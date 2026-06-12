type ReportNoticeProps = {
  notice: { tone: "success" | "error"; message: string } | null;
};

export function ReportNotice({ notice }: ReportNoticeProps) {
  if (!notice) return null;

  return (
    <div className={`report-notice ${notice.tone}`} role="status">
      {notice.message}
    </div>
  );
}
