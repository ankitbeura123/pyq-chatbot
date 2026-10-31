"""
Google Drive API integration for Orchids ExamPrep AI.
Retrieves and streams course PDFs and syllabus files stored in Google Drive
using a Google Cloud Service Account.

Hierarchy mirrored from local archive:
  [GOOGLE_DRIVE_FOLDER_ID] (Root Folder)
    └── [Semester] (e.g., 'sem 1', 'sem 2', ...)
          └── [Subject] (e.g., 'Differential Equation & Linear Algebra')
                ├── syllabus.txt
                └── [File_Name].pdf
"""

import io
import json
import logging
import os
import re
from typing import Dict, Generator, Optional, Tuple

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

# Cache timeout in seconds for folder IDs and file metadata (default 1 hour)
GDRIVE_CACHE_TIMEOUT = 3600

# Scopes needed: Read-only access to Drive files
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

_drive_service = None


def get_service_account_credentials():
    """
    Loads Google OAuth2 Service Account Credentials from either:
    1. Raw JSON content string in GOOGLE_SERVICE_ACCOUNT_JSON
    2. Path to a JSON key file pointed to by GOOGLE_SERVICE_ACCOUNT_JSON
    """
    raw_creds = getattr(settings, 'GOOGLE_SERVICE_ACCOUNT_JSON', None) or os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON')
    if not raw_creds:
        return None

    from google.oauth2 import service_account

    raw_creds = raw_creds.strip()

    # Case 1: Raw JSON string
    if raw_creds.startswith('{') and raw_creds.endswith('}'):
        try:
            info = json.loads(raw_creds)
            return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
        except Exception as e:
            logger.error(f"Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON as JSON: {e}")
            return None

    # Case 2: File path
    if os.path.exists(raw_creds):
        try:
            return service_account.Credentials.from_service_account_file(raw_creds, scopes=SCOPES)
        except Exception as e:
            logger.error(f"Failed to load credentials from file {raw_creds}: {e}")
            return None

    logger.warning("GOOGLE_SERVICE_ACCOUNT_JSON is set but is neither valid JSON nor an existing file path.")
    return None


def get_drive_folder_id() -> Optional[str]:
    """Returns the configured root Google Drive folder ID."""
    folder_id = getattr(settings, 'GOOGLE_DRIVE_FOLDER_ID', None) or os.getenv('GOOGLE_DRIVE_FOLDER_ID')
    if folder_id:
        return folder_id.strip()
    return None


def is_gdrive_configured() -> bool:
    """Returns True if both credentials and root folder ID are configured."""
    return bool(get_drive_folder_id() and get_service_account_credentials())


def get_drive_service():
    """Returns an authenticated Google Drive API service instance (v3), reusing cached client."""
    global _drive_service
    if _drive_service is not None:
        return _drive_service

    creds = get_service_account_credentials()
    if not creds:
        return None

    try:
        from googleapiclient.discovery import build
        _drive_service = build('drive', 'v3', credentials=creds, cache_discovery=False)
        return _drive_service
    except Exception as e:
        logger.error(f"Failed to build Google Drive API service: {e}")
        return None


def sanitize_drive_query_string(value: str) -> str:
    """
    Escapes single quotes and backslashes for Google Drive API query strings.
    Prevents query injection.
    """
    if not value:
        return ""
    # In Drive API query strings, single quotes must be escaped with a backslash
    return value.replace("\\", "\\\\").replace("'", "\\'")


