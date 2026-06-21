import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Clock, Plus } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet } from "@/utils/api";
import { formatRelativeDate, getYear, getMonthName } from "@/utils/dateUtils";
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
  ai_status: string;
  tags: string[];
  created_at: string;
  author: { id: string; name: string; image?: string };
  media: Array<{ id: string; url: string; type: string }>;
}

interface TodayMemory {
  id: string;
  year: number;
  post: Post;
}

interface TimelineEntry {
  year: number;
  month: string;
  posts: Post[];
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
      <Animated.View style={{ flex: 1, backgroundColor: COLORS.surfaceSecondary, opacity }} />
    </View>
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
              console.log("[Memories] Inspiration chip pressed:", chip.label);
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

function EmptyStateNoData() {
  const router = useRouter();
  const headline = "✨ Eure Familiengeschichte beginnt hier";
  const subtitle = "Speichert Fotos, besondere Momente und Erinnerungen, die ihr nie vergessen möchtet.";

  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, paddingTop: 60, paddingBottom: 40 }}>
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
          console.log("[Memories] Empty state CTA pressed");
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

function PostThumbnail({ post }: { post: Post }) {
  const router = useRouter();
  const photo = post.media.find((m) => m.type === "photo");
  const titleText = post.ai_title || post.text.slice(0, 40);

  const handlePress = () => {
    console.log("[Memories] Post thumbnail pressed, id:", post.id);
    router.push(`/post/${post.id}`);
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={{
        width: 100,
        height: 100,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: COLORS.surfaceSecondary,
      }}
    >
      {photo ? (
        <Image source={resolveImageSource(photo.url)} style={{ width: 100, height: 100 }} contentFit="cover" />
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
          }}
        >
          <Text style={{ fontSize: 10, color: COLORS.textSecondary, textAlign: "center" }} numberOfLines={3}>
            {titleText}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

function MemoryCard({ memory, index }: { memory: TodayMemory; index: number }) {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(20)).current;
  const yearsAgo = new Date().getFullYear() - memory.year;
  const yearsLabel = yearsAgo === 1 ? "Jahr" : "Jahren";

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 350, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  if (!memory?.post) return null;
  const photo = memory.post.media.find((m) => m.type === "photo");
  const cardTitle = memory.post.ai_title || memory.post.text.slice(0, 60);
  const yearsAgoText = "vor " + yearsAgo + " " + yearsLabel;

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <AnimatedPressable
        onPress={() => {
          console.log("[Memories] Memory card pressed, post id:", memory.post.id);
          router.push(`/post/${memory.post.id}`);
        }}
        style={{
          width: 200,
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          overflow: "hidden",
          marginRight: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: COLORS.cardShadow,
        }}
      >
        {photo && (
          <Image source={resolveImageSource(photo.url)} style={{ width: 200, height: 120 }} contentFit="cover" />
        )}
        <View style={{ padding: 12 }}>
          <View
            style={{
              backgroundColor: COLORS.primaryMuted,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
              alignSelf: "flex-start",
              marginBottom: 6,
            }}
          >
            <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: "700" }}>
              {yearsAgoText}
            </Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }} numberOfLines={2}>
            {cardTitle}
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const [todayMemories, setTodayMemories] = useState<TodayMemory[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    console.log("[Memories] Loading memories data");
    try {
      const [memoriesData, postsData] = await Promise.all([
        apiGet<TodayMemory | TodayMemory[]>("/api/memories/today").catch(() => null),
        apiGet<Post[]>("/api/posts").catch(() => []),
      ]);

      console.log("[Memories] Data loaded");

      const memories = memoriesData
        ? (Array.isArray(memoriesData) ? memoriesData : [memoriesData]).filter(m => m?.post)
        : [];
      setTodayMemories(memories);

      const posts = Array.isArray(postsData) ? postsData : [];
      setAllPosts(posts);

      const years = [...new Set(posts.map((p) => getYear(p.created_at)))].sort((a, b) => b - a);
      setAvailableYears(years);
      if (years.length > 0) setSelectedYear(years[0]);
    } catch (err) {
      console.error("[Memories] Load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPosts = allPosts.filter((p) => getYear(p.created_at) === selectedYear);

  const groupedByMonth = filteredPosts.reduce<Record<string, Post[]>>((acc, post) => {
    const month = getMonthName(post.created_at);
    if (!acc[month]) acc[month] = [];
    acc[month].push(post);
    return acc;
  }, {});

  const monthGroups = Object.entries(groupedByMonth).map(([month, posts]) => ({ month, posts }));

  const hasNoPosts = !loading && allPosts.length === 0;
  const hasPostsButNoneForYear = !loading && allPosts.length > 0 && filteredPosts.length === 0;
  const noDataText = "Keine Erinnerungen für " + selectedYear;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              console.log("[Memories] Pull to refresh");
              setRefreshing(true);
              loadData();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 }}>
            Erinnerungen
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 2 }}>
            Eure gemeinsame Geschichte
          </Text>
        </View>

        {/* Full empty state — no posts at all */}
        {hasNoPosts && <EmptyStateNoData />}

        {/* Today's Memories */}
        {!hasNoPosts && (
          loading ? (
            <View style={{ paddingHorizontal: 20, marginBottom: 24, gap: 8 }}>
              <SkeletonLine width={160} height={16} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <SkeletonLine width={200} height={180} />
                <SkeletonLine width={200} height={180} />
              </View>
            </View>
          ) : todayMemories.length > 0 ? (
            <View style={{ marginBottom: 28 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, marginBottom: 12 }}>
                <Clock size={18} color={COLORS.primary} />
                <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text }}>
                  Heute vor X Jahren
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              >
                {todayMemories.map((memory, i) => (
                  <MemoryCard key={memory.id} memory={memory} index={i} />
                ))}
              </ScrollView>
            </View>
          ) : null
        )}

        {/* Year Selector */}
        {!hasNoPosts && availableYears.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {availableYears.map((year) => {
                const isSelected = selectedYear === year;
                const chipBg = isSelected ? COLORS.primary : COLORS.surfaceSecondary;
                const chipColor = isSelected ? "#FFFFFF" : COLORS.textSecondary;
                return (
                  <AnimatedPressable
                    key={year}
                    onPress={() => {
                      console.log("[Memories] Year selected:", year);
                      setSelectedYear(year);
                    }}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: chipBg,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "600", color: chipColor }}>
                      {year}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Timeline by Month */}
        {!hasNoPosts && (
          loading ? (
            <View style={{ paddingHorizontal: 20, gap: 20 }}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ gap: 12 }}>
                  <SkeletonLine width={100} height={16} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <SkeletonLine width={100} height={100} />
                    <SkeletonLine width={100} height={100} />
                    <SkeletonLine width={100} height={100} />
                  </View>
                </View>
              ))}
            </View>
          ) : monthGroups.length > 0 ? (
            <View style={{ paddingHorizontal: 20, gap: 24 }}>
              {monthGroups.map(({ month, posts }) => (
                <View key={month}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: COLORS.text,
                      marginBottom: 12,
                      textTransform: "capitalize",
                    }}
                  >
                    {month}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {posts.map((post) => (
                      <PostThumbnail key={post.id} post={post} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : hasPostsButNoneForYear ? (
            <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 32 }}>
              <Text style={{ fontSize: 16, color: COLORS.textSecondary, textAlign: "center" }}>
                {noDataText}
              </Text>
            </View>
          ) : null
        )}
      </ScrollView>
    </View>
  );
}
