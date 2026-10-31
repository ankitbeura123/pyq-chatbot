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

class GoogleDriveIntegrationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.sem1 = Subject.objects.create(name="Mathematics-I", semester="sem 1")
        self.sem2 = Subject.objects.create(name="Mathematics-II", semester="sem 2")
        self.doc1 = Document.objects.create(
            subject=self.sem1,
            doc_type="pyq",
            file_name="2022 Endsem Mathematics.pdf",
            year=2022,
            exam_type="Endsem",
            source_path=""
        )
        self.doc2 = Document.objects.create(
            subject=self.sem2,
            doc_type="pyq",
            file_name="2022 Endsem Mathematics.pdf",
            year=2022,
            exam_type="Endsem",
            source_path=""
        )

    def test_sanitize_drive_query_string(self):
        from chatbot.gdrive import sanitize_drive_query_string
        self.assertEqual(sanitize_drive_query_string("O'Reilly"), r"O\'Reilly")
        self.assertEqual(sanitize_drive_query_string(r"path\file"), r"path\\file")
        self.assertEqual(sanitize_drive_query_string("normal_name"), "normal_name")

    @patch("chatbot.views.is_gdrive_configured", return_value=True)
    @patch("chatbot.views.locate_drive_file")
    @patch("chatbot.views.stream_drive_file_chunks")
    def test_download_document_streams_pdf_from_gdrive(self, mock_stream, mock_locate, mock_conf):
        mock_locate.return_value = {
            "id": "drive_file_123",
            "name": "2022 Endsem Mathematics.pdf",
            "size": 1024,
            "mimeType": "application/pdf"
        }
        mock_stream.return_value = iter([b"%PDF-1.4 sample content bytes"])

        res = self.client.get(f"/browse/document/{self.doc1.id}/download/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertIn("attachment", res["Content-Disposition"])
        self.assertIn("2022 Endsem Mathematics.pdf", res["Content-Disposition"])
        content = b"".join(res.streaming_content)
        self.assertTrue(content.startswith(b"%PDF-1.4"))

    @patch("chatbot.gdrive.is_gdrive_configured", return_value=True)
    @patch("chatbot.gdrive.find_child_folder")
    @patch("chatbot.gdrive.get_drive_folder_id", return_value="root_folder_id")
    @patch("chatbot.gdrive.get_drive_service")
    def test_duplicate_filenames_resolve_to_correct_subject_folders(
        self, mock_service, mock_root, mock_child_folder, mock_conf
    ):
        from chatbot.gdrive import locate_drive_file
        def folder_side_effect(service, parent_id, name):
            if parent_id == "root_folder_id":
                return "folder_sem1" if name == "sem 1" else "folder_sem2"
            if parent_id == "folder_sem1":
                return "folder_math1"
            if parent_id == "folder_sem2":
                return "folder_math2"
            return None

        mock_child_folder.side_effect = folder_side_effect

        mock_files = MagicMock()
        mock_service.return_value.files.return_value = mock_files

        def list_side_effect(q="", **kwargs):
            mock_exec = MagicMock()
            if "folder_math1" in q:
                mock_exec.execute.return_value = {"files": [{"id": "id_math1_file", "name": "2022 Endsem Mathematics.pdf", "size": 100}]}
            elif "folder_math2" in q:
                mock_exec.execute.return_value = {"files": [{"id": "id_math2_file", "name": "2022 Endsem Mathematics.pdf", "size": 200}]}
            else:
                mock_exec.execute.return_value = {"files": []}
            return mock_exec

        mock_files.list.side_effect = list_side_effect

        file1 = locate_drive_file("sem 1", "Mathematics-I", "2022 Endsem Mathematics.pdf")
        self.assertIsNotNone(file1)
        self.assertEqual(file1["id"], "id_math1_file")

        file2 = locate_drive_file("sem 2", "Mathematics-II", "2022 Endsem Mathematics.pdf")
        self.assertIsNotNone(file2)
        self.assertEqual(file2["id"], "id_math2_file")

    @patch("chatbot.views.is_gdrive_configured", return_value=False)
    def test_download_document_fallback_404_when_no_source(self, mock_conf):
        # Empty source_path, no gdrive, no chroma text
        res = self.client.get(f"/browse/document/{self.doc1.id}/download/")
        self.assertEqual(res.status_code, 404)
