import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  AppTextArea,
  AppTextInput,
  ChoiceCard,
  Field,
  Notice,
} from "../../components/common";
import { colors } from "../../theme";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";
import { OngoingStatus } from "./types";
import { validateReportStep } from "./validation";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: "", label: "Year" },
  ...Array.from({ length: 16 }, (_, index) => {
    const year = String(CURRENT_YEAR - index);
    return { value: year, label: year };
  }),
];

const MONTH_OPTIONS = [
  { value: "", label: "Month" },
  ...Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return { value: month, label: month };
  }),
];

const HOUR_OPTIONS = [
  { value: "", label: "HH" },
  ...Array.from({ length: 24 }, (_, index) => {
    const hour = String(index).padStart(2, "0");
    return { value: hour, label: hour };
  }),
];

const MINUTE_OPTIONS = [
  { value: "", label: "MM" },
  ...Array.from({ length: 12 }, (_, index) => {
    const minute = String(index * 5).padStart(2, "0");
    return { value: minute, label: minute };
  }),
];

function splitDate(value: string) {
  const [year = "", month = "", day = ""] = value.split("-");
  return { year, month, day };
}

function splitTime(value: string) {
  const [hour = "", minute = ""] = value.split(":");
  return { hour, minute };
}

function daysInMonth(year: string, month: string) {
  if (!year || !month) {
    return 31;
  }

  return new Date(Number(year), Number(month), 0).getDate();
}

function buildDate(year: string, month: string, day: string) {
  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function buildTime(hour: string, minute: string) {
  if (!hour && !minute) {
    return "";
  }

  if (!hour || !minute) {
    return "";
  }

  return `${hour}:${minute}`;
}

function currentDateParts() {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
  };
}

function currentTimeParts() {
  const now = new Date();
  return {
    hour: String(now.getHours()).padStart(2, "0"),
    minute: String(now.getMinutes()).padStart(2, "0"),
  };
}

function PickerColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.pickerColumn}>
      <Text style={styles.pickerColumnLabel}>{label}</Text>
      <ScrollView
        style={styles.optionList}
        nestedScrollEnabled
        showsVerticalScrollIndicator
      >
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value || option.label}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.optionButton, selected && styles.optionSelected]}
            >
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function StepDetailsScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();
  const [error, setError] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [dateSelection, setDateSelection] = useState(() =>
    splitDate(draft.incidentDate),
  );
  const [timeSelection, setTimeSelection] = useState(() =>
    splitTime(draft.incidentTime),
  );

  const dayOptions = useMemo(() => {
    const maxDay = daysInMonth(dateSelection.year, dateSelection.month);

    return [
      { value: "", label: "Day" },
      ...Array.from({ length: maxDay }, (_, index) => {
        const day = String(index + 1).padStart(2, "0");
        return { value: day, label: day };
      }),
    ];
  }, [dateSelection.month, dateSelection.year]);

  const updateDatePart = (part: "year" | "month" | "day", value: string) => {
    const next = {
      ...dateSelection,
      [part]: value,
    };
    const maxDay = daysInMonth(next.year, next.month);

    if (next.day && Number(next.day) > maxDay) {
      next.day = String(maxDay).padStart(2, "0");
    }

    setDateSelection(next);
    updateDraft({
      incidentDate: buildDate(next.year, next.month, next.day),
    });
    setError("");
  };

  const updateTimePart = (part: "hour" | "minute", value: string) => {
    const next = {
      ...timeSelection,
      [part]: value,
    };

    setTimeSelection(next);
    updateDraft({
      incidentTime: buildTime(next.hour, next.minute),
    });
  };

  const useTodayDate = () => {
    const next = currentDateParts();
    setDateSelection(next);
    updateDraft({
      incidentDate: buildDate(next.year, next.month, next.day),
    });
    setError("");
  };

  const useCurrentTime = () => {
    const next = currentTimeParts();
    setTimeSelection(next);
    updateDraft({
      incidentTime: buildTime(next.hour, next.minute),
    });
  };

  return (
    <ReportStepLayout
      step={3}
      title="Tell us what happened"
      intro="Share as much detail as you feel comfortable sharing. You can stop and continue later, and you can edit anything before you submit."
      error={error}
      onContinue={() => {
        const message = validateReportStep(3, draft);
        if (message) {
          setError(message);
          return;
        }
        router.push("/reporter/report/location");
      }}
    >
      <View style={styles.card}>
        <Field
          label="Case title"
          hint="A short line that helps you recognise this case."
        >
          <AppTextInput
            value={draft.title}
            onChangeText={(title) => {
              updateDraft({ title });
              setError("");
            }}
            placeholder="e.g. Prolonged detention without charge"
            accessibilityLabel="Case title"
          />
        </Field>

        <Field
          label="What happened?"
          hint="Include what you saw or experienced, who was involved and anything that felt unusual."
        >
          <AppTextArea
            value={draft.description}
            onChangeText={(description) => {
              updateDraft({ description });
              setError("");
            }}
            placeholder="Take your time…"
            maxLength={4000}
            accessibilityLabel="What happened?"
          />
        </Field>
        <Text style={styles.counter}>
          {draft.description.length} / 4000 characters
        </Text>

        <View style={styles.dateTimeRow}>
          <View style={styles.dateGroup}>
            <Text style={styles.groupLabel}>Date of incident</Text>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Choose incident date"
              style={styles.pickerButton}
            >
              <Text
                style={[
                  styles.pickerValue,
                  !draft.incidentDate && styles.pickerPlaceholder,
                ]}
              >
                {draft.incidentDate || "Select date"}
              </Text>
            </Pressable>
            <Text style={styles.groupHint}>Future dates are not allowed.</Text>
          </View>

          <View style={styles.timeGroup}>
            <Text style={styles.groupLabel}>
              Approximate time <Text style={styles.optional}>optional</Text>
            </Text>
            <Pressable
              onPress={() => setTimePickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Choose approximate incident time"
              style={styles.pickerButton}
            >
              <Text
                style={[
                  styles.pickerValue,
                  !draft.incidentTime && styles.pickerPlaceholder,
                ]}
              >
                {draft.incidentTime || "Select time"}
              </Text>
            </Pressable>
            <Text style={styles.groupHint}>Use your best estimate.</Text>
          </View>
        </View>
      </View>

      <Modal
        visible={datePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDatePickerOpen(false)}
        >
          <Pressable style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Date of incident</Text>
              <Pressable
                onPress={useTodayDate}
                style={styles.quickButton}
                accessibilityRole="button"
              >
                <Text style={styles.quickButtonText}>Today</Text>
              </Pressable>
            </View>
            <View style={styles.modalPickerRow}>
              <PickerColumn
                label="Year"
                value={dateSelection.year}
                options={YEAR_OPTIONS}
                onChange={(value) => updateDatePart("year", value)}
              />
              <PickerColumn
                label="Month"
                value={dateSelection.month}
                options={MONTH_OPTIONS}
                onChange={(value) => updateDatePart("month", value)}
              />
              <PickerColumn
                label="Day"
                value={dateSelection.day}
                options={dayOptions}
                onChange={(value) => updateDatePart("day", value)}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setDatePickerOpen(false)}
                style={styles.doneButton}
                accessibilityRole="button"
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={timePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setTimePickerOpen(false)}
        >
          <Pressable style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Approximate time</Text>
              <Pressable
                onPress={useCurrentTime}
                style={styles.quickButton}
                accessibilityRole="button"
              >
                <Text style={styles.quickButtonText}>Now</Text>
              </Pressable>
            </View>
            <View style={styles.modalTimeRow}>
              <PickerColumn
                label="Hour"
                value={timeSelection.hour}
                options={HOUR_OPTIONS}
                onChange={(value) => updateTimePart("hour", value)}
              />
              <PickerColumn
                label="Minute"
                value={timeSelection.minute}
                options={MINUTE_OPTIONS}
                onChange={(value) => updateTimePart("minute", value)}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setTimeSelection({ hour: "", minute: "" });
                  updateDraft({ incidentTime: "" });
                  setTimePickerOpen(false);
                }}
                style={styles.clearButton}
                accessibilityRole="button"
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={() => setTimePickerOpen(false)}
                style={styles.doneButton}
                accessibilityRole="button"
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Text style={styles.legend}>Is the incident still ongoing?</Text>
      <View style={styles.stack}>
        {(
          [
            ["yes", "Yes, it is still happening"],
            ["no", "No, it has ended"],
            ["unsure", "I am not sure"],
          ] as [OngoingStatus, string][]
        ).map(([value, title]) => (
          <ChoiceCard
            key={value}
            title={title}
            selected={draft.ongoing === value}
            onPress={() => {
              updateDraft({ ongoing: value });
              setError("");
            }}
          />
        ))}
      </View>

      <View style={styles.notice}>
        <Notice tone="caution" title="Take a break if you need one">
          Writing about a difficult experience can be hard. You can go back and
          edit anything before you submit.
        </Notice>
      </View>
    </ReportStepLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  counter: {
    marginTop: -8,
    marginBottom: 12,
    textAlign: "right",
    fontSize: 11,
    color: colors.textSoft,
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  dateGroup: {
    flex: 1.18,
    minWidth: 0,
  },
  timeGroup: {
    flex: 1,
    minWidth: 0,
  },
  groupLabel: {
    minHeight: 18,
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  optional: {
    fontWeight: "500",
    color: colors.textSoft,
  },
  pickerButton: {
    minHeight: 48,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  pickerValue: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy[800],
  },
  pickerPlaceholder: {
    color: colors.textSoft,
  },
  timeColon: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[700],
  },
  groupHint: {
    marginTop: 6,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 30, 51, 0.35)",
  },
  modalCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  modalHeader: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },
  quickButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.royal[200],
    borderRadius: 999,
    backgroundColor: colors.royal[50],
  },
  quickButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.royal[700],
  },
  modalPickerRow: {
    flexDirection: "row",
    gap: 8,
  },
  modalTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerColumnLabel: {
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  optionList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  optionButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(227, 233, 242, 0.75)",
  },
  optionSelected: {
    backgroundColor: colors.royal[50],
  },
  optionText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.navy[700],
  },
  optionTextSelected: {
    fontWeight: "700",
    color: colors.royal[700],
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  clearButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  doneButton: {
    minHeight: 42,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    borderRadius: 11,
    backgroundColor: colors.royal[700],
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
  legend: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: colors.navy[800],
  },
  stack: {
    gap: 8,
  },
  notice: {
    marginTop: 16,
  },
});
