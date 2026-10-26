import {
  Activity, BookOpenText, Bot, Brain, Briefcase, CalendarDays, FlaskConical, Gauge, LayoutDashboard, Moon, Search, Settings, Star, SunMedium, Bell, GraduationCap, Shield, UserRound,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Command Center", icon: LayoutDashboard },
      { href: "/workspace", label: "Daily Workspace", icon: SunMedium },
      { href: "/assistant", label: "Research Assistant", icon: Bot },
    ],
  },
  {
    label: "Invest",
    items: [
      { href: "/portfolio", label: "Portfolios", icon: Briefcase },
      { href: "/lab", label: "Investment Lab", icon: FlaskConical },
      { href: "/research", label: "Stock Research", icon: Search },
      { href: "/watchlists", label: "Watchlists & Alerts", icon: Star },
      { href: "/calendar", label: "Corporate Calendar", icon: CalendarDays },
      { href: "/shariah", label: "Shariah Center", icon: Moon },
    ],
  },
  {
    label: "Improve",
    items: [
      { href: "/journal", label: "Trade Journal", icon: BookOpenText },
      { href: "/behavior", label: "Behavior Studio", icon: Brain },
      { href: "/paper", label: "Paper Trading", icon: GraduationCap },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/account", label: "Account & Plans", icon: UserRound },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/admin", label: "Admin Preview", icon: Shield },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export const MOBILE_NAV = [
  { href: "/", label: "Home", icon: Gauge },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/lab", label: "Lab", icon: FlaskConical },
  { href: "/journal", label: "Journal", icon: Activity },
];
