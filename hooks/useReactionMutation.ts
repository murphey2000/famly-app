import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { apiPost, apiDelete } from "@/utils/api";
import type { Post, PostReaction, FeedItem } from "@/types";

const ALL_EMOJIS = ["👍", "❤️", "😂"] as const;
type Emoji = (typeof ALL_EMOJIS)[number];

type InfinitePostsPage = { posts: Post[]; offset: number };

function applyOptimisticReaction(reactions: PostReaction[] | undefined, emoji: Emoji | null): PostReaction[] {
  const base = ALL_EMOJIS.map((e) => {
    const existing = reactions?.find((r) => r.emoji === e);
    return { emoji: e, count: existing?.count ?? 0, userReacted: existing?.userReacted ?? false };
  });
  for (const r of base) {
    if (r.userReacted) {
      r.count = Math.max(0, r.count - 1);
      r.userReacted = false;
    }
  }
  if (emoji) {
    const target = base.find((r) => r.emoji === emoji)!;
    target.count += 1;
    target.userReacted = true;
  }
  return base;
}

function updatePostInCache(post: Post, postId: string, emoji: Emoji | null): Post {
  if (post.id !== postId) return post;
  return { ...post, reactions: applyOptimisticReaction(post.reactions, emoji) };
}

function patchInfinitePostsCache(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  emoji: Emoji | null
) {
  queryClient.setQueriesData<InfiniteData<InfinitePostsPage>>(
    { queryKey: ["posts", "infinite"] },
    (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          posts: page.posts.map((p) => updatePostInCache(p, postId, emoji)),
        })),
      };
    }
  );
}

function patchFeedCache(queryClient: ReturnType<typeof useQueryClient>, postId: string, emoji: Emoji | null) {
  queryClient.setQueriesData<FeedItem[]>({ queryKey: ["feed"] }, (data) => {
    if (!data) return data;
    return data.map((item) => {
      if ((item.kind === "post" || item.kind === "memory") && item.post.id === postId) {
        return { ...item, post: updatePostInCache(item.post, postId, emoji) };
      }
      return item;
    });
  });
}

function reconcileWithServer(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: string,
  reactions: PostReaction[]
) {
  queryClient.setQueriesData<InfiniteData<InfinitePostsPage>>(
    { queryKey: ["posts", "infinite"] },
    (data) => {
      if (!data) return data;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          posts: page.posts.map((p) => (p.id === postId ? { ...p, reactions } : p)),
        })),
      };
    }
  );
  queryClient.setQueriesData<FeedItem[]>({ queryKey: ["feed"] }, (data) => {
    if (!data) return data;
    return data.map((item) => {
      if ((item.kind === "post" || item.kind === "memory") && item.post.id === postId) {
        return { ...item, post: { ...item.post, reactions } };
      }
      return item;
    });
  });
}

function rollback(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["posts", "infinite"] });
  queryClient.invalidateQueries({ queryKey: ["feed"] });
}

export function useSetReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, emoji }: { postId: string; emoji: Emoji }) =>
      apiPost<{ reactions: PostReaction[] }>(`/api/posts/${postId}/reactions`, { emoji }),
    onMutate: async ({ postId, emoji }) => {
      patchInfinitePostsCache(queryClient, postId, emoji);
      patchFeedCache(queryClient, postId, emoji);
    },
    onError: () => rollback(queryClient),
    onSuccess: (data, { postId }) => reconcileWithServer(queryClient, postId, data.reactions),
  });
}

export function useRemoveReaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId }: { postId: string }) =>
      apiDelete<{ reactions: PostReaction[] }>(`/api/posts/${postId}/reactions`, {}),
    onMutate: async ({ postId }) => {
      patchInfinitePostsCache(queryClient, postId, null);
      patchFeedCache(queryClient, postId, null);
    },
    onError: () => rollback(queryClient),
    onSuccess: (data, { postId }) => reconcileWithServer(queryClient, postId, data.reactions),
  });
}
