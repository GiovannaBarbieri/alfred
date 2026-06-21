import type { SettingItem } from "../types";

export function normalizeSettingName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function hasSimilarSettingName(items: SettingItem[], name: string, currentId?: number): boolean {
  const normalizedName = normalizeSettingName(name);
  if (!normalizedName) return false;
  return items.some((item) => item.id !== currentId && normalizeSettingName(item.name) === normalizedName);
}