def find_child_folder(service, parent_id: str, folder_name: str) -> Optional[str]:
    """
    Finds a child folder with the exact or case-insensitive name inside parent_id.
    Uses in-memory / Django cache for fast repeated lookups.
    """
    cache_key = f"gdrive_folder_{parent_id}_{folder_name.lower().strip()}"
    cached_id = cache.get(cache_key)
    if cached_id:
        return cached_id

    escaped_name = sanitize_drive_query_string(folder_name.strip())
    # Exact match query
    q = (
        f"'{parent_id}' in parents and "
        f"mimeType = 'application/vnd.google-apps.folder' and "
        f"name = '{escaped_name}' and "
        f"trashed = false"
    )

    try:
        results = service.files().list(
            q=q,
            fields="files(id, name)",
            spaces='drive',
            pageSize=10
        ).execute()
        files = results.get('files', [])

        if files:
            folder_id = files[0]['id']
            cache.set(cache_key, folder_id, GDRIVE_CACHE_TIMEOUT)
            return folder_id

        # Fallback: check case-insensitively or normalized (e.g. 'Sem 1' vs 'sem 1')
        q_broad = (
            f"'{parent_id}' in parents and "
            f"mimeType = 'application/vnd.google-apps.folder' and "
            f"trashed = false"
        )
        all_children = service.files().list(
            q=q_broad,
            fields="files(id, name)",
            spaces='drive',
            pageSize=100
        ).execute().get('files', [])

        target_norm = folder_name.strip().lower()
        for child in all_children:
            if child['name'].strip().lower() == target_norm:
                cache.set(cache_key, child['id'], GDRIVE_CACHE_TIMEOUT)
                return child['id']

    except Exception as e:
        logger.error(f"Error querying Drive for folder '{folder_name}' in parent '{parent_id}': {e}")

    return None


def locate_drive_file(semester: str, subject_name: str, file_name: str) -> Optional[Dict]:
    """
    Locates a specific file within the Google Drive hierarchy:
      Root -> Semester -> Subject -> File
    Returns file metadata dict with keys: 'id', 'name', 'size', 'mimeType' or None.
    """
    service = get_drive_service()
    root_id = get_drive_folder_id()
    if not service or not root_id:
        return None

    # Cache key for this specific document file
    norm_file = file_name.strip().lower()
    cache_key = f"gdrive_file_{semester}_{subject_name}_{norm_file}".replace(" ", "_")
    cached_file = cache.get(cache_key)
    if cached_file:
        return cached_file

    # Step 1: Find Semester folder
    sem_folder_id = find_child_folder(service, root_id, semester)
    target_parent_id = None

    if sem_folder_id:
        # Step 2: Find Subject folder inside Semester folder
        subj_folder_id = find_child_folder(service, sem_folder_id, subject_name)
        if subj_folder_id:
            target_parent_id = subj_folder_id

    # Step 3: Query the file inside the resolved subject folder (or root if not found)
    escaped_fname = sanitize_drive_query_string(file_name.strip())

    if target_parent_id:
        q = f"'{target_parent_id}' in parents and name = '{escaped_fname}' and trashed = false"
        try:
            results = service.files().list(
                q=q,
                fields="files(id, name, size, mimeType)",
                spaces='drive',
                pageSize=5
            ).execute()
            files = results.get('files', [])
            if files:
                file_meta = files[0]
                cache.set(cache_key, file_meta, GDRIVE_CACHE_TIMEOUT)
                return file_meta
        except Exception as e:
            logger.error(f"Error finding file '{file_name}' in parent '{target_parent_id}': {e}")

    # Fallback search: If folder structure has slight differences, search by filename within root tree
    try:
        q_fallback = f"name = '{escaped_fname}' and trashed = false"
        results = service.files().list(
            q=q_fallback,
            fields="files(id, name, size, mimeType, parents)",
            spaces='drive',
            pageSize=10
        ).execute()
        files = results.get('files', [])
        if files:
            # Pick first matching file
            file_meta = files[0]
            cache.set(cache_key, file_meta, GDRIVE_CACHE_TIMEOUT)
            return file_meta
    except Exception as e:
        logger.error(f"Fallback search error for '{file_name}': {e}")

    return None


def stream_drive_file_chunks(file_id: str, chunk_size: int = 1024 * 1024) -> Generator[bytes, None, None]:
    """
    Streams file bytes from Google Drive in chunks (default 1MB).
    Avoids loading full large PDFs into server RAM.
    """
    service = get_drive_service()
    if not service:
        raise ValueError("Google Drive service is not configured.")

    from googleapiclient.http import MediaIoBaseDownload

    request = service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request, chunksize=chunk_size)

    done = False
    while not done:
        status, done = downloader.next_chunk()
        buffer.seek(0)
        data = buffer.read()
        buffer.seek(0)
        buffer.truncate(0)
        if data:
            yield data
