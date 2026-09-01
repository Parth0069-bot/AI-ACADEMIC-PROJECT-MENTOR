"""
Schemas for on-demand document generation.

Documents are generated from the project's existing data and rendered
into downloadable Word documents.
"""

from enum import Enum

from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    synopsis = "synopsis"
    methodology = "methodology"
    progress_report = "progress_report"


class DocumentSection(BaseModel):
    heading: str
    body: str


class GeneratedDocumentContent(BaseModel):
    title: str
    subtitle: str = ""
    sections: list[DocumentSection] = Field(default_factory=list)