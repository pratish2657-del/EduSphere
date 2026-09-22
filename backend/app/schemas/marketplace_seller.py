from pydantic import BaseModel, ConfigDict, Field

# ============================================================
# SELLER UPI DETAILS
# ============================================================


class MarketplaceSellerCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=1,
        max_length=255,
    )

    phone: str = Field(
        min_length=7,
        max_length=30,
    )

    upi_id: str = Field(
        min_length=3,
        max_length=255,
    )


class MarketplaceSellerUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        min_length=1,
        max_length=255,
    )

    phone: str = Field(
        min_length=7,
        max_length=30,
    )

    upi_id: str = Field(
        min_length=3,
        max_length=255,
    )


class MarketplaceSellerResponse(BaseModel):
    id: int
    user_id: int

    name: str
    phone: str
    upi_id: str

    status: str