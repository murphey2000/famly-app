import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Newspaper, RefreshCw, Users, Image as ImageIcon, FileText } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost } from "@/utils/api";
import { formatMonthYear } from "@/utils/dateUtils";
import { SkeletonLine } from "@/components/SkeletonLine";

interface NewsletterSection {
  emoji: string;
  title: string;
  content: string;
}

interface Newsletter {
  id: string;
  month: string;
  family_name: string;
  headline: string;
  sections: NewsletterSection[];
  stats: {
    posts_count: number;
    photos_count: number;
    active_members: number;
  };
  closing: string;
  created_at: string;
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 12,
        alignItems: "center",
        gap: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      {icon}
      <Text style={{ fontSize: 22, fontWeight: "800", color: COLORS.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: COLORS.textSecondary, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

function NewsletterView({ newsletter }: { newsletter: Newsletter }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [newsletter.id]);

  return (
    <Animated.View style={{ opacity: fadeAnim, gap: 20 }}>
      {/* Hero Header */}
      <View
        style={{
          backgroundColor: COLORS.primary,
          borderRadius: 20,
          padding: 24,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontWeight: "600", marginBottom: 8 }}>
          {newsletter.month}
        </Text>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: "#FFFFFF",
            textAlign: "center",
            letterSpacing: -0.3,
            lineHeight: 30,
          }}
        >
          {newsletter.headline || `${newsletter.family_name} – ${newsletter.month}`}
        </Text>
      </View>

      {/* Stats Row */}
      {newsletter.stats && (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            icon={<FileText size={18} color={COLORS.primary} />}
            value={newsletter.stats.posts_count || 0}
            label="Momente"
          />
          <StatCard
            icon={<ImageIcon size={18} color={COLORS.accent} />}
            value={newsletter.stats.photos_count || 0}
            label="Fotos"
          />
          <StatCard
            icon={<Users size={18} color={COLORS.textSecondary} />}
            value={newsletter.stats.active_members || 0}
            label="Aktive"
          />
        </View>
      )}

      {/* Sections */}
      {newsletter.sections && newsletter.sections.map((section, i) => (
        <View
          key={i}
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            boxShadow: COLORS.cardShadow,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Text style={{ fontSize: 24 }}>{section.emoji}</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text }}>
              {section.title}
            </Text>
          </View>
          <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 }}>
            {section.content}
          </Text>
        </View>
      ))}

      {/* Closing */}
      {newsletter.closing && (
        <View
          style={{
            backgroundColor: COLORS.primaryMuted,
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: "rgba(217, 119, 6, 0.15)",
          }}
        >
          <Text style={{ fontSize: 15, color: COLORS.text, lineHeight: 22, fontStyle: "italic", textAlign: "center" }}>
            "{newsletter.closing}"
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

export default function NewsletterScreen() {
  const insets = useSafeAreaInsets();
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNewsletter = useCallback(async () => {
    console.log("[Newsletter] Loading latest newsletter");
    try {
      setError(null);
      const data = await apiGet<Newsletter>("/api/newsletter/latest");
      console.log("[Newsletter] Newsletter loaded:", data?.id);
      setNewsletter(data);
    } catch (err: any) {
      console.log("[Newsletter] No newsletter found:", err?.message);
      setNewsletter(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNewsletter();
  }, [loadNewsletter]);

  const handleGenerate = async () => {
    console.log("[Newsletter] Generate button pressed");
    try {
      setGenerating(true);
      setError(null);
      console.log("[Newsletter] POST /api/newsletter/generate");
      const data = await apiPost<Newsletter>("/api/newsletter/generate", { month: new Date().toISOString().slice(0, 7) });
      console.log("[Newsletter] Newsletter generated:", data?.id);
      setNewsletter(data);
    } catch (err: any) {
      console.error("[Newsletter] Generate error:", err);
      setError(err?.message || "Zeitung konnte nicht erstellt werden");
    } finally {
      setGenerating(false);
    }
  };

  const currentMonth = formatMonthYear(new Date().toISOString());

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              console.log("[Newsletter] Pull to refresh");
              setRefreshing(true);
              loadNewsletter();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 }}>
              Familienzeitung
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 2 }}>
              {currentMonth}
            </Text>
          </View>
          <AnimatedPressable
            onPress={() => {
              console.log("[Newsletter] Refresh button pressed");
              setRefreshing(true);
              loadNewsletter();
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RefreshCw size={18} color={COLORS.textSecondary} />
          </AnimatedPressable>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* Generate Button */}
          <AnimatedPressable
            onPress={handleGenerate}
            disabled={generating}
            style={{
              backgroundColor: generating ? COLORS.surfaceSecondary : COLORS.primary,
              borderRadius: 14,
              height: 54,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 24,
            }}
          >
            <Newspaper size={20} color={generating ? COLORS.textSecondary : "#FFFFFF"} />
            <Text
              style={{
                color: generating ? COLORS.textSecondary : "#FFFFFF",
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              {generating ? "Zeitung wird erstellt..." : "Zeitung erstellen"}
            </Text>
          </AnimatedPressable>

          {error && (
            <View
              style={{
                backgroundColor: COLORS.dangerMuted,
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: COLORS.danger, fontSize: 14 }}>{error}</Text>
            </View>
          )}

          {/* Loading State */}
          {loading || generating ? (
            <View style={{ gap: 16 }}>
              <SkeletonLine width="100%" height={120} />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <SkeletonLine width="30%" height={80} />
                <SkeletonLine width="30%" height={80} />
                <SkeletonLine width="30%" height={80} />
              </View>
              <SkeletonLine width="100%" height={100} />
              <SkeletonLine width="100%" height={100} />
            </View>
          ) : newsletter ? (
            <NewsletterView newsletter={newsletter} />
          ) : (
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 24,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Newspaper size={32} color={COLORS.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 8 }}>
                Noch keine Zeitung
              </Text>
              <Text style={{ fontSize: 15, color: COLORS.textSecondary, textAlign: "center", lineHeight: 22 }}>
                Erstelle eure erste Familienzeitung für diesen Monat
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
