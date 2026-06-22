import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Animated,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { Plus, Clock, ChevronRight } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatRelativeDate } from "@/utils/dateUtils";
import { SkeletonLine } from "@/components/SkeletonLine";
import { InspirationChips } from "@/components/InspirationChips";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import { useFeed } from "@/hooks/useFeed";
import { useFamily } from "@/hooks/useFamily";
import type { Post, FamilyMember, FamilyStats, TodayMemory, FeedItemPost, FeedItemBirthday } from "@/types";
import type { ImageSourcePropType } from "react-native";

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

function MemberAvatarRow({ members }: { members: FamilyMember[] }) {
  const visible = members.slice(0, 5);
  return (
    <View style={{ flexDirection: "row", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
      {visible.map((member) => {
        const firstName = (member.name ?? "").split(" ")[0] || "?";
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

function StatsRow({ stats }: { stats: FamilyStats }) {
  const photosLabel = "Fotos";
  const videosLabel = "Videos";
  const memoriesLabel = "Erinnerungen";
  const photosCount = String(stats.photos);
  const videosCount = String(stats.videos);
  const memoriesCount = String(stats.memories);

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

function PostCard({ post, index }: { post: Post; index: number }) {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const isProcessing = post.ai_status === "processing" || post.ai_status === "pending";
  const media = post.media ?? [];
  const relativeDate = formatRelativeDate(post.created_at);

  const handlePress = () => {
    console.log("[Feed] Post card pressed, id:", post.id);
    router.push(`/post/${post.id}`);
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable
        onPress={handlePress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: COLORS.cardShadow,
        }}
      >
        {/* Author row */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
          <AuthorAvatar author={post.author} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>
              {post.author.name || "Unbekannt"}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary }}>
              {relativeDate}
            </Text>
          </View>
          <ChevronRight size={16} color={COLORS.textTertiary} />
        </View>

        {/* Title */}
        {isProcessing ? (
          <View style={{ gap: 8, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: "600" }}>
                KI schreibt...
              </Text>
            </View>
            <SkeletonLine width="75%" height={20} />
            <SkeletonLine width="100%" height={13} />
            <SkeletonLine width="60%" height={13} />
          </View>
        ) : (
          <View style={{ marginBottom: 10 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: COLORS.text,
                letterSpacing: -0.3,
                marginBottom: 6,
                lineHeight: 24,
              }}
              numberOfLines={2}
            >
              {post.ai_title || (post.text ?? '').slice(0, 60)}
            </Text>
            {post.ai_story ? (
              <Text
                style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 24, fontWeight: "500" }}
              >
                {post.ai_story}
              </Text>
            ) : (
              <Text
                style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 24, fontWeight: "500" }}
                numberOfLines={3}
              >
                {post.text}
              </Text>
            )}
          </View>
        )}

        {/* Media */}
        {media.length > 0 && (
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
            {media.slice(0, 3).map((item, i) => (
              <View key={item.id} style={{ flex: 1, position: "relative" }}>
                {item.type === "video" ? (
                  <Video
                    source={{ uri: item.url }}
                    style={{
                      height: media.length === 1 ? 180 : 100,
                      borderRadius: 10,
                    }}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                  />
                ) : (
                  <Image
                    source={resolveImageSource(item.url)}
                    style={{
                      height: media.length === 1 ? 180 : 100,
                      borderRadius: 10,
                    }}
                    contentFit="cover"
                  />
                )}
                {i === 2 && media.length > 3 && (
                  <View
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 10,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>
                      +{media.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {post.tags.slice(0, 4).map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: "600" }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
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
        const firstName = (member.name ?? "").split(" ")[0] || "?";
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
  const [stats, setStats] = useState<FamilyStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | undefined>(undefined);
  const [timedOut, setTimedOut] = useState(false);

  const feedQuery = useFeed(selectedAuthorId);
  const familyQuery = useFamily();

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log("[Feed] Loading timeout reached, forcing content render");
      setTimedOut(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const feedItems = feedQuery.data ?? [];
  const family = familyQuery.data ?? null;

  const postItems = feedItems.filter((item): item is FeedItemPost => item.kind === "post");
  const posts = postItems.map((item) => item.post);

  const firstMemoryItem = feedItems.find((item) => item.kind === "memory");
  const todayMemory: TodayMemory | null = firstMemoryItem && firstMemoryItem.kind === "memory"
    ? { id: firstMemoryItem.post.id, year: firstMemoryItem.year, post: firstMemoryItem.post }
    : null;

  const birthdayItems = feedItems.filter((item): item is FeedItemBirthday => item.kind === "birthday");

  const loading = ((feedQuery.isPending && !feedQuery.data) || (familyQuery.isPending && !familyQuery.data)) && !timedOut;
  const error = feedQuery.isError || familyQuery.isError ? "Fehler beim Laden. Bitte versuche es erneut." : null;

  useEffect(() => {
    if (familyQuery.isFetched && !familyQuery.data) {
      console.log("[Feed] No family found, redirecting to onboarding");
      router.replace("/onboarding");
    }
  }, [familyQuery.isFetched, familyQuery.data, router]);

  useEffect(() => {
    if (family && posts.length > 0) {
      apiGet<FamilyStats>("/api/families/stats")
        .then((s) => {
          console.log("[Feed] Stats loaded:", s);
          setStats(s);
        })
        .catch(() => {
          console.log("[Feed] Stats fetch failed, skipping stats row");
        });
    }
  }, [family, posts.length]);

  const handleRefresh = () => {
    console.log("[Feed] Pull to refresh triggered");
    setRefreshing(true);
    Promise.all([feedQuery.refetch(), familyQuery.refetch()]).finally(() => {
      setRefreshing(false);
    });
  };

  const handleRetry = () => {
    console.log("[Feed] Retry button pressed");
    feedQuery.refetch();
    familyQuery.refetch();
  };

  const renderHeader = () => (
    <View>
      {/* App Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 }}>
          Famly
        </Text>
        {family && (
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, fontWeight: "500", marginTop: 2 }}>
            {family.name}
          </Text>
        )}
        {family && family.members && family.members.length > 0 && (
          <MemberAvatarRow members={family.members} />
        )}
      </View>

      {/* Today's Memory Banner */}
      {todayMemory && <MemoryBanner memory={todayMemory} />}

      {/* Stats row — only when posts exist */}
      {posts.length > 0 && stats && <StatsRow stats={stats} />}

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
