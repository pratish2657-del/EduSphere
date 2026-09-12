
from pydantic import BaseModel, Field

RESOURCE_TYPES = {
    "BOOK", "MATERIAL", "EBOOK", "NOTE", "PDF", "OTHER"
}
RESOURCE_STATUSES = {"DRAFT", "PUBLISHED", "ARCHIVED"}


class LibraryResourceCreate(BaseModel):
    institution_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=255)
    resource_type: str = Field(min_length=1, max_length=30)
    author: str | None = Field(default=None, max_length=255)
    isbn: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=150)
    subject: str | None = Field(default=None, max_length=150)
    description: str | None = None
    language: str | None = Field(default=None, max_length=100)
    publication_year: int | None = None
    tags: str | None = None
    status: str = Field(default="DRAFT", max_length=30)
    featured: bool = False


class LibraryResourceUpdate(BaseModel):
    institution_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    resource_type: str | None = Field(default=None, max_length=30)
    author: str | None = Field(default=None, max_length=255)
    isbn: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=150)
    subject: str | None = Field(default=None, max_length=150)
    description: str | None = None
    language: str | None = Field(default=None, max_length=100)
    publication_year: int | None = None
    tags: str | None = None
    status: str | None = Field(default=None, max_length=30)
    featured: bool | None = None


class DeveloperVerificationDecision(BaseModel):
    status: str
    remarks: str | None = None
