import { useRouter } from "expo-router";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, AppIconName } from "../../components/AppIcon";
import { colors, iconSizes } from "../../theme";

type SupportItem = {
  title: string;
  description: string;
  detail: string;
  icon: AppIconName;
  tone: "teal" | "gold" | "royal";
  actionLabel: string;
  action: string;
};

const supportItems: SupportItem[] = [
  {
    title: "Police emergency",
    description: "Use this when there is immediate danger or an urgent police response is needed.",
    detail: "119",
    icon: "shield-alert",
    tone: "royal",
    actionLabel: "Call 119",
    action: "tel:119",
  },
  {
    title: "Ambulance emergency",
    description: "Free pre-hospital emergency ambulance support available island-wide.",
    detail: "1990",
    icon: "activity",
    tone: "teal",
    actionLabel: "Call 1990",
    action: "tel:1990",
  },
  {
    title: "Human Rights Commission",
    description: "Make a human rights complaint in Sinhala, Tamil or English.",
    detail: "Hotline 1996",
    icon: "scale",
    tone: "gold",
    actionLabel: "Open complaint page",
    action: "https://www.hrcsl.lk/make-a-complaint/",
  },
  {
    title: "Legal Aid Commission",
    description: "Ask for legal aid guidance or find help through official legal aid services.",
    detail: "+94 70 365 5111",
    icon: "users",
    tone: "teal",
    actionLabel: "Call legal aid",
    action: "tel:+94703655111",
  },
];

function toneStyles(tone: SupportItem["tone"]) {
  if (tone === "gold") {
    return {
      wrap: styles.iconGold,
      color: colors.gold[500],
    };
  }

  if (tone === "royal") {
    return {
      wrap: styles.iconRoyal,
      color: colors.royal[700],
    };
  }

  return {
    wrap: styles.iconTeal,
    color: colors.teal[800],
  };
}

async function openAction(action: string) {
  const supported = await Linking.canOpenURL(action);

  if (!supported) {
    Alert.alert("Unable to open", "Your device cannot open this support option right now.");
    return;
  }

  await Linking.openURL(action);
}

export default function SupportServicesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
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
          <Text style={styles.title}>Support Services</Text>
          <Text style={styles.subtitle}>Legal, counselling and emergency support</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <AppIcon name="info" size={iconSizes.sm} color={colors.info} />
          <Text style={styles.noticeText}>
            If someone is in immediate danger, call the emergency service directly first.
          </Text>
        </View>

        {supportItems.map((item) => {
          const tone = toneStyles(item.tone);

          return (
            <View key={item.title} style={styles.card}>
              <View style={[styles.iconWrap, tone.wrap]}>
                <AppIcon name={item.icon} size={iconSizes.lg} color={tone.color} />
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
                <Text style={styles.detail}>{item.detail}</Text>

                <Pressable
                  onPress={() => void openAction(item.action)}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={item.actionLabel}
                >
                  <Text style={styles.actionText}>{item.actionLabel}</Text>
                  <AppIcon name="chevron-right" size={iconSizes.sm} color={colors.royal[700]} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
    paddingBottom: 28,
  },
  notice: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.royal[100],
    backgroundColor: colors.royal[50],
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  card: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  iconTeal: {
    backgroundColor: colors.teal[50],
  },
  iconGold: {
    backgroundColor: colors.gold[50],
  },
  iconRoyal: {
    backgroundColor: colors.royal[50],
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: "500",
    color: colors.navy[800],
  },
  cardDescription: {
    marginTop: 5,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  detail: {
    marginTop: 8,
    fontSize: 13,
    color: colors.navy[700],
  },
  actionButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.royal[700],
  },
});
