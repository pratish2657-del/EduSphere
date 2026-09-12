from pydantic import BaseModel, Field


class InstitutionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    university_code: str = Field(min_length=1, max_length=100)


class InstitutionUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    university_code: str = Field(min_length=1, max_length=100)
