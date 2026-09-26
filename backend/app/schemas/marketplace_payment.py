from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ============================================================
# CREATE PAYMENT
# ============================================================


class MarketplacePaymentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: int = Field(gt=0)


# ============================================================
# SUBMIT UPI PAYMENT
# ============================================================
#
# Buyer has already paid directly through Google Pay / UPI.
# This only submits the transaction information.
#
# It DOES NOT mark payment as PAID.
#


class MarketplaceUPIPaymentSubmit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    utr_number: str = Field(
        min_length=6,
        max_length=100,
    )

    payer_upi_id: str = Field(
        min_length=3,
        max_length=255,
    )

    payer_phone: str = Field(
        min_length=7,
        max_length=30,
    )


# ============================================================
# PAYMENT RESPONSE
# ============================================================


class MarketplacePaymentResponse(BaseModel):
    payment_id: int
    order_id: int

    payment_method: Literal["UPI", "COD"]
    status: Literal[
        "PENDING",
        "PAID",
        "REJECTED",
    ]

    amount: Decimal
    currency: str = "INR"

    upi_id: str
    payment_name: str
    payment_phone: str

    utr_number: str | None = None
    payer_upi_id: str | None = None
    payer_phone: str | None = None

    submitted_at: str | None = None
    verified_at: str | None = None


# ============================================================
# ADMIN PAYMENT VERIFICATION
# ============================================================


class MarketplacePaymentVerify(BaseModel):
    model_config = ConfigDict(extra="forbid")

    payment_id: int = Field(gt=0)


# ============================================================
# ADMIN PAYMENT REJECTION
# ============================================================


class MarketplacePaymentReject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    payment_id: int = Field(gt=0)

    reason: str = Field(
        min_length=3,
        max_length=1000,
    )