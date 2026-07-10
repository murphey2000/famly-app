import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Newspaper, Camera, Video, Sparkles } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SkeletonLine } from "@/components/SkeletonLine";
import { apiGet } from "@/utils/api";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

interface NewsletterHighlight {
  title: string;
  text: string;
  author: string;
}

interface NewsletterContent {
  subject: string;
  headline: string;
  intro: string;
  highlights: NewsletterHighlight[];
  stats: {
    photos: number;
    videos: number;
    moments: number;
  };
  closing: string;
}

interface Newsletter {
  id: string;
  month: number;
  year: number;
  content: NewsletterContent;
  generated_at: string;
}

interface NewslettersResponse {
  newsletters: Newsletter[];
}

function NewsletterCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 12,
      }}
    >
      <SkeletonLine width="50%" height={14} />
      <SkeletonLine width="85%" height={18} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SkeletonLine width={72} height={26} />
        <SkeletonLine width={72} height={26} />
        <SkeletonLine width={80} height={26} />
      </View>
    </View>
  );
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  const displayValue = String(value);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: COLORS.surfaceSecondary,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      {icon}
      <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.textSecondary }}>
        {displayValue}
      </Text>
      <Text style={{ fontSize: 12, color: COLORS.textTertiary }}>
        {label}
      </Text>
    </View>
  );
}

function AnimatedNewsletterCard({ item, index, onPress }: { item: Newsletter; index: number; onPress: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 70, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const monthName = MONTH_NAMES[(item.month || 1) - 1] || String(item.month);
  const monthYearText = `${monthName} ${item.year}`;
  const headline = item.content?.headline || item.content?.subject || monthYearText;
  const photos = item.content?.stats?.photos ?? 0;
  const videos = item.content?.stats?.videos ?? 0;
  const moments = item.content?.stats?.moments ?? 0;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable
        onPress={onPress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: COLORS.cardShadow,
          gap: 10,
        }}
      >
        {/* Month label */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              backgroundColor: COLORS.primaryMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Newspaper size={16} color={COLORS.primary} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.primary, letterSpacing: 0.2 }}>
            {monthYearText}
          </Text>
        </View>

        {/* Headline */}
        <Text
          style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, lineHeight: 22 }}
          numberOfLines={2}
        >
          {headline}
        </Text>

        {/* Stats chips */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <StatChip
            icon={<Camera size={12} color={COLORS.textSecondary} />}
            value={photos}
            label="Fotos"
          />
          <StatChip
            icon={<Video size={12} color={COLORS.textSecondary} />}
            value={videos}
            label="Videos"
          />
          <StatChip
            icon={<Sparkles size={12} color={COLORS.textSecondary} />}
            value={moments}
            label="Momente"
          />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function NewslettersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, error } = useQuery<NewslettersResponse>({
    queryKey: ["newsletters"],
    queryFn: () => {
      console.log("[Newsletters] GET /api/newsletters");
      return apiGet<NewslettersResponse>("/api/newsletters");
    },
  });

  const newsletters = data?.newsletters ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.divider,
        }}
      >
        <AnimatedPressable
          onPress={() => {
            console.log("[Newsletters] Back button pressed");
            router.back();
          }}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityLabel="Zurück"
        >
          <ChevronLeft size={22} color={COLORS.text} />
        </AnimatedPressable>
        <Text style={{ fontSize: 20, fontWeight: "700", color: COLORS.text, letterSpacing: -0.3 }}>
          Monatsrückblick
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ gap: 14 }}>
            <NewsletterCardSkeleton />
            <NewsletterCardSkeleton />
            <NewsletterCardSkeleton />
          </View>
        ) : isError ? (
          <View
            style={{
              backgroundColor: COLORS.dangerMuted,
              borderRadius: 14,
              padding: 18,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.danger }}>
              Rückblicke konnten nicht geladen werden
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.danger, opacity: 0.8 }}>
              {(error as Error)?.message || "Bitte überprüfe deine Internetverbindung."}
            </Text>
          </View>
        ) : newsletters.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 20 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: COLORS.primaryMuted,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 18,
              }}
            >
              <Newspaper size={32} color={COLORS.primary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 8, textAlign: "center" }}>
              Noch kein Rückblick vorhanden
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: "center", lineHeight: 22, maxWidth: 280 }}>
              Der erste wird am 1. des nächsten Monats automatisch erstellt.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {newsletters.map((item, index) => (
              <AnimatedNewsletterCard
                key={item.id}
                item={item}
                index={index}
                onPress={() => {
                  console.log("[Newsletters] Newsletter card pressed:", item.id, item.month, item.year);
                  router.push(`/(tabs)/settings/newsletter/${item.id}`);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
