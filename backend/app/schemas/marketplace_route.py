from typing import Literal

from pydantic import BaseModel, Field


class RouteOnboardingRequest(BaseModel):
    business_type: Literal[
        "individual",
        "proprietorship",
        "partnership",
        "private_limited",
        "public_limited",
        "llp",
        "trust",
        "huf",
        "government",
        "judicial_person",
        "local_authority",
        "section_8_company",
    ] = "individual"
    legal_business_name: str = Field(min_length=4, max_length=200)
    customer_facing_business_name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=8, max_length=15)
    bank_account_number: str = Field(min_length=5, max_length=35)
    ifsc_code: str = Field(min_length=4, max_length=20)
    beneficiary_name: str = Field(min_length=2, max_length=255)
    stakeholder_name: str = Field(min_length=2, max_length=255)
    stakeholder_email: str | None = None
    accept_terms: bool = False


class RefundRequest(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    reverse_all: bool = True
    reason: str | None = Field(default=None, max_length=500)


class PayoutReversalRequest(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    reason: str | None = Field(default=None, max_length=500)
