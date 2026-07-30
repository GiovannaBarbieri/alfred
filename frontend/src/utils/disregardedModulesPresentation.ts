import type { GeneralIndicatorFinalizedResponse } from "../types";

type DisregardedModule = NonNullable<GeneralIndicatorFinalizedResponse["disregardedModules"]>[number];

export function buildDisregardedModulesPresentation(items: DisregardedModule[] | undefined) {
  const modules = [...(items ?? [])]
    .filter((item) => item.hours > 0)
    .sort((left, right) => right.hours - left.hours || left.tagName.localeCompare(right.tagName, "pt-BR"));

  return {
    modules,
    moduleCount: modules.length,
    totalHours: modules.reduce((total, item) => total + item.hours, 0),
  };
}
