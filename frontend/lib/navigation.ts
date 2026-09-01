import {
  LayoutDashboard,
  Map,
  FolderKanban,
  Palette,
  BookMarked,
  Orbit,
  Bot,
  BrainCircuit,
  Sparkles,
  TrendingUp,
  Sprout,
  ListChecks,
  Lightbulb,
  FileText,
  Activity,
  Trash2,
  Settings,
  Home,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

/**
 * Shared by components/layout/Sidebar.tsx (desktop) and
 * components/layout/MobileNav.tsx (hamburger drawer) -- one
 * definition, so the two nav surfaces can never drift out of sync
 * with each other.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "MY SPACE",
    items: [
      {
        label: "Home",
        href: "/dashboard",
        icon: Home,
      },
      {
        label: "Focus Room",
        href: "/focus-room",
        icon: LayoutDashboard,
      },
      {
        label: "My Journey",
        href: "/journey",
        icon: Map,
      },
      {
        label: "Projects",
        href: "/projects",
        icon: FolderKanban,
      },
    ],
  },
  {
    title: "PROJECT WORKSPACE",
    items: [
      {
        label: "Project Orbit",
        href: "/project-orbit",
        icon: Orbit,
      },
      {
        label: "Concept Canvas",
        href: "/concept-canvas",
        icon: Palette,
      },
      {
        label: "Project Storybook",
        href: "/storybook",
        icon: BookMarked,
      },
    ],
  },
  {
    title: "AI MENTOR",
    items: [
      {
        label: "AI Mentor Desk",
        href: "/mentor",
        icon: Bot,
      },
      {
        label: "AI Agents",
        href: "/agents",
        icon: BrainCircuit,
      },
      {
        label: "Viva Studio",
        href: "/viva-studio",
        icon: Sparkles,
      },
    ],
  },
  {
    title: "GROWTH",
    items: [
      {
        label: "Progress",
        href: "/progress",
        icon: TrendingUp,
      },
      {
        label: "Garden of Growth",
        href: "/garden",
        icon: Sprout,
      },
      {
        label: "Skills",
        href: "/skills",
        icon: ListChecks,
      },
    ],
  },
  {
    title: "MORE",
    items: [
      {
        label: "Submit Idea",
        href: "/submit-idea",
        icon: Lightbulb,
      },
      {
        label: "Documents",
        href: "/documents",
        icon: FileText,
      },
      {
        label: "Faculty View",
        href: "/faculty",
        icon: Activity,
      },
      {
        label: "Trash",
        href: "/trash",
        icon: Trash2,
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];
