import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  RefreshControl,
  Image,
  ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Newspaper, RefreshCw, Users, Image as ImageIcon, FileText, Archive } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiPost } from "@/utils/api";
import { formatMonthYear } from "@/utils/dateUtils";
import { SkeletonLine } from "@/components/SkeletonLine";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

interface NewsletterSection {
  emoji: string;
  title: string;
  content: string;
}

interface MemberSection {
  user_id: string;
  name: string;
  avatar_url?: string;
  text: string;
}

interface FeaturedPhoto {
  url: string;
  post_title?: string;
  author_name?: string;
}

interface Newsletter {
  id: string;
  month: string;
  family_name: string;
  headline: string;
  sections: NewsletterSection[];
  member_sections: MemberSection[];
  featured_photos: FeaturedPhoto[];
  stats: {
    posts_count: number;
    photos_count: number;
    active_members: number;
  };
  closing: string;
  created_at: string;
}

interface ArchiveItem {
  id: string;
  month: number;
  year: number;
  headline: string;
  generated_at: string;
  cover_photo?: string;
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

function InitialsAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name ? name.charAt(0).toUpperCase() : "?";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

export function NewsletterView({ newsletter }: { newsletter: Newsletter }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasFeaturedPhotos = newsletter.featured_photos && newsletter.featured_photos.length > 0;
  const hasMemberSections = newsletter.member_sections && newsletter.member_sections.length > 0;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [newsletter.id, fadeAnim]);

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

      {/* Featured Photos */}
      {hasFeaturedPhotos && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 4 }}
          >
            {newsletter.featured_photos.map((photo, i) => (
              <View key={i} style={{ width: 200 }}>
                <Image
                  source={resolveImageSource(photo.url)}
                  style={{ width: 200, height: 140, borderRadius: 12 }}
                  resizeMode="cover"
                />
                {(photo.post_title || photo.author_name) && (
                  <View style={{ marginTop: 6, gap: 2 }}>
                    {photo.post_title ? (
                      <Text
                        style={{ fontSize: 12, fontWeight: "600", color: COLORS.text }}
                        numberOfLines={1}
                      >
                        {photo.post_title}
                      </Text>
                    ) : null}
                    {photo.author_name ? (
                      <Text style={{ fontSize: 11, color: COLORS.textSecondary }} numberOfLines={1}>
                        {photo.author_name}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

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

      {/* Member Sections */}
      {hasMemberSections && (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text }}>
            👤 Familienmitglieder
          </Text>
          {newsletter.member_sections.map((member, i) => (
            <View
              key={member.user_id || i}
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 16,
                gap: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {member.avatar_url ? (
                  <Image
                    source={resolveImageSource(member.avatar_url)}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                    resizeMode="cover"
                  />
                ) : (
                  <InitialsAvatar name={member.name} size={40} />
                )}
                <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text }}>
                  {member.name}
                </Text>
              </View>
              <Text style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 }}>
                {member.text}
              </Text>
            </View>
          ))}
        </View>
      )}

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

function ArchiveTab() {
  const router = useRouter();
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const MONTH_NAMES = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];

  const loadArchive = useCallback(async () => {
    console.log("[Newsletter] Loading archive");
    try {
      setError(null);
      const data = await apiGet<ArchiveItem[]>("/api/newsletter/archive");
      console.log("[Newsletter] Archive loaded:", data?.length, "items");
      setArchive(data || []);
    } catch (err: any) {
      console.log("[Newsletter] Archive load error:", err?.message);
      setError(err?.message || "Archiv konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  if (loading) {
    return (
      <View style={{ gap: 12, paddingTop: 8 }}>
        <SkeletonLine width="100%" height={88} />
        <SkeletonLine width="100%" height={88} />
        <SkeletonLine width="100%" height={88} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ backgroundColor: COLORS.dangerMuted, borderRadius: 12, padding: 14, marginTop: 8 }}>
        <Text style={{ color: COLORS.danger, fontSize: 14 }}>{error}</Text>
      </View>
    );
  }

  if (archive.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingTop: 48 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          <Archive size={28} color={COLORS.textSecondary} />
        </View>
        <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 6 }}>
          Noch keine archivierten Zeitungen
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 }}>
          Erstellte Zeitungen erscheinen hier
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12, paddingTop: 8 }}>
      {archive.map((item) => {
        const monthName = MONTH_NAMES[(item.month || 1) - 1] || String(item.month);
        const titleText = `${monthName} ${item.year}`;
        return (
          <AnimatedPressable
            key={item.id}
            onPress={() => {
              console.log("[Newsletter] Archive item pressed:", item.id, titleText);
              router.push(`/(tabs)/newsletter/${item.id}`);
            }}
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              flexDirection: "row",
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            {item.cover_photo ? (
              <Image
                source={resolveImageSource(item.cover_photo)}
                style={{ width: 80, height: 80 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 80,
                  height: 80,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Newspaper size={28} color={COLORS.primary} />
              </View>
            )}
            <View style={{ flex: 1, padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text }}>
                {titleText}
              </Text>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 }} numberOfLines={2}>
                {item.headline}
              </Text>
            </View>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

export default function NewsletterScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"current" | "archive">("current");
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
      const now = new Date();
      const data = await apiPost<Newsletter>("/api/newsletter/generate", {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });
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
            paddingBottom: 16,
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

        {/* Tabs */}
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: 20,
            marginBottom: 20,
            backgroundColor: COLORS.surfaceSecondary,
            borderRadius: 12,
            padding: 4,
          }}
        >
          <AnimatedPressable
            onPress={() => {
              console.log("[Newsletter] Tab pressed: Aktuell");
              setActiveTab("current");
            }}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: activeTab === "current" ? COLORS.surface : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: activeTab === "current" ? COLORS.text : COLORS.textSecondary,
              }}
            >
              Aktuell
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => {
              console.log("[Newsletter] Tab pressed: Archiv");
              setActiveTab("archive");
            }}
            style={{
              flex: 1,
              height: 38,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: activeTab === "archive" ? COLORS.surface : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: activeTab === "archive" ? COLORS.text : COLORS.textSecondary,
              }}
            >
              Archiv
            </Text>
          </AnimatedPressable>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {activeTab === "current" ? (
            <>
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
            </>
          ) : (
            <ArchiveTab />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
