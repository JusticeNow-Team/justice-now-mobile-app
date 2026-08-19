import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTextInput, Notice } from "../../components/common";
import { colors } from "../../theme";
import { CATEGORY_ACCEPT, FILE_LIMIT_HINT } from "./constants";
import { EvidenceCategory, EvidenceUploadStatus, PendingEvidenceFile } from "./types";
import { formatEvidenceBytes } from "./validation";

const CATEGORIES = Object.entries(CATEGORY_ACCEPT) as [
  EvidenceCategory,
  (typeof CATEGORY_ACCEPT)[EvidenceCategory],
][];

interface EvidenceUploadPanelProps {
  files: PendingEvidenceFile[];
  statuses?: Record<string, EvidenceUploadStatus>;
  error?: string;
  picking?: boolean;
  onPick: (category: EvidenceCategory) => void;
  onRemove?: (localId: string) => void;
  onDescriptionChange: (localId: string, description: string) => void;
}

function statusCopy(status?: EvidenceUploadStatus) {
  if (status?.phase === "error") {
    return status.error || "Upload failed.";
  }

  if (status?.phase === "uploading") {
    return `Uploading… ${status.progress}%`;
  }

  if (status?.phase === "uploaded") {
    return "Uploaded securely";
  }

  return "Ready to upload with your report";
}

export default function EvidenceUploadPanel({
  files,
  statuses,
  error,
  picking,
  onPick,
  onRemove,
  onDescriptionChange,
}: EvidenceUploadPanelProps) {
  return (
    <View>
      <View style={styles.box}>
        <Text style={styles.icon}>⬆</Text>
        <Text style={styles.title}>Add a file</Text>
        <Text style={styles.copy}>{FILE_LIMIT_HINT}</Text>
        <View style={styles.grid}>
          {CATEGORIES.map(([id, item]) => (
            <Pressable
              key={id}
              onPress={() => onPick(id)}
              disabled={picking}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.label}`}
              style={({ pressed }) => [
                styles.source,
                pressed && styles.sourcePressed,
                picking && styles.sourceDisabled,
              ]}
            >
              <Text style={styles.sourceIcon}>{item.icon}</Text>
              <Text style={styles.sourceLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? (
        <View style={styles.notice}>
          <Notice tone="error" title="Unable to add this file">
            {error}
          </Notice>
        </View>
      ) : null}

      <Text style={styles.section}>Attached files ({files.length})</Text>

      {files.length === 0 ? (
        <Text style={styles.empty}>
          No files yet. You can continue without evidence, or add a photo,
          video, audio recording or document.
        </Text>
      ) : (
        files.map((file) => {
          const status = statuses?.[file.localId];
          const progress = status?.progress ?? (status?.phase === "uploaded" ? 100 : 0);
          const showBar = status?.phase === "uploading";
          const copy = statusCopy(status);
          const copyColor =
            status?.phase === "error"
              ? colors.errorStrong
              : status?.phase === "uploaded"
                ? colors.success
                : colors.info;

          return (
            <View key={file.localId} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.kind}>
                  <Text style={styles.kindText}>
                    {CATEGORY_ACCEPT[file.category].icon}
                  </Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text numberOfLines={1} style={styles.fileName}>
                      {file.fileName}
                    </Text>
                    {onRemove && status?.phase !== "uploaded" && status?.phase !== "uploading" ? (
                      <Pressable
                        onPress={() => onRemove(file.localId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${file.fileName}`}
                      >
                        <Text style={styles.remove}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.meta}>
                    {formatEvidenceBytes(file.sizeBytes)} ·{" "}
                    <Text style={[styles.metaStrong, { color: copyColor }]}>
                      {copy}
                    </Text>
                  </Text>
                  {showBar ? (
                    <View
                      style={styles.track}
                      accessibilityRole="progressbar"
                      accessibilityValue={{ min: 0, max: 100, now: progress }}
                    >
                      <View style={[styles.fill, { width: `${progress}%` }]} />
                    </View>
                  ) : null}
                  <AppTextInput
                    value={file.description}
                    onChangeText={(value) =>
                      onDescriptionChange(file.localId, value)
                    }
                    placeholder="Add a short description (optional)"
                    editable={status?.phase !== "uploading" && status?.phase !== "uploaded"}
                    style={styles.note}
                  />
                </View>
              </View>
            </View>
          );
        })
      )}

      <View style={styles.notice}>
        <Notice tone="privacy" title="Your files are protected">
          Files are encrypted on upload and reviewed only by authorised
          personnel. Location data inside files can be removed automatically if
          you report anonymously.
        </Notice>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.navy[200],
    backgroundColor: colors.surface,
  },
  icon: {
    fontSize: 22,
    color: colors.royal[700],
  },
  title: {
    marginTop: 8,
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  copy: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  grid: {
    marginTop: 12,
    width: "100%",
    flexDirection: "row",
    gap: 8,
  },
  source: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  sourcePressed: {
    borderColor: colors.royal[300],
    backgroundColor: colors.royal[50],
  },
  sourceDisabled: {
    opacity: 0.6,
  },
  sourceIcon: {
    fontSize: 16,
  },
  sourceLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: colors.navy[700],
  },
  notice: {
    marginTop: 16,
  },
  section: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  empty: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  card: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  kind: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.royal[50],
  },
  kindText: {
    fontSize: 16,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: colors.navy[800],
  },
  remove: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  meta: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  metaStrong: {
    fontWeight: "600",
  },
  track: {
    marginTop: 8,
    height: 6,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: colors.navy[100],
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.royal[600],
  },
  note: {
    marginTop: 8,
    minHeight: 40,
    paddingVertical: 8,
    fontSize: 12.5,
  },
});
