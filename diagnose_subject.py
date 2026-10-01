import os
import django
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "examprep.settings")
django.setup()

from chatbot.rag import collection

SUBJECT_NAME = "physics"  # change this

# 1. Show the parsed syllabus structure
cache_path = os.path.join("syllabus_cache", "".join(c if c.isalnum() else "_" for c in SUBJECT_NAME) + ".json")
print("=" * 70)
print(f"SYLLABUS STRUCTURE for {SUBJECT_NAME}")
print("=" * 70)
if os.path.exists(cache_path):
    with open(cache_path, "r", encoding="utf-8") as f:
        structure = json.load(f)
    for unit in structure.get("units", []):
        print(f"\n{unit.get('unit')}: {unit.get('title')}")
        for t in unit.get("topics", []):
            print(f"   - {t}")
else:
    print("NO CACHE FILE FOUND — syllabus was never parsed!")

# 2. Show the actual unclassified question chunks
print("\n" + "=" * 70)
print(f"UNCLASSIFIED QUESTIONS for {SUBJECT_NAME}")
print("=" * 70)
results = collection.get(
    where={"$and": [{"subject": {"$eq": SUBJECT_NAME}}, {"doc_type": {"$eq": "pyq"}}]},
    include=["documents", "metadatas"]
)
count = 0
for doc, meta in zip(results["documents"], results["metadatas"]):
    if not meta.get("unit") or meta.get("unit") == "Unclassified":
        count += 1
        print(f"\n[{count}] Q{meta.get('question_number')} (year {meta.get('year')}):")
        print(f"   {doc[:200]}")

print(f"\n\nTotal unclassified: {count}")