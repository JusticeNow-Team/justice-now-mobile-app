import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppIcon } from "../../components/AppIcon";
import { Notice, PrimaryButton } from "../../components/common";
import { colors } from "../../theme";
import { useReport } from "./ReportContext";
import { submitReporterCase } from "./submitReporterCase";
import { CaseDraft, initialCaseDraft } from "./types";

function formatLocalDate(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function formatLocalTime(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${hours}:${minutes}`;
}

function compact(parts: (string | null | undefined)[]) {
  return parts.filter(Boolean).join(", ");
}

export default function InstantReportScreen() {
  const router = useRouter();
  const { resetDraft, setSubmitted } = useReport();
  const [status, setStatus] = useState("Capturing your emergency location...");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(true);
  const hasStarted = useRef(false);

  const submitInstantReport = useCallback(async () => {
    setError("");
    setSubmitting(true);
    setStatus("Requesting location access...");

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setError(
          "Location access is needed so the emergency report can include where you are.",
        );
        return;
      }

      setStatus("Capturing coordinates...");

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.LocationAccuracy.High,
      });
      const capturedAt = new Date(position.timestamp || Date.now());
      const { latitude, longitude, accuracy } = position.coords;

      setStatus("Preparing report details...");

      let address: Location.LocationGeocodedAddress | null = null;

      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        address = addresses[0] ?? null;
      } catch {
        address = null;
      }

      const coordinates = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      const readableAddress =
        address?.formattedAddress ||
        compact([
          address?.name,
          address?.street,
          address?.district,
          address?.city,
          address?.region,
          address?.country,
        ]);
      const locationLine = readableAddress
        ? `${readableAddress} (${coordinates})`
        : coordinates;

      const draft: CaseDraft = {
        ...initialCaseDraft,
        reportingMode: "identified",
        isInstantReport: true,
        categories: ["other"],
        title: "Emergency instant report",
        description: [
          "Emergency instant report created from the reporter dashboard.",
          `Captured at: ${capturedAt.toLocaleString()}`,
          `Coordinates: ${coordinates}`,
          accuracy ? `Accuracy: approximately ${Math.round(accuracy)} meters` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        incidentDate: formatLocalDate(capturedAt),
        incidentTime: formatLocalTime(capturedAt),
        ongoing: "unsure",
        province: address?.region || "Unknown",
        district: address?.district || address?.subregion || address?.city || "Unknown",
        city: address?.city || "",
        specificLocation: locationLine,
        hideExactLocation: false,
        victimRelation: "self",
        hideIdentity: false,
        allowContact: true,
        discreetNotifications: true,
      };

      setStatus("Submitting urgent report...");

      const result = await submitReporterCase(draft);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      resetDraft();
      setSubmitted({
        id: result.id,
        caseReference: result.caseReference,
        submittedAt: result.submittedAt,
        reportingMode: draft.reportingMode,
        isInstantReport: true,
      });
      router.replace("/reporter/report/confirmation");
    } catch (submitError) {
      console.error("Instant report error:", submitError);
      setError("JusticeNow could not submit the instant report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [resetDraft, router, setSubmitted]);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;
    void submitInstantReport();
  }, [submitInstantReport]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <AppIcon
            name={error ? "alert-triangle" : "shield-alert"}
            size={34}
            color={error ? colors.errorStrong : colors.warning}
            strokeWidth={2.4}
          />
        </View>

        <Text style={styles.title}>
          {error ? "Instant report needs your attention" : "Sending instant report"}
        </Text>
        <Text style={styles.copy}>
          {error
            ? "Your report has not been submitted yet."
            : "Keep this screen open while JusticeNow captures location, date and time."}
        </Text>

        <View style={styles.notice}>
          {error ? (
            <Notice tone="caution" title="Unable to submit">
              {error}
            </Notice>
          ) : (
            <Notice tone="info" title="Emergency details">
              {status}
            </Notice>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        {error ? (
          <>
            <PrimaryButton
              title="Try instant report again"
              icon="refresh-cw"
              loading={submitting}
              onPress={submitInstantReport}
            />
            <PrimaryButton
              title="Use full report form"
              variant="outline"
              disabled={submitting}
              style={styles.secondaryAction}
              onPress={() => router.replace("/reporter/report/preference")}
            />
          </>
        ) : (
          <PrimaryButton title={status} loading disabled onPress={() => undefined} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold[50],
  },
  title: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800",
    color: colors.navy[800],
  },
  copy: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  notice: {
    width: "100%",
    marginTop: 20,
  },
  footer: {
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryAction: {
    marginTop: 0,
  },
});
