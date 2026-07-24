export function distributionWeightInfluence(weight: number): string {
  return {
    1: "Baixa",
    2: "Moderadamente baixa",
    3: "Média",
    4: "Alta",
    5: "Muito alta",
  }[weight] ?? "Inválida";
}

export function isAllowedDistributionWeight(weight: number): boolean {
  return Number.isInteger(weight) && weight >= 1 && weight <= 5;
}

export function hasActiveDistributionCategory(items: Array<{ active: boolean }>): boolean {
  return items.some((item) => item.active);
}

export function displayDistributionCategory(category: string): string {
  return category === "Novo projeto" ? "Novo Projeto" : category;
}
