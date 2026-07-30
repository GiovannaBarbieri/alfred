from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class GeneralIndicatorModuleResponse(BaseModel):
    id: int
    tagName: str
    active: bool
    createdAt: datetime
    updatedAt: datetime


class GeneralIndicatorModuleListResponse(BaseModel):
    items: list[GeneralIndicatorModuleResponse]
    total: int
    activeCount: int
    inactiveCount: int


class GeneralIndicatorModuleStatusRequest(BaseModel):
    active: bool


class GeneralIndicatorModuleSyncResponse(GeneralIndicatorModuleListResponse):
    discoveredCount: int
    createdCount: int
