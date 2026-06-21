import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { Plus, Clock, ChevronRight } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatRelativeDate } from "@/utils/dateUtils";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

interface Post {
  id: string;
  text: string;
  ai_title?: string;
  ai_story?: string;
  ai_status: "pending" | "processing" | "done" | "failed";
  tags: string[];
  created_at: string;
  author: {
    id: string;
    name: string;
    image?: string;
  };
  media: Array<{
    id: string;
    public_url: string;
    media_type: string;
  }>;
}

interface FamilyMember {
  id: string;
  name: string;
  image?: string;
  email?: string;
}

interface Family {
  id: string;
  name: string;
  members?: FamilyMember[];
}

interface TodayMemory {
  id: string;
  year: number;
  post: Post;
}

interface FamilyStats {
  photos: number;
  videos: number;
  memories: number;
}

const INSPIRATION_CHIPS = [
  { emoji: "📸", label: "Erster Schultag" },
  { emoji: "🎂", label: "Geburtstage" },
  { emoji: "🏖", label: "Familienurlaub" },
  { emoji: "⚽", label: "Erstes Fußballspiel" },
  { emoji: "🐶", label: "Neues Haustier" },
];

function SkeletonLine({ width, height = 14 }: { width: number | `${number}%`; height?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width, height, borderRadius: height / 2, overflow: "hidden" }}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: COLORS.surfaceSecondary,
          opacity,
        }}
      />
    </View>
  );
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

function AuthorAvatar({ author, size = 40 }: { author: { name: string; image?: string }; size?: number }) {
  const initials = (author.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (author.image) {
    return (
      <Image
        source={resolveImageSource(author.image)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.primaryMuted,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.35, fontWeight: "700", color: COLORS.primary }}>
        {initials}
      </Text>
    </View>
  );
}

function MemberAvatarRow({ members }: { members: FamilyMember[] }) {
  const visible = members.slice(0, 5);
  return (
    <View style={{ flexDirection: "row", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
      {visible.map((member) => {
        const firstName = member.name.split(" ")[0];
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
  const photos = post.media.filter((m) => m.media_type === "image");
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
              {post.ai_title || post.text.slice(0, 60)}
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

        {/* Photos */}
        {photos.length > 0 && (
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
            {photos.slice(0, 3).map((photo, i) => (
              <View key={photo.id} style={{ flex: 1, position: "relative" }}>
                <Image
                  source={resolveImageSource(photo.public_url)}
                  style={{
                    height: photos.length === 1 ? 180 : 100,
                    borderRadius: 10,
                  }}
                  contentFit="cover"
                />
                {i === 2 && photos.length > 3 && (
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
                      +{photos.length - 3}
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
  const photo = memory.post.media.find((m) => m.media_type === "image");
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
          {memory.post.ai_title || memory.post.text.slice(0, 50)}
        </Text>
      </View>
      {photo && (
        <Image
          source={resolveImageSource(photo.public_url)}
          style={{ width: 52, height: 52, borderRadius: 10 }}
          contentFit="cover"
        />
      )}
    </AnimatedPressable>
  );
}

function InspirationChips() {
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
      {INSPIRATION_CHIPS.map((chip) => {
        const chipLabel = chip.emoji + " " + chip.label;
        return (
          <AnimatedPressable
            key={chip.label}
            onPress={() => {
              console.log("[Feed] Inspiration chip pressed:", chip.label);
              router.push("/post/new");
            }}
            style={{
              backgroundColor: COLORS.surfaceSecondary,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" }}>
              {chipLabel}
            </Text>
          </AnimatedPressable>
        );
      })}
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

export default function FeedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<Post[]>([]);
  const [family, setFamily] = useState<Family | null>(null);
  const [todayMemory, setTodayMemory] = useState<TodayMemory | null>(null);
  const [stats, setStats] = useState<FamilyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    console.log("[Feed] Loading feed data");
    try {
      setError(null);
      const [familyData, postsData, memoryData] = await Promise.all([
        apiGet<Family | Family[]>("/api/families").catch(() => null),
        apiGet<Post[]>("/api/posts").catch(() => []),
        apiGet<TodayMemory>("/api/memories/today").catch(() => null),
      ]);

      console.log("[Feed] Data loaded - family:", familyData, "posts count:", Array.isArray(postsData) ? postsData.length : 0);

      if (familyData) {
        const fam = Array.isArray(familyData) ? familyData[0] : familyData;
        setFamily(fam || null);
        if (!fam) {
          console.log("[Feed] No family found, redirecting to onboarding");
          router.replace("/onboarding");
          return;
        }

        // Fetch stats only when we have a family and posts
        const resolvedPosts = Array.isArray(postsData) ? postsData : [];
        if (resolvedPosts.length > 0) {
          apiGet<FamilyStats>("/api/families/stats")
            .then((s) => {
              console.log("[Feed] Stats loaded:", s);
              setStats(s);
            })
            .catch(() => {
              console.log("[Feed] Stats fetch failed, skipping stats row");
            });
        }
      } else {
        console.log("[Feed] No family data, redirecting to onboarding");
        router.replace("/onboarding");
        return;
      }

      setPosts(Array.isArray(postsData) ? postsData : []);
      setTodayMemory(memoryData?.post ? memoryData : null);
    } catch (err: any) {
      console.error("[Feed] Load error:", err);
      setError("Fehler beim Laden. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    console.log("[Feed] Pull to refresh triggered");
    setRefreshing(true);
    loadData();
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
            onPress={() => {
              console.log("[Feed] Retry button pressed");
              setLoading(true);
              loadData();
            }}
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
