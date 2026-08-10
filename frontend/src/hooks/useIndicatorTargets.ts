import { useCallback, useEffect, useState } from "react";
import {
  createIndicatorTarget,
  deleteIndicatorTarget,
  getIndicatorTargets,
  updateIndicatorTarget,
} from "../services/indicatorTargetsService";
import type {
  IndicatorTargetPeriod,
  IndicatorTargetPeriodPayload,
} from "../types/indicatorTargets";

export function useIndicatorTargets() {
  const [items, setItems] = useState<IndicatorTargetPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getIndicatorTargets();
      setItems(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as metas dos indicadores.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(payload: IndicatorTargetPeriodPayload) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await createIndicatorTarget(payload);
      await load();
      setSuccess("Vigência de metas cadastrada com sucesso.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar a vigência de metas.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function update(id: number, payload: IndicatorTargetPeriodPayload) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateIndicatorTarget(id, payload);
      await load();
      setSuccess("Vigência de metas atualizada com sucesso.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a vigência de metas.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(id: number) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteIndicatorTarget(id);
      await load();
      setSuccess("Vigência de metas excluída com sucesso.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir a vigência de metas.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    items,
    isLoading,
    isSaving,
    error,
    success,
    load,
    create,
    update,
    remove,
  };
}
