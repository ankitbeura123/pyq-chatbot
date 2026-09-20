from django.urls import path, re_path
from . import views

urlpatterns = [
    # API Routes
    path('api/subjects/', views.api_subjects, name='api_subjects'),
    path('api/chat/', views.chat_api, name='chat_api'),
    path('api/browse/', views.api_browse_subjects, name='api_browse_subjects'),
    path('api/browse/subject/<int:subject_id>/', views.api_browse_documents, name='api_browse_documents'),

    # Knowledge Discovery API
    path('api/discover/<int:subject_id>/', views.discovery_data_api, name='discovery_data_api'),

    # Score Predictor API
    path('api/predict/topics/<int:subject_id>/', views.topics_api, name='topics_api'),
    path('api/predict/score/', views.predict_score_api, name='predict_score_api'),

    # Quiz Generator API
    path('api/quiz/generate/', views.quiz_generate_api, name='quiz_generate_api'),

    # Revision Notes Generator API
    path('api/notes/generate/', views.notes_generate_api, name='notes_generate_api'),
    path('notes/download/<str:filename>/', views.download_notes_pdf, name='download_notes_pdf'),

    # Document download
    path('browse/document/<int:doc_id>/download/', views.download_document, name='download_document'),
    path('browse/subject/<int:subject_id>/syllabus/download/', views.download_subject_syllabus, name='download_subject_syllabus'),

    # Catch-all to serve the React SPA
    re_path(r'^(?!api/|admin/|static/|browse/document/\d+/download|browse/subject/\d+/syllabus/download|notes/download/).*$', views.react_app, name='react_app'),
]