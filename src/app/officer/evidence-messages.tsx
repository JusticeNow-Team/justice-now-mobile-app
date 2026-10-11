import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "../../components/AppIcon";
import { Notice, PrimaryButton } from "../../components/common";
import {
  CaseMessage,
  getCaseMessages,
  sendCaseMessage,
} from "../../messages/caseMessages";
import { colors, iconSizes } from "../../theme";

function paramValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function OfficerEvidenceMessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    caseId?: string | string[];
    evidenceId?: string | string[];
    title?: string | string[];
    caseReference?: string | string[];
  }>();

  const caseId = paramValue(params.caseId);
  const evidenceId = paramValue(params.evidenceId);
  const title = paramValue(params.title) || "Evidence thread";
  const caseReference = paramValue(params.caseReference) || "Case evidence";

  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadMessages = useCallback(async () => {
    if (!caseId || !evidenceId) {
      setErrorMessage("The evidence thread is missing case or evidence details.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const result = await getCaseMessages(caseId, evidenceId);

      if (!result.ok) {
        setMessages([]);
        setErrorMessage(result.message);
        return;
      }

      setMessages(result.messages);
    } finally {
      setLoading(false);
    }
  }, [caseId, evidenceId]);

  useFocusEffect(
    useCallback(() => {
      void loadMessages();
      return undefined;
    }, [loadMessages]),
  );

  const sendMessage = async () => {
    if (!caseId || !evidenceId || sending) {
      return;
    }

    try {
      setSending(true);
      setErrorMessage("");

      const result = await sendCaseMessage({
        caseId,
        evidenceId,
        body: draft,
        reporterVisible: false,
      });

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      setDraft("");
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <AppIcon name="chevron-left" size={iconSizes.xl} color={colors.navy[700]} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            Evidence messages
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {caseReference}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.contextCard}>
          <View style={styles.contextIcon}>
            <AppIcon name="message-square" size={iconSizes.lg} color={colors.royal[700]} />
          </View>
          <View style={styles.contextBody}>
            <Text style={styles.contextTitle}>{title}</Text>
            <Text style={styles.contextText}>
              This thread is visible to the assigned Case Officer and Evidence Checker only.
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.royal[700]} />
            <Text style={styles.loadingText}>Loading thread...</Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.noticeWrap}>
            <Notice tone="caution" title="Messages unavailable">
              {errorMessage}
            </Notice>
          </View>
        ) : null}

        {!loading && messages.length === 0 && !errorMessage ? (
          <View style={styles.emptyCard}>
            <AppIcon name="message-square" size={iconSizes.xl} color={colors.royal[700]} />
            <Text style={styles.emptyTitle}>No evidence messages</Text>
            <Text style={styles.emptyText}>
              Start a focused thread for questions about this evidence item.
            </Text>
          </View>
        ) : null}

        {!loading
          ? messages.map((message) => (
              <View key={message.id} style={styles.messageCard}>
                <View style={styles.messageTop}>
                  <Text style={styles.messageAuthor}>
                    {message.senderRole === "case_officer"
                      ? "Case Officer"
                      : message.senderRole === "evidence_checker"
                        ? "Evidence Checker"
                        : "JusticeNow staff"}
                  </Text>
                  <Text style={styles.messageDate}>
                    {formatDateTime(message.createdAt)}
                  </Text>
                </View>
                <Text style={styles.messageBody}>{message.body}</Text>
              </View>
            ))
          : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message for the assigned checker..."
          placeholderTextColor={colors.textSoft}
          multiline
          maxLength={2000}
          textAlignVertical="top"
          editable={!sending}
          style={styles.input}
        />
        <PrimaryButton
          title="Send message"
          icon="message-square"
          loading={sending}
          onPress={() => void sendMessage()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.navy[800],
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
  },
  content: {
    padding: 16,
    paddingBottom: 20,
  },
  contextCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  contextIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[50],
  },
  contextBody: {
    flex: 1,
  },
  contextTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy[800],
  },
  contextText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  loading: {
    paddingTop: 42,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
  noticeWrap: {
    marginTop: 12,
  },
  emptyCard: {
    alignItems: "center",
    marginTop: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "500",
    color: colors.navy[800],
  },
  emptyText: {
    marginTop: 5,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  messageCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  messageTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  messageAuthor: {
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.royal[700],
  },
  messageDate: {
    fontSize: 10.5,
    color: colors.textSoft,
  },
  messageBody: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.navy[800],
  },
  composer: {
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 86,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 19,
    color: colors.navy[800],
    backgroundColor: colors.background,
  },
});
