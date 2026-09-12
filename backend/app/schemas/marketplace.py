from pydantic import BaseModel, Field

# ============================================================
# CREATE PRODUCT
# ============================================================


class MarketplaceProductCreate(BaseModel):
    institution_id: int

    name: str = Field(min_length=1, max_length=255)

    description: str | None = Field(default=None, max_length=5000)

    category: str = Field(min_length=1, max_length=100)

    product_type: str = Field(default="PHYSICAL", pattern="^(PHYSICAL|DIGITAL)$")

    condition_type: str = Field(default="NEW", pattern="^(NEW|USED|DIGITAL)$")

    price: float = Field(ge=0)

    quantity: int = Field(ge=0)


# ============================================================
# UPDATE PRODUCT
# ============================================================


class MarketplaceProductUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)

    description: str | None = Field(default=None, max_length=5000)

    category: str = Field(min_length=1, max_length=100)

    product_type: str = Field(pattern="^(PHYSICAL|DIGITAL)$")

    condition_type: str = Field(pattern="^(NEW|USED|DIGITAL)$")

    price: float = Field(ge=0)

    quantity: int = Field(ge=0)

    is_active: bool = True
