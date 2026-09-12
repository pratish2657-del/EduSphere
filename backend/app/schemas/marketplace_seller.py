from typing import Literal

from pydantic import BaseModel, Field


class SellerPayoutDetails(BaseModel):
    enabled: bool = False
    preferred_upi_app: Literal["GOOGLE_PAY", "PHONEPE", "PAYTM", "BHIM", "OTHER"] | None = None
    upi_id: str | None = Field(default=None, max_length=255)
    account_holder_name: str | None = Field(default=None, max_length=255)
