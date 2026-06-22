import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/utils/api";
import type { Family } from "@/types";

export function useFamily() {
  return useQuery({
    queryKey: ["family"],
    queryFn: async () => {
      const data = await apiGet<Family | Family[]>("/api/families");
      const fam = Array.isArray(data) ? data[0] : data;
      return fam ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}
