import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

export type AppIconName =
  | "activity"
  | "alert-circle"
  | "alert-triangle"
  | "arrow-right"
  | "arrow-up-right"
  | "balance"
  | "bell"
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
  | "upload"
  | "user"
  | "user-plus"
  | "users"
  | "video"
  | "warning"
  | "x";

const ICON_GLYPHS: Record<AppIconName, string> = {
  activity: "⚡",
  "alert-circle": "ⓘ",
  "alert-triangle": "⚠️",
  "arrow-right": "➔",
  "arrow-up-right": "↗",
  balance: "⚖",
  bell: "🔔",
  category: "🏷",
  check: "✓",
  "check-circle": "✅",
  "chevron-down": "⌄",
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
  "eye-off": "🙈",
  "file-search": "🔍",
  "file-text": "📄",
  "file-up": "📤",
  filter: "🎛",
  flag: "🚩",
  "folder-open": "📁",
  globe: "🌐",
  history: "⏱",
  house: "🏠",
  "id-card": "🪪",
  image: "🖼",
  info: "ℹ",
  key: "🔑",
  languages: "🌐",
  "layout-dashboard": "📊",
  "list-checks": "☑",
  lock: "🔒",
  "log-out": "🚪",
  mail: "✉",
  "message-square": "💬",
  mic: "🎙",
  "notebook-pen": "📝",
  plus: "+",
  "refresh-cw": "🔄",
  roles: "⚙",
  scale: "⚖",
  search: "🔍",
  settings: "⚙",
  shield: "🛡",
  "shield-alert": "🛡",
  "shield-check": "🛡",
  sliders: "🎛",
  "test-tube": "🧪",
  upload: "📤",
  user: "👤",
  "user-plus": "👤+",
  users: "👥",
  video: "📹",
  warning: "⚠️",
  x: "✕",
};

export function isAppIconName(value: string): value is AppIconName {
  return value in ICON_GLYPHS;
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
  const glyph = ICON_GLYPHS[name] || "•";

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
      {...props}
    >
      <Text
        style={{
          color,
          fontSize: Math.round(size * 0.8),
          lineHeight: size,
          textAlign: "center",
          includeFontPadding: false,
        }}
      >
        {glyph}
      </Text>
    </View>
  );
}
