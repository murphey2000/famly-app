import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/utils/api";
import type { FeedItem, Post } from "@/types";

function normalizePost(p: any): Post {
  return { ...p, text: p.raw_text ?? p.text ?? "", media: p.media ?? [] };
}

function normalizeFeedItems(items: any[]): FeedItem[] {
  return items.map((item) => {
    if (item.kind === "post") {
      return { kind: "post", post: normalizePost(item.post) } as FeedItem;
    }
    if (item.kind === "memory") {
      return { kind: "memory", year: item.year, post: normalizePost(item.post) } as FeedItem;
    }
    return item as FeedItem;
  });
}

export function useFeed(authorId?: string) {
  const url = authorId ? `/api/feed?author_id=${authorId}` : "/api/feed";
  return useQuery({
    queryKey: ["feed", authorId ?? "all"],
    queryFn: () => {
      console.log("[useFeed] Fetching feed from:", url);
      return apiGet<any[]>(url).then((data) => {
        const normalized = normalizeFeedItems(Array.isArray(data) ? data : []);
        console.log("[useFeed] Feed loaded, items:", normalized.length);
        return normalized;
      });
    },
    staleTime: 2 * 60 * 1000,
  });
}
