export type GeneralIndicatorScreenState =
  | "initial"
  | "processing"
  | "empty"
  | "inconsistencies"
  | "ready"
  | "finalizing"
  | "finalized"
  | "error";

export function resolveGeneralIndicatorScreenState(input: {
  hasConsultation: boolean;
  uniqueLaunchCount?: number;
  canFinalize?: boolean;
  hasFinalData: boolean;
  operation: "consultation" | "pending" | "finalization" | null;
  hasError: boolean;
}): GeneralIndicatorScreenState {
  if (input.operation === "finalization") return "finalizing";
  if (input.operation) return "processing";
  if (input.hasFinalData) return "finalized";
  if (input.hasError && !input.hasConsultation) return "error";
  if (!input.hasConsultation) return "initial";
  if ((input.uniqueLaunchCount ?? 0) === 0) return "empty";
  return input.canFinalize ? "ready" : "inconsistencies";
}

export function isCompletedGeneralIndicatorValidation(input: {
  uniqueLaunchCount: number;
  canFinalize: boolean;
  pendingCount: number;
}): boolean {
  return input.uniqueLaunchCount > 0 && input.canFinalize && input.pendingCount === 0;
}
