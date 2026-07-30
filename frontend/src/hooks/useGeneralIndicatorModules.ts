import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getGeneralIndicatorModules,
  syncGeneralIndicatorModules,
  updateGeneralIndicatorModule,
} from "../services/generalIndicatorModulesService";
import type { GeneralIndicatorModule } from "../types/generalIndicatorModules";

export type ModuleStatusFilter = "all" | "active" | "inactive";

export function useGeneralIndicatorModules() {
  const [items, setItems] = useState<GeneralIndicatorModule[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ModuleStatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems((await getGeneralIndicatorModules()).items);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      const matchesSearch = !term || item.tagName.toLocaleLowerCase("pt-BR").includes(term);
      const matchesStatus =
        statusFilter === "all"
        || (statusFilter === "active" ? item.active : !item.active);
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  async function synchronize() {
    setIsSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await syncGeneralIndicatorModules();
      setItems(result.items);
      setSuccess(
        result.createdCount
          ? `${result.createdCount} novo(s) módulo(s) adicionado(s).`
          : "Módulos atualizados. Nenhuma nova TAG foi encontrada.",
      );
      return true;
    } catch (cause) {
      setError(message(cause));
      return false;
    } finally {
      setIsSyncing(false);
    }
  }

  async function changeStatus(module: GeneralIndicatorModule, active: boolean) {
    setSavingId(module.id);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateGeneralIndicatorModule(module.id, active);
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSuccess(`Módulo ${active ? "ativado" : "inativado"} com sucesso.`);
      return true;
    } catch (cause) {
      setError(message(cause));
      return false;
    } finally {
      setSavingId(null);
    }
  }

  return {
    items,
    filteredItems,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    isLoading,
    isSyncing,
    savingId,
    error,
    success,
    load,
    synchronize,
    changeStatus,
  };
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : "Não foi possível carregar a configuração de módulos.";
}
