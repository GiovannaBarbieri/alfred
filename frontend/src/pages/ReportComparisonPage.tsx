import { ReportPeriodsComparisonPanel } from "../components/my-reports/ReportPeriodsComparisonPanel";

type SuggestedPeriod = {
  startDate: string;
  endDate: string;
};

export function ReportComparisonPage({
  onCreateReport,
}: {
  onCreateReport: (period?: SuggestedPeriod) => void;
}) {
  return (
    <section className="report-comparison-page">
      <ReportPeriodsComparisonPanel onCreateReport={onCreateReport} />
    </section>
  );
}
