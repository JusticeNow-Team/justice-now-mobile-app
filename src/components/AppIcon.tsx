import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";
import * as lucide from "lucide-react-native";

const LUCIDE_ICONS = lucide as Record<string, React.ComponentType<any> | undefined>;

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
  activity: "^",
  "alert-circle": "!",
  "alert-triangle": "!",
  "arrow-right": ">",
  "arrow-up-right": "/",
  balance: "=",
  bell: "!",
  category: "#",
  check: "v",
  "check-circle": "v",
  "chevron-down": "v",
  "chevron-left": "<",
  "chevron-right": ">",
  circle: "o",
  "circle-check": "v",
  "circle-help": "?",
  "circle-x": "x",
  "clipboard-check": "v",
  clock: "t",
  document: "D",
  download: "v",
  "eye-off": "-",
  "file-search": "F",
  "file-text": "F",
  "file-up": "^",
  filter: "f",
  flag: "F",
  "folder-open": "O",
  globe: "G",
  history: "H",
  house: "H",
  "id-card": "ID",
  image: "I",
  info: "i",
  key: "K",
  languages: "L",
  "layout-dashboard": "D",
  "list-checks": "L",
  lock: "L",
  "log-out": ">",
  mail: "@",
  "message-square": "M",
  mic: "m",
  "notebook-pen": "N",
  plus: "+",
  "refresh-cw": "R",
  roles: "R",
  scale: "=",
  search: "S",
  settings: "*",
  shield: "S",
  "shield-alert": "!",
  "shield-check": "v",
  sliders: "=",
  "test-tube": "T",
  upload: "^",
  user: "U",
  "user-plus": "+",
  users: "U",
  video: "V",
  warning: "!",
  x: "x",
};

const LUCIDE_NAME_MAP: Partial<Record<AppIconName, string>> = {
  activity: "Activity",
  "alert-circle": "AlertCircle",
  "alert-triangle": "TriangleAlert",
  "arrow-right": "ArrowRight",
  "arrow-up-right": "ArrowUpRight",
  balance: "Scale",
  bell: "Bell",
  category: "Tags",
  check: "Check",
  "check-circle": "BadgeCheck",
  "chevron-down": "ChevronDown",
  "chevron-left": "ChevronLeft",
  "chevron-right": "ChevronRight",
  circle: "Circle",
  "circle-check": "BadgeCheck",
  "circle-help": "CircleHelp",
  "circle-x": "CircleX",
  "clipboard-check": "ClipboardCheck",
  clock: "AlarmClock",
  document: "FileText",
  download: "Download",
  "eye-off": "EyeOff",
  "file-search": "FileSearch",
  "file-text": "FileText",
  "file-up": "FileUp",
  filter: "Filter",
  flag: "Flag",
  "folder-open": "FolderOpen",
  globe: "Globe",
  history: "History",
  house: "House",
  "id-card": "IdCard",
  image: "ImageIcon",
  info: "Info",
  key: "KeyRound",
  languages: "Languages",
  "layout-dashboard": "LayoutDashboard",
  "list-checks": "ListChecks",
  lock: "Lock",
  "log-out": "LogOut",
  mail: "Mail",
  "message-square": "MessageSquare",
  mic: "Mic",
  "notebook-pen": "NotebookPen",
  plus: "Plus",
  "refresh-cw": "RefreshCw",
  roles: "UserCog",
  scale: "Scale",
  search: "Search",
  settings: "Settings",
  shield: "Shield",
  "shield-alert": "ShieldAlert",
  "shield-check": "ShieldCheck",
  sliders: "SlidersHorizontal",
  "test-tube": "TestTubeDiagonal",
  upload: "Upload",
  user: "User",
  "user-plus": "UserPlus",
  users: "Users",
  video: "Video",
  warning: "TriangleAlert",
  x: "X",
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
  strokeWidth = 2,
  style,
  ...props
}: AppIconProps) {
  const glyph = ICON_GLYPHS[name] || "•";

  const lucideName = LUCIDE_NAME_MAP[name];
  const Component = lucideName ? LUCIDE_ICONS[lucideName] : null;
  if (Component) {
    return (
      <Component
        color={color}
        size={size}
        strokeWidth={strokeWidth}
        style={style}
        {...props}
      />
    );
  }

  const glyph = ICON_GLYPHS[name] || "?";

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
          fontSize: Math.max(10, Math.round(size * 0.7)),
          fontWeight: "700",
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
