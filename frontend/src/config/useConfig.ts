import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";
import type { FeatureKey, PublicConfig } from "@/types";

/** Fetches server config once; the UI uses it to hide disabled modules so there
 *  are never broken buttons for features that are turned off. */
export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => apiFetch<PublicConfig>("/config"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useFeature(key: FeatureKey): boolean {
  const { data } = useConfig();
  return Boolean(data?.features?.[key]);
}
