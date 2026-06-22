import { useInfiniteQuery } from "@tanstack/react-query";
import { apiGet } from "@/utils/api";
import type { Post } from "@/types";

const PAGE_SIZE = 20;

function normalizePosts(data: { posts: Post[] } | Post[]): Post[] {
  const rawPosts = Array.isArray(data) ? data : data?.posts ?? [];
  return rawPosts.map((p: any) => ({
    ...p,
    text: p.raw_text ?? p.text ?? "",
    media: p.media ?? [],
    reactions: p.reactions ?? [],
  }));
}

export function useInfinitePosts(authorId?: string) {
  return useInfiniteQuery({
    queryKey: ["posts", "infinite", authorId ?? "all"],
    queryFn: async ({ pageParam }) => {
      const offset = pageParam as number;
      const url = `/api/posts?limit=${PAGE_SIZE}&offset=${offset}${authorId ? `&author_id=${authorId}` : ""}`;
      console.log("[useInfinitePosts] Fetching:", url);
      const posts = normalizePosts(await apiGet<{ posts: Post[] } | Post[]>(url));
      return { posts, offset };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (lastPage.posts.length < PAGE_SIZE) return null;
      return lastPage.offset + PAGE_SIZE;
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
