import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle, Ellipse } from "react-native-svg";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { COLORS } from "@/constants/Colors";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react-native";

function AppleLogo({ size = 20, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
    </Svg>
  );
}

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" fill="#FFC107" />
      <Path d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" fill="#FF3D00" />
      <Path d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" fill="#4CAF50" />
      <Path d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" fill="#1976D2" />
    </Svg>
  );
}

function FamilyIllustration() {
  return (
    <Svg width={200} height={140} viewBox="0 0 200 140">
      {/* House */}
      <Path d="M60 90 L60 130 L140 130 L140 90 L100 55 Z" fill={COLORS.primaryMuted} stroke={COLORS.primary} strokeWidth="2" />
      <Path d="M80 130 L80 105 L120 105 L120 130" fill={COLORS.surfaceSecondary} />
      <Path d="M90 80 L90 95 L110 95 L110 80 L100 73 Z" fill={COLORS.primaryLight} />
      {/* People */}
      <Circle cx="75" cy="50" r="12" fill={COLORS.primary} opacity={0.7} />
      <Ellipse cx="75" cy="72" rx="10" ry="14" fill={COLORS.primary} opacity={0.5} />
      <Circle cx="125" cy="50" r="12" fill={COLORS.accent} opacity={0.7} />
      <Ellipse cx="125" cy="72" rx="10" ry="14" fill={COLORS.accent} opacity={0.5} />
      <Circle cx="100" cy="35" r="9" fill={COLORS.primary} opacity={0.9} />
      <Ellipse cx="100" cy="53" rx="8" ry="11" fill={COLORS.primary} opacity={0.7} />
      {/* Hearts */}
      <Path d="M95 18 C95 15 92 13 90 15 C88 13 85 15 85 18 C85 22 90 26 90 26 C90 26 95 22 95 18Z" fill={COLORS.danger} opacity={0.6} />
      <Path d="M115 22 C115 20 113 18 111 20 C109 18 107 20 107 22 C107 25 111 28 111 28 C111 28 115 25 115 22Z" fill={COLORS.primary} opacity={0.6} />
    </Svg>
  );
}

