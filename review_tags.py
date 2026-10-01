import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "examprep.settings")
django.setup()

from chatbot.models import Subject
from chatbot.rag import collection
from collections import Counter

FLAG_THRESHOLD_PCT = 15  # subjects with more than this % Unclassified get flagged

print("=" * 70)
print("TAGGING QUALITY REVIEW")
print("=" * 70)

flagged = []
subjects = Subject.objects.all().order_by('semester', 'name')

for subject in subjects:
    results = collection.get(
        where={"$and": [{"subject": {"$eq": subject.name}}, {"doc_type": {"$eq": "pyq"}}]},
        include=["metadatas"]
    )
    metas = results["metadatas"]
    total = len(metas)

    if total == 0:
        print(f"\n[{subject.semester}] {subject.name} — NO PYQ CHUNKS FOUND")
        continue

    unit_counts = Counter(m.get("unit", "Unclassified") or "Unclassified" for m in metas)
    topic_counts = Counter(m.get("topic", "Unclassified") or "Unclassified" for m in metas)
    untagged = sum(1 for m in metas if not m.get("unit"))  # never even got a unit field written
    unclassified = unit_counts.get("Unclassified", 0)
    bad = untagged + unclassified
    bad_pct = round((bad / total) * 100, 1)

    flag = " ⚠️  FLAGGED" if bad_pct > FLAG_THRESHOLD_PCT else ""
    if flag:
        flagged.append((subject.name, bad_pct))

    print(f"\n[{subject.semester}] {subject.name}{flag}")
    print(f"  Total chunks: {total} | Unclassified/untagged: {bad} ({bad_pct}%)")
    print(f"  Units found: {len([u for u in unit_counts if u != 'Unclassified'])}")
    print(f"  Topics found: {len([t for t in topic_counts if t != 'Unclassified'])}")
    top_units = [f"{u}({c})" for u, c in unit_counts.most_common(5)]
    print(f"  Top units: {', '.join(top_units)}")

print("\n" + "=" * 70)
if flagged:
    print(f"NEEDS ATTENTION ({len(flagged)} subjects over {FLAG_THRESHOLD_PCT}% unclassified):")
    for name, pct in sorted(flagged, key=lambda x: -x[1]):
        print(f"  - {name}: {pct}% unclassified")
    print("\nFix with:")
    print('  python manage.py tag_units_topics --subject "<name>" --force')
else:
    print("All subjects look clean — no flags.")
print("=" * 70)