from django.test import TestCase, Client
from unittest.mock import patch, MagicMock
import json
from chatbot.models import Subject, Document, ChatMessage
from chatbot.rag import get_embedder, retrieve_relevant_chunks, ChromaOnnxEmbedder


class ChatEndpointTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.subject = Subject.objects.create(name="DBMS", semester="4th")

    def test_chat_api_get_method_not_allowed(self):
        res = self.client.get("/api/chat/")
        self.assertEqual(res.status_code, 405)
        data = res.json()
        self.assertIn("error", data)

    def test_chat_api_empty_message(self):
        res = self.client.post(
            "/api/chat/",
            data=json.dumps({"message": "", "subject": "DBMS"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertIn("error", data)

    def test_chat_api_invalid_json(self):
        res = self.client.post(
            "/api/chat/",
            data="not valid json",
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 400)
        data = res.json()
        self.assertIn("error", data)

    @patch("chatbot.views.get_chatbot_response")
    def test_chat_api_success(self, mock_get_response):
        mock_get_response.return_value = "Normalization reduces redundancy in relational schemas."
        res = self.client.post(
            "/api/chat/",
            data=json.dumps({"message": "What is normalization?", "subject": "DBMS"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("response"), "Normalization reduces redundancy in relational schemas.")
        # Verify message was logged
        self.assertTrue(ChatMessage.objects.filter(role="user").exists())
        self.assertTrue(ChatMessage.objects.filter(role="assistant").exists())

    @patch("chatbot.views.get_chatbot_response")
    def test_chat_api_error_returns_meaningful_json(self, mock_get_response):
        mock_get_response.side_effect = RuntimeError("Gemini API rate limit exceeded")
        res = self.client.post(
            "/api/chat/",
            data=json.dumps({"message": "Explain transactions", "subject": "DBMS"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 500)
        data = res.json()
        self.assertIn("error", data)
        self.assertIn("Gemini API rate limit exceeded", data["error"])

    def test_chat_stream_api_get_not_allowed(self):
        res = self.client.get("/api/chat/stream/")
        self.assertEqual(res.status_code, 405)

    @patch("chatbot.views.stream_chatbot_response")
    def test_chat_stream_api_success(self, mock_stream):
        mock_stream.return_value = iter(["Hello", " from", " Orchids AI!"])
        res = self.client.post(
            "/api/chat/stream/",
            data=json.dumps({"message": "hi", "subject": "DBMS"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "text/event-stream")
        content = b"".join(res.streaming_content).decode("utf-8")
        # Verify initial ping is sent immediately
        self.assertTrue(content.startswith(": ping\n\n"))
        self.assertIn("Hello", content)
        self.assertIn('"done": true', content)

    @patch("chatbot.views.stream_chatbot_response")
    def test_chat_stream_api_error_handling(self, mock_stream):
        mock_stream.side_effect = Exception("Model unavailable")
        res = self.client.post(
            "/api/chat/stream/",
            data=json.dumps({"message": "hi", "subject": "DBMS"}),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)
        content = b"".join(res.streaming_content).decode("utf-8")
        self.assertIn(": ping\n\n", content)
        self.assertIn('"error": "Model unavailable"', content)


class RAGRetrievalTests(TestCase):
    def test_onnx_embedder_vector_generation(self):
        embedder = get_embedder()
        self.assertIsInstance(embedder, ChromaOnnxEmbedder)
        embedding = embedder.encode("test query")
        self.assertEqual(len(embedding), 384)

    def test_rag_retrieval_runs_without_crashing(self):
        chunks, query_filters, resolved_subject = retrieve_relevant_chunks("Explain 3NF", subject_filter="DBMS")
        self.assertIsInstance(chunks, list)
        self.assertEqual(resolved_subject, "DBMS")
