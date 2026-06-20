import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Animated,
  Pressable,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Clock } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet } from "@/utils/api";
import { formatRelativeDate, getYear, getMonthName } from "@/utils/dateUtils";

interface Post {
  id: string;
  text: string;
  ai_title?: string;
  ai_story?: string;
  ai_status: string;
  tags: string[];
  created_at: string;
  author: { id: string; name: string; image?: string };
  media: Array<{ id: string; public_url: string; media_type: string }>;
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

function PostThumbnail({ post }: { post: Post }) {
  const router = useRouter();
  const photo = post.media.find((m) => m.media_type === "image");

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
        <Image source={{ uri: photo.public_url }} style={{ width: 100, height: 100 }} contentFit="cover" />
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
            {post.ai_title || post.text.slice(0, 40)}
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
  const photo = memory.post.media.find((m) => m.media_type === "image");

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 350, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

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
          <Image source={{ uri: photo.public_url }} style={{ width: 200, height: 120 }} contentFit="cover" />
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
              vor {yearsAgo} {yearsAgo === 1 ? "Jahr" : "Jahren"}
            </Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }} numberOfLines={2}>
            {memory.post.ai_title || memory.post.text.slice(0, 60)}
          </Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const [todayMemories, setTodayMemories] = useState<TodayMemory[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
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
        ? Array.isArray(memoriesData)
          ? memoriesData
          : [memoriesData]
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

        {/* Today's Memories */}
        {loading ? (
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
        ) : null}

        {/* Year Selector */}
        {availableYears.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {availableYears.map((year) => (
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
                    backgroundColor: selectedYear === year ? COLORS.primary : COLORS.surfaceSecondary,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: selectedYear === year ? "#FFFFFF" : COLORS.textSecondary,
                    }}
                  >
                    {year}
                  </Text>
                </AnimatedPressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Timeline by Month */}
        {loading ? (
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
        ) : (
          <View style={{ alignItems: "center", paddingTop: 40, paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 16, color: COLORS.textSecondary, textAlign: "center" }}>
              Keine Erinnerungen für {selectedYear}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
