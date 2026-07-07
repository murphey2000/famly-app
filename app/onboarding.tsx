import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Animated,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import DatePicker from "@/components/DatePicker";
import { Users, Plus, Hash, QrCode, X, Cake, ChevronRight } from "lucide-react-native";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { COLORS } from "@/constants/Colors";
import { authenticatedPost, authenticatedPut, getBearerToken } from "@/utils/api";

const INVITE_CODE_PATTERN = /^[A-Z0-9]{6}$/;

function formatBirthdayDisplay(date: Date): string {
  return format(date, "dd. MMMM yyyy", { locale: de });
}

function formatBirthdayApi(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [step, setStep] = useState<"family" | "birthday">("family");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Birthday step state
  const [birthday, setBirthday] = useState<Date>(new Date(1990, 0, 1));
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [isSavingBirthday, setIsSavingBirthday] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    animateIn();
  }, []);

  const goToBirthdayStep = () => {
    animateIn();
    setStep("birthday");
  };

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
      const token = await getBearerToken();
      console.log("[Onboarding] Bearer token present:", !!token);
      await authenticatedPost("/api/families", { name: familyName.trim() });
      console.log("[Onboarding] Family created, proceeding to birthday step");
      goToBirthdayStep();
    } catch (err: any) {
      console.error("[Onboarding] Create family error:", err);
      setError(err?.message || "Familie konnte nicht erstellt werden");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenScanner = async () => {
    console.log("[Onboarding] QR-Code scannen button pressed");
    let permission = cameraPermission;
    if (!permission?.granted) {
      permission = await requestCameraPermission();
    }
    if (!permission?.granted) {
      Alert.alert("Berechtigung erforderlich", "Bitte erlaube den Zugriff auf deine Kamera, um QR-Codes zu scannen");
      return;
    }
    setHasScanned(false);
    setShowScanner(true);
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (hasScanned) return;
    const scannedValue = result.data.trim().toUpperCase();
    console.log("[Onboarding] QR code scanned:", scannedValue);
    if (!INVITE_CODE_PATTERN.test(scannedValue)) {
      console.log("[Onboarding] Scanned value is not a valid invite code, ignoring");
      return;
    }
    setHasScanned(true);
    setInviteCode(scannedValue);
    setError(null);
    setShowScanner(false);
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
      const token = await getBearerToken();
      console.log("[Onboarding] Bearer token present:", !!token);
      await authenticatedPost("/api/families/join", { invite_code: inviteCode.trim().toUpperCase() });
      console.log("[Onboarding] Joined family, proceeding to birthday step");
      goToBirthdayStep();
    } catch (err: any) {
      console.error("[Onboarding] Join family error:", err);
      setError(err?.message || "Familie konnte nicht beigetreten werden");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBirthday = async () => {
    const birthdayStr = formatBirthdayApi(birthday);
    console.log("[Onboarding] Save birthday button pressed:", birthdayStr);
    try {
      setIsSavingBirthday(true);
      console.log("[Onboarding] PUT /api/profile/birthday with birthday:", birthdayStr);
      await authenticatedPut("/api/profile/birthday", { birthday: birthdayStr });
      console.log("[Onboarding] Birthday saved, navigating to home");
      router.replace("/(tabs)/(home)");
    } catch (err: any) {
      console.error("[Onboarding] Save birthday error:", err);
      // Still navigate on error — birthday is optional
      router.replace("/(tabs)/(home)");
    } finally {
      setIsSavingBirthday(false);
    }
  };

  const handleSkipBirthday = () => {
    console.log("[Onboarding] Skip birthday pressed, navigating to home");
    router.replace("/(tabs)/(home)");
  };

  const handleDateChange = (date: Date) => {
    console.log("[Onboarding] Birthday date changed:", formatBirthdayApi(date));
    setBirthday(date);
  };

  const birthdayDisplayText = formatBirthdayDisplay(birthday);

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

          {/* ── Birthday Step ── */}
          {step === "birthday" && (
            <View style={{ gap: 24 }}>
              {/* Header */}
              <View style={{ alignItems: "center", marginBottom: 16 }}>
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
                  <Cake size={36} color={COLORS.primary} />
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
                  Wann hast du Geburtstag? 🎂
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    color: COLORS.textSecondary,
                    textAlign: "center",
                    lineHeight: 24,
                  }}
                >
                  So können deine Familienmitglieder dir gratulieren
                </Text>
              </View>

              {/* Date picker card */}
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  boxShadow: COLORS.cardShadow,
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {Platform.OS === "android" ? (
                  <>
                    <AnimatedPressable
                      onPress={() => {
                        console.log("[Onboarding] Android date picker opened");
                        setShowAndroidPicker(true);
                      }}
                      style={{
                        width: "100%",
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: COLORS.border,
                        backgroundColor: COLORS.surfaceSecondary,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 16,
                      }}
                    >
                      <Text style={{ fontSize: 16, color: COLORS.text, fontWeight: "600" }}>
                        {birthdayDisplayText}
                      </Text>
                      <ChevronRight size={18} color={COLORS.textSecondary} />
                    </AnimatedPressable>
                    {showAndroidPicker && (
                      <DatePicker
                        value={birthday}
                        onChange={(d) => { setShowAndroidPicker(false); handleDateChange(d); }}
                        maximumDate={new Date()}
                        display="default"
                      />
                    )}
                  </>
                ) : (
                  <DatePicker
                    value={birthday}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    display="spinner"
                    locale="de-DE"
                    style={{ width: "100%" }}
                  />
                )}
              </View>

              {/* Weiter button */}
              <AnimatedPressable
                onPress={handleSaveBirthday}
                disabled={isSavingBirthday}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 14,
                  height: 54,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                  {isSavingBirthday ? "Speichern..." : "Weiter"}
                </Text>
              </AnimatedPressable>

              {/* Skip link */}
              <AnimatedPressable
                onPress={handleSkipBirthday}
                style={{ alignItems: "center", paddingVertical: 4 }}
              >
                <Text style={{ fontSize: 15, color: COLORS.textSecondary, fontWeight: "500" }}>
                  Überspringen
                </Text>
              </AnimatedPressable>
            </View>
          )}

          {/* ── Family Step ── */}
          {step === "family" && (
            <>
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

                    <AnimatedPressable
                      onPress={handleOpenScanner}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        height: 48,
                        borderRadius: 12,
                        backgroundColor: COLORS.accentMuted,
                      }}
                    >
                      <QrCode size={18} color={COLORS.accent} />
                      <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.accent }}>
                        QR-Code scannen
                      </Text>
                    </AnimatedPressable>
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
            </>
          )}
        </Animated.View>
      </ScrollView>

      {/* QR Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000000" }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
          <View
            style={{
              position: "absolute",
              top: insets.top + 12,
              left: 20,
              right: 20,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <AnimatedPressable
              onPress={() => setShowScanner(false)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={20} color="#FFFFFF" />
            </AnimatedPressable>
          </View>
          <View
            style={{
              position: "absolute",
              bottom: insets.bottom + 40,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>
              Richte die Kamera auf den QR-Code
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
