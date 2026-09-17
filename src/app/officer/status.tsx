import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "../../components/AppIcon";
import { supabase } from "../../lib/supabase";
import { colors, iconSizes } from "../../theme";

type CaseStatus = "investigating" | "awaiting_information" | "awaiting_evidence" | "resolved" | "closed";

const STATUS_OPTIONS: { value: CaseStatus; label: string; description: string }[] = [
  {
    value: "investigating",
    label: "Investigating",
    description: "The officer is actively reviewing facts, evidence and next actions.",
  },
  {
    value: "awaiting_information",
    label: "Awaiting information",
    description: "A secure information request has been sent to the reporter.",
  },
  {
    value: "awaiting_evidence",
    label: "Awaiting evidence",
    description: "The case needs supporting files before the next investigation step.",
  },
  {
    value: "resolved",
    label: "Resolved",
    description: "Investigation action is complete and the outcome can be recorded.",
  },
  {
    value: "closed",
    label: "Closed",
    description: "No further action is expected on this case.",
  },
];

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function OfficerStatusScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    caseId?: string | string[];
    reference?: string | string[];
  }>();

  const caseId = firstParam(params.caseId);
  const reference = firstParam(params.reference) || "Case status";

  const [selectedStatus, setSelectedStatus] = useState<CaseStatus>("investigating");
  const [saving, setSaving] = useState(false);

  const saveStatus = async () => {
    if (!caseId) {
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc("update_officer_case_status", {
        p_case_id: caseId,
        p_status: selectedStatus,
      });

      if (error) {
        const message = `Unable to update status: ${error.message}`;
        if (Platform.OS === "web") {
          window.alert(message);
        } else {
          Alert.alert("Unable to update status", error.message);
        }
        return;
      }

      router.back();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "JusticeNow could not update this case.";

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Update failed", message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <AppIcon
            name="chevron-left"
            size={iconSizes.headerBack}
            color={colors.navy[700]}
          />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Update case status</Text>
          <Text style={styles.headerSubtitle}>{reference}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <AppIcon name="info" size={17} color={colors.royal[700]} />
          <Text style={styles.noticeText}>
            Select the plain-language status that best reflects the current
            investigation stage.
          </Text>
        </View>

        {STATUS_OPTIONS.map((option) => {
          const active = selectedStatus === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => setSelectedStatus(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.statusCard, active && styles.statusCardActive]}
            >
              <View style={styles.statusContent}>
                <Text style={[styles.statusTitle, active && styles.statusTitleActive]}>
                  {option.label}
                </Text>
                <Text style={styles.statusDescription}>{option.description}</Text>
              </View>
              <AppIcon
                name={active ? "check-circle" : "circle"}
                size={20}
                color={active ? colors.royal[700] : colors.textSoft}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={() => void saveStatus()}
          disabled={saving}
          style={[styles.primaryButton, saving && styles.disabledButton]}
        >
          {saving ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Update status</Text>
          )}
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
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "600", color: colors.navy[800] },
  headerSubtitle: { marginTop: 2, fontSize: 11.5, color: colors.textSecondary },
  content: { padding: 16, paddingBottom: 24 },
  notice: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.royal[100],
    borderRadius: 14,
    backgroundColor: colors.royal[50],
  },
  noticeText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: colors.textSecondary },
  statusCard: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  statusCardActive: {
    borderColor: colors.royal[300],
    backgroundColor: colors.royal[50],
  },
  statusContent: { flex: 1 },
  statusTitle: { fontSize: 13.5, fontWeight: "600", color: colors.navy[800] },
  statusTitleActive: { color: colors.royal[700] },
  statusDescription: { marginTop: 4, fontSize: 11.5, lineHeight: 16, color: colors.textSecondary },
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
  secondaryButtonText: { fontSize: 12, fontWeight: "600", color: colors.navy[700] },
  primaryButton: {
    minHeight: 42,
    flex: 1.5,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.royal[700],
  },
  primaryButtonText: { fontSize: 12, fontWeight: "600", color: colors.textInverse },
  disabledButton: { opacity: 0.6 },
});
