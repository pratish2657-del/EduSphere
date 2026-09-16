from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    id: int
    role: str
    content: str
    created_at: str | None = None


class AIConversationResponse(BaseModel):
    conversation_id: int | None = None
    messages: list[AIChatMessage] = []


class AIAskRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    course_id: int | None = None
    context: str | None = Field(default=None, max_length=10000)
    conversation_id: int | None = None


class AIAskResponse(BaseModel):
    answer: str
    course_id: int | None = None
    context_used: bool
    ai_available: bool
    conversation_id: int | None = None


class AIClearResponse(BaseModel):
    success: bool
    conversation_id: int | None = None
