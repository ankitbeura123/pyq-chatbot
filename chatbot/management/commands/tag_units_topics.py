from django.core.management.base import BaseCommand
from chatbot.models import Subject
from chatbot.rag import collection
from chatbot.syllabus_parser import parse_syllabus_structure, flat_topic_list
from chatbot.gemini_utils import call_gemini_json

BATCH_SIZE = 12


class Command(BaseCommand):
    help = "Classify each ingested PYQ chunk in ChromaDB into a unit + topic, using the subject's real syllabus."

    def add_arguments(self, parser):
        parser.add_argument("--subject", type=str, default=None, help="Only tag this subject name")
        parser.add_argument("--force", action="store_true", help="Re-tag chunks that already have a unit/topic")

    def handle(self, *args, **options):
        subject_filter = options.get("subject")
        force = options.get("force")

        subjects = Subject.objects.all()
        if subject_filter:
            subjects = subjects.filter(name=subject_filter)

        for subject in subjects:
            self.stdout.write(f"\n=== {subject.semester} / {subject.name} ===")

            try:
                structure = parse_syllabus_structure(subject.name)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Syllabus parse failed, skipping subject: {e}"))
                continue

            topics = flat_topic_list(structure)
            if not topics:
                self.stdout.write(self.style.WARNING("  No syllabus structure found — skipping."))
                continue

            topic_menu = "\n".join(f"- {u} :: {t}" for u, t in topics)

            results = collection.get(
                where={"$and": [{"subject": subject.name}, {"doc_type": "pyq"}]},
                include=["documents", "metadatas"]
            )
            ids = results["ids"]
            docs = results["documents"]
            metas = results["metadatas"]

            if not ids:
                self.stdout.write("  No PYQ chunks found.")
                continue

            if not force:
                pending = [(i, d, m) for i, d, m in zip(ids, docs, metas) if not m.get("unit")]
            else:
                pending = list(zip(ids, docs, metas))

            self.stdout.write(f"  {len(pending)} chunks to tag (of {len(ids)} total)")

            for batch_start in range(0, len(pending), BATCH_SIZE):
                batch = pending[batch_start:batch_start + BATCH_SIZE]
                questions_block = "\n\n".join(
                    f"[{idx}] {doc[:600]}" for idx, (cid, doc, meta) in enumerate(batch)
                )

                prompt = f"""You are classifying exam questions against a course syllabus.

Syllabus units and topics for this subject:
{topic_menu}

Below are exam question chunks, each labeled with an index in brackets like [0], [1], etc.

{questions_block}

For EACH indexed question, pick the SINGLE best-matching unit and topic from the syllabus
list above. If a question genuinely doesn't match anything in the list, use "Unclassified"
for both fields.

Respond with ONLY valid JSON, no markdown fences, in this exact shape:
{{"results": [{{"index": 0, "unit": "Unit 1", "topic": "<topic text>"}}, ...]}}
"""
                try:
                    parsed = call_gemini_json(prompt)
                    results_list = parsed.get("results", []) if isinstance(parsed, dict) else (parsed if isinstance(parsed, list) else [])
                    tag_map = {}
                    for r in results_list:
                        if isinstance(r, dict) and "index" in r:
                            try:
                                tag_map[int(r["index"])] = (r.get("unit", "Unclassified"), r.get("topic", "Unclassified"))
                            except (ValueError, TypeError):
                                pass
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"    Batch failed permanently, skipping: {e}"))
                    continue

                update_ids, update_metas = [], []
                for idx, (cid, doc, meta) in enumerate(batch):
                    unit, topic = tag_map.get(idx, ("Unclassified", "Unclassified"))
                    new_meta = dict(meta)
                    new_meta["unit"] = unit
                    new_meta["topic"] = topic
                    update_ids.append(cid)
                    update_metas.append(new_meta)

                collection.update(ids=update_ids, metadatas=update_metas)
                self.stdout.write(f"    Tagged batch {batch_start}-{batch_start+len(batch)}")

        self.stdout.write(self.style.SUCCESS("\nDone tagging."))