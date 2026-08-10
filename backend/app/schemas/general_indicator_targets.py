from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class GeneralIndicatorTargetPeriodPayload(BaseModel):
    startDate: date
    endDate: date
    projectsTarget: Decimal = Field(ge=0, le=100, decimal_places=2)
    errorsLimit: Decimal = Field(ge=0, le=100, decimal_places=2)


class GeneralIndicatorTargetPeriodUpdatePayload(BaseModel):
    startDate: date | None = None
    endDate: date | None = None
    projectsTarget: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)
    errorsLimit: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)


class GeneralIndicatorTargetPeriodResponse(BaseModel):
    id: int
    startDate: date
    endDate: date
    projectsTarget: Decimal
    errorsLimit: Decimal
    createdAt: datetime
    createdBy: str
    updatedAt: datetime
    updatedBy: str


class GeneralIndicatorTargetPeriodListResponse(BaseModel):
    items: list[GeneralIndicatorTargetPeriodResponse]
