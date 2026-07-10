import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Clock } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/contexts/AuthContext";
import { useFilter } from "@/contexts/FilterContext";
import { SkeletonLine } from "@/components/SkeletonLine";
import { InspirationChips } from "@/components/InspirationChips";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import { PostCard } from "@/components/PostCard";
import { useFeed } from "@/hooks/useFeed";
import { useFamily } from "@/hooks/useFamily";
import { useInfinitePosts } from "@/hooks/useInfinitePosts";
import { useTodayMemory } from "@/hooks/useTodayMemory";
import { apiGet } from "@/utils/api";
import type { FamilyMember, TodayMemory, FeedItemBirthday, Post } from "@/types";
import type { ImageSourcePropType } from "react-native";

interface UpcomingAnniversary {
  id: string;
  family_id: string;
  title: string;
  date: string;
  created_by: string;
  created_at: string;
  days_until: number;
}

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function PostCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        boxShadow: COLORS.cardShadow,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <SkeletonLine width={40} height={40} />
        <View style={{ gap: 6 }}>
          <SkeletonLine width={120} height={13} />
          <SkeletonLine width={80} height={11} />
        </View>
      </View>
      <SkeletonLine width="80%" height={20} />
      <SkeletonLine width="100%" height={13} />
      <SkeletonLine width="70%" height={13} />
      <SkeletonLine width="100%" height={120} />
    </View>
  );
}

const POLAROID_ROTATIONS = ["-6deg", "2deg", "8deg"] as const;

