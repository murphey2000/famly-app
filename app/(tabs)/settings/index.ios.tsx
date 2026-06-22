import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  Alert,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { Copy, Share2, LogOut, Users, ChevronRight, Check } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet } from "@/utils/api";
import { SkeletonLine } from "@/components/SkeletonLine";

interface FamilyMember {
  id: string;
  name: string;
  image?: string;
  email: string;
}

interface Family {
  id: string;
  name: string;
  invite_code: string;
  members: FamilyMember[];
}

function MemberAvatar({ member }: { member: FamilyMember }) {
  const initials = (member.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (member.image) {
    return (
      <Image
        source={{ uri: member.image }}
        style={{ width: 44, height: 44, borderRadius: 22 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primaryMuted,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.primary }}>
        {initials}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadFamily = useCallback(async () => {
    console.log("[Settings] Loading family data");
    try {
      const data = await apiGet<Family | Family[]>("/api/families");
      const fam = Array.isArray(data) ? data[0] : data;
      console.log("[Settings] Family loaded:", fam?.name);
      setFamily(fam || null);
    } catch (err) {
      console.error("[Settings] Load family error:", err);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [fadeAnim]);

  useEffect(() => {
    loadFamily();
  }, [loadFamily]);

  const handleCopyCode = async () => {
    if (!family?.invite_code) return;
    console.log("[Settings] Copy invite code pressed:", family.invite_code);
    await Clipboard.setStringAsync(family.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!family?.invite_code) return;
    console.log("[Settings] Share invite code pressed:", family.invite_code);
    try {
      await Share.share({
        message: `Tritt unserer Familie auf Famly bei! Einladungscode: ${family.invite_code}`,
        title: "Famly Einladung",
      });
    } catch (err) {
      console.error("[Settings] Share error:", err);
    }
  };

  const handleSignOut = () => {
    console.log("[Settings] Sign out button pressed");
    Alert.alert(
      "Abmelden",
      "Möchtest du dich wirklich abmelden?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Abmelden",
          style: "destructive",
          onPress: async () => {
            console.log("[Settings] Sign out confirmed");
            await signOut();
          },
        },
      ]
    );
  };

  const userInitials = (user?.name || user?.email || "?")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: COLORS.text, letterSpacing: -0.5 }}>
            Einstellungen
          </Text>
        </View>

        <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 20, gap: 16 }}>
          {/* Profile Card */}
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: COLORS.border,
              boxShadow: COLORS.cardShadow,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textTertiary, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Profil
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              {user?.image ? (
                <Image
                  source={{ uri: user.image }}
                  style={{ width: 60, height: 60, borderRadius: 30 }}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: COLORS.primaryMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: "700", color: COLORS.primary }}>
                    {userInitials}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text }}>
                  {user?.name || "Kein Name"}
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 2 }}>
                  {user?.email || ""}
                </Text>
              </View>
            </View>
          </View>

          {/* Family Card */}
          {loading ? (
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 12,
              }}
            >
              <SkeletonLine width={80} height={13} />
              <SkeletonLine width="60%" height={18} />
              <SkeletonLine width="40%" height={40} />
            </View>
          ) : family ? (
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
              <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Familie
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
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
                  <Users size={20} color={COLORS.primary} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text }}>
                  {family.name}
                </Text>
              </View>

              {/* Familie einladen */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 }}>
                  Familie einladen
                </Text>
                <View
                  style={{
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 12,
                    padding: 16,
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "800",
                      color: COLORS.primary,
                      letterSpacing: 6,
                    }}
                    selectable
                  >
                    {family.invite_code}
                  </Text>

                  <View
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <QRCode value={family.invite_code} size={180} />
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
                    <AnimatedPressable
                      onPress={handleCopyCode}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 10,
                        backgroundColor: copied ? COLORS.accentMuted : COLORS.primaryMuted,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {copied
                        ? <Check size={18} color={COLORS.accent} />
                        : <Copy size={18} color={COLORS.primary} />
                      }
                      <Text style={{ fontSize: 14, fontWeight: "700", color: copied ? COLORS.accent : COLORS.primary }}>
                        {copied ? "Kopiert!" : "Code kopieren"}
                      </Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      onPress={handleShare}
                      style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 10,
                        backgroundColor: COLORS.primaryMuted,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <Share2 size={18} color={COLORS.primary} />
                      <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.primary }}>
                        Teilen
                      </Text>
                    </AnimatedPressable>
                  </View>
                </View>
              </View>

              {/* Members */}
              {family.members && family.members.length > 0 && (
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 10 }}>
                    Mitglieder ({family.members.length})
                  </Text>
                  <View style={{ gap: 10 }}>
                    {family.members.map((member) => (
                      <View key={member.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <MemberAvatar member={member} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "600", color: COLORS.text }}>
                            {member.name || "Unbekannt"}
                          </Text>
                          <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>
                            {member.email}
                          </Text>
                        </View>
                        {member.id === user?.id && (
                          <View
                            style={{
                              backgroundColor: COLORS.primaryMuted,
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                            }}
                          >
                            <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: "600" }}>
                              Du
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          ) : null}

          {/* Sign Out */}
          <AnimatedPressable
            onPress={handleSignOut}
            style={{
              backgroundColor: COLORS.dangerMuted,
              borderRadius: 14,
              height: 54,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              borderWidth: 1,
              borderColor: "rgba(220, 38, 38, 0.15)",
            }}
          >
            <LogOut size={20} color={COLORS.danger} />
            <Text style={{ color: COLORS.danger, fontSize: 16, fontWeight: "700" }}>
              Abmelden
            </Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
