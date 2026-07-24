from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, StrictInt


class DistributionWeightItem(BaseModel):
    category: str
    weight: StrictInt = Field(ge=1, le=5)
    active: bool


class DistributionWeightUpdateRequest(BaseModel):
    items: list[DistributionWeightItem]


class DistributionWeightResponseItem(DistributionWeightItem):
    defaultWeight: int
    updatedAt: datetime
    updatedBy: str


class DistributionWeightConfigurationResponse(BaseModel):
    items: list[DistributionWeightResponseItem]
    updatedAt: datetime | None = None
    updatedBy: str | None = None

