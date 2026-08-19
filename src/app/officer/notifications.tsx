import { useFocusEffect, useRouter } from "expo-router";

import { useCallback, useMemo, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";
import { colors } from "../../theme";

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

type NotificationType =
  | "case_assignment"
  | "new_evidence"
  | "evidence_verified"
  | "evidence_rejected"
  | "case_update"
  | "security";

type OfficerNotification = {
  id: string;

  officer_id: string;

  case_id: string | null;

  notification_type: NotificationType;

  title: string;

  message: string;

  is_read: boolean;

  created_at: string;

  read_at: string | null;

  cases: {
    id: string;

    case_reference: string;

    title: string;
  } | null;
};

type FilterType = "all" | "unread" | "cases" | "evidence";

// ---------------------------------------------------------
// Screen
// ---------------------------------------------------------

export default function OfficerNotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<OfficerNotification[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<FilterType>("all");

  const [markingAll, setMarkingAll] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  // -------------------------------------------------------
  // Load Notifications
  // -------------------------------------------------------

  const loadNotifications = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setErrorMessage("");

        // -----------------------------------------------
        // Verify MFA
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
        // Load notifications
        // -----------------------------------------------

        const { data, error } = await supabase
          .from("officer_notifications")
          .select(
            `
                id,
                officer_id,
                case_id,
                notification_type,
                title,
                message,
                is_read,
                created_at,
                read_at,

                cases (
                  id,
                  case_reference,
                  title
                )
              `,
          )
          .order("created_at", {
            ascending: false,
          });

        console.log("OFFICER NOTIFICATIONS:", data);

        console.log("NOTIFICATION ERROR:", error);

        if (error) {
          setErrorMessage(error.message);

          return;
        }

        setNotifications((data ?? []) as unknown as OfficerNotification[]);
      } catch (error) {
        console.error("LOAD NOTIFICATIONS ERROR:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "JusticeNow could not load notifications.",
        );
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },
    [router],
  );

  // -------------------------------------------------------
  // Reload whenever screen receives focus
  // -------------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      loadNotifications();

      return undefined;
    }, [loadNotifications]),
  );

  // -------------------------------------------------------
  // Refresh
  // -------------------------------------------------------

  const handleRefresh = () => {
    setRefreshing(true);

    loadNotifications(false);
  };

  // -------------------------------------------------------
  // Filter
  // -------------------------------------------------------

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      switch (filter) {
        case "unread":
          return !item.is_read;

        case "cases":
          return item.notification_type === "case_assignment";

        case "evidence":
          return [
            "new_evidence",
            "evidence_verified",
            "evidence_rejected",
          ].includes(item.notification_type);

        case "all":
        default:
          return true;
      }
    });
  }, [notifications, filter]);

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  // -------------------------------------------------------
  // Mark One Read
  // -------------------------------------------------------

  const markRead = async (notification: OfficerNotification) => {
    if (notification.is_read) {
      return;
    }

    const { error } = await supabase
      .from("officer_notifications")
      .update({
        is_read: true,

        read_at: new Date().toISOString(),
      })
      .eq("id", notification.id);

    if (error) {
      console.error("MARK READ ERROR:", error);

      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? {
              ...item,

              is_read: true,

              read_at: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  // -------------------------------------------------------
  // Open Notification
  // -------------------------------------------------------

  const openNotification = async (notification: OfficerNotification) => {
    await markRead(notification);

    if (notification.case_id) {
      router.push({
        pathname: "/officer/case-details",

        params: {
          id: notification.case_id,
        },
      });

      return;
    }

    Alert.alert(notification.title, notification.message);
  };

  // -------------------------------------------------------
  // Mark All Read
  // -------------------------------------------------------

  const markAllRead = async () => {
    if (unreadCount === 0 || markingAll) {
      return;
    }

    try {
      setMarkingAll(true);

      const { error } = await supabase
        .from("officer_notifications")
        .update({
          is_read: true,

          read_at: new Date().toISOString(),
        })
        .eq("is_read", false);

      if (error) {
        Alert.alert("Unable to update notifications", error.message);

        return;
      }

      setNotifications((current) =>
        current.map((item) => ({
          ...item,

          is_read: true,

          read_at: item.read_at ?? new Date().toISOString(),
        })),
      );
    } catch (error) {
      console.error("MARK ALL READ ERROR:", error);

      Alert.alert(
        "Unable to update notifications",
        "JusticeNow could not update your notifications.",
      );
    } finally {
      setMarkingAll(false);
    }
  };

  // -------------------------------------------------------
  // Loading
  // -------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.royal[700]} />

        <Text style={styles.loadingText}>Loading notifications...</Text>
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
          <Text style={styles.headerTitle}>Notifications</Text>

          <Text style={styles.headerSubtitle}>Case Officer Workspace</Text>
        </View>

        {unreadCount > 0 && (
          <Pressable
            onPress={markAllRead}
            disabled={markingAll}
            accessibilityRole="button"
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.royal[700]} />
            ) : (
              <Text style={styles.markAllText}>Mark all read</Text>
            )}
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.royal[700]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Overview */}

        <View style={styles.hero}>
          <View>
            <Text style={styles.heroLabel}>OFFICER ALERTS</Text>

            <Text style={styles.heroTitle}>Stay updated</Text>

            <Text style={styles.heroText}>
              Case assignments, evidence activity and investigation-related
              updates appear here.
            </Text>
          </View>

          <View style={styles.unreadBubble}>
            <Text style={styles.unreadValue}>{unreadCount}</Text>

            <Text style={styles.unreadLabel}>unread</Text>
          </View>
        </View>

        {/* Filters */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <FilterChip
            label="All"
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />

          <FilterChip
            label={`Unread (${unreadCount})`}
            active={filter === "unread"}
            onPress={() => setFilter("unread")}
          />

          <FilterChip
            label="Case assignments"
            active={filter === "cases"}
            onPress={() => setFilter("cases")}
          />

          <FilterChip
            label="Evidence"
            active={filter === "evidence"}
            onPress={() => setFilter("evidence")}
          />
        </ScrollView>

        {/* Error */}

        {errorMessage !== "" && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load notifications</Text>

            <Text style={styles.errorText}>{errorMessage}</Text>

            <Pressable
              onPress={() => loadNotifications()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {/* List */}

        {errorMessage === "" &&
          filteredNotifications.map((notification) => (
            <Pressable
              key={notification.id}
              onPress={() => openNotification(notification)}
              accessibilityRole="button"
              accessibilityLabel={notification.title}
              style={({ pressed }) => [
                styles.notificationCard,

                !notification.is_read && styles.unreadCard,

                pressed && styles.pressed,
              ]}
            >
              <View style={styles.notificationIconBox}>
                <Text style={styles.notificationIcon}>
                  {getNotificationIcon(notification.notification_type)}
                </Text>
              </View>

              <View style={styles.notificationContent}>
                <View style={styles.notificationTopRow}>
                  <Text
                    style={[
                      styles.notificationTitle,

                      !notification.is_read && styles.notificationTitleUnread,
                    ]}
                  >
                    {notification.title}
                  </Text>

                  {!notification.is_read && <View style={styles.unreadDot} />}
                </View>

                <Text style={styles.notificationMessage}>
                  {notification.message}
                </Text>

                <View style={styles.notificationFooter}>
                  {notification.cases?.case_reference && (
                    <Text style={styles.caseReference}>
                      {notification.cases.case_reference}
                    </Text>
                  )}

                  <Text style={styles.notificationTime}>
                    {formatNotificationTime(notification.created_at)}
                  </Text>
                </View>
              </View>

              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ))}

        {/* Empty */}

        {errorMessage === "" && filteredNotifications.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔔</Text>

            <Text style={styles.emptyTitle}>No notifications</Text>

            <Text style={styles.emptyText}>
              There are currently no notifications matching this filter.
            </Text>
          </View>
        )}

        {/* Security */}

        <View style={styles.securityCard}>
          <Text style={styles.securityIcon}>🔒</Text>

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>
              Private officer notifications
            </Text>

            <Text style={styles.securityText}>
              These alerts are visible only to your authenticated Case Officer
              account.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// Filter Chip
// ---------------------------------------------------------

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
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
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------
// Notification Icon
// ---------------------------------------------------------

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "case_assignment":
      return "📁";

    case "new_evidence":
      return "📎";

    case "evidence_verified":
      return "✅";

    case "evidence_rejected":
      return "⚠️";

    case "security":
      return "🔒";

    case "case_update":
    default:
      return "📝";
  }
}

// ---------------------------------------------------------
// Time Formatter
// ---------------------------------------------------------

function formatNotificationTime(value: string) {
  const date = new Date(value);

  const now = new Date();

  const difference = now.getTime() - date.getTime();

  const minutes = Math.floor(difference / (1000 * 60));

  const hours = Math.floor(difference / (1000 * 60 * 60));

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
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

    fontSize: 11,

    color: colors.textSecondary,
  },

  markAllText: {
    padding: 5,

    fontSize: 10.5,

    fontWeight: "700",

    color: colors.royal[700],
  },

  content: {
    padding: 16,

    paddingBottom: 40,
  },

  // -----------------------------------------------------
  // Hero
  // -----------------------------------------------------

  hero: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    padding: 18,

    borderRadius: 17,

    backgroundColor: colors.navy[800],
  },

  heroLabel: {
    fontSize: 9.5,

    fontWeight: "700",

    letterSpacing: 0.8,

    color: "#AFC5DE",
  },

  heroTitle: {
    marginTop: 5,

    fontSize: 19,

    fontWeight: "800",

    color: colors.textInverse,
  },

  heroText: {
    maxWidth: 245,

    marginTop: 5,

    fontSize: 11,

    lineHeight: 16,

    color: "#DCE5EF",
  },

  unreadBubble: {
    width: 58,
    height: 58,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 29,

    backgroundColor: "rgba(255,255,255,0.12)",
  },

  unreadValue: {
    fontSize: 19,

    fontWeight: "800",

    color: colors.textInverse,
  },

  unreadLabel: {
    fontSize: 8.5,

    color: "#DCE5EF",
  },

  // -----------------------------------------------------
  // Filters
  // -----------------------------------------------------

  filters: {
    gap: 7,

    paddingVertical: 14,
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
    fontSize: 10.5,

    fontWeight: "600",

    color: colors.navy[700],
  },

  filterChipTextActive: {
    color: colors.textInverse,
  },

  // -----------------------------------------------------
  // Notification
  // -----------------------------------------------------

  notificationCard: {
    minHeight: 105,

    marginBottom: 9,

    flexDirection: "row",

    alignItems: "center",

    padding: 13,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 14,

    backgroundColor: colors.surface,
  },

  unreadCard: {
    borderColor: colors.royal[100],

    backgroundColor: colors.royal[50],
  },

  notificationIconBox: {
    width: 44,
    height: 44,

    marginRight: 11,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: colors.surface,
  },

  notificationIcon: {
    fontSize: 18,
  },

  notificationContent: {
    flex: 1,
  },

  notificationTopRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 7,
  },

  notificationTitle: {
    flex: 1,

    fontSize: 12.5,

    fontWeight: "600",

    color: colors.navy[800],
  },

  notificationTitleUnread: {
    fontWeight: "800",
  },

  unreadDot: {
    width: 8,
    height: 8,

    borderRadius: 4,

    backgroundColor: colors.royal[600],
  },

  notificationMessage: {
    marginTop: 4,

    fontSize: 10.5,

    lineHeight: 15,

    color: colors.textSecondary,
  },

  notificationFooter: {
    marginTop: 7,

    flexDirection: "row",

    alignItems: "center",

    gap: 9,
  },

  caseReference: {
    fontSize: 9.5,

    fontWeight: "700",

    color: colors.royal[700],
  },

  notificationTime: {
    fontSize: 9,

    color: colors.textSoft,
  },

  arrow: {
    marginLeft: 7,

    fontSize: 24,

    color: colors.royal[700],
  },

  pressed: {
    opacity: 0.75,
  },

  // -----------------------------------------------------
  // Empty
  // -----------------------------------------------------

  emptyCard: {
    alignItems: "center",

    padding: 28,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 15,

    backgroundColor: colors.surface,
  },

  emptyIcon: {
    fontSize: 28,
  },

  emptyTitle: {
    marginTop: 9,

    fontSize: 13,

    fontWeight: "700",

    color: colors.navy[800],
  },

  emptyText: {
    marginTop: 4,

    textAlign: "center",

    fontSize: 10.5,

    color: colors.textSecondary,
  },

  // -----------------------------------------------------
  // Security
  // -----------------------------------------------------

  securityCard: {
    marginTop: 15,

    flexDirection: "row",

    padding: 13,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 13,

    backgroundColor: colors.teal[50],
  },

  securityIcon: {
    marginRight: 8,
  },

  securityContent: {
    flex: 1,
  },

  securityTitle: {
    fontSize: 11.5,

    fontWeight: "700",

    color: colors.teal[800],
  },

  securityText: {
    marginTop: 3,

    fontSize: 10.5,

    lineHeight: 15,

    color: colors.textSecondary,
  },

  // -----------------------------------------------------
  // Error
  // -----------------------------------------------------

  errorCard: {
    padding: 14,

    borderWidth: 1,

    borderColor: colors.error,

    borderRadius: 13,

    backgroundColor: "#FFF2F1",
  },

  errorTitle: {
    fontSize: 12,

    fontWeight: "700",

    color: colors.error,
  },

  errorText: {
    marginTop: 4,

    fontSize: 10.5,

    color: colors.textSecondary,
  },

  retryButton: {
    alignSelf: "flex-start",

    marginTop: 9,

    paddingHorizontal: 12,
    paddingVertical: 7,

    borderRadius: 8,

    backgroundColor: colors.error,
  },

  retryText: {
    fontSize: 10.5,

    fontWeight: "700",

    color: colors.textInverse,
  },
});
