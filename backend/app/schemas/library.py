from pydantic import BaseModel, Field

RESOURCE_TYPES = ("BOOK", "MATERIAL", "EBOOK", "NOTE", "PDF", "OTHER")
RESOURCE_STATUSES = ("DRAFT", "PUBLISHED", "ARCHIVED")


class LibraryResourceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    resource_type: str
    institution_id: int = Field(gt=0)
    author: str | None = None
    isbn: str | None = None
    category: str | None = None
    subject: str | None = None
    description: str | None = None
    language: str | None = None
    publication_year: int | None = None
    tags: str | None = None
    status: str = "PUBLISHED"
    featured: bool = False


class LibraryResourceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    resource_type: str | None = None
    institution_id: int | None = Field(default=None, gt=0)
    author: str | None = None
    isbn: str | None = None
    category: str | None = None
    subject: str | None = None
    description: str | None = None
    language: str | None = None
    publication_year: int | None = None
    tags: str | None = None
    status: str | None = None
    featured: bool | None = None
