import {
  ArrowLeft,
  ChevronRight,
  CirclePlus,
  Cloud,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Info,
  LogOut,
  ShieldCheck,
  Timer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";

// The one entry point to lucide (CLAUDE.md §6). Keys use the lucide names from Design.pen.
// Add an icon here when a frame needs it.
const icons = {
  "arrow-left": ArrowLeft,
  "chevron-right": ChevronRight,
  "circle-plus": CirclePlus,
  cloud: Cloud,
  eye: Eye,
  "eye-off": EyeOff,
  "file-text": FileText,
  folder: Folder,
  "folder-open": FolderOpen,
  "folder-plus": FolderPlus,
  info: Info,
  "log-out": LogOut,
  "shield-check": ShieldCheck,
  timer: Timer,
  "triangle-alert": TriangleAlert,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

type Props = {
  name: IconName;
  size: number;
  color: string;
};

export function Icon({ name, size, color }: Props) {
  const Glyph = icons[name];
  return <Glyph size={size} color={color} />;
}
