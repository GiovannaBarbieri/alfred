import { ChevronLeft, ChevronRight } from "lucide-react";

export function ReportPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <nav className="saved-report-pagination" aria-label="Paginação dos relatórios">
      <span>{totalItems.toLocaleString("pt-BR")} {totalItems === 1 ? "relatório" : "relatórios"}</span>
      <label>Por página <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
      <button type="button" aria-label="Página anterior" disabled={page <= 1 || totalPages <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft size={17} /></button>
      <strong>Página {totalPages ? page : 0} de {totalPages}</strong>
      <button type="button" aria-label="Próxima página" disabled={page >= totalPages || totalPages <= 1} onClick={() => onPageChange(page + 1)}><ChevronRight size={17} /></button>
    </nav>
  );
}
