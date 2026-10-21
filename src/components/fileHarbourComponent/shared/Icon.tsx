import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Cloud,
  CloudDownload,
  Copy,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image,
  Info,
  ListChecks,
  LogOut,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  SquareCheck,
  Timer,
  Trash2,
  TriangleAlert,
  Upload,
  Video,
  X,
  type LucideIcon,
} from "lucide-react-native";

// The one entry point to lucide (CLAUDE.md §6). Keys use the lucide names from Design.pen.
// Add an icon here when a frame needs it.
const icons = {
  "arrow-down-to-line": ArrowDownToLine,
  "arrow-left": ArrowLeft,
  check: Check,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "circle-plus": CirclePlus,
  cloud: Cloud,
  "cloud-download": CloudDownload,
  copy: Copy,
  download: Download,
  ellipsis: Ellipsis,
  eye: Eye,
  "eye-off": EyeOff,
  "file-text": FileText,
  folder: Folder,
  "folder-open": FolderOpen,
  "folder-plus": FolderPlus,
  image: Image,
  info: Info,
  "list-checks": ListChecks,
  "log-out": LogOut,
  pause: Pause,
  play: Play,
  plus: Plus,
  "rotate-ccw": RotateCcw,
  search: Search,
  "share-2": Share2,
  "shield-check": ShieldCheck,
  "square-check": SquareCheck,
  timer: Timer,
  "trash-2": Trash2,
  "triangle-alert": TriangleAlert,
  upload: Upload,
  video: Video,
  x: X,
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
