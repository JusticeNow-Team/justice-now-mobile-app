import AsyncStorage from "@react-native-async-storage/async-storage";
import { Href, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppHeader,
  AppTextArea,
  Field,
  Notice,
  PrimaryButton,
  SectionCard,
} from "../../components/common";
import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";
import { logoutReporter } from "../login";
import { formatCaseDate, formatCaseDateTime } from "./filterReporterCases";
import { submitInformationResponse } from "./submitInformationResponse";

type RequestCase = {
  id: string;
  case_reference: string;
  title: string;
};

type SavedAnswer = {
  question: string;
  answer: string;
};

type SavedResponse = {
  id: string;
  answers: SavedAnswer[];
  additional_message: string | null;
  submitted_at: string;
};

type InformationRequest = {
  id: string;
  case_id: string;
  reporter_id: string;
  officer_id: string | null;
  title: string;
  message: string;
  requested_items: string[];
  requires_evidence: boolean;
  due_date: string | null;
  status: "sent" | "responded";
  sent_at: string;
  cases: RequestCase | null;
  officerName: string | null;
  case_information_responses: SavedResponse[];
};

function draftKey(requestId: string) {
  return `jn-info-request-draft:${requestId}`;
}

function parseSavedAnswers(value: unknown): SavedAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is SavedAnswer =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { question?: unknown }).question === "string" &&
        typeof (item as { answer?: unknown }).answer === "string"
    )
    .map((item) => ({
      question: item.question,
      answer: item.answer,
    }));
}

function responseFromSaved(saved: SavedResponse | null) {
  if (!saved) {
    return "";
  }

  if (saved.additional_message?.trim()) {
    return saved.additional_message.trim();
  }

  const firstAnswer = saved.answers.find((item) => item.answer.trim());
  return firstAnswer?.answer.trim() ?? "";
}

