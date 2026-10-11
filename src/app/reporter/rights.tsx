import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon, AppIconName } from "../../components/AppIcon";
import { colors, iconSizes } from "../../theme";

type RightsItem = {
  title: string;
  body: string;
  icon: AppIconName;
  tone: "royal" | "teal" | "gold";
};

const rightsItems: RightsItem[] = [
  {
    title: "Dignity and equal treatment",
    body: "You can report unfair treatment, discrimination, harassment or abuse by a public or private actor.",
    icon: "users",
    tone: "teal",
  },
  {
    title: "Safety from violence",
    body: "If there is immediate danger, use emergency services first. JusticeNow can keep a case record for follow-up.",
    icon: "shield-alert",
    tone: "royal",
  },
  {
    title: "Liberty and lawful process",
    body: "If someone is detained or threatened without clear legal process, note the place, time and people involved.",
    icon: "scale",
    tone: "gold",
  },
  {
    title: "Privacy when reporting",
    body: "Share only what is safe. You can withhold sensitive location or identity details in the full report flow.",
    icon: "lock",
    tone: "teal",
  },
];

const quickSteps = [
  "Move to a safer place before writing details.",
  "Record the date, time, location and names you know.",
  "Keep screenshots, photos or documents unchanged.",
  "Use instant reporting when a full form is too slow.",
];

function toneStyles(tone: RightsItem["tone"]) {
  if (tone === "gold") {
    return {
      wrap: styles.iconGold,
      color: colors.gold[500],
    };
  }

  if (tone === "teal") {
    return {
      wrap: styles.iconTeal,
      color: colors.teal[800],
    };
  }

  return {
    wrap: styles.iconRoyal,
    color: colors.royal[700],
  };
}

export default function KnowYourRightsScreen() {
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
          <Text style={styles.title}>Know Your Rights</Text>
          <Text style={styles.subtitle}>Simple guidance before you report</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.introText}>
            This page is general guidance, not legal advice. For urgent risk, contact emergency
            services or a qualified support organisation.
          </Text>
        </View>

        {rightsItems.map((item) => {
          const tone = toneStyles(item.tone);

          return (
            <View key={item.title} style={styles.card}>
              <View style={[styles.iconWrap, tone.wrap]}>
                <AppIcon name={item.icon} size={iconSizes.lg} color={tone.color} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardText}>{item.body}</Text>
              </View>
            </View>
          );
        })}

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>Before you submit</Text>
          {quickSteps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
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
  intro: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.teal[100],
    backgroundColor: colors.teal[50],
  },
  introText: {
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
  iconRoyal: {
    backgroundColor: colors.royal[50],
  },
  iconTeal: {
    backgroundColor: colors.teal[50],
  },
  iconGold: {
    backgroundColor: colors.gold[50],
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: "500",
    color: colors.navy[800],
  },
  cardText: {
    marginTop: 5,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  stepsCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepsTitle: {
    fontSize: 14.5,
    fontWeight: "500",
    color: colors.navy[800],
  },
  stepRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    overflow: "hidden",
    borderRadius: 11,
    textAlign: "center",
    lineHeight: 22,
    fontSize: 12,
    color: colors.royal[700],
    backgroundColor: colors.royal[50],
  },
  stepText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textSecondary,
  },
});