export default function AuthScreen() {
  const { user, loading, signInWithApple, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<"social" | "signin" | "signup">("social");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (user && !loading) {
      console.log("[Auth] User authenticated, navigating to tabs");
      router.replace("/(tabs)/(home)");
    }
  }, [user, loading]);

  const handleAppleSignIn = async () => {
    console.log("[Auth] Apple sign in button pressed");
    try {
      setIsLoading(true);
      await signInWithApple();
    } catch (err: any) {
      console.error("[Auth] Apple sign in error:", err);
      if (err?.message !== "The user canceled the authorization attempt.") {
        Alert.alert("Fehler", err?.message || "Apple-Anmeldung fehlgeschlagen");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log("[Auth] Google sign in button pressed");
    try {
      setIsLoading(true);
      await signInWithGoogle();
    } catch (err: any) {
      console.error("[Auth] Google sign in error:", err);
      Alert.alert("Fehler", err?.message || "Google-Anmeldung fehlgeschlagen");
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (val: string) => {
    if (!val) return "E-Mail ist erforderlich";
    if (!/\S+@\S+\.\S+/.test(val)) return "Ungültige E-Mail-Adresse";
    return undefined;
  };

  const validatePassword = (val: string) => {
    if (!val) return "Passwort ist erforderlich";
    if (val.length < 8) return "Mindestens 8 Zeichen";
    return undefined;
  };

  const handleEmailAuth = async () => {
    console.log("[Auth] Email auth button pressed, mode:", mode);
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);
    const nameErr = mode === "signup" && !name ? "Name ist erforderlich" : undefined;

    if (emailErr || passwordErr || nameErr) {
      setErrors({ email: emailErr, password: passwordErr, name: nameErr });
      return;
    }

    try {
      setIsLoading(true);
      if (mode === "signin") {
        console.log("[Auth] Signing in with email:", email);
        await signInWithEmail(email, password);
      } else {
        console.log("[Auth] Signing up with email:", email, "name:", name);
        await signUpWithEmail(email, password, name);
      }
    } catch (err: any) {
      console.error("[Auth] Email auth error:", err);
      Alert.alert("Fehler", err?.message || "Anmeldung fehlgeschlagen");
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
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Illustration */}
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <FamilyIllustration />
          </View>

          {/* Headline */}
          <Text
            style={{
              fontSize: 32,
              fontWeight: "800",
              color: COLORS.text,
              textAlign: "center",
              letterSpacing: -0.5,
              marginBottom: 8,
            }}
          >
            Eure Familiengeschichte
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: COLORS.textSecondary,
              textAlign: "center",
              lineHeight: 24,
              marginBottom: 40,
            }}
          >
            Momente festhalten.{"\n"}Erinnerungen bewahren.
          </Text>

          {/* Social Buttons */}
          {mode === "social" && (
            <View style={{ gap: 12 }}>
              <AnimatedPressable
                onPress={handleAppleSignIn}
                disabled={isLoading}
                style={{
                  backgroundColor: COLORS.text,
                  borderRadius: 14,
                  height: 54,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <AppleLogo size={20} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                  Mit Apple anmelden
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 14,
                  height: 54,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  borderWidth: 1.5,
                  borderColor: COLORS.border,
                  boxShadow: COLORS.cardShadow,
                }}
              >
                <GoogleLogo size={20} />
                <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: "600" }}>
                  Mit Google anmelden
                </Text>
              </AnimatedPressable>

              <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 8 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: COLORS.divider }} />
                <Text style={{ color: COLORS.textTertiary, fontSize: 13, marginHorizontal: 12 }}>
                  oder
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: COLORS.divider }} />
              </View>

              <AnimatedPressable
                onPress={() => {
                  console.log("[Auth] Email option selected");
                  setMode("signin");
                }}
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 14,
                  height: 54,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: COLORS.primary, fontSize: 16, fontWeight: "600" }}>
                  Mit E-Mail anmelden
                </Text>
              </AnimatedPressable>
            </View>
          )}

          {/* Email Form */}
          {(mode === "signin" || mode === "signup") && (
            <View style={{ gap: 16 }}>
              {mode === "signup" && (
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 }}>
                    Name
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: COLORS.surfaceSecondary,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: errors.name ? COLORS.danger : COLORS.border,
                      paddingHorizontal: 14,
                      height: 52,
                      gap: 10,
                    }}
                  >
                    <User size={18} color={COLORS.textTertiary} />
                    <TextInput
                      value={name}
                      onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: undefined })); }}
                      placeholder="Dein Name"
                      placeholderTextColor={COLORS.textTertiary}
                      autoCapitalize="words"
                      style={{ flex: 1, fontSize: 16, color: COLORS.text }}
                    />
                  </View>
                  {errors.name && (
                    <Text style={{ color: COLORS.danger, fontSize: 12, marginTop: 4 }}>{errors.name}</Text>
                  )}
                </View>
              )}

              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 }}>
                  E-Mail
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: errors.email ? COLORS.danger : COLORS.border,
                    paddingHorizontal: 14,
                    height: 52,
                    gap: 10,
                  }}
                >
                  <Mail size={18} color={COLORS.textTertiary} />
                  <TextInput
                    value={email}
                    onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
                    onBlur={() => setErrors((e) => ({ ...e, email: validateEmail(email) }))}
                    placeholder="familie@beispiel.de"
                    placeholderTextColor={COLORS.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ flex: 1, fontSize: 16, color: COLORS.text }}
                  />
                </View>
                {errors.email && (
                  <Text style={{ color: COLORS.danger, fontSize: 12, marginTop: 4 }}>{errors.email}</Text>
                )}
              </View>

              <View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 }}>
                  Passwort
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: errors.password ? COLORS.danger : COLORS.border,
                    paddingHorizontal: 14,
                    height: 52,
                    gap: 10,
                  }}
                >
                  <Lock size={18} color={COLORS.textTertiary} />
                  <TextInput
                    value={password}
                    onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
                    onBlur={() => setErrors((e) => ({ ...e, password: validatePassword(password) }))}
                    placeholder="Mindestens 8 Zeichen"
                    placeholderTextColor={COLORS.textTertiary}
                    secureTextEntry={!showPassword}
                    style={{ flex: 1, fontSize: 16, color: COLORS.text }}
                  />
                  <AnimatedPressable onPress={() => setShowPassword(!showPassword)}>
                    {showPassword
                      ? <EyeOff size={18} color={COLORS.textTertiary} />
                      : <Eye size={18} color={COLORS.textTertiary} />
                    }
                  </AnimatedPressable>
                </View>
                {errors.password && (
                  <Text style={{ color: COLORS.danger, fontSize: 12, marginTop: 4 }}>{errors.password}</Text>
                )}
              </View>

              <AnimatedPressable
                onPress={handleEmailAuth}
                disabled={isLoading}
                style={{
                  backgroundColor: COLORS.primary,
                  borderRadius: 14,
                  height: 54,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 4,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                  {isLoading ? "Laden..." : mode === "signin" ? "Anmelden" : "Konto erstellen"}
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => {
                  console.log("[Auth] Toggle mode:", mode === "signin" ? "signup" : "signin");
                  setMode(mode === "signin" ? "signup" : "signin");
                  setErrors({});
                }}
                style={{ alignItems: "center", paddingVertical: 8 }}
              >
                <Text style={{ color: COLORS.primary, fontSize: 15, fontWeight: "600" }}>
                  {mode === "signin" ? "Noch kein Konto? Registrieren" : "Bereits registriert? Anmelden"}
                </Text>
              </AnimatedPressable>

              <AnimatedPressable
                onPress={() => {
                  console.log("[Auth] Back to social options");
                  setMode("social");
                  setErrors({});
                }}
                style={{ alignItems: "center", paddingVertical: 4 }}
              >
                <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>
                  ← Zurück
                </Text>
              </AnimatedPressable>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
