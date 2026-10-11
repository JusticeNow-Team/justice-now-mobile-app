import { Href, usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "../components/AppIcon";
import { supabase } from "../lib/supabase";
import { colors, iconSizes } from "../theme";

type StaffNotification = {
  id: string;
  case_id: string | null;
  evidence_id: string | null;
  assignment_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function StaffNotificationAlert() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const mountedAt = useRef(new Date().toISOString());
  const shownIds = useRef(new Set<string>());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notification, setNotification] = useState<StaffNotification | null>(
    null,
  );

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const showNotification = (next: StaffNotification) => {
      if (!mounted || shownIds.current.has(next.id)) {
        return;
      }

      shownIds.current.add(next.id);
      setNotification(next);

      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      hideTimer.current = setTimeout(() => {
        setNotification((current) =>
          current?.id === next.id ? null : current,
        );
      }, 6500);
    };

    const pollRecentNotification = async (userId: string) => {
      const { data } = await supabase
        .from("officer_notifications")
        .select(
          "id, case_id, evidence_id, assignment_id, notification_type, title, message, is_read, created_at",
        )
        .eq("officer_id", userId)
        .eq("is_read", false)
        .gt("created_at", mountedAt.current)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        showNotification(data as StaffNotification);
      }
    };

    const start = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        return;
      }

      channel = supabase
        .channel(`staff-notification-alert-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "officer_notifications",
            filter: `officer_id=eq.${user.id}`,
          },
          (payload) => {
            showNotification(payload.new as StaffNotification);
          },
        )
        .subscribe();

      const interval = setInterval(() => {
        void pollRecentNotification(user.id);
      }, 25000);

      return () => {
        clearInterval(interval);
      };
    };

    let cleanupPoll: (() => void) | undefined;

    void start().then((cleanup) => {
      cleanupPoll = cleanup;
    });

    return () => {
      mounted = false;

      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      cleanupPoll?.();

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  const markRead = async (id: string) => {
    await supabase
      .from("officer_notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("id", id);
  };

  const openNotification = async () => {
    if (!notification) {
      return;
    }

    const selected = notification;
    setNotification(null);
    await markRead(selected.id);

    if (selected.case_id) {
      if (selected.notification_type === "evidence_message") {
        if (pathname.startsWith("/validator") && selected.assignment_id) {
          router.push(`/validator/evidence/${selected.assignment_id}` as Href);
          return;
        }

        if (selected.evidence_id) {
          router.push({
            pathname: "/officer/evidence-messages",
            params: {
              caseId: selected.case_id,
              evidenceId: selected.evidence_id,
            },
          });
          return;
        }
      }

      router.push({
        pathname: "/officer/case-details",
        params:
          selected.notification_type === "case_message"
            ? {
                id: selected.case_id,
                tab: "messages",
              }
            : {
                id: selected.case_id,
              },
      });
    }
  };

  if (!notification) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.overlay,
        {
          paddingTop: Math.max(insets.top, 12),
        },
      ]}
    >
      <View style={styles.banner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={notification.title}
          onPress={openNotification}
          style={({ pressed }) => [
            styles.openButton,
            pressed && styles.bannerPressed,
          ]}
        >
          <View style={styles.iconWrap}>
            <AppIcon
              name={
                notification.notification_type.includes("message")
                  ? "message-square"
                  : "bell"
              }
              color={colors.royal[700]}
              size={iconSizes.sm}
            />
          </View>

          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.title}>
              {notification.title}
            </Text>

            <Text numberOfLines={2} style={styles.message}>
              {notification.message}
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={10}
          onPress={() => setNotification(null)}
          style={styles.dismiss}
        >
          <AppIcon name="x" color={colors.textSecondary} size={iconSizes.xs} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: 14,
  },

  banner: {
    width: "100%",
    maxWidth: 620,
    minHeight: 72,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingRight: 8,
    backgroundColor: colors.surface,
    shadowColor: colors.navy[900],
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },

  bannerPressed: {
    opacity: 0.9,
  },

  openButton: {
    flex: 1,
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 12,
    paddingVertical: 10,
  },

  iconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.royal[50],
  },

  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },

  title: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textPrimary,
  },

  message: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  dismiss: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
});
