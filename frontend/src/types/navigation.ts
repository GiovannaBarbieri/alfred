export type SectionId = "dashboard" | "analytics" | "import" | "validation" | "reports" | "general-indicators" | "my-reports" | "report-comparison" | "history" | "settings" | "distribution-weights" | "indicator-targets" | "indicator-modules" | "audit";

export const projectSectionIds: SectionId[] = ["import", "validation", "reports", "history"];
export const analysisReportSectionIds: SectionId[] = [
  ...projectSectionIds,
  "general-indicators",
  "my-reports",
  "report-comparison",
];

export function isAnalysisReportSection(section: SectionId) {
  return analysisReportSectionIds.includes(section);
}

export function analysisReportActiveItem(section: SectionId): "import" | "general-indicators" | "my-reports" | "report-comparison" | null {
  if (projectSectionIds.includes(section)) return "import";
  if (section === "general-indicators" || section === "my-reports" || section === "report-comparison") return section;
  return null;
}

export function projectModuleActiveItem(section: SectionId): "import" | "reports" | null {
  if (section === "import" || section === "validation") return "import";
  if (section === "reports" || section === "history") return "reports";
  return null;
}

export const sectionMeta: Record<SectionId, { title: string; description: string }> = {
  dashboard: {
    title: "Dashboard",
    description: "Centro de comando da análise operacional.",
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
  "general-indicators": {
    title: "Indicadores Gerais",
    description: "Acompanhe os indicadores trimestrais da TI com dados consultados diretamente do TFS.",
  },
  "my-reports": {
    title: "Meus Relatórios",
    description: "Consulte e acesse as análises finalizadas no Alfred.",
  },
  "report-comparison": {
    title: "Comparação de Relatórios",
    description: "Compare snapshots salvos de forma independente, sem realizar novas consultas ao TFS.",
  },
  history: {
    title: "Histórico",
    description: "Consulte importações salvas, ocorrências e registros consolidados.",
  },
  settings: {
    title: "Configurações gerais",
    description: "Gerencie categorias, cargos e colaboradores utilizados na classificação das atividades.",
  },
  "distribution-weights": {
    title: "Distribuição das categorias",
    description: "Configure como as horas de Atualização do sistema serão redistribuídas entre as categorias dos Indicadores Gerais. Quando todas as categorias possuem peso igual a 1, a distribuição ocorre proporcionalmente às horas originais do período, sem priorização adicional.",
  },
  "indicator-targets": {
    title: "Metas dos indicadores",
    description: "Gerencie as vigências de metas e limites usados nos Indicadores Gerais.",
  },
  "indicator-modules": {
    title: "Configuração de Módulos",
    description: "Defina quais módulos serão considerados nos cálculos dos Indicadores Gerais.",
  },
  audit: {
    title: "Auditoria",
    description: "Consulte a trilha de alterações, importações e decisões operacionais do sistema.",
  },
};
