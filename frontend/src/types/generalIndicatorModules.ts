export type GeneralIndicatorModule = {
  id: number;
  tagName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GeneralIndicatorModuleList = {
  items: GeneralIndicatorModule[];
  total: number;
  activeCount: number;
  inactiveCount: number;
};

export type GeneralIndicatorModuleSyncResult = GeneralIndicatorModuleList & {
  discoveredCount: number;
  createdCount: number;
};
