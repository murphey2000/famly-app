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
import { X, Images, MapPin, Play, Sparkles } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import { apiPost, apiDelete, BACKEND_URL } from "@/utils/api";
import { uploadFile, type SelectedMedia } from "@/services/upload";
import { useAuth } from "@/contexts/AuthContext";

const MAX_VIDEO_DURATION_MS = 60_000;
const MAX_IMAGE_WIDTH = 1200;
const MAX_MEDIA_COUNT = 10;

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
  const [mediaList, setMediaList] = useState<SelectedMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [date, setDate] = useState(new Date());
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewState, setPreviewState] = useState<{ postId: string } | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedStory, setEditedStory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const canPost = text.trim().length > 0 || mediaList.length > 0;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handlePickMedia = async () => {
    console.log("[NewPost] Pick media button pressed");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Berechtigung erforderlich", "Bitte erlaube den Zugriff auf deine Fotos und Videos");
      return;
    }

    const remaining = MAX_MEDIA_COUNT - mediaList.length;
    if (remaining <= 0) {
      showToast(`Maximal ${MAX_MEDIA_COUNT} Medien erlaubt`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remaining,
    });

    if (result.canceled) {
      console.log("[NewPost] Media picker cancelled");
      return;
    }

    console.log("[NewPost] Media picker returned", result.assets.length, "asset(s)");

    const newItems: SelectedMedia[] = [];

    for (const asset of result.assets) {
      if (asset.type === "video") {
        if (asset.duration && asset.duration > MAX_VIDEO_DURATION_MS) {
          console.log("[NewPost] Video rejected, too long:", asset.duration, "ms");
          Alert.alert("Video zu lang", "Ein Video ist länger als 60 Sekunden und wurde übersprungen.");
          continue;
        }
        newItems.push({
          uri: asset.uri,
          fileName: asset.fileName || `video_${Date.now()}.mp4`,
          mimeType: asset.mimeType || "video/mp4",
          mediaType: "video",
        });
        console.log("[NewPost] Video added:", asset.fileName);
      } else {
        try {
          const resized = await manipulateAsync(
            asset.uri,
            [{ resize: { width: Math.min(asset.width || MAX_IMAGE_WIDTH, MAX_IMAGE_WIDTH) } }],
            { compress: 0.8, format: SaveFormat.JPEG }
          );
          console.log("[NewPost] Image resized:", resized.width, "x", resized.height);
          newItems.push({
            uri: resized.uri,
            fileName: `photo_${Date.now()}.jpg`,
            mimeType: "image/jpeg",
            mediaType: "photo",
          });
        } catch (err) {
          console.error("[NewPost] Image resize failed, using original:", err);
          newItems.push({
            uri: asset.uri,
            fileName: asset.fileName || `photo_${Date.now()}.jpg`,
            mimeType: asset.mimeType || "image/jpeg",
            mediaType: "photo",
          });
        }
      }
    }

    setMediaList((prev) => {
      const combined = [...prev, ...newItems].slice(0, MAX_MEDIA_COUNT);
      console.log("[NewPost] mediaList updated, count:", combined.length);
      return combined;
    });
  };

  const handleRemoveMedia = (idx: number) => {
    console.log("[NewPost] Remove media at index:", idx);
    setMediaList((prev) => prev.filter((_, i) => i !== idx));
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

      for (let i = 0; i < mediaList.length; i++) {
        const item = mediaList[i];
        setUploadingIndex(i);
        console.log(`[NewPost] Uploading media ${i + 1}/${mediaList.length}:`, item.mediaType, item.fileName);
        await uploadFile(item, BACKEND_URL, post.id);
        console.log(`[NewPost] Media ${i + 1}/${mediaList.length} uploaded`);
      }
      setUploadingIndex(null);

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
      setUploadingIndex(null);
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
    const hasMedia = mediaList.length > 0;

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

                {/* Media preview grid */}
                {hasMedia && (
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
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {mediaList.map((item, idx) => {
                        const isVideo = item.mediaType === "video";
                        return (
                          <View key={idx} style={{ position: "relative" }}>
                            <Image
                              source={{ uri: item.uri }}
                              style={{ width: 120, height: 120, borderRadius: 10 }}
                              contentFit="cover"
                            />
                            {isVideo && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  borderRadius: 10,
                                  backgroundColor: "rgba(0,0,0,0.25)",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <View
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: "rgba(0,0,0,0.5)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Play size={18} color="#FFFFFF" fill="#FFFFFF" />
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </ScrollView>

        <Toast message={toastMessage} visible={toastVisible} />
      </KeyboardAvoidingView>
    );
  }

  // ─── Compose screen ───────────────────────────────────────────────────────
  const mediaCount = mediaList.length;
  const mediaCountLabel = mediaCount > 1 ? `${mediaCount} Medien` : "";
  const uploadProgressLabel =
    uploadingIndex !== null
      ? `Lade hoch ${uploadingIndex + 1}/${mediaList.length}...`
      : "Posten";

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
          onPress={() => {
            if (!canPost) {
              console.log("[NewPost] Posten tapped while disabled — showing toast");
              showToast("Bitte schreib etwas oder füge ein Foto hinzu");
              return;
            }
            handlePost();
          }}
          disabled={isLoading}
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
            {uploadProgressLabel}
          </Text>
        </AnimatedPressable>
      </View>

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

          {/* Hint text — only visible when nothing has been entered yet */}
          {text.trim().length === 0 && mediaList.length === 0 && (
            <Text
              style={{
                fontSize: 13,
                color: COLORS.textTertiary,
                marginTop: -8,
              }}
            >
              Schreib etwas, um den Beitrag zu aktivieren
            </Text>
          )}

          {/* Media preview grid */}
          {mediaList.length > 0 && (
            <View>
              {mediaCount > 1 && (
                <Text
                  style={{
                    fontSize: 12,
                    color: COLORS.textSecondary,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  {mediaCountLabel}
                </Text>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {mediaList.map((item, idx) => {
                  const isVideo = item.mediaType === "video";
                  return (
                    <View key={idx} style={{ position: "relative" }}>
                      <Image
                        source={{ uri: item.uri }}
                        style={{ width: 100, height: 100, borderRadius: 10 }}
                        contentFit="cover"
                      />
                      {isVideo && (
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            borderRadius: 10,
                            backgroundColor: "rgba(0,0,0,0.25)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: "rgba(0,0,0,0.5)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
                          </View>
                        </View>
                      )}
                      <AnimatedPressable
                        onPress={() => handleRemoveMedia(idx)}
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: COLORS.danger,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <X size={12} color="#FFFFFF" />
                      </AnimatedPressable>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </ScrollView>

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
          onPress={handlePickMedia}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Images size={20} color={COLORS.primary} />
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
