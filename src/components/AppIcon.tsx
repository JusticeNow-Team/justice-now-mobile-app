import type { StyleProp, ViewStyle } from "react-native";
import {
  AlarmClock,
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleHelp,
  CircleX,
  ClipboardCheck,
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
  ImageIcon,
  Info,
  KeyRound,
  Languages,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  LucideIcon,
  LucideProps,
  Mail,
  MessageSquare,
  Mic,
  NotebookPen,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  TestTubeDiagonal,
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

const ICONS: Record<AppIconName, LucideIcon> = {
  activity: Activity,
  "alert-circle": AlertCircle,
  "alert-triangle": TriangleAlert,
  "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight,
  balance: Scale,
  bell: Bell,
  category: Tags,
  check: Check,
  "check-circle": BadgeCheck,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  circle: Circle,
  "circle-check": BadgeCheck,
  "circle-help": CircleHelp,
  "circle-x": CircleX,
  "clipboard-check": ClipboardCheck,
  clock: AlarmClock,
  document: FileText,
  download: Download,
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
  image: ImageIcon,
  info: Info,
  key: KeyRound,
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
  search: Search,
  settings: Settings,
  shield: Shield,
  "shield-alert": ShieldAlert,
  "shield-check": ShieldCheck,
  sliders: SlidersHorizontal,
  "test-tube": TestTubeDiagonal,
  upload: Upload,
  user: User,
  "user-plus": UserPlus,
  users: Users,
  video: Video,
  warning: TriangleAlert,
  x: X,
};

export function isAppIconName(value: string): value is AppIconName {
  return value in ICONS;
}

type AppIconProps = Omit<LucideProps, "ref"> & {
  name: AppIconName;
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
  const Icon = ICONS[name];

  return (
    <Icon
      color={color}
      size={size}
      strokeWidth={strokeWidth}
      style={style}
      {...props}
    />
  );
}
