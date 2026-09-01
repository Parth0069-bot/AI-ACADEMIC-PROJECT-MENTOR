"""
Endpoints for turning student project documents into searchable
vector embeddings, and querying them.
"""

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.document import DocumentType
from app.schemas.embedding import (
    ProcessDocumentRequest,
    ProcessDocumentResponse,
    SemanticSearchRequest,
    SemanticSearchResponse,
    SemanticSearchResult,
)
from app.services.embedding_service import (
    embed_query,
    process_document_for_embeddings,
)
from app.core.embedding_repository import search_similar_chunks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


@router.post("/process/{document_type}/{idea_id}", response_model=ProcessDocumentResponse)
def process_document(
    document_type: DocumentType,
    idea_id: str,
    body: ProcessDocumentRequest | None = None,
):
    """
    Chunk + embed a project document and store the vectors in
    Supabase (pgvector).

    If `text` is provided in the body, that text is embedded
    directly. Otherwise, the latest stored DOCX of this type for
    `idea_id` is downloaded from Supabase Storage and its text is
    extracted automatically.
    """

    text = body.text if body else None

    try:
        result = process_document_for_embeddings(
            idea_id=idea_id,
            document_type=document_type.value,
            text=text,
        )

    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Embedding pipeline failed")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate embeddings: {exc}",
        ) from exc

    return ProcessDocumentResponse(**result)


@router.post("/search", response_model=SemanticSearchResponse)
def semantic_search(body: SemanticSearchRequest):
    """
    Finds the most semantically similar document chunks for a
    project, using cosine similarity over pgvector embeddings.
    """

    try:
        query_embedding = embed_query(body.query)

        rows = search_similar_chunks(
            idea_id=body.idea_id,
            query_embedding=query_embedding,
            match_count=body.match_count,
            document_type=body.document_type,
        )

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Semantic search failed")
        raise HTTPException(
            status_code=500,
            detail=f"Semantic search failed: {exc}",
        ) from exc

    return SemanticSearchResponse(
        query=body.query,
        results=[SemanticSearchResult(**row) for row in rows],
    )
