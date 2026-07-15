// <!-- AGENT: FRONTEND -->
import {
  CalendarDays,
  CircleUserRound,
  Code2,
  GitBranch,
  LayoutDashboard,
  LayoutList,
  Network,
  Settings,
  Users,
} from 'lucide-react';

export const primaryNav = [
  { label: 'Overview', shortLabel: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'People', shortLabel: 'People', href: '/people', icon: Users },
  { label: 'Lists', shortLabel: 'Lists', href: '/lists', icon: LayoutList },
  { label: 'Workflows', shortLabel: 'Flow', href: '/workflows', icon: GitBranch },
  { label: 'Events', shortLabel: 'Events', href: '/events', icon: CalendarDays },
];

export const administrationNav = [
  { label: 'Developer', shortLabel: 'Dev', href: '/developer', icon: Code2 },
  { label: 'Settings', shortLabel: 'Settings', href: '/settings', icon: Settings },
];

export const platformNavItem = {
  label: 'Platform',
  shortLabel: 'Platform',
  href: '/platform',
  icon: Network,
};

export const accountNavItem = {
  label: 'Account',
  shortLabel: 'Account',
  href: '#account',
  icon: CircleUserRound,
};

export type AdminNavItem = (typeof primaryNav)[number];
