import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { usePosts } from "@/hooks/usePosts";
import { useFamily } from "@/hooks/useFamily";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import { useTodayMemory } from "@/hooks/useTodayMemory";
import { formatRelativeDate, getYear, getMonthName } from "@/utils/dateUtils";
import { SkeletonLine } from "@/components/SkeletonLine";
import { InspirationChips } from "@/components/InspirationChips";
import type { Post, TodayMemory, FamilyMember } from "@/types";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function computeDaysUntilBirthday(birthdayStr: string): number {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  const parts = birthdayStr.split("-");
  const bMonth = parseInt(parts[1] ?? "1", 10);
  const bDay = parseInt(parts[2] ?? "1", 10);

  const todayDayOfYear = todayMonth * 100 + todayDay;
  const bDayOfYear = bMonth * 100 + bDay;

  if (bDayOfYear >= todayDayOfYear) {
    // Birthday is later this year
    const thisYearBirthday = new Date(today.getFullYear(), bMonth - 1, bDay);
    const diff = thisYearBirthday.getTime() - new Date(today.getFullYear(), todayMonth - 1, todayDay).getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  } else {
    // Birthday is next year
    const nextYearBirthday = new Date(today.getFullYear() + 1, bMonth - 1, bDay);
    const diff = nextYearBirthday.getTime() - new Date(today.getFullYear(), todayMonth - 1, todayDay).getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }
}

function BirthdayBanner({ members }: { members: FamilyMember[] }) {
  const upcomingMembers = useMemo(() => {
    return members
      .filter((m) => !!m.birthday)
      .map((m) => ({ member: m, daysUntil: computeDaysUntilBirthday(m.birthday!) }))
      .filter((entry) => entry.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [members]);

  if (upcomingMembers.length === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, marginBottom: 12 }}>
        <Text style={{ fontSize: 18 }}>🎂</Text>
        <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text }}>
          Bald Geburtstag
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {upcomingMembers.map(({ member, daysUntil }) => {
          let statusText: string;
          if (daysUntil === 0) {
            statusText = "Heute!";
          } else if (daysUntil === 1) {
            statusText = "Morgen!";
          } else {
            statusText = "in " + daysUntil + " Tagen";
          }

          return (
            <View
              key={member.id}
              style={{
                backgroundColor: "#FFF8E7",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#FFD166",
                padding: 12,
                alignItems: "center",
                gap: 6,
                minWidth: 90,
              }}
            >
              <AuthorAvatar author={member} size={36} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#7A4F00", textAlign: "center" }} numberOfLines={1}>
                {member.name.split(" ")[0]}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#B07800", textAlign: "center" }}>
                {statusText}
              </Text>
            </View>
          );
        })}
      </ScrollView>
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
  const photo = (post.media ?? []).find((m) => m.type === "photo");
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
  const photo = (memory.post.media ?? []).find((m) => m.type === "photo");
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
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 4 }}
      style={{ marginBottom: 16 }}
    >
      <AnimatedPressable
        onPress={() => {
          console.log("[Memories] Author filter chip pressed: Alle");
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
              console.log("[Memories] Author filter chip pressed:", member.id, member.name);
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

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | undefined>(undefined);

  const postsQuery = usePosts(selectedAuthorId);
  const { data: family } = useFamily();
  const todayMemoryQuery = useTodayMemory();

  const allPosts = postsQuery.data ?? [];
  const todayMemories = todayMemoryQuery.data ?? [];
  const loading = postsQuery.isLoading || todayMemoryQuery.isLoading;

  const availableYears = useMemo(
    () => [...new Set(allPosts.map((p) => getYear(p.created_at)))].sort((a, b) => b - a),
    [allPosts]
  );

  useEffect(() => {
    if (availableYears.length > 0) setSelectedYear(availableYears[0]);
  }, [availableYears]);

  const handleRefresh = () => {
    console.log("[Memories] Pull to refresh");
    setRefreshing(true);
    Promise.all([postsQuery.refetch(), todayMemoryQuery.refetch()]).finally(() => setRefreshing(false));
  };

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

  const familyMembers = family?.members ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
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

        {/* Birthday Banner */}
        {!hasNoPosts && familyMembers.length > 0 && (
          <BirthdayBanner members={familyMembers} />
        )}

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
                  {(() => {
                    const yearsAgo = new Date().getFullYear() - todayMemories[0].year;
                    const yearsLabel = yearsAgo === 1 ? "Jahr" : "Jahren";
                    return "Heute vor " + yearsAgo + " " + yearsLabel;
                  })()}
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

        {/* Author filter chips */}
        {!hasNoPosts && family && family.members && family.members.length > 0 && (
          <MemberFilterChips
            members={family.members}
            selectedAuthorId={selectedAuthorId}
            onSelect={setSelectedAuthorId}
          />
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
