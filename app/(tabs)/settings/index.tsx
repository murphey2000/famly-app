import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  Alert,
  Share,
  Platform,
  Modal,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import DatePicker from "@/components/DatePicker";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Copy, Share2, LogOut, Users, ChevronRight, Check, Cake, Trash2, ExternalLink } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, authenticatedPut, authenticatedDelete } from "@/utils/api";
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

interface UserProfile {
  birthday?: string | null;
}

function formatBirthdayDisplay(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd. MMMM yyyy", { locale: de });
  } catch {
    return dateStr;
  }
}

function formatBirthdayApi(date: Date): string {
  return format(date, "yyyy-MM-dd");
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

  // Birthday state
  const [birthday, setBirthday] = useState<string | null>(null);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date(1990, 0, 1));
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [birthdaySaved, setBirthdaySaved] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    console.log("[Settings] Loading family and profile data");
    try {
      const [familyData, profileData] = await Promise.all([
        apiGet<Family | Family[]>("/api/families"),
        apiGet<UserProfile>("/api/profile").catch(() => null),
      ]);
      const fam = Array.isArray(familyData) ? familyData[0] : familyData;
      console.log("[Settings] Family loaded:", fam?.name);
      setFamily(fam || null);

      if (profileData?.birthday) {
        console.log("[Settings] Profile birthday loaded:", profileData.birthday);
        setBirthday(profileData.birthday);
        try {
          setPickerDate(parseISO(profileData.birthday));
        } catch {
          // keep default
        }
      }
    } catch (err) {
      console.error("[Settings] Load data error:", err);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [fadeAnim]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const handleDeleteAccount = () => {
    console.log("[Settings] Delete account button pressed");
    Alert.alert(
      "Konto löschen",
      "Möchtest du dein Konto und alle zugehörigen Daten dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Konto löschen",
          style: "destructive",
          onPress: async () => {
            console.log("[Settings] Delete account confirmed");
            try {
              await authenticatedDelete("/api/profile");
              console.log("[Settings] Account deleted successfully");
              await signOut();
            } catch (err) {
              console.error("[Settings] Delete account error:", err);
              Alert.alert("Fehler", "Konto konnte nicht gelöscht werden. Bitte kontaktiere den Support.");
            }
          },
        },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL("https://famly.app/privacy");
  };

  const handleBirthdayRowPress = () => {
    console.log("[Settings] Birthday row pressed, opening picker");
    setShowBirthdayPicker(true);
  };

  const handleDateChange = (date: Date) => {
    console.log("[Settings] iOS birthday date changed:", formatBirthdayApi(date));
    setPickerDate(date);
  };

  const saveBirthday = async (date: Date) => {
    const birthdayStr = formatBirthdayApi(date);
    console.log("[Settings] PUT /api/profile/birthday with birthday:", birthdayStr);
    try {
      setSavingBirthday(true);
      await authenticatedPut("/api/profile/birthday", { birthday: birthdayStr });
      console.log("[Settings] Birthday saved successfully");
      setBirthday(birthdayStr);
      setBirthdaySaved(true);
      setTimeout(() => setBirthdaySaved(false), 2000);
    } catch (err) {
      console.error("[Settings] Save birthday error:", err);
      Alert.alert("Fehler", "Geburtstag konnte nicht gespeichert werden");
    } finally {
      setSavingBirthday(false);
    }
  };

  const handleIOSPickerConfirm = () => {
    console.log("[Settings] iOS birthday picker confirmed:", formatBirthdayApi(pickerDate));
    setShowBirthdayPicker(false);
    saveBirthday(pickerDate);
  };

  const handleIOSPickerCancel = () => {
    console.log("[Settings] iOS birthday picker cancelled");
    setShowBirthdayPicker(false);
    // Reset picker to saved birthday
    if (birthday) {
      try {
        setPickerDate(parseISO(birthday));
      } catch {
        // keep current
      }
    }
  };

  const userInitials = (user?.name || user?.email || "?")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const birthdayDisplayText = birthday ? formatBirthdayDisplay(birthday) : "Nicht angegeben";

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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
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

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: COLORS.divider, marginBottom: 14 }} />

            {/* Birthday row */}
            <AnimatedPressable
              onPress={handleBirthdayRowPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: COLORS.primaryMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {birthdaySaved
                  ? <Check size={18} color={COLORS.accent} />
                  : <Cake size={18} color={COLORS.primary} />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary }}>
                  Geburtstag
                </Text>
                <Text style={{ fontSize: 15, color: birthdaySaved ? COLORS.accent : COLORS.text, fontWeight: "500", marginTop: 1 }}>
                  {birthdaySaved ? "Gespeichert!" : birthdayDisplayText}
                </Text>
              </View>
              <ChevronRight size={18} color={COLORS.textTertiary} />
            </AnimatedPressable>
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

          {/* Legal & Privacy */}
          <View
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              overflow: "hidden",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 }}>
              Rechtliches
            </Text>
            <AnimatedPressable
              onPress={handlePrivacyPolicy}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 12,
                borderTopWidth: 1,
                borderTopColor: COLORS.divider,
              }}
            >
              <ExternalLink size={18} color={COLORS.textSecondary} />
              <Text style={{ flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "500" }}>
                Datenschutzerklärung
              </Text>
              <ChevronRight size={16} color={COLORS.textTertiary} />
            </AnimatedPressable>
          </View>

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

          {/* Delete Account */}
          <AnimatedPressable
            onPress={handleDeleteAccount}
            style={{
              borderRadius: 14,
              height: 54,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <Trash2 size={18} color={COLORS.textTertiary} />
            <Text style={{ color: COLORS.textTertiary, fontSize: 15, fontWeight: "500" }}>
              Konto löschen
            </Text>
          </AnimatedPressable>
        </Animated.View>
      </ScrollView>

      {/* Birthday Picker — iOS: modal with spinner + confirm/cancel */}
      {Platform.OS === "ios" && (
        <Modal
          visible={showBirthdayPicker}
          transparent
          animationType="slide"
          onRequestClose={handleIOSPickerCancel}
        >
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" }}>
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingBottom: insets.bottom + 8,
              }}
            >
              {/* Toolbar */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.divider,
                }}
              >
                <AnimatedPressable onPress={handleIOSPickerCancel}>
                  <Text style={{ fontSize: 16, color: COLORS.textSecondary, fontWeight: "500" }}>
                    Abbrechen
                  </Text>
                </AnimatedPressable>
                <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text }}>
                  Geburtstag
                </Text>
                <AnimatedPressable onPress={handleIOSPickerConfirm} disabled={savingBirthday}>
                  <Text style={{ fontSize: 16, color: COLORS.primary, fontWeight: "700" }}>
                    {savingBirthday ? "..." : "Fertig"}
                  </Text>
                </AnimatedPressable>
              </View>
              <DatePicker
                value={pickerDate}
                onChange={handleDateChange}
                maximumDate={new Date()}
                display="spinner"
                locale="de-DE"
                style={{ width: "100%" }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Birthday Picker — Android/Web: inline (shown conditionally) */}
      {Platform.OS !== "ios" && showBirthdayPicker && (
        <DatePicker
          value={pickerDate}
          onChange={(d) => {
            console.log("[Settings] Android/web birthday date selected:", formatBirthdayApi(d));
            setPickerDate(d);
            saveBirthday(d);
            setShowBirthdayPicker(false);
          }}
          maximumDate={new Date()}
          display="default"
        />
      )}
    </View>
  );
}
