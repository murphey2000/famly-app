import React from "react";
import { View, Text } from "react-native";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import type { PostReaction } from "@/types";

const ALL_EMOJIS = ["👍", "❤️", "😂"] as const;
export type ReactionEmoji = (typeof ALL_EMOJIS)[number];

export function ReactionBar({
  reactions,
  onToggle,
}: {
  reactions: PostReaction[] | undefined;
  onToggle: (emoji: ReactionEmoji) => void;
}) {
  const byEmoji = new Map((reactions ?? []).map((r) => [r.emoji, r]));

  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
      }}
    >
      {ALL_EMOJIS.map((emoji) => {
        const r = byEmoji.get(emoji);
        const count = r?.count ?? 0;
        const active = r?.userReacted ?? false;
        return (
          <AnimatedPressable
            key={emoji}
            onPress={() => onToggle(emoji)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: active ? COLORS.primaryMuted : COLORS.surfaceSecondary,
              borderWidth: active ? 1 : 0,
              borderColor: COLORS.primary,
            }}
          >
            <Text style={{ fontSize: 15 }}>{emoji}</Text>
            {count > 0 && (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: active ? COLORS.primary : COLORS.textSecondary,
                }}
              >
                {count}
              </Text>
            )}
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
