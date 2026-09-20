from django.shortcuts import get_object_or_404
from django.http import JsonResponse, FileResponse, Http404, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from collections import defaultdict
import json
import os
import re
import pypdf

from .rag import get_chatbot_response
from .models import Subject, Document, ChatMessage
from . import analytics
from .quiz_engine import generate_quiz, QuizGenerationError
from .notes_engine import generate_revision_notes, build_notes_pdf, NotesGenerationError, NOTES_DIR


def _subjects_grouped():
    """Returns subjects grouped by semester as {semester: [{id, name}, ...]}."""
    subjects = Subject.objects.all().order_by('semester', 'name')
    grouped = defaultdict(list)
    for s in subjects:
        grouped[s.semester].append({"id": s.id, "name": s.name})
    return dict(grouped)


def react_app(request, *args, **kwargs):
    """Serves the React SPA index.html from frontend/dist/."""
    index_file = os.path.join(settings.BASE_DIR, 'frontend', 'dist', 'index.html')
    if os.path.exists(index_file):
        with open(index_file, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')
    return HttpResponse(
        "<h1>Frontend not built</h1><p>Please run <code>cd frontend && npm run build</code> to build the React application.</p>",
        status=503,
        content_type='text/html'
    )


def api_subjects(request):
    all_subjects = Subject.objects.all().order_by('semester', 'name')
    grouped = _subjects_grouped()
    semesters = list(grouped.keys())
    return JsonResponse({
        'semesters': semesters,
        'subjects_by_semester': grouped,
        'all_subjects': [{'id': s.id, 'name': s.name, 'semester': s.semester} for s in all_subjects]
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


def api_browse_subjects(request):
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
            'subject': {'id': subject.id, 'name': subject.name, 'semester': subject.semester},
            'count': docs.count(),
            'year_range': f"{min(years)}–{max(years)}" if years else "—",
            'exam_types': exam_types,
        })

    return JsonResponse({
        'subjects_data': subjects_data,
        'semesters': semesters,
        'selected_sem': selected_sem,
    })


def api_browse_documents(request, subject_id):
    subject = get_object_or_404(Subject, id=subject_id)
    documents = Document.objects.filter(subject=subject, doc_type='pyq').order_by('-year', 'exam_type')
    syllabus = Document.objects.filter(subject=subject, doc_type='syllabus').first()

    docs_data = [{
        'id': doc.id,
        'file_name': doc.file_name,
        'exam_type': doc.exam_type,
        'year': doc.year,
    } for doc in documents]

    syllabus_data = {
        'id': syllabus.id,
        'file_name': syllabus.file_name,
    } if syllabus else None

    return JsonResponse({
        'subject': {'id': subject.id, 'name': subject.name, 'semester': subject.semester},
        'documents': docs_data,
        'syllabus': syllabus_data,
        'count': len(docs_data)
    })


def download_document(request, doc_id):
    document = get_object_or_404(Document, id=doc_id)
    if os.path.exists(document.source_path):
        filename = f"{document.subject.name}_Syllabus.txt" if document.doc_type == 'syllabus' else document.file_name
        return FileResponse(
            open(document.source_path, 'rb'),
            as_attachment=True,
            filename=filename
        )
    elif document.doc_type == 'syllabus':
        from .syllabus_parser import get_raw_syllabus_text
        text = get_raw_syllabus_text(document.subject.name)
        if text:
            response = HttpResponse(text, content_type='text/plain; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="{document.subject.name}_Syllabus.txt"'
            return response
    raise Http404("File not found on disk.")


def download_subject_syllabus(request, subject_id):
    subject = get_object_or_404(Subject, id=subject_id)
    syl_doc = Document.objects.filter(subject=subject, doc_type='syllabus').first()
    if syl_doc and os.path.exists(syl_doc.source_path):
        return FileResponse(
            open(syl_doc.source_path, 'rb'),
            as_attachment=True,
            filename=f"{subject.name}_Syllabus.txt"
        )
    from .syllabus_parser import get_raw_syllabus_text
    text = get_raw_syllabus_text(subject.name)
    if text:
        response = HttpResponse(text, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{subject.name}_Syllabus.txt"'
        return response
    raise Http404("Syllabus not found.")


# ---------------- Knowledge Discovery ----------------

def discovery_data_api(request, subject_id):
    subject = get_object_or_404(Subject, id=subject_id)
    stats = analytics.get_knowledge_stats(subject.name)
    return JsonResponse(stats)


# ---------------- Score Predictor ----------------

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


# ---------------- Quiz Generator ----------------

@csrf_exempt
def quiz_generate_api(request):
    """
    POST /api/quiz/generate/
    Body: {"topic_description": "...", "num_questions": 10}
    Returns: {"quiz": {"title", "num_questions", "questions": [...]}}
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    topic_description = (data.get('topic_description') or '').strip()
    num_questions = data.get('num_questions', 10)

    try:
        num_questions = int(num_questions)
        num_questions = max(1, min(num_questions, 30))
    except (TypeError, ValueError):
        num_questions = 10

    if not topic_description:
        return JsonResponse({'error': 'topic_description is required'}, status=400)

    try:
        quiz = generate_quiz(topic_description, num_questions)
        return JsonResponse({'quiz': quiz})
    except QuizGenerationError as e:
        return JsonResponse({'error': str(e)}, status=502)
    except Exception as e:
        print(f"Quiz API error: {e}")
        return JsonResponse({'error': f"An error occurred: {str(e)}"}, status=500)


# ---------------- Revision Notes Generator ----------------

@csrf_exempt
def notes_generate_api(request):
    """
    POST /api/notes/generate/
    Body: {"topic": "...", "subject_id": optional int}
    Returns: {"notes": {...}, "pdf_filename": "..."}
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'Invalid JSON body'}, status=400)

    topic = (data.get('topic') or '').strip()
    subject_id = data.get('subject_id')

    if not topic:
        return JsonResponse({'error': 'topic is required'}, status=400)

    subject_name = None
    if subject_id:
        subject = Subject.objects.filter(id=subject_id).first()
        if subject:
            subject_name = subject.name

    try:
        notes_data = generate_revision_notes(topic, subject_name=subject_name)
        pdf_filename = build_notes_pdf(notes_data, topic)
        return JsonResponse({'notes': notes_data, 'pdf_filename': pdf_filename})
    except NotesGenerationError as e:
        return JsonResponse({'error': str(e)}, status=502)
    except Exception as e:
        print(f"Notes API error: {e}")
        return JsonResponse({'error': f"An error occurred: {str(e)}"}, status=500)


def download_notes_pdf(request, filename):
    """Streams a previously generated revision-notes PDF. Filename must match what build_notes_pdf produced."""
    if not re.fullmatch(r"[a-zA-Z0-9_\-]+\.pdf", filename):
        raise Http404("Invalid filename.")
    file_path = os.path.join(NOTES_DIR, filename)
    if not os.path.exists(file_path):
        raise Http404("Notes PDF not found.")
    return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=filename)