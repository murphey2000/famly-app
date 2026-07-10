import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Camera, Video, Sparkles, User } from "lucide-react-native";
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

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  const displayValue = String(value);
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        backgroundColor: COLORS.surfaceSecondary,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 8,
        gap: 6,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      {icon}
      <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.text }}>{displayValue}</Text>
      <Text style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

function HighlightCard({ highlight, index }: { highlight: NewsletterHighlight; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: 200 + index * 80, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: 200 + index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        boxShadow: COLORS.cardShadow,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text, lineHeight: 21 }}>
        {highlight.title}
      </Text>
      <Text style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 21 }}>
        {highlight.text}
      </Text>
      {highlight.author ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            alignSelf: "flex-start",
            backgroundColor: COLORS.primaryMuted,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <User size={11} color={COLORS.primary} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.primary }}>
            {highlight.author}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function NewsletterDetailContent({ newsletter }: { newsletter: Newsletter }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [newsletter.id]);

  const monthName = MONTH_NAMES[(newsletter.month || 1) - 1] || String(newsletter.month);
  const monthYearText = `${monthName} ${newsletter.year}`;
  const content = newsletter.content;
  const photos = content?.stats?.photos ?? 0;
  const videos = content?.stats?.videos ?? 0;
  const moments = content?.stats?.moments ?? 0;
  const highlights = content?.highlights ?? [];

  return (
    <Animated.View style={{ opacity: fadeAnim, gap: 20 }}>
      {/* Hero */}
      <View
        style={{
          backgroundColor: COLORS.primary,
          borderRadius: 20,
          padding: 24,
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600", letterSpacing: 0.5 }}>
          {monthYearText}
        </Text>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: "#FFFFFF",
            textAlign: "center",
            letterSpacing: -0.3,
            lineHeight: 29,
          }}
        >
          {content?.headline || monthYearText}
        </Text>
      </View>

      {/* Intro */}
      {content?.intro ? (
        <View
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 14,
            padding: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 23 }}>
            {content.intro}
          </Text>
        </View>
      ) : null}

      {/* Stats */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <StatPill
          icon={<Camera size={18} color={COLORS.primary} />}
          value={photos}
          label="Fotos"
        />
        <StatPill
          icon={<Video size={18} color={COLORS.accent} />}
          value={videos}
          label="Videos"
        />
        <StatPill
          icon={<Sparkles size={18} color={COLORS.textSecondary} />}
          value={moments}
          label="Momente"
        />
      </View>

      {/* Highlights */}
      {highlights.length > 0 ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text, letterSpacing: -0.2 }}>
            Highlights
          </Text>
          {highlights.map((highlight, i) => (
            <HighlightCard key={i} highlight={highlight} index={i} />
          ))}
        </View>
      ) : null}

      {/* Closing */}
      {content?.closing ? (
        <View
          style={{
            backgroundColor: COLORS.primaryMuted,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: "rgba(217, 119, 6, 0.15)",
          }}
        >
          <Text
            style={{
              fontSize: 15,
              color: COLORS.text,
              lineHeight: 23,
              fontStyle: "italic",
              textAlign: "center",
            }}
          >
            {`"${content.closing}"`}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

export default function NewsletterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, error } = useQuery<NewslettersResponse>({
    queryKey: ["newsletters"],
    queryFn: () => {
      console.log("[Newsletter Detail] GET /api/newsletters (from cache or network)");
      return apiGet<NewslettersResponse>("/api/newsletters");
    },
    staleTime: 5 * 60 * 1000,
  });

  const newsletter = data?.newsletters?.find((n) => n.id === id) ?? null;

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
            console.log("[Newsletter Detail] Back button pressed");
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
          Rückblick
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ gap: 16 }}>
            <SkeletonLine width="100%" height={120} />
            <SkeletonLine width="100%" height={80} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <SkeletonLine width="30%" height={90} />
              <SkeletonLine width="30%" height={90} />
              <SkeletonLine width="30%" height={90} />
            </View>
            <SkeletonLine width="100%" height={100} />
            <SkeletonLine width="100%" height={100} />
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
              Rückblick konnte nicht geladen werden
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.danger, opacity: 0.8 }}>
              {(error as Error)?.message || "Bitte überprüfe deine Internetverbindung."}
            </Text>
          </View>
        ) : newsletter ? (
          <NewsletterDetailContent newsletter={newsletter} />
        ) : (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 8 }}>
              Rückblick nicht gefunden
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: "center" }}>
              Dieser Rückblick ist nicht mehr verfügbar.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
