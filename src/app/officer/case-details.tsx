import { useLocalSearchParams, useRouter } from "expo-router";

import { useCallback, useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

type CaseStatus =
  | "submitted"
  | "under_review"
  | "assigned"
  | "investigating"
  | "awaiting_evidence"
  | "resolved"
  | "closed";

type CasePriority = "low" | "medium" | "high" | "urgent";

type JusticeCase = {
  id: string;
  case_reference: string;
  title: string;
  description: string | null;
  category: string;
  incident_date: string | null;
  district: string | null;
  status: CaseStatus;
  priority: CasePriority;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
};

type InvestigationNote = {
  id: string;
  case_id: string;
  officer_id: string;
  note_text: string;
  created_at: string;
};

type StatusHistory = {
  id: string;
  old_status: CaseStatus | null;
  new_status: CaseStatus;
  changed_at: string;
};

// ---------------------------------------------------------
// Status options Case Officer is allowed to choose
// ---------------------------------------------------------

const STATUS_OPTIONS: {
  value: CaseStatus;
  label: string;
}[] = [
  {
    value: "investigating",
    label: "Investigating",
  },
  {
    value: "awaiting_evidence",
    label: "Awaiting evidence",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
];

// ---------------------------------------------------------
// Screen
// ---------------------------------------------------------

export default function CaseDetailsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const caseId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [caseData, setCaseData] = useState<JusticeCase | null>(null);

  const [notes, setNotes] = useState<InvestigationNote[]>([]);

  const [history, setHistory] = useState<StatusHistory[]>([]);

  const [newNote, setNewNote] = useState("");

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [savingNote, setSavingNote] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  // -------------------------------------------------------
  // Verify Staff MFA
  // -------------------------------------------------------

  const verifySecureSession = useCallback(async () => {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      console.error("AAL error:", error);

      return false;
    }

    if (data.currentLevel !== "aal2") {
      router.replace("/two-factor");

      return false;
    }

    return true;
  }, [router]);

  // -------------------------------------------------------
  // Load Workspace
  // -------------------------------------------------------

  const loadWorkspace = useCallback(
    async (showLoader = true) => {
      if (!caseId) {
        setErrorMessage("Case ID is missing.");

        setLoading(false);

        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage("");

        // -----------------------------------------------
        // Verify MFA first
        // -----------------------------------------------

        const secure = await verifySecureSession();

        if (!secure) {
          return;
        }

        // -----------------------------------------------
        // Load Case
        // -----------------------------------------------

        const { data: loadedCase, error: caseError } = await supabase
          .from("cases")
          .select(
            `
                id,
                case_reference,
                title,
                description,
                category,
                incident_date,
                district,
                status,
                priority,
                is_anonymous,
                created_at,
                updated_at
              `,
          )
          .eq("id", caseId)
          .single();

        console.log("CASE DETAILS:", loadedCase);

        console.log("CASE DETAILS ERROR:", caseError);

        if (caseError) {
          setErrorMessage(caseError.message);

          return;
        }

        setCaseData(loadedCase as JusticeCase);

        // -----------------------------------------------
        // Investigation Notes
        // -----------------------------------------------

        const { data: noteData, error: notesError } = await supabase
          .from("investigation_notes")
          .select(
            `
                id,
                case_id,
                officer_id,
                note_text,
                created_at
              `,
          )
          .eq("case_id", caseId)
          .order("created_at", {
            ascending: false,
          });

        if (notesError) {
          console.error("Notes error:", notesError);
        } else {
          setNotes((noteData ?? []) as InvestigationNote[]);
        }

        // -----------------------------------------------
        // Status History
        // -----------------------------------------------

        const { data: historyData, error: historyError } = await supabase
          .from("case_status_history")
          .select(
            `
                id,
                old_status,
                new_status,
                changed_at
              `,
          )
          .eq("case_id", caseId)
          .order("changed_at", {
            ascending: false,
          });

        if (historyError) {
          console.error("History error:", historyError);
        } else {
          setHistory((historyData ?? []) as StatusHistory[]);
        }
      } catch (error) {
        console.error("Load case workspace error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "JusticeNow could not load this case.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [caseId, verifySecureSession],
  );

  // -------------------------------------------------------
  // Initial Load
  // -------------------------------------------------------

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // -------------------------------------------------------
  // Pull to Refresh
  // -------------------------------------------------------

  const handleRefresh = () => {
    setRefreshing(true);

    loadWorkspace(false);
  };

  // -------------------------------------------------------
  // Add Investigation Note
  // -------------------------------------------------------

  const addNote = async () => {
    const cleanNote = newNote.trim();

    if (cleanNote.length < 3) {
      Alert.alert(
        "Note required",
        "Enter an investigation note before saving.",
      );

      return;
    }

    if (!caseId) {
      return;
    }

    try {
      setSavingNote(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/secure-role");

        return;
      }

      const { error } = await supabase.from("investigation_notes").insert({
        case_id: caseId,
        officer_id: user.id,
        note_text: cleanNote,
      });

      console.log("ADD NOTE ERROR:", error);

      if (error) {
        Alert.alert("Unable to save note", error.message);

        return;
      }

      setNewNote("");

      await loadWorkspace(false);

      Alert.alert(
        "Note saved",
        "The investigation note has been added to the case.",
      );
    } catch (error) {
      console.error("Add note error:", error);

      Alert.alert(
        "Unable to save note",
        "JusticeNow could not save the investigation note.",
      );
    } finally {
      setSavingNote(false);
    }
  };

  // -------------------------------------------------------
  // Update Status
  // -------------------------------------------------------

  const updateStatus = (nextStatus: CaseStatus) => {
    if (!caseId || !caseData || updatingStatus) {
      return;
    }

    if (caseData.status === nextStatus) {
      return;
    }

    Alert.alert(
      "Update case status",
      `Change this case from "${formatStatus(
        caseData.status,
      )}" to "${formatStatus(nextStatus)}"?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Update",

          onPress: async () => {
            try {
              setUpdatingStatus(true);

              const { error } = await supabase
                .from("cases")
                .update({
                  status: nextStatus,
                })
                .eq("id", caseId);

              console.log("STATUS UPDATE ERROR:", error);

              if (error) {
                Alert.alert("Unable to update status", error.message);

                return;
              }

              await loadWorkspace(false);

              Alert.alert(
                "Status updated",
                `Case status changed to ${formatStatus(nextStatus)}.`,
              );
            } catch (error) {
              console.error("Status update error:", error);

              Alert.alert(
                "Update failed",
                "JusticeNow could not update the case status.",
              );
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ],
    );
  };

  // -------------------------------------------------------
  // Loading
  // -------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>Loading case workspace...</Text>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------
  // Error
  // -------------------------------------------------------

  if (errorMessage !== "" || !caseData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Case Details</Text>
        </View>

        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>

          <Text style={styles.errorTitle}>Unable to open case</Text>

          <Text style={styles.errorText}>
            {errorMessage || "This case is unavailable."}
          </Text>

          <Pressable onPress={() => loadWorkspace()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Case Details</Text>

          <Text style={styles.headerSubtitle}>{caseData.case_reference}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.royal[700]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Case Overview */}

        <View style={styles.caseHeaderCard}>
          <View style={styles.caseTopRow}>
            <Text style={styles.reference}>{caseData.case_reference}</Text>

            <PriorityBadge priority={caseData.priority} />
          </View>

          <Text style={styles.caseTitle}>{caseData.title}</Text>

          <StatusBadge status={caseData.status} />
        </View>

        {/* Incident Information */}

        <Text style={styles.sectionTitle}>Case information</Text>

        <View style={styles.sectionCard}>
          <DetailRow label="Category" value={caseData.category} />

          <Divider />

          <DetailRow
            label="District"
            value={caseData.district ?? "Not specified"}
          />

          <Divider />

          <DetailRow
            label="Incident date"
            value={formatDate(caseData.incident_date)}
          />

          <Divider />

          <DetailRow
            label="Submitted"
            value={formatDateTime(caseData.created_at)}
          />

          <Divider />

          <DetailRow
            label="Reporter"
            value={
              caseData.is_anonymous
                ? "Anonymous reporter"
                : "Registered reporter"
            }
          />
        </View>

        {/* Description */}

        <Text style={styles.sectionTitle}>Report description</Text>

        <View style={styles.sectionCard}>
          <Text style={styles.descriptionText}>
            {caseData.description ?? "No description was provided."}
          </Text>
        </View>

        {/* Update Status */}

        <Text style={styles.sectionTitle}>Investigation status</Text>

        <View style={styles.sectionCard}>
          <Text style={styles.statusHelp}>
            Update the case as the investigation progresses.
          </Text>

          <View style={styles.statusOptions}>
            {STATUS_OPTIONS.map((option) => {
              const active = caseData.status === option.value;

              return (
                <Pressable
                  key={option.value}
                  disabled={updatingStatus}
                  onPress={() => updateStatus(option.value)}
                  style={[
                    styles.statusOption,

                    active && styles.statusOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusOptionText,

                      active && styles.statusOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {updatingStatus && (
            <ActivityIndicator
              style={{
                marginTop: 12,
              }}
              color={colors.royal[700]}
            />
          )}
        </View>

        {/* Investigation Notes */}

        <Text style={styles.sectionTitle}>Investigation notes</Text>

        <View style={styles.noteComposer}>
          <Text style={styles.noteLabel}>Add investigation note</Text>

          <TextInput
            value={newNote}
            onChangeText={setNewNote}
            placeholder="Record findings, actions taken, interviews, observations or next steps..."
            placeholderTextColor={colors.textSoft}
            multiline
            maxLength={5000}
            textAlignVertical="top"
            editable={!savingNote}
            style={styles.noteInput}
          />

          <View style={styles.noteBottomRow}>
            <Text style={styles.characterCount}>{newNote.length}/5000</Text>

            <Pressable
              onPress={addNote}
              disabled={savingNote}
              style={[
                styles.saveNoteButton,

                savingNote && styles.disabledButton,
              ]}
            >
              {savingNote ? (
                <ActivityIndicator size="small" color={colors.textInverse} />
              ) : (
                <Text style={styles.saveNoteText}>Save note</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Existing Notes */}

        {notes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📝</Text>

            <Text style={styles.emptyTitle}>No investigation notes</Text>

            <Text style={styles.emptyText}>
              Investigation notes added to this case will appear here.
            </Text>
          </View>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteOfficer}>Case Officer</Text>

                <Text style={styles.noteDate}>
                  {formatDateTime(note.created_at)}
                </Text>
              </View>

              <Text style={styles.noteText}>{note.note_text}</Text>
            </View>
          ))
        )}

        {/* Status Timeline */}

        <Text style={styles.sectionTitle}>Status history</Text>

        <View style={styles.sectionCard}>
          {history.length === 0 ? (
            <Text style={styles.emptyHistoryText}>
              No status changes have been recorded yet.
            </Text>
          ) : (
            history.map((item, index) => (
              <View key={item.id}>
                <View style={styles.historyRow}>
                  <View style={styles.timelineDot} />

                  <View style={styles.historyContent}>
                    <Text style={styles.historyTitle}>
                      {formatStatus(item.old_status)} →{" "}
                      {formatStatus(item.new_status)}
                    </Text>

                    <Text style={styles.historyDate}>
                      {formatDateTime(item.changed_at)}
                    </Text>
                  </View>
                </View>

                {index < history.length - 1 && (
                  <View style={styles.historyDivider} />
                )}
              </View>
            ))
          )}
        </View>

        {/* Security */}

        <View style={styles.securityNotice}>
          <Text style={styles.securityIcon}>🔒</Text>

          <View
            style={{
              flex: 1,
            }}
          >
            <Text style={styles.securityTitle}>
              Confidential investigation workspace
            </Text>

            <Text style={styles.securityText}>
              Access is restricted to the Case Officer currently assigned to
              this case and requires verified staff authentication.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// Components
// ---------------------------------------------------------

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>

      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <View style={styles.currentStatus}>
      <View style={styles.statusDot} />

      <Text style={styles.currentStatusText}>{formatStatus(status)}</Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: CasePriority }) {
  return (
    <View
      style={[
        styles.priorityBadge,

        priority === "urgent" && styles.priorityUrgent,

        priority === "high" && styles.priorityHigh,
      ]}
    >
      <Text
        style={[
          styles.priorityText,

          priority === "urgent" && styles.priorityUrgentText,
        ]}
      >
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------
// Formatting
// ---------------------------------------------------------

function formatStatus(status: CaseStatus | null) {
  if (!status) {
    return "Unknown";
  }

  switch (status) {
    case "under_review":
      return "Under review";

    case "awaiting_evidence":
      return "Awaiting evidence";

    case "investigating":
      return "Investigating";

    case "submitted":
      return "Submitted";

    case "assigned":
      return "Assigned";

    case "resolved":
      return "Resolved";

    case "closed":
      return "Closed";

    default:
      return status;
  }
}

function formatDate(date: string | null) {
  if (!date) {
    return "Not specified";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString();
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString();
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: colors.background,
  },

  loadingContainer: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: colors.background,
  },

  loadingText: {
    marginTop: 12,

    fontSize: 13,

    color: colors.textSecondary,
  },

  // -----------------------------------------------------
  // Header
  // -----------------------------------------------------

  header: {
    minHeight: 66,

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

  backText: {
    fontSize: 32,

    color: colors.navy[700],
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 17,

    fontWeight: "700",

    color: colors.navy[800],
  },

  headerSubtitle: {
    marginTop: 2,

    fontSize: 11.5,

    color: colors.textSecondary,
  },

  scrollContent: {
    padding: 16,

    paddingBottom: 40,
  },

  // -----------------------------------------------------
  // Case Header
  // -----------------------------------------------------

  caseHeaderCard: {
    padding: 18,

    borderRadius: 17,

    backgroundColor: colors.navy[800],
  },

  caseTopRow: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",
  },

  reference: {
    fontSize: 11,

    fontWeight: "700",

    letterSpacing: 0.5,

    color: "#BBD0E8",
  },

  caseTitle: {
    marginTop: 10,
    marginBottom: 12,

    fontSize: 20,

    fontWeight: "800",

    lineHeight: 26,

    color: colors.textInverse,
  },

  currentStatus: {
    alignSelf: "flex-start",

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 10,
    paddingVertical: 6,

    borderRadius: 10,

    backgroundColor: "rgba(255,255,255,0.12)",
  },

  statusDot: {
    width: 7,
    height: 7,

    marginRight: 7,

    borderRadius: 4,

    backgroundColor: colors.teal[300],
  },

  currentStatusText: {
    fontSize: 10.5,

    fontWeight: "700",

    color: colors.textInverse,
  },

  priorityBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,

    borderRadius: 9,

    backgroundColor: colors.royal[50],
  },

  priorityHigh: {
    backgroundColor: colors.gold[50],
  },

  priorityUrgent: {
    backgroundColor: "#FFF0EF",
  },

  priorityText: {
    fontSize: 10,

    fontWeight: "700",

    color: colors.navy[700],
  },

  priorityUrgentText: {
    color: colors.error,
  },

  // -----------------------------------------------------
  // Sections
  // -----------------------------------------------------

  sectionTitle: {
    marginTop: 23,
    marginBottom: 9,

    fontSize: 15,

    fontWeight: "700",

    color: colors.navy[800],
  },

  sectionCard: {
    padding: 15,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: 14,

    backgroundColor: colors.surface,
  },

  detailRow: {
    flexDirection: "row",

    justifyContent: "space-between",

    gap: 15,
  },

  detailLabel: {
    flex: 1,

    fontSize: 11.5,

    color: colors.textSecondary,
  },

  detailValue: {
    flex: 1.4,

    textAlign: "right",

    fontSize: 11.5,

    fontWeight: "600",

    color: colors.navy[800],
  },

  divider: {
    height: 1,

    marginVertical: 12,

    backgroundColor: colors.border,
  },

  descriptionText: {
    fontSize: 12.5,

    lineHeight: 19,

    color: colors.navy[700],
  },

  // -----------------------------------------------------
  // Status
  // -----------------------------------------------------

  statusHelp: {
    fontSize: 11.5,

    color: colors.textSecondary,
  },

  statusOptions: {
    flexDirection: "row",

    flexWrap: "wrap",

    gap: 7,

    marginTop: 12,
  },

  statusOption: {
    minHeight: 38,

    paddingHorizontal: 12,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 10,

    backgroundColor: colors.surface,
  },

  statusOptionActive: {
    borderColor: colors.royal[700],

    backgroundColor: colors.royal[700],
  },

  statusOptionText: {
    fontSize: 11,

    fontWeight: "600",

    color: colors.navy[700],
  },

  statusOptionTextActive: {
    color: colors.textInverse,
  },

  // -----------------------------------------------------
  // Notes
  // -----------------------------------------------------

  noteComposer: {
    padding: 15,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 14,

    backgroundColor: colors.surface,
  },

  noteLabel: {
    marginBottom: 8,

    fontSize: 12.5,

    fontWeight: "700",

    color: colors.navy[800],
  },

  noteInput: {
    minHeight: 120,

    padding: 12,

    borderWidth: 1,

    borderColor: colors.navy[200],

    borderRadius: 11,

    fontSize: 12.5,

    lineHeight: 18,

    color: colors.navy[800],

    backgroundColor: colors.background,
  },

  noteBottomRow: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    marginTop: 10,
  },

  characterCount: {
    fontSize: 10,

    color: colors.textSoft,
  },

  saveNoteButton: {
    minHeight: 40,

    minWidth: 105,

    paddingHorizontal: 14,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 10,

    backgroundColor: colors.royal[700],
  },

  saveNoteText: {
    fontSize: 11.5,

    fontWeight: "700",

    color: colors.textInverse,
  },

  disabledButton: {
    opacity: 0.55,
  },

  noteCard: {
    marginTop: 9,

    padding: 14,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 13,

    backgroundColor: colors.surface,
  },

  noteHeader: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    gap: 10,
  },

  noteOfficer: {
    fontSize: 10.5,

    fontWeight: "700",

    color: colors.royal[700],
  },

  noteDate: {
    fontSize: 9.5,

    color: colors.textSoft,
  },

  noteText: {
    marginTop: 8,

    fontSize: 12,

    lineHeight: 18,

    color: colors.navy[700],
  },

  emptyCard: {
    padding: 20,

    alignItems: "center",

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 14,

    backgroundColor: colors.surface,
  },

  emptyIcon: {
    fontSize: 24,
  },

  emptyTitle: {
    marginTop: 8,

    fontSize: 13,

    fontWeight: "700",

    color: colors.navy[800],
  },

  emptyText: {
    marginTop: 4,

    textAlign: "center",

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  // -----------------------------------------------------
  // History
  // -----------------------------------------------------

  historyRow: {
    flexDirection: "row",

    alignItems: "flex-start",
  },

  timelineDot: {
    width: 9,
    height: 9,

    marginTop: 4,
    marginRight: 10,

    borderRadius: 5,

    backgroundColor: colors.royal[600],
  },

  historyContent: {
    flex: 1,
  },

  historyTitle: {
    fontSize: 11.5,

    fontWeight: "600",

    color: colors.navy[800],
  },

  historyDate: {
    marginTop: 3,

    fontSize: 10,

    color: colors.textSoft,
  },

  historyDivider: {
    height: 1,

    marginVertical: 12,

    backgroundColor: colors.border,
  },

  emptyHistoryText: {
    textAlign: "center",

    fontSize: 11.5,

    color: colors.textSecondary,
  },

  // -----------------------------------------------------
  // Security
  // -----------------------------------------------------

  securityNotice: {
    flexDirection: "row",

    marginTop: 20,

    padding: 14,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 14,

    backgroundColor: colors.teal[50],
  },

  securityIcon: {
    marginRight: 9,
  },

  securityTitle: {
    fontSize: 12,

    fontWeight: "700",

    color: colors.teal[800],
  },

  securityText: {
    marginTop: 3,

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  // -----------------------------------------------------
  // Error
  // -----------------------------------------------------

  errorContainer: {
    flex: 1,

    alignItems: "center",
    justifyContent: "center",

    padding: 30,
  },

  errorIcon: {
    fontSize: 30,
  },

  errorTitle: {
    marginTop: 10,

    fontSize: 16,

    fontWeight: "700",

    color: colors.navy[800],
  },

  errorText: {
    marginTop: 6,

    textAlign: "center",

    fontSize: 12,

    lineHeight: 18,

    color: colors.textSecondary,
  },

  retryButton: {
    minHeight: 44,

    marginTop: 18,

    paddingHorizontal: 20,

    justifyContent: "center",

    borderRadius: 10,

    backgroundColor: colors.royal[700],
  },

  retryText: {
    fontSize: 12,

    fontWeight: "700",

    color: colors.textInverse,
  },
});
