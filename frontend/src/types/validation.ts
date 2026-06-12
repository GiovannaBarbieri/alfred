export type ClassificationReviewGroup = {
  idTask: string;
  lines: number[];
  title: string;
  users: string[];
  category: string;
  subcategory: string;
  origin: string;
  confidence: number;
  confidenceLevel: string;
  confidenceFactors: string[];
  matchedKeywords: string[];
  totalRecords: number;
  needsReview: boolean;
};
