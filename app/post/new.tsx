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
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { X, Camera, Tag, Plus, Trash2, Calendar, Play } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiPost, apiDelete, apiGet, BACKEND_URL } from "@/utils/api";
import { uploadFile, type SelectedMedia } from "@/services/upload";
import { format } from "date-fns";
import { de } from "date-fns/locale";

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
  }, [visible]);

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
  const [text, setText] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [images, setImages] = useState<SelectedMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [previewState, setPreviewState] = useState<{ postId: string; aiTitle: string; aiStory: string } | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedStory, setEditedStory] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const handlePickImages = async () => {
    console.log("[NewPost] Pick images button pressed");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Berechtigung erforderlich", "Bitte erlaube den Zugriff auf deine Fotos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      console.log("[NewPost] Media selected:", result.assets.length);
      const newImages: SelectedMedia[] = result.assets.map((asset) => {
        const mediaType: "photo" | "video" = asset.type === "video" ? "video" : "photo";
        return {
          uri: asset.uri,
          fileName: asset.fileName || `${mediaType}_${Date.now()}.${mediaType === "video" ? "mp4" : "jpg"}`,
          mimeType: asset.mimeType || (mediaType === "video" ? "video/mp4" : "image/jpeg"),
          mediaType,
        };
      });
      setImages((prev) => [...prev, ...newImages]);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      console.log("[NewPost] Tag added:", trimmed);
      setTags((prev) => [...prev, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    console.log("[NewPost] Tag removed:", tag);
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleRemoveImage = (index: number) => {
    console.log("[NewPost] Image removed at index:", index);
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    console.log("[NewPost] KI-Story erstellen button pressed");
    if (!text.trim()) {
      Alert.alert("Fehler", "Bitte beschreibe deinen Moment");
      return;
    }

    try {
      setIsLoading(true);

      console.log("[NewPost] POST /api/posts with text:", text.slice(0, 50), "tags:", tags, "date:", date.toISOString());
      const post = await apiPost<{ id: string }>("/api/posts", {
        raw_text: text.trim(),
        event_date: date.toISOString(),
        tags,
      });

      console.log("[NewPost] Post created with id:", post.id);

      if (images.length > 0) {
        console.log("[NewPost] Uploading", images.length, "media items");
        await Promise.all(images.map((img) => uploadFile(img, BACKEND_URL, post.id)));
        console.log("[NewPost] All media uploaded");
      }

      console.log("[NewPost] POST /api/posts/" + post.id + "/generate-preview");
      const preview = await apiPost<{ ai_title: string; ai_story: string }>(
        `/api/posts/${post.id}/generate-preview`,
        {}
      );
      console.log("[NewPost] AI preview received — title:", preview.ai_title?.slice(0, 60));

      setEditedTitle(preview.ai_title);
      setEditedStory(preview.ai_story);
      setPreviewState({ postId: post.id, aiTitle: preview.ai_title, aiStory: preview.ai_story });
    } catch (err: any) {
      console.error("[NewPost] Save/generate-preview error:", err);
      Alert.alert("Fehler", err?.message || "Moment konnte nicht gespeichert werden");
    } finally {
      setIsLoading(false);
    }
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
    router.back();
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

  const loadingLabel = isLoading ? "KI schreibt deine Geschichte..." : "KI-Story erstellen";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
          borderBottomWidth: 1,
          borderBottomColor: COLORS.divider,
          backgroundColor: COLORS.surface,
        }}
      >
        <AnimatedPressable
          onPress={() => {
            console.log("[NewPost] Close button pressed");
            router.back();
          }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: COLORS.surfaceSecondary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={18} color={COLORS.text} />
        </AnimatedPressable>

        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.text }}>
          Neuer Moment
        </Text>

        <AnimatedPressable
          onPress={handleSave}
          disabled={isLoading || !text.trim()}
          style={{
            backgroundColor: isLoading || !text.trim() ? COLORS.surfaceSecondary : COLORS.primary,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          {isLoading && (
            <ActivityIndicator size="small" color="#FFFFFF" />
          )}
          <Text
            style={{
              color: isLoading || !text.trim() ? COLORS.textTertiary : "#FFFFFF",
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            {loadingLabel}
          </Text>
        </AnimatedPressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Text Input */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 }}>
            Was ist passiert?
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Erzähle von diesem besonderen Moment..."
            placeholderTextColor={COLORS.textTertiary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: COLORS.border,
              padding: 14,
              fontSize: 16,
              color: COLORS.text,
              lineHeight: 24,
              minHeight: 120,
            }}
            autoFocus
          />
        </View>

        {/* Date Picker */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 }}>
            Wann?
          </Text>
          <AnimatedPressable
            onPress={() => {
              console.log("[NewPost] Date picker opened");
              setShowDatePicker(!showDatePicker);
            }}
            style={{
              backgroundColor: COLORS.surface,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: COLORS.border,
              paddingHorizontal: 14,
              height: 52,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Calendar size={18} color={COLORS.primary} />
            <Text style={{ fontSize: 16, color: COLORS.text, flex: 1 }}>
              {formattedDate}
            </Text>
          </AnimatedPressable>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              onChange={(event, selectedDate) => {
                if (Platform.OS === "android") setShowDatePicker(false);
                if (selectedDate) {
                  console.log("[NewPost] Date changed:", selectedDate.toISOString());
                  setDate(selectedDate);
                }
              }}
              maximumDate={new Date()}
              style={{ marginTop: 8 }}
            />
          )}
        </View>

        {/* Tags */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 }}>
            Tags
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {tags.map((tag) => (
              <AnimatedPressable
                key={tag}
                onPress={() => handleRemoveTag(tag)}
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: "600" }}>
                  {tag}
                </Text>
                <X size={12} color={COLORS.primary} />
              </AnimatedPressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={handleAddTag}
              placeholder="Tag hinzufügen (z.B. Geburtstag)"
              placeholderTextColor={COLORS.textTertiary}
              returnKeyType="done"
              style={{
                flex: 1,
                backgroundColor: COLORS.surface,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: COLORS.border,
                paddingHorizontal: 14,
                height: 48,
                fontSize: 15,
                color: COLORS.text,
              }}
            />
            <AnimatedPressable
              onPress={handleAddTag}
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                backgroundColor: COLORS.primaryMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Plus size={20} color={COLORS.primary} />
            </AnimatedPressable>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {["Geburtstag", "Schule", "Reise", "Familie", "Urlaub"].map((suggestion) => (
              !tags.includes(suggestion) && (
                <AnimatedPressable
                  key={suggestion}
                  onPress={() => {
                    console.log("[NewPost] Tag suggestion selected:", suggestion);
                    setTags((prev) => [...prev, suggestion]);
                  }}
                  style={{
                    backgroundColor: COLORS.surfaceSecondary,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>
                    + {suggestion}
                  </Text>
                </AnimatedPressable>
              )
            ))}
          </View>
        </View>

        {/* Photos */}
        <View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 }}>
            Fotos
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {images.map((img, i) => (
                <View key={i} style={{ position: "relative" }}>
                  <Image
                    source={{ uri: img.uri }}
                    style={{ width: 100, height: 100, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  {img.mediaType === "video" && (
                    <View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: 12,
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
                    onPress={() => handleRemoveImage(i)}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: COLORS.danger,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={12} color="#FFFFFF" />
                  </AnimatedPressable>
                </View>
              ))}
              <AnimatedPressable
                onPress={handlePickImages}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 12,
                  backgroundColor: COLORS.surfaceSecondary,
                  borderWidth: 2,
                  borderColor: COLORS.border,
                  borderStyle: "dashed",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Camera size={24} color={COLORS.textTertiary} />
                <Text style={{ fontSize: 11, color: COLORS.textTertiary, textAlign: "center" }}>
                  Fotos hinzufügen
                </Text>
              </AnimatedPressable>
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <Toast message={toastMessage} visible={toastVisible} />

      {/* AI Story Preview Modal */}
      <Modal
        visible={previewState !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          console.log("[NewPost] Preview modal dismissed via back gesture");
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: COLORS.background }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {/* Modal Header */}
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
                console.log("[NewPost] Verwerfen button pressed");
                handleDiscard();
              }}
              style={{
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: COLORS.dangerMuted ?? "#FEE2E2",
              }}
            >
              <Text style={{ color: COLORS.danger, fontSize: 14, fontWeight: "700" }}>
                ✕ Verwerfen
              </Text>
            </AnimatedPressable>

            <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.text }}>
              KI-Story Vorschau
            </Text>

            <AnimatedPressable
              onPress={() => {
                console.log("[NewPost] Publizieren button pressed");
                handlePublish();
              }}
              disabled={isPublishing}
              style={{
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: isPublishing ? COLORS.surfaceSecondary : COLORS.primary,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isPublishing && (
                <ActivityIndicator size="small" color="#FFFFFF" />
              )}
              <Text
                style={{
                  color: isPublishing ? COLORS.textTertiary : "#FFFFFF",
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {isPublishing ? "Wird veröffentlicht..." : "Publizieren ✓"}
              </Text>
            </AnimatedPressable>
          </View>

          {/* Modal Scrollable Content */}
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Editable Title */}
            <TextInput
              value={editedTitle}
              onChangeText={(val) => {
                console.log("[NewPost] AI title edited");
                setEditedTitle(val);
              }}
              placeholder="Titel..."
              placeholderTextColor={COLORS.textTertiary}
              multiline
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: COLORS.text,
                lineHeight: 30,
                marginBottom: 16,
              }}
            />

            {/* Divider */}
            <View
              style={{
                height: 1,
                backgroundColor: COLORS.divider,
                marginBottom: 16,
              }}
            />

            {/* Editable Story Body */}
            <TextInput
              value={editedStory}
              onChangeText={(val) => {
                console.log("[NewPost] AI story edited, length:", val.length);
                setEditedStory(val);
              }}
              placeholder="Geschichte..."
              placeholderTextColor={COLORS.textTertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{
                fontSize: 16,
                color: COLORS.text,
                lineHeight: 26,
                minHeight: 80,
                marginBottom: 6,
              }}
            />

            {/* Word counter */}
            <Text
              style={{
                fontSize: 12,
                color: editedStory.trim().split(/\s+/).filter(Boolean).length > 60 ? COLORS.danger : COLORS.textTertiary,
                textAlign: "right",
                marginBottom: 12,
              }}
            >
              {editedStory.trim() === "" ? 0 : editedStory.trim().split(/\s+/).filter(Boolean).length}/60 Wörter
            </Text>

            {/* Hint */}
            <Text
              style={{
                fontSize: 13,
                color: COLORS.textTertiary,
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              Max. 60 Wörter — kurz und persönlich
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}
