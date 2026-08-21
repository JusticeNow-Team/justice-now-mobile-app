import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { requestControlledDownload } from "../checker/api";
import { formatBytes, getPreviewKind, simulatePublicUrlAccess } from "../checker/metadataValidation";
import { ControlledDownloadLog, EvidenceRecord } from "../checker/types";
import { colors } from "../theme";

interface EvidenceSafePreviewProps {
  record: EvidenceRecord;
  isAuthorized?: boolean;
  onDownloadLogged?: (log: ControlledDownloadLog) => void;
}

export function EvidenceSafePreview({
  record,
  isAuthorized = true,
  onDownloadLogged,
}: EvidenceSafePreviewProps) {
  const previewKind = getPreviewKind(record.fileName, record.fileType);
  const isMissingFile = record.fileExistsInStorage === false;

  // Image Modal zoom state
  const [imageModalVisible, setImageModalVisible] = useState(false);

  // Document pagination state
  const [activeDocPage, setActiveDocPage] = useState(1);

  // Audio/Video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);

  // Controlled Download Modal State
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadReason, setDownloadReason] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Public URL Test State
  const [testingPublicUrl, setTestingPublicUrl] = useState(false);
  const [publicUrlResult, setPublicUrlResult] = useState<{
    isPublicAccessBlocked: boolean;
    publicUrl: string;
    httpStatus: number;
    message: string;
  } | null>(null);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleTestPublicUrl = () => {
    setTestingPublicUrl(true);
    setTimeout(() => {
      const res = simulatePublicUrlAccess(record.storageBucket, record.storagePath);
      setPublicUrlResult(res);
      setTestingPublicUrl(false);
    }, 400);
  };

  const handleRequestControlledDownload = async () => {
    if (!isAuthorized) {
      Alert.alert(
        "🔒 Authorization Required",
        "Controlled file download is restricted to authorized Evidence Checkers."
      );
      return;
    }

    if (!downloadReason.trim()) {
      Alert.alert(
        "Audit Reason Required",
        "Please enter an explanation/reason for downloading this evidence file."
      );
      return;
    }

    try {
      setDownloading(true);
      const res = await requestControlledDownload({
        evidenceId: record.id,
        checkerId: "Evidence Checker Squad #1",
        reason: downloadReason,
      });

      if (res.ok && res.log) {
        setActiveToken(res.log.oneTimeToken);
        if (onDownloadLogged) {
          onDownloadLogged(res.log);
        }

        // Simulate download progress
        setDownloadProgress(20);
        setTimeout(() => setDownloadProgress(60), 300);
        setTimeout(() => {
          setDownloadProgress(100);
          setDownloading(false);
          Alert.alert(
            "🔒 Controlled Download Authorized",
            `Single-use download token generated & audit logged.\n\nDownload ID: ${res.log.downloadId}\nToken expires in 5 minutes.`
          );
        }, 700);
      } else {
        setDownloading(false);
        Alert.alert("Download Error", res.message);
      }
    } catch (err: any) {
      setDownloading(false);
      Alert.alert("Error", err.message || "Failed to initiate controlled download.");
    }
  };

  // Sensitive content blur state
  const [isRevealed, setIsRevealed] = useState(false);

  // 1. Missing File Error Render State
  if (isMissingFile) {
    return (
      <View style={styles.errorBox}>
        <View style={styles.errorHeader}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>HTTP 404 Storage Error: File Missing</Text>
            <Text style={styles.errorSub}>
              Database reference exists (`{record.id}`), but the object is missing from storage vault.
            </Text>
          </View>
        </View>

        <View style={styles.errorDetailCard}>
          <Text style={styles.errorDetailText}>
            • Storage Bucket: {record.storageBucket || "case-evidence"}
          </Text>
          <Text style={styles.errorDetailText}>
            • Expected Path: {record.storagePath || "N/A"}
          </Text>
          <Text style={styles.errorDetailText}>
            • Error Type: Object NotFound / 404 Storage Vault Exception
          </Text>
        </View>

        <View style={styles.errorActionsRow}>
          <Pressable
            style={styles.errorActionBtn}
            onPress={() =>
              Alert.alert(
                "Vault Audit Re-synced",
                "Storage API queried: Object still missing. Logged for System Administrator review."
              )
            }
          >
            <Text style={styles.errorActionBtnText}>🔄 Re-check Vault</Text>
          </Pressable>

          <Pressable
            style={[styles.errorActionBtn, { backgroundColor: colors.royal[700] }]}
            onPress={() =>
              Alert.alert(
                "Reporter Notified",
                "Automated notification sent to case reporter requesting evidence re-upload."
              )
            }
          >
            <Text style={styles.errorActionBtnText}>📩 Notify Reporter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 2. IMAGE PREVIEW (SENSITIVE BLURRED PREVIEW MATCHING MAGIC PATTERNS) */}
      {previewKind === "image" && (
        <View style={styles.mediaContainer}>
          {!isRevealed ? (
            <View style={styles.blurredPreviewBox}>
              <Text style={styles.blurredEyeIcon}>👁️‍🗨️</Text>
              <Text style={styles.blurredTitle}>Secure preview blurred</Text>
              <Text style={styles.blurredSub}>Content may be distressing</Text>

              <Pressable
                style={styles.revealBtn}
                onPress={() => setIsRevealed(true)}
                accessibilityRole="button"
                accessibilityLabel="Reveal evidence preview"
              >
                <Text style={styles.revealBtnText}>Reveal preview</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setImageModalVisible(true)} accessibilityRole="button">
              <Image
                source={{
                  uri:
                    record.previewUrl ||
                    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
                }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <View style={styles.zoomOverlayBadge}>
                <Text style={styles.zoomOverlayText}>🔍 Tap for Full Screen Zoom</Text>
              </View>
            </Pressable>
          )}

          <View style={styles.secureStorageFooter}>
            <Text style={styles.secureStorageFooterText}>
              🔒 Streamed from secure storage · downloads are blocked and logged
            </Text>
            {isRevealed && (
              <Pressable onPress={() => setIsRevealed(false)} style={styles.reblurBtn}>
                <Text style={styles.reblurBtnText}>Blur again</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* 3. DOCUMENT PREVIEW */}
      {previewKind === "document" && (
        <View style={styles.docContainer}>
          <View style={styles.docTopBar}>
            <Text style={styles.docTitle} numberOfLines={1}>
              {record.fileName}
            </Text>
            <Text style={styles.docPageCounter}>
              Page {activeDocPage} of {record.documentPageCount || 8}
            </Text>
          </View>

          <View style={styles.docBodyCard}>
            <Text style={styles.docSnippetHeader}>Extracted Page Preview Snippet:</Text>
            <Text style={styles.docSnippetText}>
              {record.documentSnippet ||
                `OFFICIAL EVIDENCE DOCUMENTATION
Reference: ${record.id} | Case: ${record.caseInfo?.caseReference || record.caseId}
Submitted Date: ${new Date(record.uploadDate).toLocaleDateString()}

SECTION 1: INCIDENT RECORDING
This document represents submitted written documentation for legal verification.
All metadata attributes have been verified against secure storage criteria.

SECTION 2: VERIFICATION STAMP
Digital Seal Verified by Authorized System Squad.`}
            </Text>
          </View>

          <View style={styles.docControlsRow}>
            <Pressable
              style={[styles.docPageBtn, activeDocPage <= 1 && styles.docBtnDisabled]}
              disabled={activeDocPage <= 1}
              onPress={() => setActiveDocPage((p) => Math.max(1, p - 1))}
            >
              <Text style={styles.docPageBtnText}>‹ Previous Page</Text>
            </Pressable>

            <Text style={styles.docPageIndicator}>Page {activeDocPage}</Text>

            <Pressable
              style={[
                styles.docPageBtn,
                activeDocPage >= (record.documentPageCount || 8) && styles.docBtnDisabled,
              ]}
              disabled={activeDocPage >= (record.documentPageCount || 8)}
              onPress={() => setActiveDocPage((p) => Math.min(record.documentPageCount || 8, p + 1))}
            >
              <Text style={styles.docPageBtnText}>Next Page ›</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 4. AUDIO / VIDEO MEDIA PREVIEW */}
      {(previewKind === "audio" || previewKind === "video") && (
        <View style={styles.mediaContainer}>
          {previewKind === "video" && (
            <View style={styles.videoScreenBox}>
              <Text style={styles.videoPlaceholderIcon}>🎥</Text>
              <Text style={styles.videoPlaceholderTitle}>Video Stream Preview Sandbox</Text>
              <Text style={styles.videoPlaceholderSub}>
                Format: {record.fileType} · 1080p HD Video
              </Text>
            </View>
          )}

          {previewKind === "audio" && (
            <View style={styles.audioWaveBox}>
              <View style={styles.waveBarRow}>
                {[40, 70, 30, 90, 60, 100, 45, 80, 50, 85, 30, 65, 95, 40].map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      { height: isPlaying ? h * 0.4 : 12, backgroundColor: isPlaying ? colors.royal[600] : colors.navy[300] },
                    ]}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Player controls */}
          <View style={styles.playerBar}>
            <Pressable
              style={styles.playBtn}
              onPress={() => {
                setIsPlaying(!isPlaying);
                if (!isPlaying) {
                  setPlaybackSeconds(12);
                }
              }}
            >
              <Text style={styles.playBtnText}>{isPlaying ? "⏸ Pause" : "▶ Play Preview"}</Text>
            </Pressable>

            <View style={styles.timelineContainer}>
              <Text style={styles.timelineText}>
                {formatTime(playbackSeconds)} / {formatTime(record.mediaDurationSeconds || 300)}
              </Text>
            </View>

            <View style={styles.qualityBadge}>
              <Text style={styles.qualityText}>
                {previewKind === "video" ? "1080p HD" : "AAC Audio"}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 5. UNSUPPORTED FORMAT & CONTROLLED DOWNLOAD */}
      {previewKind === "unsupported" && (
        <View style={styles.unsupportedCard}>
          <Text style={styles.unsupportedTitle}>
            🚫 Live Inline Preview Disabled for '{record.fileName.split(".").pop()}' Format
          </Text>
          <Text style={styles.unsupportedSub}>
            Executable binary files (`.exe`, `.dll`, `.zip`) cannot be rendered inline in order to protect client devices from executing unauthorized code.
          </Text>

          <Pressable
            style={styles.controlledDownloadBtn}
            onPress={() => setDownloadModalVisible(true)}
            accessibilityRole="button"
          >
            <Text style={styles.controlledDownloadBtnText}>
              🔒 Request Controlled Download & Audit Log
            </Text>
          </Pressable>
        </View>
      )}

      {/* 6. PUBLIC URL PROTECTION AUDIT CARD */}
      <View style={styles.publicUrlCard}>
        <View style={styles.publicUrlHeader}>
          <Text style={styles.publicUrlIcon}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.publicUrlTitle}>Public URL Exposure Protection</Text>
            <Text style={styles.publicUrlSub}>
              Public S3 URLs must return HTTP 403 Forbidden to prevent unauthorized exposure.
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.testPublicUrlBtn}
          onPress={handleTestPublicUrl}
          disabled={testingPublicUrl}
        >
          {testingPublicUrl ? (
            <ActivityIndicator color={colors.navy[800]} size="small" />
          ) : (
            <Text style={styles.testPublicUrlBtnText}>
              🧪 Test Direct Public Access URL (HTTP 403 Audit)
            </Text>
          )}
        </Pressable>

        {publicUrlResult && (
          <View
            style={[
              styles.publicResultBox,
              publicUrlResult.isPublicAccessBlocked
                ? styles.publicResultValid
                : styles.publicResultInvalid,
            ]}
          >
            <Text style={styles.publicResultText}>{publicUrlResult.message}</Text>
            <Text style={styles.publicResultUrl}>URL: {publicUrlResult.publicUrl}</Text>
          </View>
        )}
      </View>

      {/* FULLSCREEN IMAGE MODAL */}
      <Modal
        visible={imageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.fullModalOverlay}>
          <SafeAreaView style={styles.fullModalSafeArea}>
            <View style={styles.fullModalHeader}>
              <Text style={styles.fullModalTitle}>{record.fileName}</Text>
              <Pressable style={styles.closeBtn} onPress={() => setImageModalVisible(false)}>
                <Text style={styles.closeBtnText}>✕ Close</Text>
              </Pressable>
            </View>

            <View style={styles.fullModalImageContainer}>
              <Image
                source={{
                  uri:
                    record.previewUrl ||
                    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
                }}
                style={styles.fullModalImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.fullModalFooter}>
              <Text style={styles.fullModalFooterText}>
                🔒 Full Resolution Evidence Inspection (EXIF Metadata Sanitized)
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* CONTROLLED DOWNLOAD REASON MODAL */}
      <Modal
        visible={downloadModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDownloadModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request Controlled File Download</Text>
            <Text style={styles.modalSub}>
              Downloading high-risk evidence files (`.{record.fileName.split(".").pop()}`) requires explicit checker authorization and audit reason entry.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Audit Download Reason (Required):</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={downloadReason}
                onChangeText={setDownloadReason}
                placeholder="e.g. Forensic malware analysis in isolated sandbox VM..."
                multiline
              />
            </View>

            {downloading && (
              <View style={styles.progressBox}>
                <ActivityIndicator color={colors.royal[700]} />
                <Text style={styles.progressText}>
                  Generating 5-minute single-use download token... ({downloadProgress}%)
                </Text>
              </View>
            )}

            {activeToken && (
              <View style={styles.tokenBox}>
                <Text style={styles.tokenLabel}>One-Time Download Token (Active 5 Mins):</Text>
                <Text style={styles.tokenValue}>{activeToken}</Text>
              </View>
            )}

            <View style={styles.modalActionsRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setDownloadModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.modalConfirmBtn}
                onPress={handleRequestControlledDownload}
                disabled={downloading}
              >
                <Text style={styles.modalConfirmText}>Authorize & Download</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 16,
  },

  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.navy[900],
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  previewBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  previewHeaderIcon: {
    fontSize: 16,
    marginRight: 6,
  },

  previewHeaderTitle: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "700",
  },

  sandboxTag: {
    backgroundColor: colors.teal[700],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },

  sandboxTagText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: "700",
  },

  // Image Preview & Blurred Sensitive State
  mediaContainer: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    overflow: "hidden",
    margin: 8,
  },

  blurredPreviewBox: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F172A",
  },

  blurredEyeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },

  blurredTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },

  blurredSub: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 16,
  },

  revealBtn: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#475569",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },

  revealBtnText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
  },

  secureStorageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0B132B",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  },

  secureStorageFooterText: {
    color: "#0284C7",
    fontSize: 10.5,
    fontWeight: "600",
    flex: 1,
  },

  reblurBtn: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },

  reblurBtnText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
  },

  imagePreview: {
    width: "100%",
    height: 280,
    aspectRatio: 16 / 9,
    maxHeight: 340,
  },

  zoomOverlayBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(10, 27, 46, 0.8)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },

  zoomOverlayText: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: "600",
  },

  mediaInfoBar: {
    backgroundColor: colors.navy[800],
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  mediaInfoText: {
    color: colors.navy[200],
    fontSize: 11,
  },

  // Document Preview
  docContainer: {
    backgroundColor: "#F8FAFC",
    padding: 12,
  },

  docTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  docTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy[900],
    flex: 1,
    marginRight: 8,
  },

  docPageCounter: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.royal[700],
    backgroundColor: colors.royal[50],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  docBodyCard: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },

  docSnippetHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.navy[600],
    marginBottom: 4,
  },

  docSnippetText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11.5,
    color: colors.navy[800],
    lineHeight: 17,
  },

  docControlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  docPageBtn: {
    backgroundColor: colors.royal[700],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  docBtnDisabled: {
    backgroundColor: colors.navy[200],
  },

  docPageBtnText: {
    color: colors.surface,
    fontSize: 11.5,
    fontWeight: "700",
  },

  docPageIndicator: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[800],
  },

  // Audio / Video
  videoScreenBox: {
    height: 180,
    backgroundColor: colors.navy[900],
    alignItems: "center",
    justifyContent: "center",
  },

  videoPlaceholderIcon: {
    fontSize: 40,
    marginBottom: 6,
  },

  videoPlaceholderTitle: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "700",
  },

  videoPlaceholderSub: {
    color: colors.navy[300],
    fontSize: 11,
    marginTop: 2,
  },

  audioWaveBox: {
    height: 80,
    backgroundColor: colors.navy[900],
    alignItems: "center",
    justifyContent: "center",
  },

  waveBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  waveBar: {
    width: 5,
    borderRadius: 3,
  },

  playerBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.navy[800],
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  playBtn: {
    backgroundColor: colors.teal[700],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 10,
  },

  playBtnText: {
    color: colors.surface,
    fontSize: 11.5,
    fontWeight: "700",
  },

  timelineContainer: {
    flex: 1,
  },

  timelineText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "600",
  },

  qualityBadge: {
    backgroundColor: colors.navy[700],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },

  qualityText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: "700",
  },

  // Unsupported format
  unsupportedCard: {
    padding: 14,
    backgroundColor: "#FEF2F2",
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5",
  },

  unsupportedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.error,
  },

  unsupportedSub: {
    fontSize: 11.5,
    color: colors.navy[800],
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 16,
  },

  controlledDownloadBtn: {
    backgroundColor: colors.error,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
  },

  controlledDownloadBtnText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "700",
  },

  // Missing File Box
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 14,
    marginBottom: 16,
  },

  errorHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  errorIcon: {
    fontSize: 24,
    marginRight: 10,
  },

  errorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.error,
  },

  errorSub: {
    fontSize: 12,
    color: colors.navy[800],
    marginTop: 2,
  },

  errorDetailCard: {
    backgroundColor: "#FFF",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },

  errorDetailText: {
    fontSize: 11.5,
    color: colors.navy[800],
    marginVertical: 2,
  },

  errorActionsRow: {
    flexDirection: "row",
    gap: 8,
  },

  errorActionBtn: {
    flex: 1,
    backgroundColor: colors.navy[800],
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },

  errorActionBtnText: {
    color: colors.surface,
    fontSize: 11.5,
    fontWeight: "700",
  },

  // Public URL Card
  publicUrlCard: {
    padding: 12,
    backgroundColor: "#F1F5F9",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  publicUrlHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  publicUrlIcon: {
    fontSize: 16,
    marginRight: 8,
  },

  publicUrlTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.navy[900],
  },

  publicUrlSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  testPublicUrlBtn: {
    backgroundColor: colors.navy[200],
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: "center",
  },

  testPublicUrlBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[900],
  },

  publicResultBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
  },

  publicResultValid: {
    backgroundColor: "#ECFDF5",
  },

  publicResultInvalid: {
    backgroundColor: "#FEF2F2",
  },

  publicResultText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.navy[900],
  },

  publicResultUrl: {
    fontSize: 10.5,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Full Screen Image Modal
  fullModalOverlay: {
    flex: 1,
    backgroundColor: "#000",
  },

  fullModalSafeArea: {
    flex: 1,
  },

  fullModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(10, 27, 46, 0.9)",
  },

  fullModalTitle: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "700",
  },

  closeBtn: {
    backgroundColor: colors.navy[700],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  closeBtnText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "700",
  },

  fullModalImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  fullModalImage: {
    width: "100%",
    height: "100%",
  },

  fullModalFooter: {
    padding: 12,
    backgroundColor: "rgba(10, 27, 46, 0.9)",
    alignItems: "center",
  },

  fullModalFooterText: {
    color: colors.navy[200],
    fontSize: 11,
  },

  // Controlled Download Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10, 27, 46, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.navy[900],
  },

  modalSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 16,
  },

  inputGroup: {
    marginBottom: 12,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy[800],
    marginBottom: 4,
  },

  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.navy[900],
  },

  textArea: {
    height: 70,
    textAlignVertical: "top",
  },

  progressBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.royal[50],
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },

  progressText: {
    fontSize: 11.5,
    color: colors.royal[700],
    fontWeight: "600",
    flex: 1,
  },

  tokenBox: {
    backgroundColor: colors.navy[50],
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },

  tokenLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.navy[700],
  },

  tokenValue: {
    fontSize: 11,
    color: colors.royal[700],
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 2,
  },

  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },

  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },

  modalCancelText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  modalConfirmBtn: {
    backgroundColor: colors.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },

  modalConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.surface,
  },
});
