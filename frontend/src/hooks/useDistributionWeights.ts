import { useCallback, useEffect, useState } from "react";
import {
  getDistributionWeights,
  restoreDefaultDistributionWeights,
  updateDistributionWeights,
} from "../services/distributionWeightsService";
import type {
  DistributionWeightConfiguration,
  DistributionWeightItem,
} from "../types/distributionWeights";

export function useDistributionWeights() {
  const [configuration, setConfiguration] = useState<DistributionWeightConfiguration | null>(null);
  const [items, setItems] = useState<DistributionWeightItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDistributionWeights();
      setConfiguration(result);
      setItems(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os pesos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function changeWeight(category: string, weight: number) {
    setSuccess(null);
    setItems((current) => current.map((item) => item.category === category ? { ...item, weight } : item));
  }

  function changeParticipation(category: string, active: boolean) {
    setSuccess(null);
    setItems((current) => current.map((item) => item.category === category ? { ...item, active } : item));
  }

  async function save() {
    setError(null);
    setSuccess(null);
    if (!items.some((item) => item.active)) {
      setError("Pelo menos uma categoria deve participar da distribuição.");
      return false;
    }
    setIsSaving(true);
    try {
      const result = await updateDistributionWeights(
        items.map(({ category, weight, active }) => ({ category, weight, active })),
      );
      setConfiguration(result);
      setItems(result.items);
      setSuccess("Pesos de distribuição salvos com sucesso.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar os pesos.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function restoreDefaults() {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const result = await restoreDefaultDistributionWeights();
      setConfiguration(result);
      setItems(result.items);
      setSuccess("Pesos padrão restaurados com sucesso.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível restaurar os pesos.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    configuration,
    items,
    isLoading,
    isSaving,
    error,
    success,
    load,
    changeWeight,
    changeParticipation,
    save,
    restoreDefaults,
  };
}

