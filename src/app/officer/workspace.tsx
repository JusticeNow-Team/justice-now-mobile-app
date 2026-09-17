import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
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

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default function OfficerWorkspaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    caseId?: string | string[];
    reference?: string | string[];
  }>();

  const reference = firstParam(params.reference) || "Case workspace";

  const [note, setNote] = useState(
    "Record investigation notes, witness activity, requests and next steps.",
  );

  const checklist = useMemo(
    () => [
      { label: "Confirm case summary and risk level", done: true },
      { label: "Review reporter information", done: true },
      { label: "Review submitted evidence", done: false },
      { label: "Record first investigation activity", done: false },
      { label: "Set next action and deadline", done: false },
    ],
    [],
  );

  const completed = checklist.filter((item) => item.done).length;

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Investigation workspace"
        subtitle={reference}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard
          title="Investigation checklist"
          description={`${completed} of ${checklist.length} steps complete`}
        >
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(completed / checklist.length) * 100}%` },
              ]}
            />
          </View>

          {checklist.map((item) => (
            <View key={item.label} style={styles.checkRow}>
              <AppIcon
                name={item.done ? "check-circle" : "circle"}
                size={18}
                color={item.done ? colors.teal[700] : colors.textSoft}
              />
              <Text style={styles.checkText}>{item.label}</Text>
            </View>
          ))}
        </SectionCard>

        <SectionCard
          title="Investigation notes"
          description="Internal only. Never shown to the reporter."
        >
          <View style={styles.toolbar}>
            <ToolIcon name="document" />
            <ToolIcon name="list-checks" />
            <ToolIcon name="file-up" />
            <ToolIcon name="refresh-cw" />
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            textAlignVertical="top"
            style={styles.noteInput}
          />

          <Text style={styles.autosaveText}>
            Autosaved locally while this workspace remains open.
          </Text>
        </SectionCard>

        <SectionCard title="Add investigation activity">
          <FieldLabel label="Activity type" value="Witness statement" />
          <FieldLabel label="Date" value={new Date().toLocaleDateString()} />
          <FieldLabel label="Notes" value="What was done and what was found" />

          <Pressable style={styles.secondaryButton}>
            <AppIcon name="file-up" size={16} color={colors.royal[700]} />
            <Text style={styles.secondaryButtonText}>
              Attach supporting document
            </Text>
          </Pressable>
        </SectionCard>

        <SectionCard
          title="Recorded activity"
          description="Entries added to the case timeline"
        >
          <ActivityRow
            title="Reporter contact"
            date="Today"
            description="Follow-up details can be requested through secure messaging."
          />
          <ActivityRow
            title="Evidence review"
            date="Pending"
            description="Open files from the case review screen when needed."
          />
        </SectionCard>

        <SectionCard title="Next action">
          <FieldLabel label="Task" value="Witness verification visit" />
          <FieldLabel label="Deadline" value="Set from investigation plan" />

          <Pressable
            onPress={() => router.push("/officer/tasks")}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Set task</Text>
          </Pressable>
        </SectionCard>

        <View style={styles.notice}>
          <AppIcon name="lock" size={16} color={colors.teal[800]} />
          <Text style={styles.noticeText}>
            Nothing on this screen reaches the reporter. Use Request
            information or Update status for reporter-facing communication.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <AppIcon
          name="chevron-left"
          size={iconSizes.headerBack}
          color={colors.navy[700]}
        />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? (
        <Text style={styles.sectionDescription}>{description}</Text>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ToolIcon({
  name,
}: {
  name: "document" | "list-checks" | "file-up" | "refresh-cw";
}) {
  return (
    <View style={styles.toolIcon}>
      <AppIcon name={name} size={15} color={colors.navy[700]} />
    </View>
  );
}

function FieldLabel({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function ActivityRow({
  title,
  date,
  description,
}: {
  title: string;
  date: string;
  description: string;
}) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityHeader}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityDate}>{date}</Text>
      </View>
      <Text style={styles.activityDescription}>{description}</Text>
    </View>
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
  content: { padding: 16, paddingBottom: 34 },
  sectionCard: {
    marginBottom: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  sectionTitle: { fontSize: 13.5, fontWeight: "600", color: colors.navy[800] },
  sectionDescription: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  sectionBody: { marginTop: 12 },
  progressTrack: {
    height: 6,
    marginBottom: 12,
    borderRadius: 999,
    backgroundColor: colors.navy[100],
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.teal[500] },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 8 },
  checkText: { flex: 1, fontSize: 12.5, color: colors.navy[700] },
  toolbar: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 10,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  toolIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  noteInput: {
    minHeight: 128,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.navy[800],
    backgroundColor: colors.background,
  },
  autosaveText: { marginTop: 7, fontSize: 11, color: colors.textSoft },
  fieldBox: {
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    backgroundColor: colors.background,
  },
  fieldLabel: { fontSize: 10.5, fontWeight: "600", color: colors.textSecondary },
  fieldValue: { marginTop: 4, fontSize: 12.5, color: colors.navy[800] },
  secondaryButton: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.royal[100],
    borderRadius: 11,
    backgroundColor: colors.royal[50],
  },
  secondaryButtonText: { fontSize: 12, fontWeight: "600", color: colors.royal[700] },
  primaryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: colors.royal[700],
  },
  primaryButtonText: { fontSize: 12, fontWeight: "600", color: colors.textInverse },
  activityRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  activityHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  activityTitle: { flex: 1, fontSize: 12.5, fontWeight: "600", color: colors.navy[800] },
  activityDate: { fontSize: 11, color: colors.textSoft },
  activityDescription: { marginTop: 4, fontSize: 11.5, lineHeight: 16, color: colors.textSecondary },
  notice: {
    flexDirection: "row",
    gap: 9,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 14,
    backgroundColor: colors.teal[50],
  },
  noticeText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: colors.textSecondary },
});
