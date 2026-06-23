import React, { useRef, useEffect, useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Animated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { X, Camera, Video as VideoIcon, MapPin, Play, Sparkles } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import { apiPost, apiDelete, BACKEND_URL } from "@/utils/api";
import { uploadFile, type SelectedMedia } from "@/services/upload";
import { useAuth } from "@/contexts/AuthContext";

const MAX_VIDEO_DURATION_MS = 60_000;
const MAX_IMAGE_WIDTH = 1200;

function Toast({ message, visible }: { message: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, translateY]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        bottom: 100,
        left: 20,
        right: 20,
        backgroundColor: COLORS.text,
        borderRadius: 14,
        padding: 16,
        opacity,
        transform: [{ translateY }],
        zIndex: 999,
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600", textAlign: "center" }}>
        {message}
      </Text>
    </Animated.View>
  );
}

export default function NewPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [text, setText] = useState("");
  const [media, setMedia] = useState<SelectedMedia | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [date, setDate] = useState(new Date());
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewState, setPreviewState] = useState<{ postId: string } | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedStory, setEditedStory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const canPost = text.trim().length > 0 || media !== null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const handlePickImage = async () => {
    console.log("[NewPost] Pick image button pressed");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Berechtigung erforderlich", "Bitte erlaube den Zugriff auf deine Fotos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (result.canceled) return;
    const asset = result.assets[0];

    try {
      const resized = await manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(asset.width || MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH) } }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );
      console.log("[NewPost] Image resized for upload:", resized.width, "x", resized.height);
      setMedia({
        uri: resized.uri,
        fileName: `photo_${Date.now()}.jpg`,
        mimeType: "image/jpeg",
        mediaType: "photo",
      });
    } catch (err) {
      console.error("[NewPost] Image resize failed, using original:", err);
      setMedia({
        uri: asset.uri,
        fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        mediaType: "photo",
      });
    }
  };

  const handlePickVideo = async () => {
    console.log("[NewPost] Pick video button pressed");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Berechtigung erforderlich", "Bitte erlaube den Zugriff auf deine Videos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
    });

    if (result.canceled) return;
    const asset = result.assets[0];

    if (asset.duration && asset.duration > MAX_VIDEO_DURATION_MS) {
      console.log("[NewPost] Video rejected, too long:", asset.duration, "ms");
      Alert.alert("Video zu lang", "Video zu lang (max. 60 Sekunden)");
      return;
    }

    setMedia({
      uri: asset.uri,
      fileName: asset.fileName || `video_${Date.now()}.mp4`,
      mimeType: asset.mimeType || "video/mp4",
      mediaType: "video",
    });
  };

  const handleRemoveMedia = () => {
    console.log("[NewPost] Media removed");
    setMedia(null);
  };

  const handlePost = async () => {
    console.log("[NewPost] Posten button pressed");
    try {
      setIsLoading(true);

      console.log("[NewPost] POST /api/posts with text:", text.trim().slice(0, 50));
      const post = await apiPost<{ id: string }>("/api/posts", {
        raw_text: text.trim(),
      });
      console.log("[NewPost] Post created with id:", post.id);

      if (media) {
        console.log("[NewPost] Uploading media:", media.mediaType);
        await uploadFile(media, BACKEND_URL, post.id);
        console.log("[NewPost] Media uploaded");
      }

      // Set preview state and start AI generation
      setPreviewState({ postId: post.id });
      setIsGenerating(true);

      console.log("[NewPost] POST /api/posts/" + post.id + "/generate-ai");
      try {
        const aiResult = await apiPost<{ ai_title: string; ai_story: string }>(
          `/api/posts/${post.id}/generate-ai`,
          {}
        );
        console.log("[NewPost] AI generation success — title:", aiResult.ai_title?.slice(0, 60));
        setEditedTitle(aiResult.ai_title ?? "");
        setEditedStory(aiResult.ai_story ?? "");
      } catch (aiErr: any) {
        console.error("[NewPost] AI generation error:", aiErr);
        Alert.alert("KI-Fehler", aiErr?.message || "KI-Story konnte nicht generiert werden");
      } finally {
        setIsGenerating(false);
      }

      queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch (err: any) {
      console.error("[NewPost] Post error:", err);
      setIsLoading(false);
      Alert.alert("Fehler", err?.message || "Beitrag konnte nicht veröffentlicht werden");
      return;
    }
    setIsLoading(false);
  };

  const handleDiscard = async () => {
    if (!previewState) return;
    console.log("[NewPost] Verwerfen pressed — deleting draft post:", previewState.postId);
    try {
      await apiDelete(`/api/posts/${previewState.postId}`, {});
      console.log("[NewPost] Draft post deleted:", previewState.postId);
    } catch (err: any) {
      console.error("[NewPost] Delete draft error:", err);
    }
    setPreviewState(null);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/(home)");
    }
  };

  const handlePublish = async () => {
    if (!previewState) return;
    console.log("[NewPost] Publizieren pressed — postId:", previewState.postId, "title:", editedTitle.slice(0, 60));
    try {
      setIsPublishing(true);
      console.log("[NewPost] POST /api/posts/" + previewState.postId + "/publish");
      await apiPost(`/api/posts/${previewState.postId}/publish`, {
        ai_title: editedTitle,
        ai_story: editedStory,
      });
      console.log("[NewPost] Post published successfully, navigating to feed");
      setPreviewState(null);
      router.replace("/(tabs)/(home)");
    } catch (err: any) {
      console.error("[NewPost] Publish error:", err);
      Alert.alert("Fehler", err?.message || "Post konnte nicht veröffentlicht werden");
    } finally {
      setIsPublishing(false);
    }
  };

  const formattedDate = format(date, "d. MMMM yyyy", { locale: de });

  // ─── Preview screen ───────────────────────────────────────────────────────
  if (previewState !== null) {
    const publishLabel = isPublishing ? "Wird publiziert..." : "Publizieren";
    const generatingLabel = "KI schreibt deine Geschichte...";

    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: COLORS.background }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Preview header */}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: COLORS.divider,
            backgroundColor: COLORS.surface,
          }}
        >
          <AnimatedPressable
            onPress={handleDiscard}
            disabled={isPublishing}
          >
            <Text
              style={{
                fontSize: 16,
                color: isPublishing ? COLORS.textTertiary : COLORS.danger,
                fontWeight: "600",
              }}
            >
              Verwerfen
            </Text>
          </AnimatedPressable>

          <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text }}>
            Vorschau
          </Text>

          <AnimatedPressable
            onPress={handlePublish}
            disabled={isPublishing || isGenerating}
            style={{
              backgroundColor:
                isPublishing || isGenerating ? COLORS.surfaceSecondary : COLORS.primary,
              borderRadius: 10,
              paddingHorizontal: 16,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isPublishing && <ActivityIndicator size="small" color="#FFFFFF" />}
            <Text
              style={{
                color:
                  isPublishing || isGenerating ? COLORS.textTertiary : "#FFFFFF",
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              {publishLabel}
            </Text>
          </AnimatedPressable>
        </View>

        <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* AI badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                alignSelf: "flex-start",
                backgroundColor: COLORS.primaryMuted,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Sparkles size={14} color={COLORS.primary} />
              <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: "600" }}>
                KI-generiert · Du kannst den Text bearbeiten
              </Text>
            </View>

            {/* Generating state */}
            {isGenerating ? (
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  paddingVertical: 48,
                }}
              >
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text
                  style={{
                    fontSize: 16,
                    color: COLORS.textSecondary,
                    fontWeight: "500",
                    textAlign: "center",
                  }}
                >
                  {generatingLabel}
                </Text>
              </View>
            ) : (
              <>
                {/* Editable title */}
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: COLORS.textTertiary,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Titel
                  </Text>
                  <TextInput
                    value={editedTitle}
                    onChangeText={(v) => {
                      console.log("[NewPost] Title edited");
                      setEditedTitle(v);
                    }}
                    placeholder="Titel eingeben..."
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    style={{
                      fontSize: 22,
                      fontWeight: "700",
                      color: COLORS.text,
                      lineHeight: 30,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: 12,
                      padding: 14,
                      backgroundColor: COLORS.surface,
                    }}
                  />
                </View>

                {/* Editable story */}
                <View>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: COLORS.textTertiary,
                      letterSpacing: 0.8,
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Geschichte
                  </Text>
                  <TextInput
                    value={editedStory}
                    onChangeText={(v) => {
                      console.log("[NewPost] Story edited");
                      setEditedStory(v);
                    }}
                    placeholder="Geschichte eingeben..."
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    textAlignVertical="top"
                    style={{
                      fontSize: 16,
                      color: COLORS.text,
                      lineHeight: 24,
                      minHeight: 180,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      borderRadius: 12,
                      padding: 14,
                      backgroundColor: COLORS.surface,
                    }}
                  />
                </View>

                {/* Media preview */}
                {media && (
                  <View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: COLORS.textTertiary,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      Medien
                    </Text>
                    <View style={{ position: "relative", alignSelf: "flex-start" }}>
                      <Image
                        source={{ uri: media.uri }}
                        style={{ width: 160, height: 160, borderRadius: 14 }}
                        contentFit="cover"
                      />
                      {media.mediaType === "video" && (
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderRadius: 14,
                            backgroundColor: "rgba(0,0,0,0.25)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: "rgba(0,0,0,0.5)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </Pressable>

        <Toast message={toastMessage} visible={toastVisible} />
      </KeyboardAvoidingView>
    );
  }

  // ─── Compose screen ───────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomWidth: 1,
          borderBottomColor: COLORS.divider,
          backgroundColor: COLORS.surface,
        }}
      >
        <AnimatedPressable
          onPress={() => {
            console.log("[NewPost] Close button pressed");
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/(home)");
            }
          }}
        >
          <Text style={{ fontSize: 16, color: COLORS.textSecondary, fontWeight: "600" }}>
            Abbrechen
          </Text>
        </AnimatedPressable>

        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text }}>
          Neuer Beitrag
        </Text>

        <AnimatedPressable
          onPress={handlePost}
          disabled={!canPost || isLoading}
          style={{
            backgroundColor: canPost && !isLoading ? COLORS.primary : COLORS.surfaceSecondary,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isLoading && <ActivityIndicator size="small" color="#FFFFFF" />}
          <Text
            style={{
              color: canPost && !isLoading ? "#FFFFFF" : COLORS.textTertiary,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Posten
          </Text>
        </AnimatedPressable>
      </View>

      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Author row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <AuthorAvatar author={{ name: user?.name || "Du", image: user?.image }} size={40} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.text }}>
              {user?.name || "Du"}
            </Text>
          </View>

          {/* Text Input */}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Was möchtest du teilen?"
            placeholderTextColor={COLORS.textTertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{
              fontSize: 17,
              color: COLORS.text,
              lineHeight: 24,
              minHeight: 140,
            }}
            autoFocus
          />

          {/* Media preview */}
          {media && (
            <View style={{ position: "relative", alignSelf: "flex-start" }}>
              <Image
                source={{ uri: media.uri }}
                style={{ width: 160, height: 160, borderRadius: 14 }}
                contentFit="cover"
              />
              {media.mediaType === "video" && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 14,
                    backgroundColor: "rgba(0,0,0,0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                  </View>
                </View>
              )}
              <AnimatedPressable
                onPress={handleRemoveMedia}
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: COLORS.danger,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={14} color="#FFFFFF" />
              </AnimatedPressable>
            </View>
          )}
        </ScrollView>
      </Pressable>

      {/* Bottom toolbar */}
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: 1,
          borderTopColor: COLORS.divider,
          backgroundColor: COLORS.surface,
        }}
      >
        <AnimatedPressable
          onPress={handlePickImage}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Camera size={20} color={COLORS.primary} />
        </AnimatedPressable>

        <AnimatedPressable
          onPress={handlePickVideo}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <VideoIcon size={20} color={COLORS.primary} />
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => console.log("[NewPost] Standort button pressed (not yet functional)")}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.4,
          }}
        >
          <MapPin size={20} color={COLORS.textTertiary} />
        </AnimatedPressable>
      </View>

      <Toast message={toastMessage} visible={toastVisible} />
    </KeyboardAvoidingView>
  );
}