export default function InformationRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    requestId?: string | string[];
  }>();
  const requestId = Array.isArray(params.requestId)
    ? params.requestId[0]
    : params.requestId;

  const [request, setRequest] = useState<InformationRequest | null>(null);
  const [responseText, setResponseText] = useState("");
  const [savedResponse, setSavedResponse] = useState<SavedResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formError, setFormError] = useState("");

  const goToCase = useCallback(() => {
    if (request?.case_id) {
      router.replace(`/reporter/cases/${request.case_id}` as Href);
      return;
    }

    router.replace("/reporter/cases" as Href);
  }, [request?.case_id, router]);

  const loadRequest = useCallback(async () => {
    if (!requestId) {
      setErrorMessage("Information request ID is missing.");
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
        await logoutReporter().catch(() => undefined);
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("case_information_requests")
        .select(
          `
            id,
            case_id,
            reporter_id,
            officer_id,
            title,
            message,
            requested_items,
            requires_evidence,
            due_date,
            status,
            sent_at,
            cases (
              id,
              case_reference,
              title
            ),
            case_information_responses (
              id,
              answers,
              additional_message,
              submitted_at
            )
          `
        )
        .eq("id", requestId)
        .eq("reporter_id", user.id)
        .in("status", ["sent", "responded"])
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        setErrorMessage(
          "This information request is not available on your account."
        );
        return;
      }

      const nestedCase = Array.isArray(data.cases) ? data.cases[0] : data.cases;
      const responseRows = Array.isArray(data.case_information_responses)
        ? data.case_information_responses
        : data.case_information_responses
          ? [data.case_information_responses]
          : [];
      const firstResponse = responseRows[0];

      const parsedResponse: SavedResponse | null = firstResponse
        ? {
            id: firstResponse.id,
            answers: parseSavedAnswers(firstResponse.answers),
            additional_message: firstResponse.additional_message,
            submitted_at: firstResponse.submitted_at,
          }
        : null;

      let officerName: string | null = null;

      if (data.officer_id) {
        const { data: officerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.officer_id)
          .maybeSingle();

        officerName = officerProfile?.full_name ?? null;
      }

      const typedRequest: InformationRequest = {
        id: data.id,
        case_id: data.case_id,
        reporter_id: data.reporter_id,
        officer_id: data.officer_id,
        title: data.title,
        message: data.message,
        requested_items: data.requested_items ?? [],
        requires_evidence: Boolean(data.requires_evidence),
        due_date: data.due_date,
        status: data.status === "responded" ? "responded" : "sent",
        sent_at: data.sent_at,
        cases: nestedCase ?? null,
        officerName,
        case_information_responses: parsedResponse ? [parsedResponse] : [],
      };

      setRequest(typedRequest);
      setSavedResponse(parsedResponse);

      if (parsedResponse) {
        setResponseText(responseFromSaved(parsedResponse));
      } else {
        const draft = await AsyncStorage.getItem(draftKey(requestId));
        setResponseText(draft ?? "");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "JusticeNow could not load this information request."
      );
    } finally {
      setLoading(false);
    }
  }, [requestId, router]);

  useFocusEffect(
    useCallback(() => {
      void loadRequest();
      return undefined;
    }, [loadRequest])
  );

  const saveDraft = async () => {
    if (!requestId || savingDraft || savedResponse) {
      return;
    }

    try {
      setSavingDraft(true);
      setFormError("");
      await AsyncStorage.setItem(draftKey(requestId), responseText);
      setDraftSaved(true);
    } catch {
      setFormError("JusticeNow could not save your draft on this device.");
    } finally {
      setSavingDraft(false);
    }
  };

  const submitResponse = async () => {
    if (!request || submitting || savedResponse) {
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");

      const result = await submitInformationResponse({
        requestId: request.id,
        caseId: request.case_id,
        requestedItems: request.requested_items,
        responseText,
      });

      if (!result.ok) {
        if (result.reason === "unauthenticated") {
          await logoutReporter().catch(() => undefined);
          router.replace("/login");
          return;
        }

        setFormError(result.message);
        return;
      }

      await AsyncStorage.removeItem(draftKey(request.id)).catch(() => undefined);
      goToCase();
    } catch {
      setFormError("JusticeNow could not submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.royal[700]} />
          <Text style={styles.loadingText}>Loading secure request…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage || !request) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <AppHeader
          title="Additional information required"
          onBack={() => router.replace("/reporter/cases" as Href)}
        />
        <View style={styles.errorContent}>
          <Notice tone="error" title="Unable to open request">
            {errorMessage || "This request is unavailable."}
          </Notice>
          <PrimaryButton
            title="Try again"
            onPress={() => void loadRequest()}
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const readOnly = Boolean(savedResponse) || request.status === "responded";
  const officerLabel = request.officerName
    ? `Message from ${request.officerName}`
    : "Message from your assigned investigator";
  const dueLabel = request.due_date
    ? `Response requested by ${formatCaseDate(request.due_date)}`
    : "A response has been requested";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AppHeader
          title="Additional information required"
          subtitle={request.cases?.case_reference}
          onBack={goToCase}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.deadline}>
            <Text style={styles.deadlineTitle}>🕒 {dueLabel}</Text>
            <Text style={styles.deadlineCopy}>
              If you need more time, tell your officer — the case will not be
              closed while you are working on a reply.
            </Text>
          </View>

          <View style={styles.stack}>
            <SectionCard
              title={officerLabel}
              description="Assigned investigator"
            >
              <Text style={styles.message}>{request.message}</Text>
            </SectionCard>

            <SectionCard title="Information requested">
              {request.requested_items.length === 0 ? (
                <Text style={styles.emptyItems}>
                  Your investigator has not listed specific items. Use the
                  response box below.
                </Text>
              ) : (
                request.requested_items.map((item, index) => (
                  <View key={`${index}-${item}`} style={styles.itemRow}>
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.itemText}>{item}</Text>
                  </View>
                ))
              )}
            </SectionCard>

            <SectionCard
              title={readOnly ? "Your submitted response" : "Your response"}
              description={
                readOnly && savedResponse
                  ? `Submitted ${formatCaseDateTime(savedResponse.submitted_at)}`
                  : undefined
              }
            >
              <Field
                label="Write your response"
                hint="Answer in your own words, in any language you prefer."
              >
                <AppTextArea
                  value={responseText}
                  onChangeText={(value) => {
                    setDraftSaved(false);
                    setResponseText(value.slice(0, 2000));
                  }}
                  editable={!readOnly && !submitting}
                  placeholder="Type here…"
                  style={[styles.responseArea, readOnly && styles.readOnlyInput]}
                />
              </Field>
              <Text style={styles.counter}>
                {responseText.length} / 2000 characters
              </Text>

              <PrimaryButton
                title="Attach a supporting file"
                variant="outline"
                icon="📎"
                onPress={() =>
                  router.push({
                    pathname: "/reporter/cases/upload",
                    params: { caseId: request.case_id },
                  })
                }
              />
            </SectionCard>
          </View>

          {formError ? (
            <View style={styles.notice}>
              <Notice tone="error" title="Unable to continue">
                {formError}
              </Notice>
            </View>
          ) : null}

          {draftSaved && !readOnly ? (
            <View style={styles.notice}>
              <Notice tone="success" title="Draft saved">
                Your draft is saved on this device until you submit.
              </Notice>
            </View>
          ) : null}

          {readOnly ? (
            <View style={styles.notice}>
              <Notice tone="success" title="Response submitted">
                Your response was sent securely to your assigned investigator.
              </Notice>
            </View>
          ) : (
            <View style={styles.notice}>
              <Notice tone="privacy">
                Your response is added to the case record and seen only by your
                assigned investigator.
              </Notice>
            </View>
          )}
        </ScrollView>

        {!readOnly ? (
          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <View style={styles.draftBtn}>
                <PrimaryButton
                  title="Save draft"
                  variant="outline"
                  loading={savingDraft}
                  disabled={submitting}
                  onPress={() => void saveDraft()}
                />
              </View>
              <View style={styles.submitBtn}>
                <PrimaryButton
                  title="Submit response"
                  icon="✈"
                  loading={submitting}
                  disabled={savingDraft}
                  onPress={() => void submitResponse()}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.footer}>
            <PrimaryButton title="Back to case" onPress={goToCase} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorContent: {
    padding: 16,
  },
  retryButton: {
    marginTop: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  deadline: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold[100],
    backgroundColor: colors.gold[50],
  },
  deadlineTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.warning,
  },
  deadlineCopy: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.warning,
  },
  stack: {
    marginTop: 14,
    gap: 12,
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.navy[800],
  },
  emptyItems: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  itemBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.royal[50],
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.royal[700],
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.navy[800],
  },
  responseArea: {
    minHeight: 140,
  },
  readOnlyInput: {
    backgroundColor: colors.navy[50],
  },
  counter: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  notice: {
    marginTop: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  draftBtn: {
    flex: 0.42,
  },
  submitBtn: {
    flex: 1,
  },
});
