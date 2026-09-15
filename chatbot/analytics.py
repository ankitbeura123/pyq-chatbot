from collections import Counter
from .rag import collection


def _get_subject_chunks(subject_name):
    results = collection.get(
        where={"$and": [{"subject": subject_name}, {"doc_type": "pyq"}]},
        include=["metadatas"]
    )
    return results.get("metadatas", [])


def get_knowledge_stats(subject_name):
    """Aggregate real counts from ChromaDB for a subject. Unclassified excluded entirely."""
    metas = _get_subject_chunks(subject_name)

    if not metas:
        return {"total_questions": 0, "error": "No PYQ data ingested for this subject yet."}

    unit_counter = Counter(m.get("unit") for m in metas if m.get("unit") and m.get("unit") != "Unclassified")
    topic_counter = Counter(m.get("topic") for m in metas if m.get("topic") and m.get("topic") != "Unclassified")

    def sorted_pairs(counter):
        items = sorted(counter.items(), key=lambda x: x[1], reverse=True)
        return [{"label": str(k), "value": v} for k, v in items]

    classified_total = sum(unit_counter.values())

    return {
        "total_questions": len(metas),
        "classified_questions": classified_total,
        "unit_map": sorted_pairs(unit_counter),
        "topic_map": sorted_pairs(topic_counter),
    }


def get_topics_for_subject(subject_name):
    """Topic list + historical frequency — used to build the predictor's checkbox list."""
    metas = _get_subject_chunks(subject_name)
    counter = Counter(m.get("topic", "Unclassified") or "Unclassified" for m in metas)
    counter.pop("Unclassified", None)
    total = sum(counter.values())
    topics = [
        {"topic": t, "count": c, "weight_pct": round((c / total) * 100, 1) if total else 0}
        for t, c in sorted(counter.items(), key=lambda x: x[1], reverse=True)
    ]
    return topics


def predict_score(subject_name, studied_topics, total_marks=50):
    """
    Weighted prediction: each topic's historical share of past questions
    determines how much of total_marks it 'covers'. Only topics the student
    has actually studied count toward the predicted score.
    """
    topics = get_topics_for_subject(subject_name)
    if not topics:
        return {"error": "No tagged topic data for this subject yet. Run tag_units_topics first."}

    studied_set = set(studied_topics)
    total_weight = sum(t["count"] for t in topics)

    breakdown = []
    covered_weight = 0
    for t in topics:
        is_studied = t["topic"] in studied_set
        if is_studied:
            covered_weight += t["count"]
        breakdown.append({
            "topic": t["topic"],
            "weight_pct": t["weight_pct"],
            "studied": is_studied,
            "marks_contribution": round((t["count"] / total_weight) * total_marks, 2) if is_studied else 0,
        })

    predicted_score = round((covered_weight / total_weight) * total_marks, 1) if total_weight else 0

    return {
        "predicted_score": predicted_score,
        "total_marks": total_marks,
        "coverage_pct": round((covered_weight / total_weight) * 100, 1) if total_weight else 0,
        "breakdown": sorted(breakdown, key=lambda x: x["weight_pct"], reverse=True),
    }