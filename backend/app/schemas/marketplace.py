from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ============================================================
# PRODUCT
# ============================================================


class MarketplaceProductCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    institution_id: int = Field(gt=0)

    name: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    category: str | None = Field(
        default=None,
        max_length=100,
    )

    product_type: Literal[
        "PHYSICAL",
        "DIGITAL",
    ]

    condition_type: Literal[
        "NEW",
        "USED",
        "DIGITAL",
    ] = "NEW"

    price: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    quantity: int = Field(
        default=0,
        ge=0,
    )


class MarketplaceProductUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    category: str | None = Field(
        default=None,
        max_length=100,
    )

    product_type: Literal[
        "PHYSICAL",
        "DIGITAL",
    ]

    condition_type: Literal[
        "NEW",
        "USED",
        "DIGITAL",
    ]

    price: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
    )

    quantity: int = Field(
        ge=0,
    )

    is_active: bool = True


# ============================================================
# CART
# ============================================================


class CartItemAdd(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: int = Field(gt=0)

    quantity: int = Field(
        default=1,
        ge=1,
    )


class CartItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantity: int = Field(
        ge=1,
    )


# ============================================================
# CHECKOUT
# ============================================================


class MarketplaceCheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    institution_id: int = Field(gt=0)

    shipping_address: str | None = Field(
        default=None,
        max_length=2000,
    )


# ============================================================
# CHECKOUT PRICE RESPONSE
# ============================================================


class MarketplacePriceBreakdown(BaseModel):
    subtotal_amount: Decimal
    tax_percent: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    currency: str = "INR"