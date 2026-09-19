import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

export type AppIconName =
  | "activity"
  | "alert-circle"
  | "alert-triangle"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up-right"
  | "balance"
  | "bell"
  | "calendar"
  | "category"
  | "check"
  | "check-circle"
  | "chevron-down"
  | "chevron-left"
  | "chevron-right"
  | "circle"
  | "circle-check"
  | "circle-help"
  | "circle-x"
  | "clipboard-check"
  | "clock"
  | "document"
  | "download"
  | "edit"
  | "eye-off"
  | "file-search"
  | "file-text"
  | "file-up"
  | "filter"
  | "flag"
  | "folder-open"
  | "globe"
  | "history"
  | "house"
  | "id-card"
  | "image"
  | "info"
  | "key"
  | "languages"
  | "layout-dashboard"
  | "list-checks"
  | "lock"
  | "log-out"
  | "mail"
  | "message-square"
  | "mic"
  | "notebook-pen"
  | "plus"
  | "refresh-cw"
  | "roles"
  | "scale"
  | "search"
  | "settings"
  | "shield"
  | "shield-alert"
  | "shield-check"
  | "sliders"
  | "test-tube"
  | "trash"
  | "upload"
  | "user"
  | "user-plus"
  | "users"
  | "video"
  | "warning"
  | "x";

const ICON_FALLBACK_GLYPHS: Record<AppIconName, string> = {
  activity: "⚡",
  "alert-circle": "ⓘ",
  "alert-triangle": "⚠️",
  "arrow-right": "➔",
  "arrow-up-right": "↗",
  balance: "⚖",
  bell: "🔔",
  calendar: "📅",
  category: "🏷",
  check: "✓",
  "check-circle": "✅",
  "chevron-down": "⌄",
const ICONS_MAP: Record<AppIconName, string> = {
  activity: "📈",
  "alert-circle": "⚠️",
  "alert-triangle": "⚠️",
  "arrow-left": "←",
  "arrow-right": "→",
  "arrow-up-right": "↗",
  balance: "⚖️",
  bell: "🔔",
  calendar: "📅",
  category: "🏷️",
  check: "✓",
  "check-circle": "✅",
  "chevron-down": "▼",
  "chevron-left": "‹",
  "chevron-right": "›",
  circle: "○",
  "circle-check": "✅",
  "circle-help": "❓",
  "circle-x": "✕",
  "clipboard-check": "📋",
  clock: "🕒",
  document: "📄",
  download: "📥",
  edit: "✏️",
  "eye-off": "👁️",
  "file-search": "🔍",
  "file-text": "📄",
  "file-up": "📤",
  filter: "🔍",
  flag: "🚩",
  "folder-open": "📁",
  globe: "🌐",
  history: "⏱️",
  house: "🏠",
  "id-card": "🪪",
  image: "🖼️",
  info: "ℹ️",
  key: "🔑",
  languages: "🌐",
  "layout-dashboard": "▦",
  "list-checks": "☑️",
  lock: "🔒",
  "log-out": "🚪",
  mail: "✉️",
  "message-square": "💬",
  mic: "🎙️",
  "notebook-pen": "📝",
  plus: "+",
  "refresh-cw": "🔄",
  roles: "👥",
  scale: "⚖️",
  search: "🔍",
  settings: "⚙️",
  shield: "🛡️",
  "shield-alert": "🛡️",
  "shield-check": "🛡️",
  sliders: "🎛️",
  "test-tube": "🧪",
  trash: "🗑️",
  upload: "📤",
  user: "👤",
  "user-plus": "👤+",
  users: "👥",
  video: "📹",
  warning: "⚠️",
  x: "✕",
};

export function isAppIconName(value: string): value is AppIconName {
  return value in ICON_FALLBACK_GLYPHS;
  return value in ICONS_MAP;
}

export type AppIconProps = {
  name: AppIconName;
  color?: string;
  size?: number;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export function AppIcon({
  name,
  color = "#173458",
  size = 20,
  style,
  ...props
}: AppIconProps) {
  const glyph = ICON_FALLBACK_GLYPHS[name] || "•";
  const symbol = ICONS_MAP[name] || "•";
  const isAscii =
    name === "chevron-left" ||
    name === "chevron-right" ||
    name === "chevron-down" ||
    name === "arrow-right" ||
    name === "arrow-up-right" ||
    name === "check" ||
    name === "x" ||
    name === "plus" ||
    name === "layout-dashboard";

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size },
        style,
      ]}
      {...props}
    >
      <Text
        style={{
          color,
          fontSize: Math.max(10, Math.round(size * 0.75)),
          lineHeight: size,
          textAlign: "center",
          includeFontPadding: false,
        }}
      >
        {glyph}
    >
      <Text
        style={[
          styles.iconText,
          {
            fontSize: isAscii ? size * 0.95 : size * 0.82,
            lineHeight: size,
            color: color,
            fontWeight: isAscii ? "700" : "normal",
          },
        ]}
        accessibilityRole="image"
      >
        {symbol}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
