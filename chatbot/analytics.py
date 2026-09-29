from collections import Counter
from .rag import collection
from .syllabus_parser import parse_syllabus_structure


def _get_subject_chunks(subject_name):
    results = collection.get(
        where={"$and": [{"subject": subject_name}, {"doc_type": "pyq"}]},
        include=["metadatas"]
    )
    return results.get("metadatas", [])


def get_knowledge_stats(subject_name):
    """Aggregate real counts from ChromaDB for a subject grouped hierarchically under syllabus units."""
    metas = _get_subject_chunks(subject_name)

    if not metas:
        return {"total_questions": 0, "error": "No PYQ data ingested for this subject yet."}

    # Fetch parsed syllabus structure for this subject
    try:
        syl_structure = parse_syllabus_structure(subject_name)
    except Exception:
        syl_structure = {"units": []}

    syl_units = syl_structure.get("units", [])

    # Count real chunks from ChromaDB
    unit_counter = Counter()
    topic_counter = Counter()
    unit_topic_counter = Counter()

    for m in metas:
        u = m.get("unit")
        t = m.get("topic")
        if u and u != "Unclassified":
            unit_counter[u] += 1
        if t and t != "Unclassified":
            topic_counter[t] += 1
        if u and t and u != "Unclassified" and t != "Unclassified":
            unit_topic_counter[(u, t)] += 1

    classified_total = sum(unit_counter.values()) or sum(topic_counter.values()) or 1

    # Topic lookup helper (case-insensitive & trimmed)
    topic_norm_map = {}
    for (u, t), c in unit_topic_counter.items():
        topic_norm_map[(u.strip().lower(), t.strip().lower())] = c
    for t, c in topic_counter.items():
        topic_norm_map[t.strip().lower()] = c

    structured_units = []
    all_seen_topics = set()
    all_topics_list = []

    # If we have official syllabus units, map them
    if syl_units:
        for idx, u_obj in enumerate(syl_units):
            u_name = u_obj.get("unit", f"Unit {idx + 1}")
            u_title = u_obj.get("title", "")
            raw_topics = u_obj.get("topics", [])

            # Full display label
            display_label = f"{u_name}: {u_title}" if u_title else u_name

            # Topics under this unit
            unit_topics_data = []
            unit_q_count = 0

            for t_name in raw_topics:
                # Find matching count
                c = unit_topic_counter.get((u_name, t_name), 0)
                if not c:
                    c = topic_norm_map.get((u_name.strip().lower(), t_name.strip().lower()), 0)
                if not c:
                    c = topic_norm_map.get(t_name.strip().lower(), 0)

                weight_pct = round((c / classified_total) * 100, 1) if classified_total else 0
                topic_info = {
                    "name": t_name,
                    "label": t_name,
                    "count": c,
                    "value": c,
                    "weight_pct": weight_pct,
                    "unit": u_name,
                    "unit_title": u_title
                }
                unit_topics_data.append(topic_info)
                all_topics_list.append(topic_info)
                all_seen_topics.add(t_name.strip().lower())
                unit_q_count += c

            # Any extra ChromaDB topics tagged under this unit
            for (u_tag, t_tag), c in unit_topic_counter.items():
                if (u_tag == u_name or u_tag.startswith(u_name)) and t_tag.strip().lower() not in all_seen_topics:
                    weight_pct = round((c / classified_total) * 100, 1) if classified_total else 0
                    topic_info = {
                        "name": t_tag,
                        "label": t_tag,
                        "count": c,
                        "value": c,
                        "weight_pct": weight_pct,
                        "unit": u_name,
                        "unit_title": u_title
                    }
                    unit_topics_data.append(topic_info)
                    all_topics_list.append(topic_info)
                    all_seen_topics.add(t_tag.strip().lower())
                    unit_q_count += c

            # Check direct unit count
            direct_u_count = unit_counter.get(u_name, 0)
            if not direct_u_count:
                for k, v in unit_counter.items():
                    if k.startswith(u_name):
                        direct_u_count += v
            final_unit_count = max(unit_q_count, direct_u_count)
            unit_weight_pct = round((final_unit_count / classified_total) * 100, 1) if classified_total else 0

            unit_entry = {
                "unit": u_name,
                "title": u_title,
                "label": display_label,
                "value": final_unit_count,
                "total_questions": final_unit_count,
                "weight_pct": unit_weight_pct,
                "topics": sorted(unit_topics_data, key=lambda x: x["count"], reverse=True)
            }
            structured_units.append(unit_entry)

    else:
        # Fallback if no syllabus cache exists
        for u_name, u_count in unit_counter.most_common():
            unit_topics = []
            for (u, t), c in unit_topic_counter.items():
                if u == u_name:
                    weight_pct = round((c / classified_total) * 100, 1)
                    topic_info = {
                        "name": t,
                        "label": t,
                        "count": c,
                        "value": c,
                        "weight_pct": weight_pct,
                        "unit": u_name
                    }
                    unit_topics.append(topic_info)
                    all_topics_list.append(topic_info)

            unit_weight_pct = round((u_count / classified_total) * 100, 1)
            unit_entry = {
                "unit": u_name,
                "title": "",
                "label": u_name,
                "value": u_count,
                "total_questions": u_count,
                "weight_pct": unit_weight_pct,
                "topics": sorted(unit_topics, key=lambda x: x["count"], reverse=True)
            }
            structured_units.append(unit_entry)

    # Sort units by question frequency / value descending
    structured_units_sorted = sorted(structured_units, key=lambda x: x["value"], reverse=True)
    all_topics_sorted = sorted(all_topics_list, key=lambda x: x["count"], reverse=True)

    # Dedup all_topics_sorted by name while preserving highest count
    seen_topic_names = set()
    deduped_topics = []
    for t in all_topics_sorted:
        key = (t["unit"], t["name"].strip().lower())
        if key not in seen_topic_names:
            seen_topic_names.add(key)
            deduped_topics.append(t)

    return {
        "total_questions": len(metas),
        "classified_questions": classified_total,
        "syllabus_units": structured_units,
        "unit_map": structured_units_sorted,
        "topic_map": deduped_topics,
    }


