import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Home, Clock, Plus, Newspaper, User } from "lucide-react-native";
import { Stack } from "expo-router";
import { COLORS } from "@/constants/Colors";
import { FilterProvider } from "@/contexts/FilterContext";

function FamlyTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const tabs: {
    name: string;
    route: string;
    icon: typeof Home;
    label: string;
    special?: boolean;
  }[] = [
    { name: "home", route: "/(tabs)/(home)", icon: Home, label: "Zuhause" },
    { name: "memories", route: "/(tabs)/memories", icon: Clock, label: "Erinnerungen" },
    { name: "add", route: "/post/new", icon: Plus, label: "Hinzufügen", special: true },
    { name: "newsletter", route: "/(tabs)/newsletter", icon: Newspaper, label: "Zeitung" },
    { name: "settings", route: "/(tabs)/settings", icon: User, label: "Profil" },
  ];

  const isActive = (tabName: string) => {
    if (tabName === "home") return pathname === "/" || pathname.includes("/(home)");
    if (tabName === "add") return false;
    return pathname.includes(`/${tabName}`);
  };

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: insets.bottom,
      }}
    >
      <BlurView
        intensity={80}
        style={{
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          flexDirection: "row",
          paddingTop: 8,
          paddingBottom: 4,
          paddingHorizontal: 8,
        }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.name);
          const IconComp = tab.icon;

          if (tab.special) {
            return (
              <Pressable
                key={tab.name}
                onPress={() => {
                  console.log("[TabBar] Add button pressed, navigating to /post/new");
                  router.push("/post/new");
                }}
                style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: COLORS.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 12px rgba(217, 119, 6, 0.4)",
                    marginBottom: 2,
                  }}
                >
                  <IconComp size={24} color="#FFFFFF" />
                </View>
                <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: "600" }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          }

          return (
            <Pressable
              key={tab.name}
              onPress={() => {
                console.log("[TabBar] Tab pressed:", tab.name, "route:", tab.route);
                router.push(tab.route as any);
              }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 4 }}
            >
              <IconComp
                size={24}
                color={active ? COLORS.primary : COLORS.textTertiary}
              />
              <Text
                style={{
                  fontSize: 10,
                  marginTop: 2,
                  color: active ? COLORS.primary : COLORS.textTertiary,
                  fontWeight: active ? "600" : "400",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  return (
    <FilterProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(home)" />
          <Stack.Screen name="memories" />
          <Stack.Screen name="newsletter" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="add" />
        </Stack>
        <FamlyTabBar />
      </View>
    </FilterProvider>
  );
}
