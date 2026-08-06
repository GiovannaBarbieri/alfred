import type { SectionId } from "../types/navigation";

export type NavigationGroupId = "reports" | "settings";

const REPORT_GROUP_SECTIONS = new Set<SectionId>([
  "import",
  "validation",
  "reports",
  "history",
  "general-indicators",
  "my-reports",
  "report-comparison",
]);

export function navigationGroupForSection(section: SectionId): NavigationGroupId | null {
  if (REPORT_GROUP_SECTIONS.has(section)) return "reports";
  if (section === "settings" || section === "distribution-weights" || section === "indicator-modules") return "settings";
  return null;
}

export function toggleNavigationGroup(
  current: NavigationGroupId | null,
  requested: NavigationGroupId,
): NavigationGroupId | null {
  return current === requested ? null : requested;
}
