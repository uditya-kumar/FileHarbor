import {
  ArrowLeft,
  Cloud,
  Eye,
  EyeOff,
  FolderPlus,
  LogOut,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from "lucide-react-native";

// The one entry point to lucide (CLAUDE.md §6). Keys use the lucide names from Design.pen.
// Add an icon here when a frame needs it.
const icons = {
  "arrow-left": ArrowLeft,
  cloud: Cloud,
  eye: Eye,
  "eye-off": EyeOff,
  "folder-plus": FolderPlus,
  "log-out": LogOut,
  "shield-check": ShieldCheck,
  timer: Timer,
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
