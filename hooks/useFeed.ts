import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/utils/api";
import type { FeedItem, Post } from "@/types";

function normalizePost(p: any): Post {
  if (!p) return { id: '', text: '', media: [], created_at: '', author: { id: '', name: '' } } as any;
  return { ...p, text: p.raw_text ?? p.text ?? "", media: p.media ?? [] };
}

function normalizeFeedItems(items: any[]): FeedItem[] {
  return items
    .filter((item) => item != null)
    .map((item) => {
      if (item.kind === "post") {
        if (!item.post) return null;
        return { kind: "post", post: normalizePost(item.post) } as FeedItem;
      }
      if (item.kind === "memory") {
        if (!item.post) return null;
        return { kind: "memory", year: item.year, post: normalizePost(item.post) } as FeedItem;
      }
      if (item.kind === "birthday") {
        if (!item.member) return null;
        return item as FeedItem;
      }
      return null;
    })
    .filter((item): item is FeedItem => item !== null);
}

export function useFeed(authorId?: string) {
  const url = authorId ? `/api/feed?author_id=${authorId}` : "/api/feed";
  return useQuery({
    queryKey: ["feed", authorId ?? "all"],
    queryFn: () => {
      console.log("[useFeed] Fetching feed from:", url);
      return apiGet<any>(url)
        .then((data) => {
          console.log("[useFeed] Raw response:", JSON.stringify(data).slice(0, 200));
          const items: any[] = Array.isArray(data) ? data : Array.isArray(data?.posts) ? data.posts : [];
          const normalized = normalizeFeedItems(items);
          console.log("[useFeed] Feed loaded, items:", normalized.length);
          return normalized;
        })
        .catch((e) => {
          console.error("[useFeed] fetch error:", e?.message, e);
          throw e;
        });
    },
    staleTime: 2 * 60 * 1000,
  });
}
