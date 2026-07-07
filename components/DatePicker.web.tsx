import React from "react";
import { View } from "react-native";
import { COLORS } from "@/constants/Colors";

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  style?: any;
  display?: string;
  locale?: string;
}

export default function DatePicker({ value, onChange, maximumDate, style }: DatePickerProps) {
  const toInputValue = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const maxStr = maximumDate ? toInputValue(maximumDate) : undefined;

  return (
    <View style={[{ width: "100%" }, style]}>
      <input
        type="date"
        value={toInputValue(value)}
        max={maxStr}
        onChange={(e) => {
          if (e.target.value) {
            const parts = e.target.value.split("-").map(Number);
            const y = parts[0];
            const m = parts[1];
            const d = parts[2];
            console.log("[DatePicker] Web date input changed:", e.target.value);
            onChange(new Date(y, m - 1, d));
          }
        }}
        style={{
          width: "100%",
          height: 52,
          borderRadius: 12,
          border: `1.5px solid ${COLORS.border}`,
          backgroundColor: COLORS.surfaceSecondary,
          paddingLeft: 14,
          paddingRight: 14,
          fontSize: 16,
          color: COLORS.text,
          fontFamily: "inherit",
          cursor: "pointer",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </View>
  );
}
