import React from "react";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { Pressable, View } from "react-native";
import { COLORS } from "@/constants/Colors";

export default function TabLayoutIOS() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Icon sf="house.fill" />
        <Label>Zuhause</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="memories">
        <Icon sf="clock.arrow.circlepath" />
        <Label>Erinnerungen</Label>
      </NativeTabs.Trigger>

      {/* Navigation to /post/new is handled by app/(tabs)/add/index.tsx on focus */}
      <NativeTabs.Trigger name="add">
        <Icon sf="plus.circle.fill" />
        <Label>Hinzufügen</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="newsletter">
        <Icon sf="newspaper" />
        <Label>Zeitung</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon sf="person.circle" />
        <Label>Profil</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
