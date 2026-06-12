export type SectionId = "dashboard" | "analytics" | "import" | "validation" | "reports" | "history" | "settings" | "audit";

export const sectionMeta: Record<SectionId, { title: string; description: string }> = {
  dashboard: {
    title: "Dashboard",
    description: "Acompanhe indicadores consolidados, pendencias e projetos analisados.",
  },
  analytics: {
    title: "Inteligencia Operacional",
    description: "Identifique tendencias, anomalias, concentracoes, riscos e pontos de qualidade dos projetos.",
  },
  import: {
    title: "Importacao de planilha",
    description: "Selecione a base Excel ou CSV extraida do TFS para iniciar a validacao.",
  },
  validation: {
    title: "Validacao da importacao",
    description: "Revise bloqueios, alertas, duplicidades e classificacoes antes de salvar a base.",
  },
  reports: {
    title: "Relatorios",
    description: "Analise horas por colaborador, Epic, PBI, categoria e subcategoria.",
  },
  history: {
    title: "Historico",
    description: "Consulte importacoes salvas, ocorrencias e registros consolidados.",
  },
  settings: {
    title: "Configuracoes",
    description: "Mantenha categorias aceitas no titulo e perfis operacionais de colaboradores.",
  },
  audit: {
    title: "Auditoria",
    description: "Consulte a trilha de alteracoes, importacoes e decisoes operacionais do sistema.",
  },
};
