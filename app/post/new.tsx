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
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import DateTimePicker from "@react-native-community/datetimepicker";
import { X, Camera, Tag, Plus, Trash2, Calendar } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiPost, apiGet, BACKEND_URL } from "@/utils/api";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface SelectedImage {
  uri: string;
  fileName?: string;
  mimeType?: string;
}

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
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      console.log("[NewPost] Images selected:", result.assets.length);
      const newImages: SelectedImage[] = result.assets.map((asset) => ({
        uri: asset.uri,
        fileName: asset.fileName || `photo_${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      }));
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

  const uploadImage = async (postId: string, image: SelectedImage) => {
    const fileName = image.fileName || `photo_${Date.now()}.jpg`;
    const contentType = image.mimeType || "image/jpeg";

    console.log("[NewPost] Requesting upload URL for:", fileName);
    const { upload_url, public_url } = await apiPost<{ upload_url: string; public_url: string }>(
      "/api/upload-url",
      { filename: fileName, content_type: contentType }
    );

    console.log("[NewPost] Uploading image to:", upload_url, "platform:", Platform.OS);
    let uploadStatus: number;

    if (Platform.OS === "web") {
      const imageResponse = await fetch(image.uri);
      const blob = await imageResponse.blob();
      const uploadResponse = await fetch(upload_url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType },
      });
      uploadStatus = uploadResponse.status;
    } else {
      const uploadResult = await FileSystem.uploadAsync(upload_url, image.uri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": contentType },
      });
      uploadStatus = uploadResult.status;
    }

    if (uploadStatus < 200 || uploadStatus >= 300) {
      throw new Error(`Upload failed: ${uploadStatus}`);
    }

    console.log("[NewPost] Image uploaded, registering media for post:", postId);
    await apiPost(`/api/posts/${postId}/media`, {
      public_url,
      media_type: "image",
      filename: fileName,
    });

    return public_url;
  };

  const handleSave = async () => {
    console.log("[NewPost] Save button pressed");
    if (!text.trim()) {
      Alert.alert("Fehler", "Bitte beschreibe deinen Moment");
      return;
    }

    try {
      setIsLoading(true);

      console.log("[NewPost] POST /api/posts with text:", text.slice(0, 50), "tags:", tags, "date:", date.toISOString());
      const post = await apiPost<{ id: string }>("/api/posts", {
        text: text.trim(),
        date: date.toISOString(),
        tags,
      });

      console.log("[NewPost] Post created with id:", post.id);

      if (images.length > 0) {
        console.log("[NewPost] Uploading", images.length, "images");
        await Promise.all(images.map((img) => uploadImage(post.id, img)));
        console.log("[NewPost] All images uploaded");
      }

      showToast("Moment gespeichert! KI schreibt deine Geschichte...");
      setTimeout(() => {
        console.log("[NewPost] Navigating back to feed");
        router.replace("/(tabs)/(home)");
      }, 1500);
    } catch (err: any) {
      console.error("[NewPost] Save error:", err);
      Alert.alert("Fehler", err?.message || "Moment konnte nicht gespeichert werden");
    } finally {
      setIsLoading(false);
    }
  };

  const formattedDate = format(date, "d. MMMM yyyy", { locale: de });

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
          }}
        >
          <Text
            style={{
              color: isLoading || !text.trim() ? COLORS.textTertiary : "#FFFFFF",
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            {isLoading ? "Speichern..." : "Speichern"}
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
    </KeyboardAvoidingView>
  );
}
