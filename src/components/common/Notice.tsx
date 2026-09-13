import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppIcon, AppIconName } from "../AppIcon";
import { colors } from "../../theme";

type NoticeTone = "privacy" | "info" | "caution" | "error" | "success" | "safety";

interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
}

const toneStyles: Record<
  NoticeTone,
  { box: object; icon: AppIconName; color: string }
> = {
  privacy: {
    box: {
      borderColor: colors.teal[100],
      backgroundColor: colors.teal[50],
    },
    icon: "lock",
    color: colors.teal[800],
  },
  info: {
    box: {
      borderColor: colors.royal[100],
      backgroundColor: colors.royal[50],
    },
    icon: "info",
    color: colors.info,
  },
  caution: {
    box: {
      borderColor: colors.gold[100],
      backgroundColor: colors.gold[50],
    },
    icon: "warning",
    color: colors.warning,
  },
  error: {
    box: {
      borderColor: "#F4C7C3",
      backgroundColor: "#FFF2F1",
    },
    icon: "warning",
    color: colors.errorStrong,
  },
  success: {
    box: {
      borderColor: "#B7E4D4",
      backgroundColor: "#EAF8F2",
    },
    icon: "check-circle",
    color: colors.success,
  },
  safety: {
    box: {
      borderColor: colors.navy[100],
      backgroundColor: colors.navy[50],
    },
    icon: "shield",
    color: colors.navy[700],
  },
};

export default function Notice({
  tone = "info",
  title,
  children,
}: NoticeProps) {
  const selected = toneStyles[tone];

  return (
    <View style={[styles.box, selected.box]}>
      <AppIcon name={selected.icon} size={14} color={selected.color} />
      <View style={styles.content}>
        {title ? (
          <Text style={[styles.title, { color: selected.color }]}>{title}</Text>
        ) : null}
        <Text style={[styles.body, { color: selected.color }]}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
  },
  body: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 18,
  },
});
