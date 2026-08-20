import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

type RequestStatus = "draft" | "sent";

type CaseSummary = {
  id: string;
  case_reference: string;
  title: string;
  reporter_id: string | null;
  is_anonymous: boolean;
};

type DraftRequest = {
  id: string;
  title: string;
  message: string;
  requested_items: string[];
  requires_evidence: boolean;
  due_date: string | null;
  send_reminder: boolean;
};

const DEFAULT_MESSAGE =
  "Thank you for your report. To take this forward, I need a few more details. Please answer only what you are comfortable answering. Partial answers are welcome.";

const DEFAULT_ITEMS = [
  "Name or address of the office visited",
  "Approximate arrival and departure time",
  "Any written response received",
];

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function RequestInformationScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    caseId?: string | string[];
  }>();

  const caseId = Array.isArray(params.caseId)
    ? params.caseId[0]
    : params.caseId;

  const [caseData, setCaseData] = useState<CaseSummary | null>(null);
  const [officerId, setOfficerId] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);

  const [requestTitle, setRequestTitle] = useState(
    "Details required for the investigation",
  );
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [requestedItems, setRequestedItems] = useState<string[]>(DEFAULT_ITEMS);
  const [requiresEvidence, setRequiresEvidence] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [sendReminder, setSendReminder] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadRequestWorkspace = useCallback(async () => {
    if (!caseId) {
      setErrorMessage("Case ID is missing.");
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
        await supabase.auth.signOut();
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

      const { data: assignment, error: assignmentError } = await supabase
        .from("case_assignments")
        .select("id")
        .eq("case_id", caseId)
        .eq("assigned_officer_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (assignmentError) {
        throw assignmentError;
      }

      if (!assignment) {
        throw new Error(
          "You are not the active Case Officer assigned to this case.",
        );
      }

      const { data: loadedCase, error: caseError } = await supabase
        .from("cases")
        .select("id, case_reference, title, reporter_id, is_anonymous")
        .eq("id", caseId)
        .single();

      if (caseError) {
        throw caseError;
      }

      const typedCase = loadedCase as CaseSummary;

      if (typedCase.is_anonymous || !typedCase.reporter_id) {
        throw new Error(
          "Additional information cannot be requested because this case does not have a registered Reporter.",
        );
      }

      setCaseData(typedCase);
      setOfficerId(user.id);

      const { data: draft, error: draftError } = await supabase
        .from("case_information_requests")
        .select(
          `
            id,
            title,
            message,
            requested_items,
            requires_evidence,
            due_date,
            send_reminder
          `,
        )
        .eq("case_id", caseId)
        .eq("officer_id", user.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (draftError) {
        throw draftError;
      }

      if (draft) {
        const typedDraft = draft as DraftRequest;

        setRequestId(typedDraft.id);
        setRequestTitle(typedDraft.title);
        setMessage(typedDraft.message);
        setRequestedItems(
          typedDraft.requested_items.length > 0
            ? typedDraft.requested_items
            : [""],
        );
        setRequiresEvidence(typedDraft.requires_evidence);
        setDueDate(typedDraft.due_date ?? "");
        setSendReminder(typedDraft.send_reminder);
      }
    } catch (error) {
      console.error("LOAD INFORMATION REQUEST ERROR:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "JusticeNow could not prepare the information request.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId, router]);

  useFocusEffect(
    useCallback(() => {
      void loadRequestWorkspace();
      return undefined;
    }, [loadRequestWorkspace]),
  );

  const updateRequestedItem = (index: number, value: string) => {
    setRequestedItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  const addRequestedItem = () => {
    if (requestedItems.length >= 10) {
      Alert.alert(
        "Item limit reached",
        "A request can contain up to 10 information items.",
      );
      return;
    }

    setRequestedItems((current) => [...current, ""]);
  };

  const removeRequestedItem = (index: number) => {
    if (requestedItems.length === 1) {
      return;
    }

    setRequestedItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const validateRequest = (status: RequestStatus) => {
    const cleanTitle = requestTitle.trim();
    const cleanMessage = message.trim();
    const cleanItems = requestedItems
      .map((item) => item.trim())
      .filter(Boolean);

    if (cleanTitle.length < 3) {
      return "Enter a clear request title.";
    }

    if (cleanMessage.length < 10) {
      return "Enter a message explaining why the information is needed.";
    }

    if (cleanItems.length === 0) {
      return "Add at least one information item.";
    }

    if (dueDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return "Enter the due date in YYYY-MM-DD format.";
    }

    if (status === "sent" && dueDate === "") {
      return "Choose a response due date before sending.";
    }

    if (dueDate !== "" && dueDate < todayIsoDate()) {
      return "The response due date cannot be in the past.";
    }

    return null;
  };

  const saveRequest = async (status: RequestStatus) => {
    if (saving || !caseData || !officerId || !caseId) {
      return;
    }

    const validationError = validateRequest(status);

    if (validationError) {
      Alert.alert("Check request", validationError);
      return;
    }

    try {
      setSaving(true);

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) {
        throw aalError;
      }

      if (aal.currentLevel !== "aal2") {
        router.replace("/two-factor");
        return;
      }

      const payload = {
        case_id: caseId,
        officer_id: officerId,
        reporter_id: caseData.reporter_id,
        title: requestTitle.trim(),
        message: message.trim(),
        requested_items: requestedItems
          .map((item) => item.trim())
          .filter(Boolean),
        requires_evidence: requiresEvidence,
        due_date: dueDate || null,
        send_reminder: sendReminder,
        status,
      };

      if (requestId) {
        const { data, error } = await supabase
          .from("case_information_requests")
          .update(payload)
          .eq("id", requestId)
          .eq("status", "draft")
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        setRequestId(data.id);
      } else {
        const { data, error } = await supabase
          .from("case_information_requests")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        setRequestId(data.id);
      }

      if (status === "draft") {
        Alert.alert(
          "Draft saved",
          "The information request was saved securely and has not been sent to the Reporter.",
        );
        return;
      }

      Alert.alert(
        "Request sent",
        "The Reporter received a discreet notification. The request is now part of the case record.",
        [
          {
            text: "Return to case",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error("SAVE INFORMATION REQUEST ERROR:", error);

      Alert.alert(
        status === "sent" ? "Unable to send request" : "Unable to save draft",
        error instanceof Error
          ? error.message
          : "JusticeNow could not save the information request.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>Preparing secure request...</Text>
      </SafeAreaView>
    );
  }

  if (errorMessage !== "" || !caseData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Request information</Text>
        </View>

        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>

          <Text style={styles.errorTitle}>Request unavailable</Text>

          <Text style={styles.errorText}>{errorMessage}</Text>

          <Pressable
            onPress={() => void loadRequestWorkspace()}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Return to case"
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Request information</Text>

            <Text style={styles.headerSubtitle}>{caseData.case_reference}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.caseCard}>
            <Text style={styles.caseReference}>{caseData.case_reference}</Text>

            <Text style={styles.caseTitle}>{caseData.title}</Text>
          </View>

          <Text style={styles.sectionTitle}>Request details</Text>

          <View style={styles.sectionCard}>
            <Text style={styles.label}>Request title</Text>

            <TextInput
              value={requestTitle}
              onChangeText={setRequestTitle}
              placeholder="What information is required?"
              placeholderTextColor={colors.textSoft}
              maxLength={120}
              editable={!saving}
              style={styles.input}
            />

            <Text style={styles.label}>Message to the Reporter</Text>

            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Explain why this information is needed..."
              placeholderTextColor={colors.textSoft}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              editable={!saving}
              style={styles.messageInput}
            />

            <Text style={styles.characterCount}>{message.length}/2000</Text>

            <Text style={styles.fieldHint}>
              Use calm, plain language. Partial answers should be accepted.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Information required</Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionDescription}>
              Each item will appear as a numbered question for the Reporter.
            </Text>

            {requestedItems.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemNumber}>
                  <Text style={styles.itemNumberText}>{index + 1}</Text>
                </View>

                <TextInput
                  value={item}
                  onChangeText={(value) => updateRequestedItem(index, value)}
                  placeholder="Enter requested information"
                  placeholderTextColor={colors.textSoft}
                  multiline
                  maxLength={300}
                  editable={!saving}
                  style={styles.itemInput}
                />

                {requestedItems.length > 1 && (
                  <Pressable
                    onPress={() => removeRequestedItem(index)}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove information item ${index + 1}`}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Pressable
              onPress={addRequestedItem}
              disabled={saving}
              style={styles.addButton}
              accessibilityRole="button"
            >
              <Text style={styles.addButtonText}>＋ Add another item</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Evidence and deadline</Text>

          <View style={styles.sectionCard}>
            <OptionRow
              title="Supporting evidence is required"
              description="The Reporter will see an evidence-upload option with their response."
              selected={requiresEvidence}
              disabled={saving}
              onPress={() => setRequiresEvidence((current) => !current)}
            />

            <View style={styles.divider} />

            <Text style={styles.label}>Response due by</Text>

            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSoft}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              maxLength={10}
              editable={!saving}
              style={styles.input}
            />

            <Text style={styles.fieldHint}>
              The case remains open if the Reporter needs more time.
            </Text>

            <View style={styles.divider} />

            <OptionRow
              title="Send a gentle reminder"
              description="Store a reminder preference for two days before the due date."
              selected={sendReminder}
              disabled={saving}
              onPress={() => setSendReminder((current) => !current)}
            />
          </View>

          <View style={styles.securityNotice}>
            <Text style={styles.securityIcon}>🔒</Text>

            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>
                Delivered through secure messaging
              </Text>

              <Text style={styles.securityText}>
                The Reporter receives a discreet notification. No case details
                are included in the notification itself.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => void saveRequest("draft")}
            disabled={saving}
            style={[styles.secondaryButton, saving && styles.disabled]}
          >
            <Text style={styles.secondaryButtonText}>Save draft</Text>
          </Pressable>

          <Pressable
            onPress={() => void saveRequest("sent")}
            disabled={saving}
            style={[styles.primaryButton, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.primaryButtonText}>Send securely</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OptionRow({
  title,
  description,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: selected, disabled }}
      style={styles.optionRow}
    >
      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>{title}</Text>

        <Text style={styles.optionDescription}>{description}</Text>
      </View>

      <View
        style={[styles.switchTrack, selected && styles.switchTrackSelected]}
      >
        <View
          style={[styles.switchThumb, selected && styles.switchThumbSelected]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
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
    paddingBottom: 32,
  },
  caseCard: {
    padding: 16,
    borderRadius: 15,
    backgroundColor: colors.navy[800],
  },
  caseReference: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#BBD0E8",
  },
  caseTitle: {
    marginTop: 7,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    color: colors.textInverse,
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 8,
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
  sectionDescription: {
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  label: {
    marginBottom: 6,
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  input: {
    minHeight: 48,
    marginBottom: 14,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 11,
    fontSize: 13,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },
  messageInput: {
    minHeight: 120,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 11,
    fontSize: 13,
    lineHeight: 19,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },
  characterCount: {
    marginTop: 6,
    textAlign: "right",
    fontSize: 10.5,
    color: colors.textSoft,
  },
  fieldHint: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  itemNumber: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: colors.royal[50],
  },
  itemNumberText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.royal[700],
  },
  itemInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },
  removeButton: {
    width: 34,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },
  removeButtonText: {
    fontSize: 22,
    color: colors.error,
  },
  addButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.royal[300],
    borderRadius: 11,
  },
  addButtonText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.royal[700],
  },
  divider: {
    height: 1,
    marginVertical: 14,
    backgroundColor: colors.border,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionText: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  optionDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  switchTrack: {
    width: 42,
    height: 24,
    padding: 3,
    borderRadius: 12,
    backgroundColor: colors.navy[200],
  },
  switchTrackSelected: {
    backgroundColor: colors.royal[600],
  },
  switchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surface,
  },
  switchThumbSelected: {
    alignSelf: "flex-end",
  },
  securityNotice: {
    flexDirection: "row",
    marginTop: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.teal[100],
    borderRadius: 14,
    backgroundColor: colors.teal[50],
  },
  securityIcon: {
    marginRight: 9,
    fontSize: 16,
  },
  securityContent: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.teal[800],
  },
  securityText: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.teal[800],
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
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    borderWidth: 1,
    borderColor: colors.royal[400],
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.royal[700],
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[700],
  },
  primaryButtonText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: colors.textInverse,
  },
  disabled: {
    opacity: 0.5,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  errorIcon: {
    fontSize: 30,
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: colors.navy[800],
  },
  errorText: {
    marginTop: 7,
    textAlign: "center",
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  retryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    paddingHorizontal: 22,
    borderRadius: 11,
    backgroundColor: colors.royal[700],
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textInverse,
  },
});
