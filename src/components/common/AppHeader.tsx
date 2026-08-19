import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

export default function AppHeader({
  title,
  subtitle,
  onBack,
}: AppHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.backPressed,
        ]}
      >
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <View style={styles.headerText}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: {
    backgroundColor: colors.navy[50],
  },
  backIcon: {
    fontSize: 28,
    lineHeight: 32,
    color: colors.navy[700],
    marginTop: -2,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
    color: colors.navy[800],
  },
  subtitle: {
    marginTop: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
