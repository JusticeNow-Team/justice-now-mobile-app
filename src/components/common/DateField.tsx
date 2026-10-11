import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { AppIcon } from "../AppIcon";
import { colors, iconSizes } from "../../theme";

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

function dateFromIso(value: string, fallback: Date) {
  if (!value) {
    return fallback;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? fallback : date;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function getMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function isBeforeDate(date: Date, limit?: Date) {
  if (!limit) {
    return false;
  }

  return formatIsoDate(date) < formatIsoDate(limit);
}

function isAfterDate(date: Date, limit?: Date) {
  if (!limit) {
    return false;
  }

  return formatIsoDate(date) > formatIsoDate(limit);
}

function isDisabledDate(date: Date, minimumDate?: Date, maximumDate?: Date) {
  return isBeforeDate(date, minimumDate) || isAfterDate(date, maximumDate);
}

function buildCalendarDays(month: Date) {
  const firstDay = startOfMonth(month);
  const daysInMonth = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = Array.from(
    { length: firstDay.getDay() },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export default function DateField({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  minimumDate,
  maximumDate,
  accessibilityLabel,
  style,
}: DateFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(dateFromIso(value, minimumDate ?? new Date())),
  );
  const selectedDate = useMemo(() => {
    return dateFromIso(value, minimumDate ?? new Date());
  }, [minimumDate, value]);
  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth],
  );

  const openPicker = () => {
    setVisibleMonth(startOfMonth(selectedDate));
    setPickerOpen(true);
  };

  const chooseDate = (date: Date) => {
    if (isDisabledDate(date, minimumDate, maximumDate)) {
      return;
    }

    onChange(formatIsoDate(date));
    setPickerOpen(false);
  };

  const chooseToday = () => {
    chooseDate(new Date());
  };

  const handleNativeChange = (
    event: DateTimePickerEvent,
    nextDate?: Date,
  ) => {
    if (Platform.OS !== "ios") {
      setPickerOpen(false);
    }

    if (event.type === "dismissed" || !nextDate) {
      return;
    }

    onChange(formatIsoDate(nextDate));
  };

  if (Platform.OS === "web") {
    return (
      <View style={style}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={openPicker}
          style={({ pressed }) => [
            styles.button,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <AppIcon
            name="calendar"
            size={iconSizes.sm}
            color={colors.royal[700]}
          />
          <Text style={[styles.value, !value && styles.placeholder]}>
            {value || placeholder}
          </Text>
        </Pressable>

        <Modal
          visible={pickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
              style={StyleSheet.absoluteFill}
              onPress={() => setPickerOpen(false)}
            />
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  onPress={() => setVisibleMonth((date) => addMonths(date, -1))}
                  style={({ pressed }) => [
                    styles.monthButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon
                    name="chevron-left"
                    size={iconSizes.sm}
                    color={colors.navy[800]}
                  />
                </Pressable>
                <Text style={styles.monthTitle}>{getMonthTitle(visibleMonth)}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  onPress={() => setVisibleMonth((date) => addMonths(date, 1))}
                  style={({ pressed }) => [
                    styles.monthButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon
                    name="chevron-right"
                    size={iconSizes.sm}
                    color={colors.navy[800]}
                  />
                </Pressable>
              </View>

              <View style={styles.weekdayRow}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <Text key={day} style={styles.weekdayText}>
                      {day}
                    </Text>
                  ),
                )}
              </View>

              <View style={styles.calendarGrid}>
                {calendarDays.map((date, index) => {
                  if (!date) {
                    return <View key={`blank-${index}`} style={styles.dayCell} />;
                  }

                  const isoDate = formatIsoDate(date);
                  const selected = isoDate === value;
                  const unavailable = isDisabledDate(
                    date,
                    minimumDate,
                    maximumDate,
                  );

                  return (
                    <Pressable
                      key={isoDate}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${isoDate}`}
                      accessibilityState={{
                        disabled: unavailable,
                        selected,
                      }}
                      disabled={unavailable}
                      onPress={() => chooseDate(date)}
                      style={({ pressed }) => [
                        styles.dayCell,
                        selected && styles.dayCellSelected,
                        unavailable && styles.dayCellDisabled,
                        pressed && !unavailable && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.dayTextSelected,
                          unavailable && styles.dayTextDisabled,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                {value ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      onChange("");
                      setPickerOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.textButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.textButtonText}>Clear</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={isDisabledDate(new Date(), minimumDate, maximumDate)}
                  onPress={chooseToday}
                  style={({ pressed }) => [
                    styles.textButton,
                    isDisabledDate(new Date(), minimumDate, maximumDate) &&
                      styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.textButtonText}>Today</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPickerOpen(false)}
                  style={({ pressed }) => [
                    styles.doneButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.doneButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.button,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <AppIcon
          name="calendar"
          size={iconSizes.sm}
          color={colors.royal[700]}
        />
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
      </Pressable>

      {pickerOpen ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleNativeChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 11,
    backgroundColor: colors.surface,
  },
  value: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: colors.navy[800],
  },
  placeholder: {
    color: colors.textSoft,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(10, 18, 32, 0.48)",
  },
  calendarCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.navy[100],
    shadowColor: colors.navy[900],
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  calendarHeader: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  monthButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.navy[50],
  },
  monthTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[900],
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSoft,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: colors.royal[700],
  },
  dayCellDisabled: {
    opacity: 0.35,
  },
  dayText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  dayTextSelected: {
    color: colors.surface,
  },
  dayTextDisabled: {
    color: colors.textSoft,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  textButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  textButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.royal[700],
  },
  doneButton: {
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.royal[700],
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.surface,
  },
});
