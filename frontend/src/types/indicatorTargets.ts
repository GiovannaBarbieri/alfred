export type IndicatorTargetPeriod = {
  id: number;
  startDate: string;
  endDate: string;
  projectsTarget: string;
  errorsLimit: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type IndicatorTargetPeriodList = {
  items: IndicatorTargetPeriod[];
};

export type IndicatorTargetPeriodPayload = {
  startDate: string;
  endDate: string;
  projectsTarget: string;
  errorsLimit: string;
};
