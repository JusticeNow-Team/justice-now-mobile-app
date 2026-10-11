import { Href, useFocusEffect, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon, AppIconName } from "../components/AppIcon";
import { supabase } from "../lib/supabase";
import { colors, iconSizes } from "../theme";

export type NavigationRole =
  | "reporter"
  | "case_officer"
  | "evidence_validator"
  | "system_admin";

type NavigationItem = {
  label: string;
  icon: AppIconName;
  href: string;
  exact?: boolean;
  prominent?: boolean;
};

const ROLE_NAVIGATION: Record<NavigationRole, NavigationItem[]> = {
  reporter: [
    {
      label: "Home",
      icon: "house",
      href: "/reporter",
      exact: true,
    },
    {
      label: "My Cases",
      icon: "folder-open",
      href: "/reporter/cases",
    },
    {
      label: "Report",
      icon: "plus",
      href: "/reporter/report/preference",
      prominent: true,
    },
    {
      label: "Messages",
      icon: "message-square",
      href: "/reporter/messages",
    },
    {
      label: "Profile",
      icon: "user",
      href: "/reporter/profile",
    },
  ],

  case_officer: [
    {
      label: "Dashboard",
      icon: "layout-dashboard",
      href: "/officer",
      exact: true,
    },
    {
      label: "Cases",
      icon: "folder-open",
      href: "/officer/cases",
    },
    {
      label: "Messages",
      icon: "message-square",
      href: "/officer/messages",
    },
    {
      label: "Tasks",
      icon: "list-checks",
      href: "/officer/tasks",
    },
    {
      label: "Profile",
      icon: "user",
      href: "/officer/profile",
    },
  ],

  evidence_validator: [
    {
      label: "Dashboard",
      icon: "layout-dashboard",
      href: "/validator/dashboard",
      exact: true,
    },
    {
      label: "Queue",
      icon: "file-search",
      href: "/validator/queue",
    },
    {
      label: "History",
      icon: "history",
      href: "/validator/history",
    },
    {
      label: "Alerts",
      icon: "bell",
      href: "/validator/notifications",
    },
    {
      label: "Profile",
      icon: "clipboard-check",
      href: "/validator/profile",
    },
  ],

  system_admin: [
    {
      label: "Dashboard",
      icon: "layout-dashboard",
      href: "/admin",
      exact: true,
    },
    {
      label: "Cases",
      icon: "folder-open",
      href: "/admin/cases",
    },
    {
      label: "Users",
      icon: "users",
      href: "/admin/users",
    },
    {
      label: "Activity",
      icon: "activity",
      href: "/admin/audit",
    },
    {
      label: "Settings",
      icon: "settings",
      href: "/admin/settings",
    },
  ],
};

const HIDDEN_PREFIXES: Record<NavigationRole, string[]> = {
  reporter: [
    "/reporter/report",
    "/reporter/cases/upload",
    "/reporter/cases/information-request",
    "/reporter/profile/change-password",
    "/reporter/profile/personal",
    "/reporter/profile/security",
  ],

  case_officer: [
    "/officer/case-details",
    "/officer/assign-evidence",
    "/officer/workspace",
    "/officer/request-information",
    "/officer/status",
    "/officer/resolution",
  ],

  evidence_validator: ["/validator/evidence"],

  system_admin: [],
};

function isCurrentPath(pathname: string, item: NavigationItem) {
  if (item.exact) {
    return pathname === item.href || pathname === `${item.href}/`;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function shouldShowStaffBadge(role: NavigationRole, item: NavigationItem) {
  return (
    (role === "case_officer" && item.href === "/officer/messages") ||
    (role === "evidence_validator" && item.href === "/validator/notifications")
  );
}

export default function RoleBottomNavigation({
  role,
}: {
  role: NavigationRole;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const staffNotificationsEnabled =
    role === "case_officer" || role === "evidence_validator";

  const loadUnreadNotifications = useCallback(async () => {
    if (!staffNotificationsEnabled) {
      setUnreadNotifications(0);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUnreadNotifications(0);
      return;
    }

    const { count, error } = await supabase
      .from("officer_notifications")
      .select("id", { count: "exact", head: true })
      .eq("officer_id", user.id)
      .eq("is_read", false);

    if (!error) {
      setUnreadNotifications(count ?? 0);
    }
  }, [staffNotificationsEnabled]);

  useFocusEffect(
    useCallback(() => {
      void loadUnreadNotifications();
    }, [loadUnreadNotifications]),
  );

  useEffect(() => {
    if (!staffNotificationsEnabled) {
      return undefined;
    }

    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const start = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        return;
      }

      channel = supabase
        .channel(`staff-notification-badge-${role}-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "officer_notifications",
            filter: `officer_id=eq.${user.id}`,
          },
          () => {
            void loadUnreadNotifications();
          },
        )
        .subscribe();
    };

    void start();

    return () => {
      mounted = false;

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadUnreadNotifications, role, staffNotificationsEnabled]);

  const shouldHide = HIDDEN_PREFIXES[role].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (shouldHide) {
    return null;
  }

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.navigation,
        {
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View style={styles.navigationRow}>
        {ROLE_NAVIGATION[role].map((item) => {
          const active = isCurrentPath(pathname, item);
          const showBadge =
            unreadNotifications > 0 && shouldShowStaffBadge(role, item);

          const iconColor =
            active || item.prominent ? colors.royal[700] : colors.textSecondary;

          return (
            <Pressable
              key={`${role}-${item.href}`}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (!active) {
                  router.replace(item.href as Href);
                }
              }}
              style={({ pressed }) => [
                styles.navigationItem,
                pressed && styles.pressed,
              ]}
            >
              {item.prominent ? (
                <View style={styles.prominentButton}>
                  <AppIcon
                    name={item.icon}
                    color={colors.surface}
                    size={iconSizes.navProminent}
                  />
                </View>
              ) : (
                <View style={styles.iconSlot}>
                  <AppIcon
                    name={item.icon}
                    color={iconColor}
                    size={iconSizes.nav}
                  />

                  {showBadge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadNotifications > 99 ? "99+" : unreadNotifications}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  active && styles.activeLabel,
                  item.prominent && styles.prominentLabel,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  navigationRow: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  navigationItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 12,
  },

  pressed: {
    opacity: 0.65,
  },

  iconSlot: {
    width: iconSizes.nav + 16,
    height: iconSizes.nav + 8,
    alignItems: "center",
    justifyContent: "center",
  },

  badge: {
    position: "absolute",
    top: 0,
    right: 2,
    minWidth: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
  },

  badgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: colors.surface,
  },

  prominentButton: {
    width: 44,
    height: 44,
    marginTop: -18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.royal[700],
    shadowColor: colors.navy[900],
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 5,
  },

  label: {
    maxWidth: "100%",
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  activeLabel: {
    color: colors.royal[700],
  },

  prominentLabel: {
    color: colors.royal[700],
  },
});
