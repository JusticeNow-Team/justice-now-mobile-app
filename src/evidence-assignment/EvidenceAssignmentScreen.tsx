import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ConfirmDialog from "../components/common/ConfirmDialog";
import PrimaryButton from "../components/common/PrimaryButton";
import { supabase } from "../lib/supabase";
import { colors } from "../theme";
import {
  assignEvidenceToChecker,
  getAvailableEvidenceCheckers,
  getOfficerEvidenceAssignments,
} from "./api";
import { EvidenceChecker } from "./types";

type EvidenceDetail = {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  evidence_type: string;
  file_name: string | null;
  validation_status: string;
  created_at: string;
};

type CaseDetail = {
  id: string;
  case_reference: string;
  title: string;
};

export default function EvidenceAssignmentScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    evidenceId?: string | string[];
    caseId?: string | string[];
  }>();

  const evidenceId = Array.isArray(params.evidenceId)
    ? params.evidenceId[0]
    : params.evidenceId;

  const caseId = Array.isArray(params.caseId)
    ? params.caseId[0]
    : params.caseId;

  const [evidence, setEvidence] =
    useState<EvidenceDetail | null>(null);

  const [caseData, setCaseData] =
    useState<CaseDetail | null>(null);

  const [checkers, setCheckers] =
    useState<EvidenceChecker[]>([]);

  const [selectedCheckerId, setSelectedCheckerId] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [confirmVisible, setConfirmVisible] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const selectedChecker = useMemo(
    () =>
      checkers.find(
        (checker) => checker.id === selectedCheckerId,
      ) ?? null,
    [checkers, selectedCheckerId],
  );

  /**
   * Return safely to the Evidence screen.
   *
   * router.back() must only be used when navigation
   * history is available. This also supports opening the
   * assignment page directly from a browser URL.
   */
  const returnToEvidence = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (caseId) {
      router.replace({
        pathname: "/officer/evidence",
        params: {
          caseId,
        },
      });

      return;
    }

    router.replace("/officer/evidence");
  }, [caseId, router]);

  const loadWorkspace = useCallback(async () => {
    if (!evidenceId || !caseId) {
      setErrorMessage("Evidence or case ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/secure-role");
        return;
      }

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        throw aalError;
      }

      if (aal.currentLevel !== "aal2") {
        router.replace("/two-factor");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

      if (
        profileError ||
        profile?.role !== "case_officer"
      ) {
        throw new Error(
          "This workspace is restricted to authorized Case Officers.",
        );
      }

      const [
        evidenceResult,
        caseResult,
        checkerRows,
        assignmentRows,
      ] = await Promise.all([
        supabase
          .from("case_evidence")
          .select(
            "id, case_id, title, description, evidence_type, file_name, validation_status, created_at",
          )
          .eq("id", evidenceId)
          .eq("case_id", caseId)
          .single(),

        supabase
          .from("cases")
          .select("id, case_reference, title")
          .eq("id", caseId)
          .single(),

        getAvailableEvidenceCheckers(caseId),

        getOfficerEvidenceAssignments(caseId),
      ]);

      if (
        evidenceResult.error ||
        !evidenceResult.data
      ) {
        throw (
          evidenceResult.error ??
          new Error("Evidence was not found.")
        );
      }

      if (caseResult.error || !caseResult.data) {
        throw (
          caseResult.error ??
          new Error("Case was not found.")
        );
      }

      const activeAssignment = assignmentRows.find(
        (assignment) =>
          assignment.evidenceId === evidenceId &&
          (assignment.status === "assigned" ||
            assignment.status === "under_review"),
      );

      if (activeAssignment) {
        throw new Error(
          `This evidence is already assigned to ${activeAssignment.checkerName}.`,
        );
      }

      const typedEvidence =
        evidenceResult.data as EvidenceDetail;

      if (
        typedEvidence.validation_status !== "pending"
      ) {
        throw new Error(
          "Only pending evidence can be assigned.",
        );
      }

      setEvidence(typedEvidence);
      setCaseData(caseResult.data as CaseDetail);
      setCheckers(checkerRows);

      if (checkerRows.length > 0) {
        setSelectedCheckerId(
          (current) => current || checkerRows[0].id,
        );
      }
    } catch (error) {
      console.error(
        "LOAD EVIDENCE ASSIGNMENT ERROR:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "JusticeNow could not prepare this evidence assignment.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId, evidenceId, router]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkspace();
      return undefined;
    }, [loadWorkspace]),
  );

  const confirmAssignment = async () => {
    if (!evidence || !selectedChecker) {
      return;
    }

    try {
      setAssigning(true);

      const result = await assignEvidenceToChecker(
        evidence.id,
        selectedChecker.id,
      );

      if (!result.ok) {
        Alert.alert(
          "Unable to assign evidence",
          result.message,
        );

        return;
      }

      setConfirmVisible(false);

      Alert.alert(
        "Evidence assigned",
        `${evidence.title} was assigned to ${result.assignment.checkerName}.`,
        [
          {
            text: "Done",
            onPress: returnToEvidence,
          },
        ],
      );
    } catch (error) {
      console.error(
        "ASSIGN EVIDENCE ERROR:",
        error,
      );

      Alert.alert(
        "Unable to assign evidence",
        "JusticeNow could not complete the evidence assignment.",
      );
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={colors.royal[700]}
        />

        <Text style={styles.loadingText}>
          Preparing evidence assignment...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={returnToEvidence}
          accessibilityRole="button"
          accessibilityLabel="Return to evidence"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            Assign Evidence
          </Text>

          <Text style={styles.headerSubtitle}>
            Case Officer Workspace
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {errorMessage !== "" ||
        !evidence ||
        !caseData ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>

            <Text style={styles.errorTitle}>
              Assignment unavailable
            </Text>

            <Text style={styles.errorText}>
              {errorMessage ||
                "This evidence cannot be assigned."}
            </Text>

            <PrimaryButton
              title="Return to evidence"
              onPress={returnToEvidence}
              style={styles.errorButton}
            />
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>
                FORMAL VERIFICATION
              </Text>

              <Text style={styles.heroTitle}>
                Choose an Evidence Checker
              </Text>

              <Text style={styles.heroText}>
                Only active Evidence Checkers are shown.
                The assignment is recorded in the case
                timeline and cannot be duplicated while
                it remains active.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>
              Selected evidence
            </Text>

            <View style={styles.evidenceCard}>
              <Text style={styles.caseReference}>
                {caseData.case_reference}
              </Text>

              <Text style={styles.evidenceTitle}>
                {evidence.title}
              </Text>

              <Text style={styles.caseTitle}>
                {caseData.title}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>
                    Type
                  </Text>

                  <Text style={styles.metaValue}>
                    {formatLabel(
                      evidence.evidence_type,
                    )}
                  </Text>
                </View>

                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>
                    Status
                  </Text>

                  <Text style={styles.pendingValue}>
                    Pending
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text
                style={styles.sectionTitleNoMargin}
              >
                Available Evidence Checkers
              </Text>

              <Text style={styles.countText}>
                {checkers.length} active
              </Text>
            </View>

            {checkers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>
                  👤
                </Text>

                <Text style={styles.emptyTitle}>
                  No active checker available
                </Text>

                <Text style={styles.emptyText}>
                  Ask an administrator to activate an
                  Evidence Checker account.
                </Text>
              </View>
            ) : (
              checkers.map((checker) => {
                const selected =
                  checker.id === selectedCheckerId;

                return (
                  <Pressable
                    key={checker.id}
                    onPress={() =>
                      setSelectedCheckerId(
                        checker.id,
                      )
                    }
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: selected,
                    }}
                    style={[
                      styles.checkerCard,
                      selected &&
                        styles.checkerCardSelected,
                    ]}
                  >
                    <View style={styles.avatar}>
                      <Text
                        style={styles.avatarText}
                      >
                        {initials(checker.fullName)}
                      </Text>
                    </View>

                    <View
                      style={styles.checkerContent}
                    >
                      <Text
                        style={styles.checkerName}
                      >
                        {checker.fullName}
                      </Text>

                      <Text
                        style={styles.checkerMeta}
                      >
                        {
                          checker.activeAssignmentCount
                        }{" "}
                        active assignment
                        {checker.activeAssignmentCount ===
                        1
                          ? ""
                          : "s"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radio,
                        selected &&
                          styles.radioSelected,
                      ]}
                    >
                      {selected ? (
                        <View
                          style={styles.radioDot}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}

            <View style={styles.securityCard}>
              <Text style={styles.securityIcon}>
                🔒
              </Text>

              <Text style={styles.securityText}>
                The server verifies your active Case
                Officer assignment, multi-factor session,
                checker status, and duplicate-assignment
                rules before saving.
              </Text>
            </View>

            <PrimaryButton
              title="Assign evidence"
              onPress={() =>
                setConfirmVisible(true)
              }
              disabled={!selectedChecker}
              style={styles.assignButton}
            />
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Confirm evidence assignment"
        body={
          selectedChecker && evidence
            ? `Assign “${evidence.title}” to ${selectedChecker.fullName} for formal verification?`
            : "Confirm this evidence assignment?"
        }
        confirmLabel="Assign"
        loading={assigning}
        onConfirm={() =>
          void confirmAssignment()
        }
        onClose={() => {
          if (!assigning) {
            setConfirmVisible(false);
          }
        }}
      />
    </SafeAreaView>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "EC"
  );
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(" ");
}

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

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  hero: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.navy[800],
  },

  heroLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: "#AEC3DC",
  },

  heroTitle: {
    marginTop: 5,
    fontSize: 19,
    fontWeight: "800",
    color: colors.textInverse,
  },

  heroText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "#DCE5EF",
  },

  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
  },

  evidenceCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },

  caseReference: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.royal[700],
  },

  evidenceTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy[800],
  },

  caseTitle: {
    marginTop: 4,
    fontSize: 11.5,
    color: colors.textSecondary,
  },

  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  metaItem: {
    flex: 1,
  },

  metaLabel: {
    fontSize: 9.5,
    color: colors.textSoft,
  },

  metaValue: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: colors.navy[700],
  },

  pendingValue: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: colors.warning,
  },

  sectionHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitleNoMargin: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
  },

  countText: {
    fontSize: 10.5,
    color: colors.textSecondary,
  },

  checkerCard: {
    minHeight: 74,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },

  checkerCardSelected: {
    borderColor: colors.royal[600],
    backgroundColor: colors.royal[50],
  },

  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.navy[800],
  },

  avatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textInverse,
  },

  checkerContent: {
    flex: 1,
    marginLeft: 12,
  },

  checkerName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[800],
  },

  checkerMeta: {
    marginTop: 4,
    fontSize: 10.5,
    color: colors.textSecondary,
  },

  radio: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.navy[300],
    borderRadius: 11,
  },

  radioSelected: {
    borderColor: colors.royal[700],
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.royal[700],
  },

  emptyCard: {
    alignItems: "center",
    padding: 22,
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

  securityCard: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 12,
    backgroundColor: colors.teal[50],
  },

  securityIcon: {
    marginTop: 1,
  },

  securityText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  assignButton: {
    marginTop: 16,
  },

  errorCard: {
    alignItems: "center",
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  errorIcon: {
    fontSize: 28,
  },

  errorTitle: {
    marginTop: 9,
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy[800],
  },

  errorText: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  errorButton: {
    alignSelf: "stretch",
    marginTop: 16,
  },
});