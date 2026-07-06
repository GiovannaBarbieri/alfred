from pydantic import BaseModel, Field


class ImportIssue(BaseModel):
    line: int | None = None
    field: str
    value: str | None = None
    severity: str
    code: str
    message: str


class DuplicateGroup(BaseModel):
    idLancamento: str
    lines: list[int]
    records: list[dict] = Field(default_factory=list)


class ClassificationSuggestion(BaseModel):
    line: int
    idTask: str
    loginUsuario: str
    tituloTask: str
    category: str
    subcategory: str
    origin: str
    confidence: float
    confidenceLevel: str
    classifierVersion: str
    confidenceFactors: list[str] = Field(default_factory=list)
    matchedKeywords: list[str] = Field(default_factory=list)


class ImportPreviewCategory(BaseModel):
    category: str
    totalHours: float
    totalRecords: int
    percentage: float


class ImportPreviewSummary(BaseModel):
    totalHours: float
    collaboratorsCount: int
    tasksCount: int
    categoriesCount: int
    averageConfidence: float
    lowConfidenceCount: int
    unclassifiedCount: int
    zeroDurationCount: int
    topCategories: list[ImportPreviewCategory] = Field(default_factory=list)


class RelatedImportSummary(BaseModel):
    importId: int
    filename: str
    importedAt: str
    totalRows: int
    totalHours: float
    sameFileHash: bool = False


class ImportFileHistory(BaseModel):
    status: str
    message: str
    sameProjectImportCount: int = 0
    exactDuplicate: bool = False
    latestImport: RelatedImportSummary | None = None
    matchingImport: RelatedImportSummary | None = None
    newRecords: int = 0
    removedRecords: int = 0
    unchangedRecords: int = 0


class ImportValidationResponse(BaseModel):
    sessionId: int | None = None
    filename: str
    totalRows: int
    validRows: int
    blockedRows: int
    alertRows: int
    missingColumns: list[str]
    issues: list[ImportIssue]
    duplicates: list[DuplicateGroup]
    classifications: list[ClassificationSuggestion]
    preview: ImportPreviewSummary | None = None
    fileHistory: ImportFileHistory | None = None
    canComplete: bool


class ImportCompleteResponse(BaseModel):
    importId: int
    filename: str
    status: str
    totalRows: int
    validRows: int
    alertRows: int
    blockedRows: int
    savedRows: int


class ImportSessionSummary(BaseModel):
    sessionId: int
    filename: str
    status: str
    totalRows: int
    validRows: int
    alertRows: int
    blockedRows: int
    createdAt: str
    updatedAt: str
    importId: int | None = None


class ImportSessionResponse(BaseModel):
    session: ImportSessionSummary
    validation: ImportValidationResponse


class SQLServerConnectionStatus(BaseModel):
    ok: bool
    message: str


class SQLServerImportRequest(BaseModel):
    ids: list[int | str] = Field(default_factory=list)
    idType: str = "auto"


class CompleteSessionRequest(BaseModel):
    duplicateKeepLines: list[int] = Field(default_factory=list)
    classificationOverrides: list[dict] = Field(default_factory=list)


class ImportSummary(BaseModel):
    id: int
    filename: str
    status: str
    importedAt: str
    totalRows: int
    validRows: int
    alertRows: int
    blockedRows: int
    classifierVersion: str = "1.0.0"
    totalHours: float = 0


class ImportDetail(BaseModel):
    id: int
    filename: str
    status: str
    importedAt: str
    totalRows: int
    validRows: int
    alertRows: int
    blockedRows: int
    classifierVersion: str = "1.0.0"
    records: list[dict]
    issues: list[dict] = Field(default_factory=list)
    duplicates: list[dict] = Field(default_factory=list)


class ReprocessCategoryChange(BaseModel):
    fromCategory: str
    toCategory: str
    totalRecords: int


class ReprocessPreviewItem(BaseModel):
    recordId: int
    taskKey: str
    line: int
    idLancamento: str
    idTask: str
    tituloTask: str
    loginUsuario: str
    currentCategory: str
    currentSubcategory: str
    currentConfidence: float
    currentConfidenceLevel: str
    currentClassifierVersion: str
    newCategory: str
    newSubcategory: str
    newConfidence: float
    newConfidenceLevel: str
    newClassifierVersion: str
    newOrigin: str
    changed: bool
    confidenceDelta: float
    confidenceFactors: list[str] = Field(default_factory=list)
    matchedKeywords: list[str] = Field(default_factory=list)


class ReprocessPreviewTaskGroup(BaseModel):
    taskKey: str
    idTask: str
    tituloTask: str
    firstLine: int
    totalRecords: int
    collaborators: list[str] = Field(default_factory=list)
    currentCategory: str
    currentSubcategory: str
    newCategory: str
    newSubcategory: str
    averageCurrentConfidence: float
    averageNewConfidence: float
    confidenceDelta: float
    confidenceFactors: list[str] = Field(default_factory=list)


class ImportReprocessPreview(BaseModel):
    importId: int
    filename: str
    currentClassifierVersion: str
    newClassifierVersion: str
    totalRecords: int
    changedRecords: int
    unchangedRecords: int
    changedTasks: int
    confidenceImproved: int
    confidenceReduced: int
    averageCurrentConfidence: float
    averageNewConfidence: float
    categoryChanges: list[ReprocessCategoryChange] = Field(default_factory=list)
    taskGroups: list[ReprocessPreviewTaskGroup] = Field(default_factory=list)
    items: list[ReprocessPreviewItem] = Field(default_factory=list)
    itemLimit: int


class ImportReprocessApplyResponse(BaseModel):
    importId: int
    filename: str
    status: str
    appliedRecords: int
    changedTasks: int
    classifierVersion: str
    message: str


class ImportReprocessApplyRequest(BaseModel):
    selectedTaskKeys: list[str] | None = None


class ReprocessHistoryItem(BaseModel):
    id: int
    recordId: int
    idLancamento: str
    idTask: str
    tituloTask: str
    loginUsuario: str
    previousCategory: str | None = None
    previousSubcategory: str | None = None
    newCategory: str | None = None
    newSubcategory: str | None = None
    previousConfidence: float | None = None
    newConfidence: float | None = None
    previousConfidenceLevel: str | None = None
    newConfidenceLevel: str | None = None
    previousVersion: str | None = None
    newVersion: str | None = None
    origin: str | None = None
    reason: str | None = None
    user: str
    createdAt: str
