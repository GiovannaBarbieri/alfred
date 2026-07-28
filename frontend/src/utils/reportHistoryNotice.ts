export const REPORT_NOTICE_DISMISS_MS = 4_000;

export function scheduleReportNoticeDismiss(
  onDismiss: () => void,
  schedule: (callback: () => void, delay: number) => number = (callback, delay) => window.setTimeout(callback, delay),
  cancel: (timerId: number) => void = (timerId) => window.clearTimeout(timerId),
): () => void {
  const timerId = schedule(onDismiss, REPORT_NOTICE_DISMISS_MS);
  return () => cancel(timerId);
}
