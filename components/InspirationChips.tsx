import React from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants/Colors";
import { AnimatedPressable } from "@/components/AnimatedPressable";

export const INSPIRATION_CHIPS = [
  { emoji: "📸", label: "Erster Schultag" },
  { emoji: "🎂", label: "Geburtstage" },
  { emoji: "🏖", label: "Familienurlaub" },
  { emoji: "⚽", label: "Erstes Fußballspiel" },
  { emoji: "🐶", label: "Neues Haustier" },
];

export function InspirationChips() {
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 16 }}>
      {INSPIRATION_CHIPS.map((chip) => {
        const chipLabel = chip.emoji + " " + chip.label;
        return (
          <AnimatedPressable
            key={chip.label}
            onPress={() => {
              console.log("[InspirationChips] Chip pressed:", chip.label);
              router.push("/post/new");
            }}
            style={{
              backgroundColor: COLORS.surfaceSecondary,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" }}>
              {chipLabel}
            </Text>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}
