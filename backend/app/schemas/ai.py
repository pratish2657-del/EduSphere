
from pydantic import BaseModel, Field

# ============================================================
# AI ASK REQUEST
# ============================================================


class AIAskRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)

    course_id: int | None = None

    context: str | None = Field(default=None, max_length=10000)


# ============================================================
# AI ASK RESPONSE
# ============================================================


class AIAskResponse(BaseModel):
    answer: str

    course_id: int | None = None

    context_used: bool

    ai_available: bool
