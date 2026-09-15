from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt
from collections import defaultdict
import json
import os
import pypdf

from .rag import get_chatbot_response
from .models import Subject, Document, ChatMessage
from . import analytics


def _subjects_grouped():
    """Returns subjects grouped by semester as {semester: [{id, name}, ...]}."""
    subjects = Subject.objects.all().order_by('semester', 'name')
    grouped = defaultdict(list)
    for s in subjects:
        grouped[s.semester].append({"id": s.id, "name": s.name})
    return dict(grouped)


def chat_page(request):
    subjects = Subject.objects.all().order_by('semester', 'name')
    return render(request, 'chatbot/chat.html', {
        'subjects': subjects,
        'subjects_by_semester_json': json.dumps(_subjects_grouped()),
    })


@csrf_exempt
def chat_api(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    user_message = data.get('message', '').strip()
    subject_filter = data.get('subject', '').strip() or None

    if not user_message:
        return JsonResponse({'error': 'Empty message'}, status=400)

    try:
        subj_obj = Subject.objects.filter(name=subject_filter).first() if subject_filter else None
        ChatMessage.objects.create(role='user', content=user_message, subject=subj_obj)
        bot_response = get_chatbot_response(user_message, subject_filter=subject_filter)
        ChatMessage.objects.create(role='assistant', content=bot_response, subject=subj_obj)
        return JsonResponse({'response': bot_response})
    except Exception as e:
        print(f"Chat API error: {e}")
        return JsonResponse({'error': f"An error occurred: {str(e)}"}, status=500)


def browse_subjects(request):
    all_subjects = Subject.objects.all().order_by('semester', 'name')
    semesters = list(dict.fromkeys(all_subjects.values_list('semester', flat=True)))
    selected_sem = request.GET.get('sem') or (semesters[0] if semesters else None)

    filtered = all_subjects.filter(semester=selected_sem) if selected_sem else all_subjects

    subjects_data = []
    for subject in filtered:
        docs = subject.documents.filter(doc_type='pyq')
        years = [d.year for d in docs if d.year]
        exam_types = sorted(set(d.exam_type for d in docs if d.exam_type))
        subjects_data.append({
            'subject': subject,
            'count': docs.count(),
            'year_range': f"{min(years)}–{max(years)}" if years else "—",
            'exam_types': exam_types,
        })

    return render(request, 'chatbot/browse_subjects.html', {
        'subjects_data': subjects_data,
        'semesters': semesters,
        'selected_sem': selected_sem,
    })


def browse_documents(request, subject_id):
    subject = get_object_or_404(Subject, id=subject_id)
    documents = Document.objects.filter(subject=subject, doc_type='pyq').order_by('-year', 'exam_type')
    syllabus = Document.objects.filter(subject=subject, doc_type='syllabus').first()
    return render(request, 'chatbot/browse_documents.html', {
        'subject': subject, 'documents': documents, 'syllabus': syllabus
    })


def download_document(request, doc_id):
    document = get_object_or_404(Document, id=doc_id)
    if not os.path.exists(document.source_path):
        raise Http404("File not found on disk.")
    return FileResponse(
        open(document.source_path, 'rb'),
        as_attachment=True,
        filename=document.file_name
    )


def view_document(request, doc_id):
    document = get_object_or_404(Document, id=doc_id)
    text = ""
    try:
        reader = pypdf.PdfReader(document.source_path)
        for page in reader.pages:
            text += (page.extract_text() or "") + "\n\n"
        if not text.strip():
            text = "(This is a scanned document — text preview not available here.)"
    except Exception as e:
        text = f"Could not load file: {e}"
    return render(request, 'chatbot/view_document.html', {'document': document, 'text': text})


# ---------------- Knowledge Discovery ----------------

def knowledge_discovery_page(request):
    subjects = Subject.objects.all().order_by('semester', 'name')
    return render(request, 'chatbot/knowledge_discovery.html', {
        'subjects': subjects,
        'subjects_by_semester_json': json.dumps(_subjects_grouped()),
    })


def discovery_data_api(request, subject_id):
    subject = get_object_or_404(Subject, id=subject_id)
    stats = analytics.get_knowledge_stats(subject.name)
    return JsonResponse(stats)


# ---------------- Score Predictor ----------------

def score_predictor_page(request):
    subjects = Subject.objects.all().order_by('semester', 'name')
    return render(request, 'chatbot/score_predictor.html', {
        'subjects': subjects,
        'subjects_by_semester_json': json.dumps(_subjects_grouped()),
    })


def topics_api(request, subject_id):
    subject = get_object_or_404(Subject, id=subject_id)
    topics = analytics.get_topics_for_subject(subject.name)
    return JsonResponse({'topics': topics})


@csrf_exempt
def predict_score_api(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)
    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    subject_id = data.get('subject_id')
    studied_topics = data.get('studied_topics', [])
    total_marks = data.get('total_marks', 50)

    subject = get_object_or_404(Subject, id=subject_id)
    result = analytics.predict_score(subject.name, studied_topics, total_marks=total_marks)
    return JsonResponse(result)