function PolaroidStack({ posts, topPadding }: { posts: Post[]; topPadding: number }) {
  const photoPosts = posts
    .filter((p) => (p.media ?? []).some((m) => m.type === "photo"))
    .slice(-3)
    .reverse();

  const frames: { photoUrl: string | null; caption: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const p = photoPosts[i];
    if (p) {
      const photo = (p.media ?? []).find((m) => m.type === "photo");
      frames.push({
        photoUrl: photo?.url ?? null,
        caption: (p.author?.name ?? "").split(" ")[0] || "",
      });
    } else {
      frames.push({ photoUrl: null, caption: "" });
    }
  }

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingTop: topPadding,
        height: topPadding + 170,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {frames.map((frame, index) => {
          const rotation = POLAROID_ROTATIONS[index];
          const marginLeft = index === 0 ? 0 : -28;
          const zIndex = index === 1 ? 3 : index === 0 ? 2 : 1;
          const photoSource = resolveImageSource(frame.photoUrl ?? undefined);
          return (
            <View
              key={index}
              style={{
                marginLeft,
                zIndex,
                transform: [{ rotate: rotation }],
                backgroundColor: "#FFFFFF",
                width: 120,
                height: 148,
                borderRadius: 4,
                paddingTop: 8,
                paddingHorizontal: 8,
                paddingBottom: 28,
                shadowColor: "rgba(180, 120, 40, 0.35)",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              {frame.photoUrl ? (
                <Image
                  source={photoSource}
                  style={{ flex: 1, borderRadius: 2 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    borderRadius: 2,
                    backgroundColor: COLORS.surfaceSecondary,
                  }}
                />
              )}
              {frame.caption.length > 0 && (
                <Text
                  style={{
                    position: "absolute",
                    bottom: 6,
                    left: 0,
                    right: 0,
                    fontSize: 10,
                    color: COLORS.textSecondary,
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                  numberOfLines={1}
                >
                  {frame.caption}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function MemberAvatarRow({ members }: { members: FamilyMember[] }) {
  const visible = members.slice(0, 5);
  return (
    <View style={{ flexDirection: "row", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
      {visible.map((member) => {
        const firstName = (member.name || member.display_name || member.email || "?").split(" ")[0];
        return (
          <View key={member.id} style={{ alignItems: "center", gap: 4 }}>
            <AuthorAvatar author={member} size={32} />
            <Text
              style={{ fontSize: 10, color: COLORS.textSecondary, fontWeight: "500", maxWidth: 40 }}
              numberOfLines={1}
            >
              {firstName}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function StatsRow({ photos, videos, memories }: { photos: number; videos: number; memories: number }) {
  const photosLabel = "Fotos";
  const videosLabel = "Videos";
  const memoriesLabel = "Erinnerungen";
  const photosCount = String(photos);
  const videosCount = String(videos);
  const memoriesCount = String(memories);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}
      style={{ marginBottom: 16 }}
    >
      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          alignItems: "center",
          minWidth: 90,
        }}
      >
        <Text style={{ fontSize: 18 }}>📷</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: 4 }}>
          {photosCount}
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
          {photosLabel}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          alignItems: "center",
          minWidth: 90,
        }}
      >
        <Text style={{ fontSize: 18 }}>🎥</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: 4 }}>
          {videosCount}
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
          {videosLabel}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          alignItems: "center",
          minWidth: 90,
        }}
      >
        <Text style={{ fontSize: 18 }}>❤️</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: 4 }}>
          {memoriesCount}
        </Text>
        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
          {memoriesLabel}
        </Text>
      </View>
    </ScrollView>
  );
}

function MemoryBanner({ memory }: { memory: TodayMemory }) {
  const router = useRouter();
  if (!memory?.post) return null;
  const yearsAgo = new Date().getFullYear() - memory.year;
  const photo = (memory.post.media ?? []).find((m) => m.type === "photo");
  const yearsLabel = yearsAgo === 1 ? "Jahr" : "Jahren";

  return (
    <AnimatedPressable
      onPress={() => {
        console.log("[Feed] Memory banner pressed, post id:", memory.post.id);
        router.push(`/post/${memory.post.id}`);
      }}
      style={{
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        padding: 14,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: "rgba(255,255,255,0.2)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Clock size={22} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "600", marginBottom: 2 }}>
          Heute vor {yearsAgo}
          {" "}
          {yearsLabel}
        </Text>
        <Text style={{ fontSize: 15, color: "#FFFFFF", fontWeight: "700" }} numberOfLines={1}>
          {memory.post.ai_title || (memory.post.text ?? '').slice(0, 50)}
        </Text>
      </View>
      {photo && (
        <Image
          source={resolveImageSource(photo.url)}
          style={{ width: 52, height: 52, borderRadius: 10 }}
          contentFit="cover"
        />
      )}
    </AnimatedPressable>
  );
}

function AnniversaryCard({ anniversary }: { anniversary: UpcomingAnniversary }) {
  const daysUntil = anniversary.days_until;
  let statusText: string;
  if (daysUntil === 0) {
    statusText = "heute";
  } else if (daysUntil === 1) {
    statusText = "in 1 Tag";
  } else {
    statusText = "in " + daysUntil + " Tagen";
  }

  return (
    <View
      style={{
        backgroundColor: "#FFF8E7",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#FFD166",
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: "rgba(255, 209, 102, 0.3)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 22 }}>🎉</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#7A4F00" }}>
          {anniversary.title}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#B07800", marginTop: 2 }}>
          {statusText}
        </Text>
      </View>
    </View>
  );
}

function BirthdayCard({ item }: { item: FeedItemBirthday }) {
  const { member, daysUntil, age } = item;

  let statusText: string;
  if (daysUntil === 0) {
    statusText = "Heute Geburtstag! 🎉";
  } else if (daysUntil === 1) {
    statusText = "Morgen Geburtstag!";
  } else {
    statusText = "In " + daysUntil + " Tagen Geburtstag";
  }

  const ageText = age !== null ? "wird " + age + " Jahre alt" : null;

  return (
    <View
      style={{
        backgroundColor: "#FFF8E7",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#FFD166",
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <AuthorAvatar author={member} size={44} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <Text style={{ fontSize: 18 }}>🎂</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#7A4F00" }}>
            {member.name}
          </Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#B07800" }}>
          {statusText}
        </Text>
        {ageText !== null && (
          <Text style={{ fontSize: 12, color: "#B07800", marginTop: 2 }}>
            {ageText}
          </Text>
        )}
      </View>
    </View>
  );
}

function EmptyState() {
  const router = useRouter();
  const headline = "✨ Eure Familiengeschichte beginnt hier";
  const subtitle = "Speichert Fotos, besondere Momente und Erinnerungen, die ihr nie vergessen möchtet.";

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 60 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          backgroundColor: COLORS.primaryMuted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 36 }}>📸</Text>
      </View>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: COLORS.text,
          textAlign: "center",
          marginBottom: 10,
          lineHeight: 28,
        }}
      >
        {headline}
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: COLORS.textSecondary,
          textAlign: "center",
          lineHeight: 22,
          marginBottom: 28,
        }}
      >
        {subtitle}
      </Text>
      <AnimatedPressable
        onPress={() => {
          console.log("[Feed] Empty state CTA pressed");
          router.push("/post/new");
        }}
        style={{
          backgroundColor: COLORS.primary,
          borderRadius: 14,
          paddingHorizontal: 24,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Plus size={18} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
          Ersten Moment teilen
        </Text>
      </AnimatedPressable>
      <InspirationChips />
    </View>
  );
}

function MemberFilterChips({
  members,
  selectedAuthorId,
  onSelect,
}: {
  members: FamilyMember[];
  selectedAuthorId: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  const allSelected = selectedAuthorId === undefined;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}
      style={{ marginBottom: 12 }}
    >
      <AnimatedPressable
        onPress={() => {
          console.log("[Feed] Author filter chip pressed: Alle");
          onSelect(undefined);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 20,
          backgroundColor: allSelected ? COLORS.primary : COLORS.surfaceSecondary,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: allSelected ? "#fff" : COLORS.textSecondary }}>
          Alle
        </Text>
      </AnimatedPressable>
      {members.map((member) => {
        const isSelected = selectedAuthorId === member.id;
        const firstName = (member.name || member.display_name || member.email || "?").split(" ")[0];
        return (
          <AnimatedPressable
            key={member.id}
            onPress={() => {
              console.log("[Feed] Author filter chip pressed:", member.id, member.name);
              onSelect(member.id);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: isSelected ? COLORS.primary : COLORS.surfaceSecondary,
            }}
          >
            <AuthorAvatar author={member} size={28} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: isSelected ? "#fff" : COLORS.textSecondary }}>
              {firstName}
            </Text>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { selectedAuthorId, setSelectedAuthorId } = useFilter();
  const [refreshing, setRefreshing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const feedQuery = useFeed(selectedAuthorId);
  const familyQuery = useFamily();
  const infinitePostsQuery = useInfinitePosts(selectedAuthorId);
  const todayMemoryQuery = useTodayMemory();

  const familyId = familyQuery.data?.id;

  const upcomingAnniversariesQuery = useQuery({
    queryKey: ["anniversaries", "upcoming", familyId],
    queryFn: async () => {
      console.log("[Feed] GET /api/anniversaries/upcoming");
      const data = await apiGet<{ anniversaries: UpcomingAnniversary[] }>("/api/anniversaries/upcoming");
      console.log("[Feed] Upcoming anniversaries loaded:", data.anniversaries?.length ?? 0);
      return data.anniversaries ?? [];
    },
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log("[Feed] Loading timeout reached, forcing content render");
      setTimedOut(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const feedItems = feedQuery.data ?? [];
  const family = familyQuery.data ?? null;

  const posts = infinitePostsQuery.data?.pages.flatMap((page) => page.posts) ?? [];

  const todayMemories = todayMemoryQuery.data ?? [];
  const todayMemory: TodayMemory | null = todayMemories[0] ?? null;

  const birthdayItems = feedItems.filter((item): item is FeedItemBirthday => item.kind === "birthday");

  const upcomingAnniversaries = (upcomingAnniversariesQuery.data ?? []).filter(
    (a) => a.days_until <= 7
  );

  const photoCount = posts.filter((p) => (p.media ?? []).some((m) => m.type === "photo")).length;
  const videoCount = posts.filter((p) => (p.media ?? []).some((m) => m.type === "video")).length;
  const memoryCount = posts.length;

  const loading = ((feedQuery.isPending && !feedQuery.data) || (familyQuery.isPending && !familyQuery.data)) && !timedOut;
  const error = feedQuery.isError || familyQuery.isError ? "Fehler beim Laden. Bitte versuche es erneut." : null;

  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (familyQuery.isFetched && !familyQuery.data && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      console.log("[Feed] No family found, redirecting to onboarding");
      router.replace("/onboarding");
    }
  }, [familyQuery.isFetched, familyQuery.data, router]);

  const handleRefresh = () => {
    console.log("[Feed] Pull to refresh triggered");
    setRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ["posts", "infinite"] });
    queryClient.invalidateQueries({ queryKey: ["feed"] });
    queryClient.invalidateQueries({ queryKey: ["anniversaries", "upcoming"] });
    Promise.all([
      infinitePostsQuery.refetch(),
      feedQuery.refetch(),
      familyQuery.refetch(),
      upcomingAnniversariesQuery.refetch(),
    ]).finally(() => {
      setRefreshing(false);
    });
  };

  const handleRetry = () => {
    console.log("[Feed] Retry button pressed");
    infinitePostsQuery.refetch();
    feedQuery.refetch();
    familyQuery.refetch();
  };

  const handleLoadMore = () => {
    if (infinitePostsQuery.hasNextPage && !infinitePostsQuery.isFetchingNextPage) {
      console.log("[Feed] Loading next page");
      infinitePostsQuery.fetchNextPage();
    }
  };

  const renderHeader = () => (
    <View>
      {/* Editorial Header */}
      <View style={{ alignItems: "center", paddingBottom: 24 }}>
        <PolaroidStack posts={posts} topPadding={insets.top + 16} />
        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: COLORS.text,
            textAlign: "center",
            letterSpacing: -0.5,
            marginTop: 20,
            paddingHorizontal: 24,
          }}
        >
          Eure Familiengeschichte
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: COLORS.textSecondary,
            textAlign: "center",
            marginTop: 6,
            paddingHorizontal: 32,
          }}
        >
          Momente festhalten. Erinnerungen bewahren.
        </Text>
        {family && (
          <View
            style={{
              backgroundColor: COLORS.primaryMuted,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 4,
              marginTop: 12,
            }}
          >
            <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: "600" }}>
              {family.name}
            </Text>
          </View>
        )}
        {family && family.members && family.members.length > 0 && (
          <View style={{ alignItems: "center", marginTop: 12 }}>
            <MemberAvatarRow members={family.members} />
          </View>
        )}
      </View>

      {/* Today's Memory Banner */}
      {todayMemory && <MemoryBanner memory={todayMemory} />}

      {/* Upcoming Anniversaries */}
      {upcomingAnniversaries.map((anniversary) => (
        <AnniversaryCard key={anniversary.id} anniversary={anniversary} />
      ))}

      {/* Stats row — only when posts exist */}
      {posts.length > 0 && <StatsRow photos={photoCount} videos={videoCount} memories={memoryCount} />}

      {/* Author filter chips */}
      {family && family.members && family.members.length > 0 && (
        <MemberFilterChips
          members={family.members}
          selectedAuthorId={selectedAuthorId}
          onSelect={setSelectedAuthorId}
        />
      )}

      {/* Birthday cards */}
      {birthdayItems.map((item) => (
        <BirthdayCard key={item.member.id} item={item} />
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {renderHeader()}
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        {renderHeader()}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 16, color: COLORS.danger, textAlign: "center", marginBottom: 16 }}>
            {error}
          </Text>
          <AnimatedPressable
            onPress={handleRetry}
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: "#FFF", fontWeight: "600" }}>Erneut versuchen</Text>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <PostCard post={item} index={index} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<EmptyState />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.8}
        ListFooterComponent={
          infinitePostsQuery.isFetchingNextPage ? (
            <View style={{ paddingVertical: 8 }}>
              <PostCardSkeleton />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
