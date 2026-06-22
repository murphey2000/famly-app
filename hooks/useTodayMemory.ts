import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/utils/api";
import type { TodayMemory } from "@/types";

function normalizeMemories(data: { memories: any[] } | null): TodayMemory[] {
  const memList = data?.memories ?? [];
  return memList.map((m: any) => ({
    id: m.id,
    year: new Date(m.event_date).getFullYear(),
    post: { ...m, text: m.raw_text ?? m.text ?? "", media: m.media ?? [] },
  }));
}

export function useTodayMemory() {
  return useQuery({
    queryKey: ["memories", "today"],
    queryFn: async () => normalizeMemories(await apiGet<{ memories: any[] }>("/api/memories/today")),
    staleTime: 10 * 60 * 1000,
  });
}
