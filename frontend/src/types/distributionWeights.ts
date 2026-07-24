export type DistributionWeightItem = {
  category: string;
  weight: number;
  defaultWeight: number;
  active: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type DistributionWeightConfiguration = {
  items: DistributionWeightItem[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export type DistributionWeightUpdateItem = Pick<DistributionWeightItem, "category" | "weight" | "active">;

