from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_page, name='chat_page'),
    path('api/chat/', views.chat_api, name='chat_api'),
    path('browse/', views.browse_subjects, name='browse_subjects'),
    path('browse/subject/<int:subject_id>/', views.browse_documents, name='browse_documents'),
    path('browse/document/<int:doc_id>/', views.view_document, name='view_document'),
    path('browse/document/<int:doc_id>/download/', views.download_document, name='download_document'),

    # Knowledge Discovery
    path('discover/', views.knowledge_discovery_page, name='knowledge_discovery_page'),
    path('api/discover/<int:subject_id>/', views.discovery_data_api, name='discovery_data_api'),

    # Score Predictor
    path('predict/', views.score_predictor_page, name='score_predictor_page'),
    path('api/predict/topics/<int:subject_id>/', views.topics_api, name='topics_api'),
    path('api/predict/score/', views.predict_score_api, name='predict_score_api'),
]