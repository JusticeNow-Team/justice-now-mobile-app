import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getActiveCategories, ReportCategory } from "../../categories";
import { ChoiceCard, Notice } from "../../components/common";
import { colors } from "../../theme";
import ReportStepLayout from "./ReportStepLayout";
import { useReport } from "./ReportContext";
import { validateReportStep } from "./validation";

export default function StepCategoryScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useReport();
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function loadActiveCategories() {
      try {
        const active = await getActiveCategories();
        if (isMounted) {
          setCategories(active);
        }
      } catch (err) {
        console.error("Failed to load active categories:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadActiveCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggle = (identifier: string) => {
    const selected = draft.categories.includes(identifier);
    updateDraft({
      categories: selected
        ? draft.categories.filter((item) => item !== identifier)
        : [...draft.categories, identifier],
    });
    setError("");
  };

  return (
    <ReportStepLayout
      step={2}
      title="What kind of incident are you reporting?"
      intro="Choose everything that applies. Only active categories can be selected. Your officer can adjust this later."
      error={error}
      onContinue={() => {
        const message = validateReportStep(2, draft);
        if (message) {
          setError(message);
          return;
        }
        router.push("/reporter/report/details");
      }}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.royal[600]} />
          <Text style={styles.loadingText}>Loading report categories...</Text>
        </View>
      ) : (
        <View style={styles.stack}>
          {categories.map((category) => (
            <ChoiceCard
              key={category.id}
              multi
              title={`${category.icon ? `${category.icon} ` : ""}${category.name}`}
              description={category.hint || category.description}
              selected={
                draft.categories.includes(category.code) ||
                draft.categories.includes(category.id)
              }
              onPress={() => toggle(category.code)}
            />
          ))}
        </View>
      )}
      <View style={styles.notice}>
        <Notice tone="info">
          Categories help route your case to an officer with the right
          experience. They are never shown to anyone outside JusticeNow.
        </Notice>
      </View>
    </ReportStepLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  notice: {
    marginTop: 16,
  },
});
