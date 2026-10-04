import React, { ComponentType } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CircleX,
  ClipboardCheck,
  Clock,
  Download,
  EyeOff,
  FileSearch,
  FileText,
  FileUp,
  Filter,
  Flag,
  FolderOpen,
  Globe,
  History,
  House,
  IdCard,
  Image,
  Info,
  Key,
  Languages,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  Mic,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  TestTube,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  UserCog,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react-native";

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

type LucideComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

const ICONS_MAP: Record<AppIconName, LucideComponent> = {
  activity: Activity,
  "alert-circle": CircleAlert,
  "alert-triangle": TriangleAlert,
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight,
  balance: Scale,
  bell: Bell,
  calendar: Calendar,
  category: Tags,
  check: Check,
  "check-circle": CircleCheck,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  circle: Circle,
  "circle-check": CircleCheck,
  "circle-help": CircleHelp,
  "circle-x": CircleX,
  "clipboard-check": ClipboardCheck,
  clock: Clock,
  document: FileText,
  download: Download,
  edit: Pencil,
  "eye-off": EyeOff,
  "file-search": FileSearch,
  "file-text": FileText,
  "file-up": FileUp,
  filter: Filter,
  flag: Flag,
  "folder-open": FolderOpen,
  globe: Globe,
  history: History,
  house: House,
  "id-card": IdCard,
  image: Image,
  info: Info,
  key: Key,
  languages: Languages,
  "layout-dashboard": LayoutDashboard,
  "list-checks": ListChecks,
  lock: Lock,
  "log-out": LogOut,
  mail: Mail,
  "message-square": MessageSquare,
  mic: Mic,
  "notebook-pen": NotebookPen,
  plus: Plus,
  "refresh-cw": RefreshCw,
  roles: UserCog,
  scale: Scale,
  search: FileSearch,
  settings: Settings,
  shield: Shield,
  "shield-alert": ShieldAlert,
  "shield-check": ShieldCheck,
  sliders: SlidersHorizontal,
  "test-tube": TestTube,
  trash: Trash2,
  upload: Upload,
  user: User,
  "user-plus": UserPlus,
  users: Users,
  video: Video,
  warning: TriangleAlert,
  x: X,
};

export function isAppIconName(value: string): value is AppIconName {
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
  strokeWidth = 2,
  style,
}: AppIconProps) {
  const Icon = ICONS_MAP[name];

  return (
    <View
      accessibilityRole="image"
      style={[styles.container, { width: size, height: size }, style]}
    >
      <Icon color={color} size={size} strokeWidth={strokeWidth} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
