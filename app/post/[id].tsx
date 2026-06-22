import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { ArrowLeft, Trash2, Tag } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { apiGet, apiDelete } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatFullDate, formatRelativeDate } from "@/utils/dateUtils";
import { SkeletonLine } from "@/components/SkeletonLine";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import type { Post } from "@/types";

function ProcessingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, [dot1, dot2, dot3]);

  const dots = [dot1, dot2, dot3];

  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: COLORS.primary,
            opacity: dot,
          }}
        />
      ))}
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadPost = useCallback(async () => {
    console.log("[PostDetail] Loading post:", id);
    try {
      const data = await apiGet<Post>(`/api/posts/${id}`);
      console.log("[PostDetail] Post loaded:", data.id, "ai_status:", data.ai_status);
      // Backend stores the body as raw_text; map it to text for display.
      setPost({ ...data, text: (data as any).raw_text ?? (data as any).text ?? "" });
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (err: any) {
      console.error("[PostDetail] Load error:", err);
      setError(err?.message || "Beitrag konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  // Poll if AI is still processing
  useEffect(() => {
    if (!post) return undefined;
    if (post.ai_status === "processing" || post.ai_status === "pending") {
      console.log("[PostDetail] AI processing, polling in 3s");
      const timer = setTimeout(() => loadPost(), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [post?.ai_status, loadPost]);

  const handleDelete = () => {
    console.log("[PostDetail] Delete button pressed for post:", id);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    console.log("[PostDetail] Delete confirmed for post:", id);
    setShowDeleteModal(false);
    try {
      await apiDelete(`/api/posts/${id}`, {});
      console.log("[PostDetail] Post deleted, navigating back");
      router.back();
    } catch (err: any) {
      console.error("[PostDetail] Delete error:", err);
      Alert.alert("Fehler", "Beitrag konnte nicht gelöscht werden");
    }
  };

  console.log("[PostDetail] isAuthor check:", post?.author?.id, user?.id);
  const isAuthor = post?.author?.id === user?.id;
  const media = post?.media ?? [];
  const isProcessing = post?.ai_status === "processing" || post?.ai_status === "pending";

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 16,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <AnimatedPressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.surfaceSecondary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={COLORS.text} />
          </AnimatedPressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <SkeletonLine width="100%" height={240} />
          <SkeletonLine width="80%" height={28} />
          <SkeletonLine width="100%" height={14} />
          <SkeletonLine width="100%" height={14} />
          <SkeletonLine width="60%" height={14} />
        </ScrollView>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <Text style={{ fontSize: 16, color: COLORS.danger, textAlign: "center", marginBottom: 16 }}>
          {error || "Beitrag nicht gefunden"}
        </Text>
        <AnimatedPressable
          onPress={() => router.back()}
          style={{
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "600" }}>Zurück</Text>
        </AnimatedPressable>
      </View>
    );
  }

  const postDate = post.date || post.created_at;
  const displayDate = formatFullDate(postDate);
  const relativeDate = formatRelativeDate(post.created_at);

  const hasMedia = media.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        {/* Non-absolute header when no media */}
        {!hasMedia && (
          <View
            style={{
              paddingTop: insets.top + 12,
              paddingHorizontal: 20,
              paddingBottom: 12,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: COLORS.background,
            }}
          >
            <AnimatedPressable
              onPress={() => {
                console.log("[PostDetail] Back button pressed");
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
              <ArrowLeft size={20} color={COLORS.text} />
            </AnimatedPressable>
            {isAuthor && (
              <AnimatedPressable
                onPress={handleDelete}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: COLORS.dangerMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={18} color={COLORS.danger} />
              </AnimatedPressable>
            )}
          </View>
        )}

        {/* Delete confirmation modal */}
        <Modal
          visible={showDeleteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
            }}
          >
            <View
              style={{
                backgroundColor: COLORS.surface,
                borderRadius: 16,
                padding: 24,
                width: "100%",
                maxWidth: 360,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: COLORS.text,
                  marginBottom: 10,
                }}
              >
                Beitrag löschen
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: COLORS.textSecondary,
                  lineHeight: 22,
                  marginBottom: 24,
                }}
              >
                Möchtest du diesen Moment wirklich löschen? Das kann nicht rückgängig gemacht werden.
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  onPress={() => {
                    console.log("[PostDetail] Delete cancelled");
                    setShowDeleteModal(false);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: COLORS.textSecondary }}>
                    Abbrechen
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleDeleteConfirm}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    backgroundColor: COLORS.danger,
                    paddingVertical: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>
                    Löschen
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Media with absolute header overlay */}
          {hasMedia && (
            <View style={{ position: "relative" }}>
              {media[selectedPhotoIndex]?.type === "video" ? (
                <Video
                  source={{ uri: media[selectedPhotoIndex]?.url }}
                  style={{ width: "100%", height: 320 }}
                  useNativeControls
                  resizeMode={ResizeMode.COVER}
                />
              ) : (
                <Image
                  source={{ uri: media[selectedPhotoIndex]?.url }}
                  style={{ width: "100%", height: 320 }}
                  contentFit="cover"
                />
              )}
              {/* Gradient overlay */}
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 80,
                  backgroundColor: "rgba(0,0,0,0.15)",
                }}
              />
              {/* Absolute header over photo */}
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
                  onPress={() => {
                    console.log("[PostDetail] Back button pressed");
                    router.back();
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "rgba(0,0,0,0.4)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ArrowLeft size={20} color="#FFFFFF" />
                </AnimatedPressable>
                {isAuthor && (
                  <AnimatedPressable
                    onPress={handleDelete}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: "rgba(0,0,0,0.4)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Trash2 size={18} color="#FFFFFF" />
                  </AnimatedPressable>
                )}
              </View>
            </View>
          )}

          {/* Content */}
          <View style={{ padding: 20, gap: 16 }}>
            {/* AI Processing State */}
            {isProcessing && (
              <View
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <ProcessingDots />
                <Text style={{ fontSize: 14, color: COLORS.primary, fontWeight: "600" }}>
                  KI schreibt deine Geschichte...
                </Text>
              </View>
            )}

            {/* Title */}
            {isProcessing ? (
              <View style={{ gap: 8 }}>
                <SkeletonLine width="80%" height={28} />
                <SkeletonLine width="100%" height={14} />
                <SkeletonLine width="70%" height={14} />
              </View>
            ) : (
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: "800",
                  color: COLORS.text,
                  letterSpacing: -0.4,
                  lineHeight: 32,
                }}
              >
                {post.ai_title || post.text.slice(0, 80)}
              </Text>
            )}

            {/* Author + Date */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AuthorAvatar author={post.author} size={36} />
              <View>
                <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>
                  {post.author.name || "Unbekannt"}
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.textTertiary }}>
                  {displayDate}
                </Text>
              </View>
            </View>

            {/* AI Story */}
            {!isProcessing && (post.ai_story || post.text) && (
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderRadius: 14,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: COLORS.text,
                    lineHeight: 26,
                  }}
                >
                  {post.ai_story || post.text}
                </Text>
              </View>
            )}

            {/* Original Text (if AI story exists) */}
            {!isProcessing && post.ai_story && post.text && (
              <View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.textTertiary, marginBottom: 6 }}>
                  ORIGINAL
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 }}>
                  {post.text}
                </Text>
              </View>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Tag size={14} color={COLORS.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.textSecondary }}>
                    TAGS
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {post.tags.map((tag) => (
                    <View
                      key={tag}
                      style={{
                        backgroundColor: COLORS.primaryMuted,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: "600" }}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Media Grid */}
            {media.length > 1 && (
              <View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 10 }}>
                  {`ALLE MEDIEN (${media.length})`}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {media.map((item, i) => (
                    <AnimatedPressable
                      key={item.id}
                      onPress={() => {
                        console.log("[PostDetail] Media selected:", i);
                        setSelectedPhotoIndex(i);
                      }}
                      style={{
                        width: "31%",
                        aspectRatio: 1,
                        borderRadius: 10,
                        overflow: "hidden",
                        borderWidth: selectedPhotoIndex === i ? 2 : 0,
                        borderColor: COLORS.primary,
                      }}
                    >
                      {item.type === "video" ? (
                        <Video
                          source={{ uri: item.url }}
                          style={{ width: "100%", height: "100%" }}
                          useNativeControls
                          resizeMode={ResizeMode.COVER}
                        />
                      ) : (
                        <Image
                          source={{ uri: item.url }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      )}
                    </AnimatedPressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}
