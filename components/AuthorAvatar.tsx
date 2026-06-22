import React from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { COLORS } from "@/constants/Colors";

export function AuthorAvatar({ author, size = 40 }: { author: { name: string; image?: string }; size?: number }) {
  const initials = (author.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (author.image) {
    return (
      <Image
        source={{ uri: author.image }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.primaryMuted,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.35, fontWeight: "700", color: COLORS.primary }}>
        {initials}
      </Text>
    </View>
  );
}
