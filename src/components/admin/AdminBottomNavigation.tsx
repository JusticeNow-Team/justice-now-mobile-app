import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../../theme";
import { AppIcon } from "../AppIcon";

const ITEMS = [
  { label: "Dashboard", icon: "layout-dashboard", route: "/admin" },
  { label: "Users", icon: "users", route: "/admin/staff" },
  { label: "Activity", icon: "activity", route: "/admin/audit" },
  { label: "Alerts", icon: "shield-alert", route: "/admin/alerts" },
  { label: "Settings", icon: "settings", route: "/admin/settings" },
] as const;

const MAIN_ROUTES = [
  "/admin",
  "/admin/",
  "/admin/staff",
  "/admin/audit",
  "/admin/alerts",
  "/admin/settings",
];

export default function AdminBottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!MAIN_ROUTES.includes(pathname)) {
    return null;
  }

  const activeRoute = pathname === "/admin/" ? "/admin" : pathname;

  return (
    <View
      style={[styles.navigation, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      {ITEMS.map((item) => {
        const active = activeRoute === item.route;

        return (
          <Pressable
            key={item.route}
            style={styles.item}
            onPress={() => router.replace(item.route as any)}
          >
            <AppIcon
              name={item.icon}
              size={20}
              color={active ? colors.royal[700] : colors.textSecondary}
            />

            <Text style={[styles.label, active && styles.activeLabel]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    flexDirection: "row",
    paddingTop: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  item: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  activeLabel: {
    color: colors.royal[700],
  },
});
