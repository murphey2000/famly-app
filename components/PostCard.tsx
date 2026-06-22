import React, { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { ChevronRight, Play } from "lucide-react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { AuthorAvatar } from "@/components/AuthorAvatar";
import { SkeletonLine } from "@/components/SkeletonLine";
import { formatRelativeDate } from "@/utils/dateUtils";
import { ReactionBar, type ReactionEmoji } from "@/components/ReactionBar";
import { useSetReaction, useRemoveReaction } from "@/hooks/useReactionMutation";
import type { Post, Media } from "@/types";
import type { ImageSourcePropType } from "react-native";

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: "" };
  if (typeof source === "string") return { uri: source };
  return source as ImageSourcePropType;
}

function MediaThumb({ item, height }: { item: Media; height: number }) {
  if (item.type === "video") {
    return (
      <View
        style={{
          height,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: COLORS.surfaceSecondary,
        }}
      >
        {item.thumbnail_url ? (
          <Image
            source={resolveImageSource(item.thumbnail_url)}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: "#00000022" }} />
        )}
        <View
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(0,0,0,0.45)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </View>
      </View>
    );
  }
  return (
    <Image
      source={resolveImageSource(item.url)}
      style={{ height, borderRadius: 10 }}
      contentFit="cover"
    />
  );
}

export function PostCard({ post, index }: { post: Post; index: number }) {
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const setReaction = useSetReaction();
  const removeReaction = useRemoveReaction();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  const isProcessing = post.ai_status === "processing" || post.ai_status === "pending";
  const media = post.media ?? [];
  const relativeDate = formatRelativeDate(post.created_at);

  const handlePress = () => {
    console.log("[PostCard] Post card pressed, id:", post.id);
    router.push(`/post/${post.id}`);
  };

  const handleReactionToggle = (emoji: ReactionEmoji) => {
    const current = post.reactions?.find((r) => r.userReacted);
    if (current?.emoji === emoji) {
      removeReaction.mutate({ postId: post.id });
    } else {
      setReaction.mutate({ postId: post.id, emoji });
    }
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <AnimatedPressable
        onPress={handlePress}
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          boxShadow: COLORS.cardShadow,
        }}
      >
        {/* Author row */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
          <AuthorAvatar author={post.author} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>
              {post.author.name || "Unbekannt"}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary }}>
              {relativeDate}
            </Text>
          </View>
          <ChevronRight size={16} color={COLORS.textTertiary} />
        </View>

        {/* Title */}
        {isProcessing ? (
          <View style={{ gap: 8, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: "600" }}>
                KI schreibt...
              </Text>
            </View>
            <SkeletonLine width="75%" height={20} />
            <SkeletonLine width="100%" height={13} />
            <SkeletonLine width="60%" height={13} />
          </View>
        ) : (
          <View style={{ marginBottom: 10 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: COLORS.text,
                letterSpacing: -0.3,
                marginBottom: 6,
                lineHeight: 24,
              }}
              numberOfLines={2}
            >
              {post.ai_title || post.text.slice(0, 60)}
            </Text>
            {post.ai_story ? (
              <Text
                style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 24, fontWeight: "500" }}
              >
                {post.ai_story}
              </Text>
            ) : (
              <Text
                style={{ fontSize: 15, color: COLORS.textSecondary, lineHeight: 24, fontWeight: "500" }}
                numberOfLines={3}
              >
                {post.text}
              </Text>
            )}
          </View>
        )}

        {/* Media */}
        {media.length > 0 && (
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
            {media.slice(0, 3).map((item, i) => (
              <View key={item.id} style={{ flex: 1, position: "relative" }}>
                <MediaThumb item={item} height={media.length === 1 ? 180 : 100} />
                {i === 2 && media.length > 3 && (
                  <View
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 10,
                      backgroundColor: "rgba(0,0,0,0.5)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "700" }}>
                      +{media.length - 3}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {post.tags.slice(0, 4).map((tag) => (
              <View
                key={tag}
                style={{
                  backgroundColor: COLORS.primaryMuted,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: "600" }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        <ReactionBar reactions={post.reactions} onToggle={handleReactionToggle} />
      </AnimatedPressable>
    </Animated.View>
  );
}
