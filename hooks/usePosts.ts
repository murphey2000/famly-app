import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/utils/api";
import type { Post } from "@/types";

function normalizePosts(data: { posts: Post[] } | Post[]): Post[] {
  const rawPosts = Array.isArray(data) ? data : data?.posts ?? [];
  return rawPosts.map((p: any) => ({ ...p, text: p.raw_text ?? p.text ?? "", media: p.media ?? [] }));
}

export function usePosts(authorId?: string) {
  const url = authorId ? `/api/posts?author_id=${authorId}` : "/api/posts";
  return useQuery({
    queryKey: ["posts", authorId ?? "all"],
    queryFn: async () => normalizePosts(await apiGet<{ posts: Post[] } | Post[]>(url)),
    staleTime: 2 * 60 * 1000,
  });
}
