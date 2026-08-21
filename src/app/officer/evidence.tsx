import { useLocalSearchParams, useRouter } from "expo-router";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Linking,
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

type EvidenceType = "document" | "image" | "audio" | "video" | "text";

type ValidationStatus = "pending" | "under_review" | "verified" | "rejected";

type OfficerReviewState = "reviewed" | "follow_up_required";

type CaseBrief = {
  id: string;
  case_reference: string;
  title: string;
};

type OfficerReview = {
  id: string;
  review_state: OfficerReviewState;
  finding_text: string;
  reviewed_at: string;
};

type EvidenceItem = {
  id: string;

  case_id: string;

  evidence_type: EvidenceType;

  title: string;

  description: string | null;

  file_name: string | null;

  storage_bucket: string | null;

  storage_path: string | null;

  mime_type: string | null;

  file_size_bytes: number | null;

  validation_status: ValidationStatus;

  created_at: string;

  cases: CaseBrief | null;

  officer_evidence_reviews: OfficerReview[];
};

type ReviewFilter = "all" | "unreviewed" | "reviewed" | "follow_up";

export default function EvidenceReviewScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    caseId?: string | string[];
  }>();

  const caseId = Array.isArray(params.caseId)
    ? params.caseId[0]
    : params.caseId;

  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState<ReviewFilter>("all");

  const [selected, setSelected] = useState<EvidenceItem | null>(null);

  const [reviewState, setReviewState] =
    useState<OfficerReviewState>("reviewed");

  const [finding, setFinding] = useState("");

  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  // -------------------------------------------------------
  // Load Evidence
  // -------------------------------------------------------

  const loadEvidence = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage("");

        // -----------------------------------------------
        // Require staff MFA
        // -----------------------------------------------

        const { data: aal, error: aalError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError) {
          setErrorMessage(aalError.message);

          return;
        }

        if (aal.currentLevel !== "aal2") {
          router.replace("/two-factor");

          return;
        }

        // -----------------------------------------------
        // Evidence query
        // -----------------------------------------------

        let query = supabase
          .from("case_evidence")
          .select(
            `
                id,
                case_id,
                evidence_type,
                title,
                description,
                file_name,
                storage_bucket,
                storage_path,
                mime_type,
                file_size_bytes,
                validation_status,
                created_at,

                cases (
                  id,
                  case_reference,
                  title
                ),

                officer_evidence_reviews (
                  id,
                  review_state,
                  finding_text,
                  reviewed_at
                )
              `,
          )
          .order("created_at", {
            ascending: false,
          });

        if (caseId) {
          query = query.eq("case_id", caseId);
        }

        const { data, error } = await query;

        console.log("EVIDENCE DATA:", data);

        console.log("EVIDENCE ERROR:", error);

        if (error) {
          setErrorMessage(error.message);

          return;
        }

        setEvidence((data ?? []) as unknown as EvidenceItem[]);
      } catch (error) {
        console.error("Load evidence error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "JusticeNow could not load evidence.",
        );
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },
    [caseId, router],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvidence();
  }, [loadEvidence]);

  // -------------------------------------------------------
  // Refresh
  // -------------------------------------------------------

  const refresh = () => {
    setRefreshing(true);

    loadEvidence(false);
  };

  // -------------------------------------------------------
  // Filtering
  // -------------------------------------------------------

  const filteredEvidence = useMemo(() => {
    const query = search.trim().toLowerCase();

    return evidence.filter((item) => {
      const review = item.officer_evidence_reviews?.[0];

      const matchesSearch =
        query === "" ||
        item.title.toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query) ||
        (item.cases?.case_reference ?? "").toLowerCase().includes(query);

      if (!matchesSearch) {
        return false;
      }

      switch (filter) {
        case "unreviewed":
          return !review;

        case "reviewed":
          return review?.review_state === "reviewed";

        case "follow_up":
          return review?.review_state === "follow_up_required";

        case "all":
        default:
          return true;
      }
    });
  }, [evidence, search, filter]);

  // -------------------------------------------------------
  // Start Review
  // -------------------------------------------------------

  const startReview = (item: EvidenceItem) => {
    const existing = item.officer_evidence_reviews?.[0];

    setSelected(item);

    if (existing) {
      setReviewState(existing.review_state);

      setFinding(existing.finding_text);
    } else {
      setReviewState("reviewed");

      setFinding("");
    }
  };

  // -------------------------------------------------------
  // Save Review
  // -------------------------------------------------------

  const saveReview = async () => {
    if (!selected) {
      return;
    }

    const cleanFinding = finding.trim();

    if (cleanFinding.length < 3) {
      Alert.alert(
        "Finding required",
        "Enter your investigation finding before saving.",
      );

      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc("save_officer_evidence_review", {
        p_evidence_id: selected.id,

        p_review_state: reviewState,

        p_finding_text: cleanFinding,
      });

      console.log("SAVE EVIDENCE REVIEW ERROR:", error);

      if (error) {
        Alert.alert("Unable to save review", error.message);

        return;
      }

      setSelected(null);

      setFinding("");

      await loadEvidence(false);

      Alert.alert(
        "Evidence review saved",
        "Your investigation finding has been recorded.",
      );
    } catch (error) {
      console.error("Save evidence review error:", error);

      Alert.alert(
        "Unable to save review",
        "JusticeNow could not save your evidence review.",
      );
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------
  // Open Evidence File
  // -------------------------------------------------------

  const openFile = async (item: EvidenceItem) => {
    if (!item.storage_bucket || !item.storage_path) {
      Alert.alert(
        "No digital file",
        "This evidence record currently contains metadata only. No file has been uploaded yet.",
      );

      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from(item.storage_bucket)
        .createSignedUrl(item.storage_path, 60);

      if (error) {
        Alert.alert("Unable to open file", error.message);

        return;
      }

      if (!data?.signedUrl) {
        Alert.alert(
          "Unable to open file",
          "JusticeNow could not generate a secure file link.",
        );

        return;
      }

      await Linking.openURL(data.signedUrl);
    } catch (error) {
      console.error("Open evidence file error:", error);

      Alert.alert(
        "Unable to open file",
        "The evidence file could not be opened.",
      );
    }
  };

  // -------------------------------------------------------
  // Loading
  // -------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>Loading evidence...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Evidence Review</Text>

          <Text style={styles.headerSubtitle}>Case Officer Workspace</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Overview */}

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>INVESTIGATION EVIDENCE</Text>

          <Text style={styles.heroTitle}>Review case evidence</Text>

          <Text style={styles.heroText}>
            Review evidence connected to your assigned cases and record
            investigation findings.
          </Text>
        </View>

        {/* Important Boundary */}

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>

          <Text style={styles.infoText}>
            Case Officers record investigation findings. Evidence verification
            decisions are handled separately by authorized Evidence Validators.
          </Text>
        </View>

        {/* Search */}

        <View style={styles.searchBox}>
          <Text>🔎</Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search evidence or case ID"
            placeholderTextColor={colors.textSoft}
            style={styles.searchInput}
          />

          {search !== "" && (
            <Pressable onPress={() => setSearch("")}>
              <Text style={styles.clearText}>×</Text>
            </Pressable>
          )}
        </View>

        {/* Filters */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <FilterChip
            title="All"
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />

          <FilterChip
            title="Not reviewed"
            active={filter === "unreviewed"}
            onPress={() => setFilter("unreviewed")}
          />

          <FilterChip
            title="Reviewed"
            active={filter === "reviewed"}
            onPress={() => setFilter("reviewed")}
          />

          <FilterChip
            title="Follow-up"
            active={filter === "follow_up"}
            onPress={() => setFilter("follow_up")}
          />
        </ScrollView>

        {/* Error */}

        {errorMessage !== "" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Unable to load evidence</Text>

            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Results */}

        {errorMessage === "" && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Evidence</Text>

            <Text style={styles.resultsCount}>
              {filteredEvidence.length} item
              {filteredEvidence.length === 1 ? "" : "s"}
            </Text>
          </View>
        )}

        {filteredEvidence.map((item) => {
          const review = item.officer_evidence_reviews?.[0];

          return (
            <View key={item.id} style={styles.evidenceCard}>
              {/* Top */}

              <View style={styles.evidenceTop}>
                <View style={styles.typeIcon}>
                  <Text style={styles.typeIconText}>
                    {getEvidenceIcon(item.evidence_type)}
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text style={styles.caseReference}>
                    {item.cases?.case_reference ?? "Case"}
                  </Text>

                  <Text style={styles.evidenceTitle}>{item.title}</Text>
                </View>

                <ValidationBadge status={item.validation_status} />
              </View>

              {/* Description */}

              <Text style={styles.evidenceDescription}>
                {item.description ?? "No description provided."}
              </Text>

              {/* Metadata */}

              <View style={styles.metadataRow}>
                <View style={styles.metadataItem}>
                  <Text style={styles.metaLabel}>Type</Text>

                  <Text style={styles.metaValue}>
                    {formatEvidenceType(item.evidence_type)}
                  </Text>
                </View>

                <View style={styles.metadataItem}>
                  <Text style={styles.metaLabel}>Submitted</Text>

                  <Text style={styles.metaValue}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>
              </View>

              {/* Existing Review */}

              {review && (
                <View
                  style={
                    review.review_state === "follow_up_required"
                      ? styles.followUpBox
                      : styles.reviewedBox
                  }
                >
                  <Text style={styles.reviewStateText}>
                    {review.review_state === "follow_up_required"
                      ? "⚠ Follow-up required"
                      : "✓ Reviewed"}
                  </Text>

                  <Text style={styles.reviewFinding}>
                    {review.finding_text}
                  </Text>
                </View>
              )}

              {/* Actions */}

              <View style={styles.actions}>
                <Pressable
                  onPress={() => openFile(item)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>View file</Text>
                </Pressable>

                <Pressable
                  onPress={() => startReview(item)}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>
                    {review ? "Update finding" : "Review evidence"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {/* Empty */}

        {errorMessage === "" && filteredEvidence.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔎</Text>

            <Text style={styles.emptyTitle}>No evidence found</Text>

            <Text style={styles.emptyText}>
              No evidence matches your current search or filter.
            </Text>
          </View>
        )}

        {/* Review Composer */}

        {selected && (
          <View style={styles.reviewComposer}>
            <Text style={styles.composerLabel}>CASE OFFICER FINDING</Text>

            <Text style={styles.composerTitle}>{selected.title}</Text>

            <Text style={styles.composerHelp}>
              Record how this evidence affects your investigation. Do not make
              an evidence validation decision here.
            </Text>

            {/* Review State */}

            <View style={styles.stateRow}>
              <Pressable
                onPress={() => setReviewState("reviewed")}
                style={[
                  styles.stateButton,

                  reviewState === "reviewed" && styles.stateButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.stateButtonText,

                    reviewState === "reviewed" && styles.stateButtonTextActive,
                  ]}
                >
                  Reviewed
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setReviewState("follow_up_required")}
                style={[
                  styles.stateButton,

                  reviewState === "follow_up_required" &&
                    styles.stateButtonWarning,
                ]}
              >
                <Text
                  style={[
                    styles.stateButtonText,

                    reviewState === "follow_up_required" &&
                      styles.stateButtonTextActive,
                  ]}
                >
                  Follow-up required
                </Text>
              </Pressable>
            </View>

            <TextInput
              value={finding}
              onChangeText={setFinding}
              placeholder="Record your investigation finding..."
              placeholderTextColor={colors.textSoft}
              multiline
              maxLength={5000}
              textAlignVertical="top"
              style={styles.findingInput}
            />

            <Text style={styles.characterCount}>{finding.length}/5000</Text>

            <View style={styles.composerActions}>
              <Pressable
                onPress={() => setSelected(null)}
                disabled={saving}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={saveReview}
                disabled={saving}
                style={[styles.saveButton, saving && styles.disabled]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.saveText}>Save finding</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Security */}

        <View style={styles.securityBox}>
          <Text>🔒</Text>

          <Text style={styles.securityText}>
            Evidence access is restricted to cases currently assigned to your
            authenticated Case Officer account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// Filter Chip
// ---------------------------------------------------------

function FilterChip({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text
        style={[styles.filterChipText, active && styles.filterChipTextActive]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------
// Validation Badge
// ---------------------------------------------------------

function ValidationBadge({ status }: { status: ValidationStatus }) {
  return (
    <View
      style={[
        styles.validationBadge,

        status === "verified" && styles.validationVerified,

        status === "rejected" && styles.validationRejected,

        status === "under_review" && styles.validationReview,
      ]}
    >
      <Text style={styles.validationText}>
        {formatValidationStatus(status)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------
// Formatting
// ---------------------------------------------------------

function getEvidenceIcon(type: EvidenceType) {
  switch (type) {
    case "image":
      return "🖼️";

    case "audio":
      return "🎧";

    case "video":
      return "🎥";

    case "text":
      return "📝";

    case "document":
    default:
      return "📄";
  }
}

function formatEvidenceType(type: EvidenceType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatValidationStatus(status: ValidationStatus) {
  switch (status) {
    case "under_review":
      return "Under review";

    case "verified":
      return "Verified";

    case "rejected":
      return "Rejected";

    case "pending":
    default:
      return "Pending";
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString();
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

  infoBox: {
    flexDirection: "row",

    marginTop: 12,

    padding: 13,

    borderWidth: 1,

    borderColor: colors.royal[100],

    borderRadius: 12,

    backgroundColor: colors.royal[50],
  },

  infoIcon: {
    marginRight: 8,
  },

  infoText: {
    flex: 1,

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  searchBox: {
    minHeight: 48,

    marginTop: 15,

    flexDirection: "row",
    alignItems: "center",

    gap: 8,

    paddingHorizontal: 13,

    borderWidth: 1,
    borderColor: colors.border,

    borderRadius: 12,

    backgroundColor: colors.surface,
  },

  searchInput: {
    flex: 1,

    fontSize: 13,

    color: colors.navy[800],
  },

  clearText: {
    fontSize: 22,

    color: colors.textSoft,
  },

  filters: {
    gap: 7,

    paddingVertical: 13,
  },

  filterChip: {
    minHeight: 34,

    paddingHorizontal: 13,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 18,

    backgroundColor: colors.surface,
  },

  filterChipActive: {
    borderColor: colors.royal[700],

    backgroundColor: colors.royal[700],
  },

  filterChipText: {
    fontSize: 11,

    fontWeight: "600",

    color: colors.navy[700],
  },

  filterChipTextActive: {
    color: colors.textInverse,
  },

  resultsHeader: {
    flexDirection: "row",

    justifyContent: "space-between",

    marginBottom: 9,
  },

  resultsTitle: {
    fontSize: 15,

    fontWeight: "700",

    color: colors.navy[800],
  },

  resultsCount: {
    fontSize: 11,

    color: colors.textSecondary,
  },

  evidenceCard: {
    marginBottom: 11,

    padding: 15,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 15,

    backgroundColor: colors.surface,
  },

  evidenceTop: {
    flexDirection: "row",

    alignItems: "center",

    gap: 10,
  },

  typeIcon: {
    width: 43,
    height: 43,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.royal[50],
  },

  typeIconText: {
    fontSize: 19,
  },

  caseReference: {
    fontSize: 9.5,

    fontWeight: "700",

    color: colors.royal[700],
  },

  evidenceTitle: {
    marginTop: 2,

    fontSize: 13.5,

    fontWeight: "700",

    color: colors.navy[800],
  },

  evidenceDescription: {
    marginTop: 10,

    fontSize: 11.5,

    lineHeight: 17,

    color: colors.textSecondary,
  },

  metadataRow: {
    flexDirection: "row",

    marginTop: 12,

    gap: 10,
  },

  metadataItem: {
    flex: 1,
  },

  metaLabel: {
    fontSize: 9,

    color: colors.textSoft,
  },

  metaValue: {
    marginTop: 2,

    fontSize: 10.5,

    fontWeight: "600",

    color: colors.navy[700],
  },

  validationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,

    borderRadius: 8,

    backgroundColor: colors.gold[50],
  },

  validationVerified: {
    backgroundColor: colors.teal[50],
  },

  validationRejected: {
    backgroundColor: "#FFF0EF",
  },

  validationReview: {
    backgroundColor: colors.royal[50],
  },

  validationText: {
    fontSize: 9,

    fontWeight: "700",

    color: colors.navy[700],
  },

  reviewedBox: {
    marginTop: 12,

    padding: 11,

    borderRadius: 10,

    backgroundColor: colors.teal[50],
  },

  followUpBox: {
    marginTop: 12,

    padding: 11,

    borderRadius: 10,

    backgroundColor: colors.gold[50],
  },

  reviewStateText: {
    fontSize: 10.5,

    fontWeight: "700",

    color: colors.navy[800],
  },

  reviewFinding: {
    marginTop: 4,

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  actions: {
    flexDirection: "row",

    gap: 8,

    marginTop: 13,
  },

  secondaryButton: {
    flex: 1,

    minHeight: 41,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.royal[200],

    borderRadius: 10,
  },

  secondaryButtonText: {
    fontSize: 11,

    fontWeight: "700",

    color: colors.royal[700],
  },

  primaryButton: {
    flex: 1,

    minHeight: 41,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 10,

    backgroundColor: colors.royal[700],
  },

  primaryButtonText: {
    fontSize: 11,

    fontWeight: "700",

    color: colors.textInverse,
  },

  reviewComposer: {
    marginTop: 10,

    padding: 16,

    borderWidth: 1,

    borderColor: colors.royal[200],

    borderRadius: 15,

    backgroundColor: colors.surface,
  },

  composerLabel: {
    fontSize: 9.5,

    fontWeight: "700",

    letterSpacing: 0.6,

    color: colors.royal[700],
  },

  composerTitle: {
    marginTop: 4,

    fontSize: 15,

    fontWeight: "700",

    color: colors.navy[800],
  },

  composerHelp: {
    marginTop: 5,

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },

  stateRow: {
    flexDirection: "row",

    gap: 8,

    marginTop: 14,
  },

  stateButton: {
    flex: 1,

    minHeight: 40,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 10,
  },

  stateButtonActive: {
    borderColor: colors.teal[600],

    backgroundColor: colors.teal[600],
  },

  stateButtonWarning: {
    borderColor: colors.warning,

    backgroundColor: colors.warning,
  },

  stateButtonText: {
    fontSize: 10.5,

    fontWeight: "600",

    color: colors.navy[700],
  },

  stateButtonTextActive: {
    color: colors.textInverse,
  },

  findingInput: {
    minHeight: 115,

    marginTop: 12,

    padding: 12,

    borderWidth: 1,

    borderColor: colors.navy[200],

    borderRadius: 11,

    fontSize: 12,

    lineHeight: 18,

    color: colors.navy[800],

    backgroundColor: colors.background,
  },

  characterCount: {
    marginTop: 4,

    textAlign: "right",

    fontSize: 9.5,

    color: colors.textSoft,
  },

  composerActions: {
    flexDirection: "row",

    justifyContent: "flex-end",

    gap: 8,

    marginTop: 10,
  },

  cancelButton: {
    minHeight: 42,

    paddingHorizontal: 16,

    alignItems: "center",
    justifyContent: "center",
  },

  cancelText: {
    fontSize: 11.5,

    fontWeight: "600",

    color: colors.textSecondary,
  },

  saveButton: {
    minHeight: 42,

    minWidth: 115,

    paddingHorizontal: 15,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 10,

    backgroundColor: colors.royal[700],
  },

  saveText: {
    fontSize: 11.5,

    fontWeight: "700",

    color: colors.textInverse,
  },

  disabled: {
    opacity: 0.55,
  },

  errorBox: {
    padding: 14,

    borderWidth: 1,

    borderColor: colors.error,

    borderRadius: 12,

    backgroundColor: "#FFF2F1",
  },

  errorTitle: {
    fontSize: 12.5,

    fontWeight: "700",

    color: colors.error,
  },

  errorText: {
    marginTop: 4,

    fontSize: 11,

    color: colors.textSecondary,
  },

  emptyCard: {
    alignItems: "center",

    padding: 24,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 15,

    backgroundColor: colors.surface,
  },

  emptyIcon: {
    fontSize: 25,
  },

  emptyTitle: {
    marginTop: 8,

    fontSize: 13,

    fontWeight: "700",

    color: colors.navy[800],
  },

  emptyText: {
    marginTop: 4,

    fontSize: 11,

    color: colors.textSecondary,
  },

  securityBox: {
    flexDirection: "row",

    gap: 8,

    marginTop: 15,

    padding: 13,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 12,

    backgroundColor: colors.teal[50],
  },

  securityText: {
    flex: 1,

    fontSize: 10.5,

    lineHeight: 16,

    color: colors.textSecondary,
  },
});
