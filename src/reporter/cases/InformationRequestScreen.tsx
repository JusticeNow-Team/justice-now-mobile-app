import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    AppHeader,
    Notice,
    PrimaryButton,
    SectionCard,
} from "../../components/common";
import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";
import { logoutReporter } from "../login";
import { formatCaseDate, formatCaseDateTime } from "./filterReporterCases";

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
  title: string;
  message: string;
  requested_items: string[];
  requires_evidence: boolean;
  due_date: string | null;
  status: "sent" | "responded";
  sent_at: string;
  cases: RequestCase | null;
  case_information_responses: SavedResponse[];
};

function parseSavedAnswers(value: unknown): SavedAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is SavedAnswer =>
        typeof item === "object" &&
        item !== null &&
        typeof (
          item as {
            question?: unknown;
          }
        ).question === "string" &&
        typeof (
          item as {
            answer?: unknown;
          }
        ).answer === "string",
    )
    .map((item) => ({
      question: item.question,
      answer: item.answer,
    }));
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
  const [answers, setAnswers] = useState<string[]>([]);
  const [additionalMessage, setAdditionalMessage] = useState("");
  const [savedResponse, setSavedResponse] = useState<SavedResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
          `,
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
          "This information request is not available on your account.",
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

      const typedRequest: InformationRequest = {
        id: data.id,
        case_id: data.case_id,
        reporter_id: data.reporter_id,
        title: data.title,
        message: data.message,
        requested_items: data.requested_items ?? [],
        requires_evidence: Boolean(data.requires_evidence),
        due_date: data.due_date,
        status: data.status === "responded" ? "responded" : "sent",
        sent_at: data.sent_at,
        cases: nestedCase ?? null,
        case_information_responses: parsedResponse ? [parsedResponse] : [],
      };

      setRequest(typedRequest);
      setSavedResponse(parsedResponse);

      if (parsedResponse) {
        setAnswers(
          typedRequest.requested_items.map(
            (question) =>
              parsedResponse.answers.find(
                (answer) => answer.question === question,
              )?.answer ?? "",
          ),
        );

        setAdditionalMessage(parsedResponse.additional_message ?? "");
      } else {
        setAnswers(typedRequest.requested_items.map(() => ""));
        setAdditionalMessage("");
      }
    } catch (error) {
      console.error("LOAD REPORTER INFORMATION REQUEST ERROR:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "JusticeNow could not load this information request.",
      );
    } finally {
      setLoading(false);
    }
  }, [requestId, router]);

  useFocusEffect(
    useCallback(() => {
      void loadRequest();
      return undefined;
    }, [loadRequest]),
  );

  const updateAnswer = (index: number, value: string) => {
    setAnswers((current) =>
      current.map((answer, answerIndex) =>
        answerIndex === index ? value : answer,
      ),
    );
  };

  const submitResponse = async () => {
    if (!request || submitting || savedResponse) {
      return;
    }

    const preparedAnswers = request.requested_items
      .map((question, index) => ({
        question,
        answer: (answers[index] ?? "").trim(),
      }))
      .filter((item) => item.answer.length > 0);

    const cleanAdditionalMessage = additionalMessage.trim();

    if (preparedAnswers.length === 0 && cleanAdditionalMessage.length === 0) {
      const message =
        "Answer at least one question or add a message. Partial answers are accepted.";

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Response required", message);
      }

      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        await logoutReporter().catch(() => undefined);
        router.replace("/login");
        return;
      }

      const { error } = await supabase
        .from("case_information_responses")
        .insert({
          request_id: request.id,
          case_id: request.case_id,
          reporter_id: user.id,
          answers: preparedAnswers,
          additional_message: cleanAdditionalMessage || null,
        });

      if (error) {
        throw error;
      }

      await loadRequest();

      if (Platform.OS === "web") {
        window.alert(
          "Response submitted. Your response was sent securely to the Case Officer.",
        );
      } else {
        Alert.alert(
          "Response submitted",
          "Your response was sent securely to the Case Officer.",
        );
      }
    } catch (error) {
      console.error("SUBMIT INFORMATION RESPONSE ERROR:", error);

      const message =
        error instanceof Error
          ? error.message
          : "JusticeNow could not submit your response.";

      if (Platform.OS === "web") {
        window.alert(`Unable to submit response: ${message}`);
      } else {
        Alert.alert("Unable to submit response", message);
      }
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
        <AppHeader title="Information request" onBack={() => router.back()} />

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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <AppHeader
          title="Information request"
          subtitle={request.cases?.case_reference}
          onBack={() => router.back()}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>CASE OFFICER REQUEST</Text>

            <Text style={styles.heroTitle}>{request.title}</Text>

            <Text style={styles.heroMeta}>
              Sent {formatCaseDateTime(request.sent_at)}
            </Text>
          </View>

          <SectionCard title="Message from your Case Officer">
            <Text style={styles.message}>{request.message}</Text>
          </SectionCard>

          <SectionCard
            title={readOnly ? "Your submitted response" : "Your response"}
            description={
              readOnly
                ? savedResponse
                  ? `Submitted ${formatCaseDateTime(
                      savedResponse.submitted_at,
                    )}`
                  : "Response submitted"
                : "Answer only what you are comfortable sharing. Partial answers are accepted."
            }
          >
            {request.requested_items.map((question, index) => (
              <View key={`${index}-${question}`} style={styles.answerGroup}>
                <Text style={styles.question}>
                  {index + 1}. {question}
                </Text>

                <TextInput
                  value={answers[index] ?? ""}
                  onChangeText={(value) => updateAnswer(index, value)}
                  editable={!readOnly && !submitting}
                  multiline
                  maxLength={1500}
                  textAlignVertical="top"
                  placeholder="Type your answer…"
                  placeholderTextColor={colors.textSoft}
                  style={[styles.answerInput, readOnly && styles.readOnlyInput]}
                />
              </View>
            ))}

            <Text style={styles.question}>Additional message</Text>

            <TextInput
              value={additionalMessage}
              onChangeText={setAdditionalMessage}
              editable={!readOnly && !submitting}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              placeholder="Add anything else the Case Officer should know…"
              placeholderTextColor={colors.textSoft}
              style={[styles.answerInput, readOnly && styles.readOnlyInput]}
            />
          </SectionCard>

          <SectionCard title="Request details">
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Response due</Text>

              <Text style={styles.detailValue}>
                {formatCaseDate(request.due_date)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Supporting evidence</Text>

              <Text style={styles.detailValue}>
                {request.requires_evidence ? "Requested" : "Not requested"}
              </Text>
            </View>
          </SectionCard>

          {request.requires_evidence ? (
            <PrimaryButton
              title="Upload supporting evidence"
              variant="outline"
              icon="⬆"
              onPress={() =>
                router.push({
                  pathname: "/reporter/cases/upload",
                  params: {
                    caseId: request.case_id,
                  },
                })
              }
            />
          ) : null}

          {readOnly ? (
            <Notice tone="success" title="Response submitted">
              Your Case Officer has been notified. Your response is now part of
              the protected case record.
            </Notice>
          ) : (
            <Notice tone="privacy" title="Secure case communication">
              Your answers are visible only to authorized staff working on this
              case. Submit once you are ready; responses cannot be edited later.
            </Notice>
          )}

          {!readOnly ? (
            <PrimaryButton
              title="Submit response securely"
              loading={submitting}
              onPress={() => void submitResponse()}
            />
          ) : null}
        </ScrollView>
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
    gap: 14,
    padding: 16,
    paddingBottom: 40,
  },
  hero: {
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.navy[800],
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: "#AFC5DE",
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 25,
    color: colors.textInverse,
  },
  heroMeta: {
    marginTop: 7,
    fontSize: 11,
    color: "#DCE5EF",
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.navy[700],
  },
  answerGroup: {
    marginBottom: 16,
  },
  question: {
    marginBottom: 7,
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 18,
    color: colors.navy[800],
  },
  answerInput: {
    minHeight: 90,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.navy[200],
    borderRadius: 11,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.navy[800],
    backgroundColor: colors.surface,
  },
  readOnlyInput: {
    borderColor: colors.border,
    backgroundColor: colors.navy[50],
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 7,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "600",
    color: colors.navy[800],
  },
});
