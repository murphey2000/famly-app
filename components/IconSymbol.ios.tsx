import { SymbolView, SymbolViewProps, SymbolWeight } from "expo-symbols";
import { Pressable, StyleProp, ViewStyle } from "react-native";

export function IconSymbol({
  ios_icon_name,
  android_material_icon_name,
  size = 24,
  color,
  style,
  weight = "regular",
  onPress,
  onClick,
  onMouseOver,
  onMouseLeave,
  testID,
  accessibilityLabel,
}: {
  ios_icon_name: SymbolViewProps["name"];
  android_material_icon_name: any;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
  onPress?: any;
  onClick?: any;
  onMouseOver?: any;
  onMouseLeave?: any;
  testID?: any;
  accessibilityLabel?: any;
}) {
  const symbol = (
    <SymbolView
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={ios_icon_name}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );

  // SymbolView doesn't support press/mouse handlers, so wrap it in a
  // Pressable when a caller actually needs touch handling.
  if (onPress || onClick) {
    return (
      <Pressable onPress={onPress ?? onClick} onHoverIn={onMouseOver} onHoverOut={onMouseLeave}>
        {symbol}
      </Pressable>
    );
  }

  return symbol;
}