def get_topics_for_subject(subject_name):
    """Topic list + historical frequency — used to build the predictor's checkbox list."""
    stats = get_knowledge_stats(subject_name)
    topic_map = stats.get("topic_map", [])
    if topic_map:
        return [
            {
                "topic": t["name"],
                "name": t["name"],
                "count": t.get("count", 0),
                "weight_pct": t.get("weight_pct", 0),
                "unit": t.get("unit", ""),
                "unit_title": t.get("unit_title", "")
            }
            for t in topic_map
        ]

    # Fallback to direct Chroma count
    metas = _get_subject_chunks(subject_name)
    counter = Counter(m.get("topic", "Unclassified") or "Unclassified" for m in metas)
    counter.pop("Unclassified", None)
    total = sum(counter.values())
    topics = [
        {
            "topic": t,
            "name": t,
            "count": c,
            "weight_pct": round((c / total) * 100, 1) if total else 0,
            "unit": "General",
            "unit_title": ""
        }
        for t, c in sorted(counter.items(), key=lambda x: x[1], reverse=True)
    ]
    return topics


def predict_score(subject_name, studied_topics, total_marks=50):
    """
    Weighted prediction: each topic's historical share of past questions
    determines how much of total_marks it 'covers'. Only topics the student
    has actually studied count toward the predicted score.
    """
    stats = get_knowledge_stats(subject_name)
    units = stats.get("syllabus_units") or stats.get("unit_map") or []
    topics = get_topics_for_subject(subject_name)
    if not topics:
        return {"error": "No tagged topic data for this subject yet. Run tag_units_topics first."}

    studied_set = set(studied_topics)
    total_weight = sum(t["count"] for t in topics)
    if total_weight == 0:
        total_weight = len(topics) or 1

    covered_weight = 0
    breakdown = []
    
    # Calculate unit summaries
    unit_summaries = []
    for u in units:
        u_name = u.get("unit", "")
        u_title = u.get("title", "")
        u_topics = u.get("topics", [])
        u_total_topics = len(u_topics)
        u_studied_topics = [t for t in u_topics if (t.get("name") in studied_set or t.get("topic") in studied_set)]
        u_total_count = sum(t.get("count", 0) for t in u_topics)
        u_studied_count = sum(t.get("count", 0) for t in u_studied_topics)
        
        # Max marks this unit can contribute
        if total_weight and u_total_count > 0:
            u_max_marks = round((u_total_count / total_weight) * total_marks, 2)
            u_scored_marks = round((u_studied_count / total_weight) * total_marks, 2)
        else:
            u_max_marks = round((u.get("weight_pct", 0) / 100) * total_marks, 2)
            u_scored_marks = round((len(u_studied_topics) / u_total_topics * u_max_marks), 2) if u_total_topics else 0
            
        unit_summaries.append({
            "unit": u_name,
            "title": u_title,
            "label": u.get("label") or f"{u_name}: {u_title}".strip(": "),
            "total_topics": u_total_topics,
            "studied_topics_count": len(u_studied_topics),
            "unit_weight_pct": u.get("weight_pct", 0),
            "max_marks": u_max_marks,
            "scored_marks": u_scored_marks,
            "coverage_pct": round((len(u_studied_topics) / u_total_topics) * 100, 1) if u_total_topics else 0,
        })

    for t in topics:
        t_name = t.get("topic") or t.get("name")
        is_studied = t_name in studied_set
        if is_studied:
            covered_weight += t.get("count", 0)
        breakdown.append({
            "topic": t_name,
            "unit": t.get("unit", ""),
            "unit_title": t.get("unit_title", ""),
            "weight_pct": t.get("weight_pct", 0),
            "count": t.get("count", 0),
            "studied": is_studied,
            "marks_contribution": round((t.get("count", 0) / total_weight) * total_marks, 2) if is_studied and total_weight else 0,
        })

    predicted_score = round((covered_weight / total_weight) * total_marks, 1) if total_weight else 0

    return {
        "predicted_score": min(total_marks, predicted_score),
        "total_marks": total_marks,
        "coverage_pct": round((covered_weight / total_weight) * 100, 1) if total_weight else 0,
        "breakdown": sorted(breakdown, key=lambda x: (x["unit"], -x["weight_pct"])),
        "unit_breakdown": unit_summaries,
    }