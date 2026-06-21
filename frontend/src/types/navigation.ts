export type SectionId = "dashboard" | "analytics" | "import" | "validation" | "reports" | "history" | "settings" | "audit";

export const sectionMeta: Record<SectionId, { title: string; description: string }> = {
  dashboard: {
    title: "Dashboard",
    description: "Acompanhe indicadores consolidados, pendências e projetos analisados.",
  },
  analytics: {
    title: "Inteligência Operacional",
    description: "Identifique tendências, anomalias, concentrações, riscos e pontos de qualidade dos projetos.",
  },
  import: {
    title: "Importação de planilha",
    description: "Selecione a base Excel ou CSV extraída do TFS para iniciar a validação.",
  },
  validation: {
    title: "Validação da importação",
    description: "Revise bloqueios, alertas, duplicidades e classificações antes de salvar a base.",
  },
  reports: {
    title: "Relatórios",
    description: "Analise horas por colaborador, Epic, PBI, categoria e subcategoria.",
  },
  history: {
    title: "Histórico",
    description: "Consulte importações salvas, ocorrências e registros consolidados.",
  },
  settings: {
    title: "Configurações",
    description: "Mantenha categorias aceitas no título e perfis operacionais de colaboradores.",
  },
  audit: {
    title: "Auditoria",
    description: "Consulte a trilha de alterações, importações e decisões operacionais do sistema.",
  },
};
