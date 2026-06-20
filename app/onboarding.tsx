import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Users, Plus, Hash } from "lucide-react-native";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { COLORS } from "@/constants/Colors";
import { apiPost } from "@/utils/api";

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleCreateFamily = async () => {
    console.log("[Onboarding] Create family button pressed, name:", familyName);
    if (!familyName.trim()) {
      setError("Bitte gib einen Familiennamen ein");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      console.log("[Onboarding] POST /api/families with name:", familyName.trim());
      await apiPost("/api/families", { name: familyName.trim() });
      console.log("[Onboarding] Family created, navigating to home");
      router.replace("/(tabs)/(home)");
    } catch (err: any) {
      console.error("[Onboarding] Create family error:", err);
      setError(err?.message || "Familie konnte nicht erstellt werden");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinFamily = async () => {
    console.log("[Onboarding] Join family button pressed, code:", inviteCode);
    if (!inviteCode.trim() || inviteCode.trim().length !== 6) {
      setError("Bitte gib einen 6-stelligen Einladungscode ein");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      console.log("[Onboarding] POST /api/families/join with code:", inviteCode.trim().toUpperCase());
      await apiPost("/api/families/join", { invite_code: inviteCode.trim().toUpperCase() });
      console.log("[Onboarding] Joined family, navigating to home");
      router.replace("/(tabs)/(home)");
    } catch (err: any) {
      console.error("[Onboarding] Join family error:", err);
      setError(err?.message || "Familie konnte nicht beigetreten werden");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: COLORS.primaryMuted,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Users size={36} color={COLORS.primary} />
            </View>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: COLORS.text,
                textAlign: "center",
                letterSpacing: -0.4,
                marginBottom: 8,
              }}
            >
              Deine Familie
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: COLORS.textSecondary,
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              Erstelle eine neue Familie oder tritt einer bestehenden bei
            </Text>
          </View>

          {/* Tab Selector */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: COLORS.surfaceSecondary,
              borderRadius: 14,
              padding: 4,
              marginBottom: 28,
            }}
          >
            <AnimatedPressable
              onPress={() => {
                console.log("[Onboarding] Tab: create");
                setTab("create");
                setError(null);
              }}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tab === "create" ? COLORS.surface : "transparent",
                boxShadow: tab === "create" ? "0 1px 4px rgba(0,0,0,0.08)" : undefined,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: tab === "create" ? COLORS.primary : COLORS.textSecondary,
                }}
              >
                Familie erstellen
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => {
                console.log("[Onboarding] Tab: join");
                setTab("join");
                setError(null);
              }}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tab === "join" ? COLORS.surface : "transparent",
                boxShadow: tab === "join" ? "0 1px 4px rgba(0,0,0,0.08)" : undefined,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: tab === "join" ? COLORS.primary : COLORS.textSecondary,
                }}
              >
                Familie beitreten
              </Text>
            </AnimatedPressable>
          </View>

          {/* Create Family Form */}
          {tab === "create" && (
            <View style={{ gap: 16 }}>
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  boxShadow: COLORS.cardShadow,
                  gap: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: COLORS.primaryMuted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Plus size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text }}>
                      Neue Familie
                    </Text>
                    <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>
                      Lade deine Familie ein
                    </Text>
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 }}>
                    Familienname
                  </Text>
                  <TextInput
                    value={familyName}
                    onChangeText={(v) => { setFamilyName(v); setError(null); }}
                    placeholder="z.B. Familie Müller"
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="words"
                    style={{
                      backgroundColor: COLORS.surfaceSecondary,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: COLORS.border,
                      paddingHorizontal: 14,
                      height: 52,
                      fontSize: 16,
                      color: COLORS.text,
                    }}
                  />
                </View>
              </View>

              {error && (
                <Text style={{ color: COLORS.danger, fontSize: 13, textAlign: "center" }}>{error}</Text>
              )}

              <AnimatedPressable
                onPress={handleCreateFamily}
                disabled={isLoading}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 14,
                  height: 54,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                  {isLoading ? "Erstelle Familie..." : "Familie erstellen"}
                </Text>
              </AnimatedPressable>
            </View>
          )}

          {/* Join Family Form */}
          {tab === "join" && (
            <View style={{ gap: 16 }}>
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  boxShadow: COLORS.cardShadow,
                  gap: 16,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: COLORS.accentMuted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Hash size={20} color={COLORS.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text }}>
                      Familie beitreten
                    </Text>
                    <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>
                      Gib den Einladungscode ein
                    </Text>
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 }}>
                    Einladungscode (6 Zeichen)
                  </Text>
                  <TextInput
                    value={inviteCode}
                    onChangeText={(v) => { setInviteCode(v.toUpperCase()); setError(null); }}
                    placeholder="ABC123"
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="characters"
                    maxLength={6}
                    style={{
                      backgroundColor: COLORS.surfaceSecondary,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: COLORS.border,
                      paddingHorizontal: 14,
                      height: 52,
                      fontSize: 24,
                      fontWeight: "700",
                      color: COLORS.text,
                      letterSpacing: 6,
                      textAlign: "center",
                    }}
                  />
                </View>
              </View>

              {error && (
                <Text style={{ color: COLORS.danger, fontSize: 13, textAlign: "center" }}>{error}</Text>
              )}

              <AnimatedPressable
                onPress={handleJoinFamily}
                disabled={isLoading}
                style={{
                  backgroundColor: COLORS.accent,
                  borderRadius: 14,
                  height: 54,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                  {isLoading ? "Beitreten..." : "Familie beitreten"}
                </Text>
              </AnimatedPressable>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
