from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.http import FileResponse, Http404
import os
import json
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
    subjects = Subject.objects.all().order_by('semester', 'name')
    return render(request, 'chatbot/browse_subjects.html', {'subjects': subjects})


def browse_documents(request, subject_id):
    subject = get_object_or_404(Subject, id=subject_id)
    documents = Document.objects.filter(subject=subject, doc_type='pyq').order_by('-year', 'exam_type')
    syllabus = Document.objects.filter(subject=subject, doc_type='syllabus').first()
    return render(request, 'chatbot/browse_documents.html', {
        'subject': subject, 'documents': documents, 'syllabus': syllabus
    })

def download_document(request, doc_id):
    """Serve the original PDF file for download."""
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
            text = "(This is a scanned document — text preview not available here. OCR text is stored in the chatbot's search index, not shown live.)"
    except Exception as e:
        text = f"Could not load file: {e}"
    return render(request, 'chatbot/view_document.html', {'document': document, 'text': text})