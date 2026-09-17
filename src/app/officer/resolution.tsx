import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "../../components/AppIcon";
import { colors, iconSizes } from "../../theme";

type ResolutionOutcome = "resolved" | "escalated" | "closed";

const OUTCOMES: {
  value: ResolutionOutcome;
  label: string;
  description: string;
  icon: "check-circle" | "arrow-up-right" | "circle-x";
}[] = [
  {
    value: "resolved",
    label: "Resolved",
    description: "The case has a recorded outcome and no immediate follow-up.",
    icon: "check-circle",
  },
  {
    value: "escalated",
    label: "Escalate",
    description: "Move the case to senior review or external authority action.",
    icon: "arrow-up-right",
  },
  {
    value: "closed",
    label: "Close",
    description: "Close the case when it cannot progress or was withdrawn.",
    icon: "circle-x",
  },
];

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function OfficerResolutionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    caseId?: string | string[];
    reference?: string | string[];
  }>();

  const reference = firstParam(params.reference) || "Case resolution";

  const [outcome, setOutcome] = useState<ResolutionOutcome>("resolved");
  const [caseSummary, setCaseSummary] = useState("");
  const [reporterSummary, setReporterSummary] = useState("");
  const [followUp, setFollowUp] = useState("");

  const confirmResolution = () => {
    const message =
      outcome === "escalated"
        ? "Escalation notes have been prepared for this case."
        : outcome === "closed"
          ? "Closure notes have been prepared for this case."
          : "Resolution notes have been prepared for this case.";

    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert("Resolution prepared", message);
    }

    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <AppIcon
            name="chevron-left"
            size={iconSizes.headerBack}
            color={colors.navy[700]}
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Resolution</Text>
          <Text style={styles.headerSubtitle}>{reference}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <AppIcon name="shield-check" size={22} color={colors.royal[700]} />
          <View style={styles.summaryTextBox}>
            <Text style={styles.summaryTitle}>Prepare case outcome</Text>
            <Text style={styles.summaryText}>
              Choose the final action, record internal reasoning and write the
              reporter-facing update before closing the workspace.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Outcome</Text>

        <View style={styles.outcomeList}>
          {OUTCOMES.map((item) => {
            const active = outcome === item.value;

            return (
              <Pressable
                key={item.value}
                onPress={() => setOutcome(item.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.outcomeCard,
                  active && styles.outcomeCardActive,
                ]}
              >
                <View
                  style={[
                    styles.outcomeIcon,
                    active && styles.outcomeIconActive,
                  ]}
                >
                  <AppIcon
                    name={item.icon}
                    size={18}
                    color={active ? colors.textInverse : colors.royal[700]}
                  />
                </View>

                <View style={styles.outcomeContent}>
                  <Text
                    style={[
                      styles.outcomeTitle,
                      active && styles.outcomeTitleActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={styles.outcomeDescription}>
                    {item.description}
                  </Text>
                </View>

                <AppIcon
                  name={active ? "check-circle" : "circle"}
                  size={19}
                  color={active ? colors.royal[700] : colors.textSoft}
                />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Case record</Text>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Internal resolution summary</Text>
          <TextInput
            value={caseSummary}
            onChangeText={setCaseSummary}
            placeholder="Summarize findings, actions taken, referrals, risks and final reasoning..."
            placeholderTextColor={colors.textSoft}
            multiline
            textAlignVertical="top"
            style={styles.textArea}
          />
        </View>

        <Text style={styles.sectionTitle}>Reporter update</Text>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Message to reporter</Text>
          <TextInput
            value={reporterSummary}
            onChangeText={setReporterSummary}
            placeholder="Write a clear, careful update the reporter can safely read..."
            placeholderTextColor={colors.textSoft}
            multiline
            textAlignVertical="top"
            style={styles.textArea}
          />
        </View>

        <Text style={styles.sectionTitle}>Follow-up</Text>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Next step or referral</Text>
          <TextInput
            value={followUp}
            onChangeText={setFollowUp}
            placeholder="Add referral, monitoring, protection or documentation steps..."
            placeholderTextColor={colors.textSoft}
            multiline
            textAlignVertical="top"
            style={styles.smallTextArea}
          />
        </View>

        <View style={styles.notice}>
          <AppIcon name="lock" size={16} color={colors.teal[800]} />
          <Text style={styles.noticeText}>
            This screen follows the reference Officer flow. It prepares the
            outcome package; final backend publication can be connected when the
            Sprint 3 resolution API is added.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Save draft</Text>
        </Pressable>

        <Pressable onPress={confirmResolution} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Confirm</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.navy[800] },
  headerSubtitle: { marginTop: 2, fontSize: 11.5, color: colors.textSecondary },
  content: { padding: 16, paddingBottom: 24 },
  summaryCard: {
    flexDirection: "row",
    gap: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.royal[100],
    borderRadius: 14,
    backgroundColor: colors.royal[50],
  },
  summaryTextBox: { flex: 1 },
  summaryTitle: { fontSize: 14, fontWeight: "600", color: colors.navy[800] },
  summaryText: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 9,
    fontSize: 14,
    fontWeight: "600",
    color: colors.navy[800],
  },
  outcomeList: { gap: 10 },
  outcomeCard: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  outcomeCardActive: {
    borderColor: colors.royal[300],
    backgroundColor: colors.royal[50],
  },
  outcomeIcon: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  outcomeIconActive: { backgroundColor: colors.royal[700] },
  outcomeContent: { flex: 1 },
  outcomeTitle: { fontSize: 13.5, fontWeight: "600", color: colors.navy[800] },
  outcomeTitleActive: { color: colors.royal[700] },
  outcomeDescription: {
    marginTop: 4,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  inputCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  inputLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[800],
  },
  textArea: {
    minHeight: 128,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 11,
    fontSize: 12,
    lineHeight: 18,
    color: colors.navy[800],
    backgroundColor: colors.background,
  },
  smallTextArea: {
    minHeight: 92,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 11,
    fontSize: 12,
    lineHeight: 18,
    color: colors.navy[800],
    backgroundColor: colors.background,
  },
  notice: {
    flexDirection: "row",
    gap: 9,
    marginTop: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 14,
    backgroundColor: colors.teal[50],
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButton: {
    minHeight: 42,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[700],
  },
  primaryButton: {
    minHeight: 42,
    flex: 1.4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.royal[700],
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textInverse,
  },
});
