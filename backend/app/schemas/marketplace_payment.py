from pydantic import BaseModel, Field

# ============================================================
# CREATE PAYMENT
# ============================================================


class MarketplacePaymentCreate(BaseModel):
    order_id: int


# ============================================================
# PAYMENT VERIFICATION
# ============================================================


class MarketplacePaymentVerify(BaseModel):
    order_id: int
    gateway_order_id: str = Field(min_length=1, max_length=255)
    gateway_payment_id: str | None = Field(default=None, max_length=255)
    gateway_signature: str | None = Field(default=None, max_length=500)
