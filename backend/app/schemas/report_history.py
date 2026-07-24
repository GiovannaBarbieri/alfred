from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.general_indicators import GeneralIndicatorFinalizedSnapshot


class ReportType(str, Enum):
    GENERAL_INDICATORS = "GENERAL_INDICATORS"


class ReportStatus(str, Enum):
    CURRENT = "CURRENT"
    SUPERSEDED = "SUPERSEDED"
    ARCHIVED = "ARCHIVED"


class ReportStatusFilter(str, Enum):
    CURRENT = "CURRENT"
    SUPERSEDED = "SUPERSEDED"
    ARCHIVED = "ARCHIVED"
    ALL = "ALL"


class ReportVersionInfo(BaseModel):
    versionNumber: int
    status: ReportStatus
    isCurrent: bool
    supersededById: int | None = None
    supersedesId: int | None = None
    supersededAt: datetime | None = None
    archivedAt: datetime | None = None
    archivedBy: str | None = None
    currentSelectedAt: datetime | None = None
    currentSelectedBy: str | None = None


class ReportListItem(BaseModel):
    id: int
    consultationId: int
    name: str
    type: ReportType
    version: ReportVersionInfo
    periodStart: date
    periodEnd: date
    consultedAt: datetime
    finalizedAt: datetime
    totalHours: float
    consideredLaunchCount: int
    excludedCollaboratorCount: int
    projectsImprovementsPercentage: float | None = None
    projectsImprovementsStatus: str | None = None
    errorsBugsPercentage: float | None = None
    errorsBugsStatus: str | None = None
    responsible: str | None = None
    snapshotContractVersion: int
    resultHash: str | None = None


class ReportListResponse(BaseModel):
    items: list[ReportListItem]
    page: int
    pageSize: int
    totalItems: int
    totalPages: int


class ReportDetail(BaseModel):
    report: ReportListItem
    snapshot: GeneralIndicatorFinalizedSnapshot


class ReportActionRequest(BaseModel):
    actor: str | None = Field(default=None, max_length=255)


class ReportDeletionCandidate(BaseModel):
    id: int
    versionNumber: int
    status: ReportStatus
    finalizedAt: datetime


class ReportDeleteResponse(BaseModel):
    deleted: bool
    id: int
    consultationId: int
    type: ReportType
    periodStart: date
    periodEnd: date
    versionNumber: int
    wasCurrent: bool
    previousVersionsAvailable: bool
    previousVersions: list[ReportDeletionCandidate]
    deletedAt: datetime


class AnnualReportUpdateStatus(str, Enum):
    IDLE = "IDLE"
    PROCESSING = "PROCESSING"
    PENDING_CORRECTIONS = "PENDING_CORRECTIONS"
    READY_TO_FINALIZE = "READY_TO_FINALIZE"
    FAILED = "FAILED"


class AnnualReportCurrentRevision(BaseModel):
    id: int
    consultationId: int
    revisionNumber: int
    periodStart: date
    periodEnd: date
    finalizedAt: datetime
    responsible: str | None = None
    snapshotContractVersion: int
    resultHash: str | None = None
    previousRevisionId: int | None = None


class AnnualReportListItem(BaseModel):
    id: int
    name: str
    type: ReportType
    year: int
    currentRevisionNumber: int
    periodStart: date
    periodEnd: date
    createdAt: datetime
    updatedAt: datetime
    finalizedAt: datetime
    totalHours: float
    consideredLaunchCount: int
    excludedCollaboratorCount: int
    projectsImprovementsPercentage: float | None = None
    projectsImprovementsStatus: str | None = None
    errorsBugsPercentage: float | None = None
    errorsBugsStatus: str | None = None
    hasUpdateInProgress: bool
    updateStatus: AnnualReportUpdateStatus
    responsible: str | None = None


class AnnualReportListResponse(BaseModel):
    items: list[AnnualReportListItem]
    page: int
    pageSize: int
    totalItems: int
    totalPages: int


class AnnualReportUpdateState(BaseModel):
    consultationId: int | None = None
    status: AnnualReportUpdateStatus
    currentPeriodEnd: date
    requestedPeriodEnd: date | None = None
    createdAt: datetime | None = None
    createdBy: str | None = None
    inconsistenciesCount: int = 0
    canContinue: bool = False
    canFinalize: bool = False


class AnnualReportDetail(BaseModel):
    report: AnnualReportListItem
    currentRevision: AnnualReportCurrentRevision
    snapshot: GeneralIndicatorFinalizedSnapshot
    update: AnnualReportUpdateState
    revisionCount: int


class AnnualReportUpdateRequest(BaseModel):
    newPeriodEnd: date
    actor: str | None = Field(default=None, max_length=255)


class AnnualReportUpdateResponse(BaseModel):
    reportId: int
    consultationId: int
    status: AnnualReportUpdateStatus
    periodStart: date
    periodEnd: date


class AnnualReportRevisionSummary(BaseModel):
    id: int
    consultationId: int
    revisionNumber: int
    periodStart: date
    periodEnd: date
    finalizedAt: datetime
    createdBy: str | None = None
    previousRevisionId: int | None = None


class AnnualReportDeleteResponse(BaseModel):
    deleted: bool
    id: int
    type: ReportType
    year: int
    deletedRevisionCount: int
    deletedConsultationCount: int
    deletedAt: datetime
