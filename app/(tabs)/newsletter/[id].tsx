import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet } from "@/utils/api";
import { NewsletterView } from "./index";

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

export default function NewsletterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    console.log("[Newsletter] Loading archive detail, id:", id);
    apiGet<Newsletter>(`/api/newsletter/${id}`)
      .then((data) => {
        console.log("[Newsletter] Archive detail loaded:", data?.id);
        setNewsletter(data);
      })
      .catch((err: any) => {
        console.log("[Newsletter] Archive detail error:", err?.message);
        setError(err?.message || "Zeitung konnte nicht geladen werden");
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Back header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AnimatedPressable
          onPress={() => {
            console.log("[Newsletter] Back button pressed from detail screen");
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
        >
          <ChevronLeft size={22} color={COLORS.text} />
        </AnimatedPressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text }}>
          Archiv
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : error ? (
          <View
            style={{
              backgroundColor: COLORS.dangerMuted,
              borderRadius: 12,
              padding: 16,
              marginTop: 16,
            }}
          >
            <Text style={{ color: COLORS.danger, fontSize: 14 }}>{error}</Text>
          </View>
        ) : newsletter ? (
          <NewsletterView newsletter={newsletter} />
        ) : null}
      </ScrollView>
    </View>
  );
}
