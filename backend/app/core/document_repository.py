"""
Repository for storing and retrieving generated project documents
using Supabase Storage and the documents table.
"""

from fastapi import HTTPException

from app.core.supabase_client import get_supabase


BUCKET_NAME = "generated-documents"


def save_document(
    *,
    student_id: str,
    idea_id: str,
    document_type: str,
    file_name: str,
    file_bytes: bytes,
) -> dict:
    """
    Upload a generated DOCX file to Supabase Storage and create or
    update the corresponding row in the documents table.

    Storage path:
        student_id / idea_id / document_type / file_name

    There can be only one current document record for each:
        idea_id + document_type
    """

    supabase = get_supabase()

    storage_path = f"{student_id}/{idea_id}/{document_type}/{file_name}"

    try:
        # ---------------------------------------------------------
        # 1. Upload the DOCX to Supabase Storage.
        #
        # upsert=True means regenerating the same document replaces
        # the existing file instead of creating another file.
        # ---------------------------------------------------------
        supabase.storage.from_(BUCKET_NAME).upload(
            storage_path,
            file_bytes,
            {
                "content-type": (
                    "application/vnd.openxmlformats-officedocument."
                    "wordprocessingml.document"
                ),
                "upsert": "true",
            },
        )

        # ---------------------------------------------------------
        # 2. Insert OR update the document metadata.
        #
        # The database has a UNIQUE constraint on:
        #     (idea_id, document_type)
        #
        # Therefore, generating the same document again updates the
        # existing row instead of creating a duplicate.
        # ---------------------------------------------------------
        result = (
            supabase.table("documents")
            .upsert(
                {
                    "student_id": student_id,
                    "idea_id": idea_id,
                    "document_type": document_type,
                    "file_name": file_name,
                    "storage_path": storage_path,
                },
                on_conflict="idea_id,document_type",
            )
            .execute()
        )

        if not result.data:
            raise RuntimeError("Document metadata was not saved.")

        return result.data[0]

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to store document: {exc}",
        ) from exc


def get_latest_document(
    *,
    idea_id: str,
    document_type: str,
) -> dict | None:
    """
    Return the stored document metadata for one project and
    document type.
    """

    supabase = get_supabase()

    result = (
        supabase.table("documents")
        .select("*")
        .eq("idea_id", idea_id)
        .eq("document_type", document_type)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        return None

    return result.data[0]


def download_stored_document(storage_path: str) -> bytes:
    """
    Download an existing DOCX file from Supabase Storage.
    """

    supabase = get_supabase()

    try:
        return supabase.storage.from_(BUCKET_NAME).download(storage_path)

    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Stored document could not be downloaded: {exc}",
        ) from exc