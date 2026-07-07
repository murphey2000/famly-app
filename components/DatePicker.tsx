import React from "react";
import RNDateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
  style?: any;
  display?: "spinner" | "default" | "compact" | "inline";
  locale?: string;
}

export default function DatePicker({ value, onChange, maximumDate, style, display = "spinner", locale }: DatePickerProps) {
  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  return (
    <RNDateTimePicker
      value={value}
      mode="date"
      display={display}
      maximumDate={maximumDate}
      onChange={handleChange}
      locale={locale}
      style={style}
    />
  );
}
