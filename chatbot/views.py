from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

from .rag import get_chatbot_response
from .models import Subject, ChatMessage


def chat_page(request):
    """Renders the main chat UI."""
    subjects = Subject.objects.all().order_by('semester', 'name')
    return render(request, 'chatbot/chat.html', {'subjects': subjects})


@csrf_exempt
def chat_api(request):
    """Handles AJAX requests from the chat UI."""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    data = json.loads(request.body)
    user_message = data.get('message', '').strip()
    subject_filter = data.get('subject', '').strip() or None

    if not user_message:
        return JsonResponse({'error': 'Empty message'}, status=400)

    # Save user message
    ChatMessage.objects.create(role='user', content=user_message)

    # Get bot response
    bot_response = get_chatbot_response(user_message, subject_filter=subject_filter)

    # Save bot response
    ChatMessage.objects.create(role='assistant', content=bot_response)

    return JsonResponse({'response': bot_response})