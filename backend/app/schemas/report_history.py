from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.general_indicators import (
    GeneralIndicatorCategory,
    GeneralIndicatorFinalizedSnapshot,
    GeneralIndicatorKpi,
)


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


class GeneralIndicatorFinalizeRequest(BaseModel):
    reportName: str = Field(min_length=1, max_length=255)


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
    startDate: date
    endDate: date
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


# Neutral public contracts for the independent saved-report architecture.
# The inherited fields keep backward-compatible JSON for existing clients.
class SavedReportListResponse(AnnualReportListResponse):
    pass


class SavedReportDetail(AnnualReportDetail):
    pass


class ReportPeriodAnalysisMonth(BaseModel):
    month: str
    label: str
    competence: dict[str, date]
    totalHours: float
    projectsImprovements: GeneralIndicatorKpi
    errorsBugs: GeneralIndicatorKpi
    categories: dict[str, float]


class ReportPeriodAnalysisSummary(BaseModel):
    totalHours: float
    consideredLaunchCount: int
    projectsImprovementsHours: float
    projectsImprovementsPercentage: float
    errorsBugsHours: float
    errorsBugsPercentage: float


class ReportPeriodAnalysisWeight(BaseModel):
    category: str
    weight: float
    active: bool


class ReportPeriodAnalysisGranularity(str, Enum):
    DAY = "DAY"
    MONTH = "MONTH"


class ReportComparisonType(str, Enum):
    FREE = "FREE"
    QUARTER = "QUARTER"
    SEMESTER = "SEMESTER"
    YEAR = "YEAR"


class ReportPeriodKind(str, Enum):
    FIRST_QUARTER = "FIRST_QUARTER"
    SECOND_QUARTER = "SECOND_QUARTER"
    THIRD_QUARTER = "THIRD_QUARTER"
    FOURTH_QUARTER = "FOURTH_QUARTER"
    FIRST_SEMESTER = "FIRST_SEMESTER"
    SECOND_SEMESTER = "SECOND_SEMESTER"
    YEAR = "YEAR"
    CUSTOM = "CUSTOM"


class SavedReportComparisonOption(BaseModel):
    revisionId: int
    reportId: int
    reportName: str
    reportType: ReportType
    periodStart: date
    periodEnd: date
    periodKind: ReportPeriodKind
    periodLabel: str
    versionNumber: int
    status: ReportStatus
    isCurrent: bool
    generatedAt: datetime
    totalHours: float
    consideredLaunchCount: int


class SavedReportComparisonOptionsResponse(BaseModel):
    reportType: ReportType
    comparisonType: ReportComparisonType
    items: list[SavedReportComparisonOption]


class SavedReportsComparisonRequest(BaseModel):
    reportType: ReportType = ReportType.GENERAL_INDICATORS
    reportARevisionId: int = Field(gt=0)
    reportBRevisionId: int = Field(gt=0)


class ReportPeriodAnalysisResponse(BaseModel):
    reportId: int
    reportName: str
    source: str = "SAVED_SNAPSHOT"
    officialPeriod: dict[str, date]
    analyzedPeriod: dict[str, date]
    recordCount: int
    totalHours: float
    summary: ReportPeriodAnalysisSummary
    kpis: dict[str, GeneralIndicatorKpi]
    categories: list[GeneralIndicatorCategory]
    months: list[ReportPeriodAnalysisMonth]
    granularity: ReportPeriodAnalysisGranularity
    evolution: list[ReportPeriodAnalysisMonth]
    appliedWeights: list[ReportPeriodAnalysisWeight]


class ReportComparisonPeriod(BaseModel):
    startDate: date
    endDate: date
    dayCount: int
    dailyAverageHours: float
    dailyAverageLaunches: float = 0
    periodKind: ReportPeriodKind = ReportPeriodKind.CUSTOM
    periodLabel: str = "Período personalizado"


class ReportComparisonSummary(BaseModel):
    totalHours: float
    consideredLaunchCount: int
    consideredCollaboratorCount: int = 0
    projectsImprovementsHours: float
    projectsImprovementsPercentage: float
    errorsBugsHours: float
    errorsBugsPercentage: float


class ReportComparisonDifference(BaseModel):
    valueA: float
    valueB: float
    absoluteDifference: float
    percentageDifference: float | None
    direction: str
    unit: str


class ReportCategoryComparison(BaseModel):
    category: str
    hoursA: float
    hoursB: float
    participationA: float
    participationB: float
    absoluteDifference: float
    percentageDifference: float | None
    direction: str


class ReportComparisonHighlight(BaseModel):
    category: str
    value: float


class ReportComparisonHighlights(BaseModel):
    largestPercentageIncrease: ReportComparisonHighlight | None = None
    largestPercentageReduction: ReportComparisonHighlight | None = None
    largestHoursIncrease: ReportComparisonHighlight | None = None
    largestHoursReduction: ReportComparisonHighlight | None = None


class ReportPeriodsComparisonResponse(BaseModel):
    reportId: int
    reportName: str
    source: str = "SAVED_SNAPSHOT"
    officialPeriod: dict[str, date]
    periodA: ReportComparisonPeriod
    periodB: ReportComparisonPeriod
    summaryA: ReportComparisonSummary
    summaryB: ReportComparisonSummary
    differences: dict[str, ReportComparisonDifference]
    categoriesComparison: list[ReportCategoryComparison]
    chartData: list[ReportCategoryComparison]
    comparisonSummary: ReportComparisonHighlights
    differentDurations: bool


class SavedReportComparisonContext(BaseModel):
    revisionId: int
    reportId: int
    reportName: str
    reportType: ReportType
    versionNumber: int
    status: ReportStatus
    isCurrent: bool
    generatedAt: datetime
    period: ReportComparisonPeriod
    totalHours: float
    consideredLaunchCount: int
    consideredCollaboratorCount: int


class SavedReportComparisonWarning(BaseModel):
    code: str
    message: str


class SavedReportsComparisonResponse(BaseModel):
    source: str = "SAVED_SNAPSHOTS"
    reportType: ReportType
    reportA: SavedReportComparisonContext
    reportB: SavedReportComparisonContext
    summaryA: ReportComparisonSummary
    summaryB: ReportComparisonSummary
    differences: dict[str, ReportComparisonDifference]
    categoriesComparison: list[ReportCategoryComparison]
    chartData: list[ReportCategoryComparison]
    comparisonSummary: ReportComparisonHighlights
    differentDurations: bool
    differentPeriodTypes: bool
    overlappingPeriods: bool
    warnings: list[SavedReportComparisonWarning] = Field(default_factory=list)


class SavedReportDeleteResponse(AnnualReportDeleteResponse):
    pass
