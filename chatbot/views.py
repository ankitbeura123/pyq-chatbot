from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt
import json
import os
import pypdf

from .rag import get_chatbot_response
from .models import Subject, Document, ChatMessage


def chat_page(request):
    subjects = Subject.objects.all().order_by('semester', 'name')
    return render(request, 'chatbot/chat.html', {'subjects': subjects})


@csrf_exempt
def chat_api(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body)
    user_message = data.get('message', '').strip()
    subject_filter = data.get('subject', '').strip() or None

    if not user_message:
        return JsonResponse({'error': 'Empty message'}, status=400)

    ChatMessage.objects.create(role='user', content=user_message)
    bot_response = get_chatbot_response(user_message, subject_filter=subject_filter)
    ChatMessage.objects.create(role='assistant', content=bot_response)

    return JsonResponse({'response': bot_response})


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