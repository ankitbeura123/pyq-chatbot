import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "examprep.settings")
django.setup()

from django.core.management import call_command

FLAGGED_SUBJECTS = [
    "physics",
    "Differential Equation & Linear Algebra",
    "Cybersecurity",
    "Scientific and Technical Writing",
    "Natural Language Processing",
    "Human Computer Interaction",
    "Computational Intelligence",
    "Data and Algorithm Analysis",
    "Science of Public Health",
    "Computer Network",
    "Object oriented Programming Java",
    "Basic Electrical Engineering",
    "Deep Learning",
]

for name in FLAGGED_SUBJECTS:
    print(f"\n{'='*60}\nRe-tagging: {name}\n{'='*60}")
    try:
        call_command("tag_units_topics", subject=name, force=True)
    except Exception as e:
        print(f"FAILED on {name}: {e}")
        continue

print("\nAll flagged subjects re-tagged. Run review_tags.py again to confirm.")