import type { ImportIssue, ImportValidationResponse } from "../types";

type ReviewableClassification = ImportValidationResponse["classifications"][number];

const FALLBACK_ORIGINS = new Set(["padrao_titulo", "padrao_titulo_categoria"]);
const PENDING_ORIGINS = new Set(["pendente"]);
const CONFLICT_ISSUE_CODES = new Set(["conflicting_categories", "conflicting_category"]);
const SUBCATEGORY_ISSUE_CODES = new Set(["missing_technical_profile"]);
const MANUAL_REVIEW_ISSUE_CODES = new Set(["generic_title"]);

function normalizeReviewValue(value: string | undefined | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isBlankOrUnclassified(value: string | undefined | null) {
  const normalized = normalizeReviewValue(value);
  return normalized === "" || normalized === "nao classificado";
}

function isKnownOption(value: string | undefined | null, options: string[]) {
  if (!options.length) return true;
  const normalized = normalizeReviewValue(value);
  return options.some((option) => normalizeReviewValue(option) === normalized);
}

function hasConflictReason(reasons: string[]) {
  return reasons.some((reason) => {
    const normalized = normalizeReviewValue(reason);
    return normalized.includes("multipl") || normalized.includes("conflit");
  });
}

export function reviewReasonsForClassification(
  classification: ReviewableClassification,
  options: { categoryOptions?: string[]; subcategoryOptions?: string[]; issues?: ImportIssue[] } = {},
) {
  const reasons = new Set<string>();
  const categoryOptions = options.categoryOptions ?? [];
  const subcategoryOptions = options.subcategoryOptions ?? [];
  const lineIssues = options.issues?.filter((issue) => issue.line === classification.line) ?? [];
  const suggestionReasons = classification.confidenceFactors ?? [];

  if (isBlankOrUnclassified(classification.category)) {
    reasons.add("Sem categoria");
  } else if (!isKnownOption(classification.category, categoryOptions)) {
    reasons.add("Categoria não encontrada nas regras");
  }

  if (isBlankOrUnclassified(classification.subcategory)) {
    reasons.add("Sem subcategoria");
  } else if (!isKnownOption(classification.subcategory, subcategoryOptions)) {
    reasons.add("Subcategoria não encontrada nas regras");
  }

  if (PENDING_ORIGINS.has(classification.origin)) {
    reasons.add("Regra de classificação não encontrada");
  }

  if (FALLBACK_ORIGINS.has(classification.origin)) {
    reasons.add("Classificação padrão aplicada");
  }

  if (hasConflictReason(suggestionReasons) || lineIssues.some((issue) => CONFLICT_ISSUE_CODES.has(issue.code))) {
    reasons.add("Conflito entre regras");
  }

  if (lineIssues.some((issue) => SUBCATEGORY_ISSUE_CODES.has(issue.code))) {
    reasons.add("Sem subcategoria");
  }

  if (lineIssues.some((issue) => MANUAL_REVIEW_ISSUE_CODES.has(issue.code))) {
    reasons.add("Revisão manual necessária");
  }

  return Array.from(reasons);
}
