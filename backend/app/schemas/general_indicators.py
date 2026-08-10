from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class GeneralIndicatorSnapshotModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class GeneralIndicatorPeriod(GeneralIndicatorSnapshotModel):
    startDate: str
    endDate: str


class GeneralIndicatorKpi(GeneralIndicatorSnapshotModel):
    hours: float
    percentage: float
    difference: float
    status: str
    target: float | None = None
    limit: float | None = None


class GeneralIndicatorCategory(GeneralIndicatorSnapshotModel):
    category: str
    originalHours: float
    allocatedHours: float
    adjustedHours: float
    percentage: float


class GeneralIndicatorSnapshotMetadata(GeneralIndicatorSnapshotModel):
    consultationId: int
    consultedAt: str | None = None
    validatedAt: str | None = None
    finalizedAt: str | None = None
    initiatedBy: str | None = None
    finalizedBy: str | None = None
    resultContractVersion: int
    calculationVersion: str | None = None
    classificationVersion: str | None = None
    distributionRulesVersion: str | None = None
    targetsVersion: str | None = None
    backendBuild: str | None = None


class GeneralIndicatorSnapshotIntegrity(GeneralIndicatorSnapshotModel):
    algorithm: str = "SHA-256"
    launchSnapshotHash: str | None = None
    resultHash: str | None = None


class GeneralIndicatorSnapshotSummary(GeneralIndicatorSnapshotModel):
    foundLaunchCount: int | None = None
    uniqueLaunchCount: int | None = None
    consideredLaunchCount: int | None = None
    disregardedLaunchCount: int | None = None
    removedLaunchCount: int | None = None
    removedHours: float | None = None
    excludedCollaboratorCount: int | None = None
    excludedCollaborators: list[str] = Field(default_factory=list)
    grossHours: float | None = None
    consideredHours: float | None = None
    disregardedHours: float | None = None
    pendingCount: int | None = None
    affectedLaunchCount: int | None = None
    affectedHours: float | None = None


class GeneralIndicatorQuarter(GeneralIndicatorSnapshotModel):
    quarter: str
    label: str
    competence: GeneralIndicatorPeriod
    totalHours: float
    newProjectHours: float
    improvementHours: float
    itErrorHours: float
    bugHours: float
    projectsImprovements: GeneralIndicatorKpi
    errorsBugs: GeneralIndicatorKpi


class GeneralIndicatorFinalizedSnapshot(GeneralIndicatorSnapshotModel):
    contractVersion: int = 1
    consultationId: int
    status: str
    period: GeneralIndicatorPeriod
    consultedAt: str | None = None
    finalizedAt: str | None = None
    recordCount: int
    totalHours: float
    metadata: GeneralIndicatorSnapshotMetadata | None = None
    summary: GeneralIndicatorSnapshotSummary | None = None
    rules: dict[str, Any] | None = None
    integrity: GeneralIndicatorSnapshotIntegrity | None = None
    kpis: dict[str, GeneralIndicatorKpi]
    categories: list[GeneralIndicatorCategory]
    distribution: list[dict[str, Any]]
    months: list[dict[str, Any]]
    quarters: list[GeneralIndicatorQuarter] = Field(default_factory=list)
    audit: list[dict[str, Any]]
    inconsistencyHistory: list[dict[str, Any]] = Field(default_factory=list)
    auditPagination: dict[str, int] | None = None


class GeneralIndicatorFinalizationResponse(GeneralIndicatorFinalizedSnapshot):
    reportId: int
