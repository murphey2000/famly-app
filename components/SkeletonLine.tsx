import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";
import { COLORS } from "@/constants/Colors";

export function SkeletonLine({ width, height = 14 }: { width: number | `${number}%`; height?: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width, height, borderRadius: height / 2, overflow: "hidden" }}>
      <Animated.View style={{ flex: 1, backgroundColor: COLORS.surfaceSecondary, opacity }} />
    </View>
  );
}
