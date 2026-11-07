import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { FORUM_ENABLED } from '../config/features';
import { useAuth } from '../context/AuthContext';
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Users,
  Rocket,
  Award,
  FolderOpen,
  Calendar,
  Shield,
  KeyRound,
  GraduationCap,
  Send,
  ChevronDown,
  Trophy,
  ShieldCheck,
  BookOpen,
  Crown,
  Radar as RadarIcon,
  Mountain,
  Briefcase,
  TrendingUp,
  UserRound,
  Camera,
  MessagesSquare,
  type LucideIcon
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { UserAvatar } from './UserAvatar';
import { AvatarUploadModal } from './AvatarUploadModal';

interface NavItem {
  path: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

interface NavGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Plain list, or titled sections (used by the staff menu). */
  sections: { title?: string; items: NavItem[] }[];
}

/**
 * The header is grouped by what people are trying to do, so it stays at a
 * handful of entries however many pages the portal grows:
 *
 *   Dashboard · Work · Growth · Community · (Manage)
 */
const WORK: NavGroup = {
  key: 'work',
  label: 'Work',
  icon: Briefcase,
  sections: [
    {
      items: [
        { path: '/missions', label: 'Missions', hint: 'Browse, join and deliver missions', icon: Rocket },
        { path: '/meetings', label: 'Meetings', hint: 'Schedule and attendance', icon: Calendar },
        { path: '/vault', label: 'Vault', hint: 'Your documents and NDA', icon: FolderOpen }
      ]
    }
  ]
};

const GROWTH: NavGroup = {
  key: 'growth',
  label: 'Growth',
  icon: TrendingUp,
  sections: [
    {
      items: [
        { path: '/fundamentals', label: 'Fundamentals', hint: 'Learn, then take the quiz', icon: BookOpen },
        { path: '/quests', label: 'Quests', hint: 'Goals and your progress', icon: Trophy },
        { path: '/badges', label: 'Badges', hint: 'Earn them, collect them', icon: Award }
      ]
    }
  ]
};

const COMMUNITY: NavGroup = {
  key: 'community',
  label: 'Community',
  icon: Users,
  sections: [
    {
      items: [
        ...(FORUM_ENABLED ? [{ path: '/forum', label: 'Forum', hint: 'Cube community discussions', icon: MessagesSquare }] : []),
        { path: '/directory', label: 'Directory', hint: 'Everyone in the programme', icon: Users },
        { path: '/mvcubes', label: 'MVCubes', hint: 'The most valued each month', icon: Crown },
        { path: '/hall-of-fame', label: 'Hall of Fame', hint: 'The path to the summit', icon: Mountain }
      ]
    }
  ]
};

const buildManage = (isAdmin: boolean): NavGroup => ({
  key: 'manage',
  label: 'Manage',
  icon: Shield,
  sections: [
    {
      title: 'Programme',
      items: [
        { path: '/radar', label: 'Radar', hint: 'Hidden gems and growth signals', icon: RadarIcon },
        { path: '/teams', label: 'Teams', hint: 'Build and edit mission teams', icon: Shield },
        { path: '/demodays', label: 'Demo Days', hint: 'Plan and review demo days', icon: Calendar },
        { path: '/offboarding', label: 'Offboarding', hint: 'Certificates and exits', icon: GraduationCap }
      ]
    },
    {
      title: 'Operations',
      items: [
        { path: '/admin/documents', label: 'Document Tracking', hint: 'NDAs and Cube documents', icon: ShieldCheck },
        { path: '/notifications', label: 'Broadcast', hint: 'Message every Cube', icon: Send },
        ...(isAdmin
          ? [
              { path: '/admin/users', label: 'Users Admin', hint: 'Accounts and roles', icon: Users },
              { path: '/admin/quests', label: 'Quests Admin', hint: 'Create and assign quests', icon: Trophy }
            ]
          : [])
      ]
    }
  ]
});

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  /** Which header dropdown is open: a group key, 'user', or null. */
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click, Escape and navigation.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdminOrMentor = user.role === 'ADMIN' || user.role === 'MENTOR';
  const groups: NavGroup[] = [WORK, GROWTH, COMMUNITY, ...(isAdminOrMentor ? [buildManage(user.role === 'ADMIN')] : [])];

  const pathname = location.pathname;
  const isItemActive = (path: string) => {
    if (pathname === path || pathname.startsWith(`${path}/`)) return true;
    if (path === '/directory' && pathname.startsWith('/cubes/')) return true;
    if (path === '/admin/documents' && pathname === '/admin/nda') return true;
    if (path === '/missions' && pathname.startsWith('/submit-demo')) return true;
    return false;
  };
  const isGroupActive = (group: NavGroup) =>
    group.sections.some(section => section.items.some(item => isItemActive(item.path)));

  const avatarUrl = user.avatarUrl || user.avatar_url;
  const toggle = (key: string) => setOpenMenu(current => (current === key ? null : key));

  return (
    <div className="min-h-screen bg-slate-50 text-dark flex flex-col font-sans">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm no-print">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 min-h-20" ref={navRef}>
            <div className="flex items-center min-w-0">
              <Link to="/" className="flex items-center hover:opacity-90 transition-opacity" title="Iceberg X OS">
                <img src="/images/xicon.jpg" alt="Iceberg X" className="w-16 h-16 rounded-[1.35rem] object-cover shadow-xl shadow-black/10 border border-gray-100 shrink-0" />
              </Link>
            </div>

            {/* Desktop navigation */}
            <div className="hidden lg:flex items-center justify-center gap-1.5 min-w-0">
              <Link
                to="/dashboard"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold leading-none whitespace-nowrap transition-all duration-200 ${
                  pathname === '/dashboard'
                    ? 'bg-magenta text-white shadow-md shadow-magenta/20'
                    : 'text-gray-600 hover:text-magenta hover:bg-gray-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>

              {groups.map((group, index) => {
                const Icon = group.icon;
                const open = openMenu === group.key;
                const active = isGroupActive(group);
                const alignRight = index === groups.length - 1 && groups.length > 3;
                const isManage = group.key === 'manage';
                return (
                  <div key={group.key} className="relative">
                    <button
                      type="button"
                      onClick={() => toggle(group.key)}
                      aria-haspopup="menu"
                      aria-expanded={open}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold leading-none whitespace-nowrap transition-all duration-200 ${
                        open || active
                          ? isManage
                            ? 'bg-gray-800 text-white shadow-md'
                            : 'bg-magenta text-white shadow-md shadow-magenta/20'
                          : 'text-gray-600 hover:text-magenta hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{group.label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>

                    {open && (
                      <div
                        role="menu"
                        className={`absolute top-full mt-3 w-[19rem] rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl z-50 animate-fadeIn ${
                          alignRight ? 'right-0' : 'left-0'
                        }`}
                      >
                        {group.sections.map((section, i) => (
                          <div key={section.title || i} className={i > 0 ? 'mt-1 border-t border-gray-50 pt-1' : ''}>
                            {section.title && (
                              <p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400">
                                {section.title}
                              </p>
                            )}
                            {section.items.map(item => {
                              const ItemIcon = item.icon;
                              const itemActive = isItemActive(item.path);
                              return (
                                <Link
                                  key={item.path}
                                  to={item.path}
                                  role="menuitem"
                                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                                    itemActive ? 'bg-magenta/5' : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <span
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                      itemActive ? 'bg-magenta text-white' : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    <ItemIcon className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className={`block text-sm font-extrabold leading-tight ${itemActive ? 'text-magenta' : 'text-gray-900'}`}>
                                      {item.label}
                                    </span>
                                    <span className="block truncate text-[11px] font-medium text-gray-400">{item.hint}</span>
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right: notifications and the account menu */}
            <div className="hidden lg:flex items-center justify-end gap-2 min-w-0">
              <NotificationBell />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggle('user')}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === 'user'}
                  className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-gray-50"
                >
                  <UserAvatar name={user.name} avatarUrl={avatarUrl} size="sm" />
                  <span className="min-w-0 max-w-[140px] text-left">
                    <span className="block truncate text-xs font-bold leading-tight text-gray-900">{user.name}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-magenta">{user.role}</span>
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${openMenu === 'user' ? 'rotate-180' : ''}`} />
                </button>

                {openMenu === 'user' && (
                  <div role="menu" className="absolute right-0 top-full z-50 mt-3 w-60 animate-fadeIn rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl">
                    <div className="px-3 pb-2 pt-1.5">
                      <p className="truncate text-sm font-extrabold text-gray-900">{user.name}</p>
                      <p className="truncate text-[11px] font-medium text-gray-400">{user.email}</p>
                    </div>
                    <div className="border-t border-gray-50 pt-1">
                      {user.role === 'CUBE' && user.cubeProfileId ? (
                        <MenuLink to={`/cubes/${user.cubeProfileId}`} icon={UserRound}>My profile</MenuLink>
                      ) : (
                        <MenuButton
                          icon={Camera}
                          onClick={() => {
                            setOpenMenu(null);
                            setAvatarModalOpen(true);
                          }}
                        >
                          Update profile photo
                        </MenuButton>
                      )}
                      <MenuLink to="/change-password" icon={KeyRound}>Change password</MenuLink>
                      <MenuButton icon={LogOut} onClick={handleLogout}>Sign out</MenuButton>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center justify-end gap-1 lg:hidden">
              <NotificationBell />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Menu"
                aria-expanded={mobileMenuOpen}
                className="p-2 text-gray-500 hover:text-magenta hover:bg-gray-50 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation: grouped, scrollable */}
        {mobileMenuOpen && (
          <div className="lg:hidden max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain bg-white border-b border-gray-100 px-4 pt-2 pb-5 shadow-inner animate-fadeIn">
            <Link
              to="/dashboard"
              className={`mt-1 flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-all ${
                pathname === '/dashboard' ? 'bg-magenta text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            {groups.map(group => (
              <div key={group.key} className="mt-4">
                <p className="px-4 pb-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-400">{group.label}</p>
                {group.sections.flatMap(section => section.items).map(item => {
                  const Icon = item.icon;
                  const active = isItemActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-all ${
                        active ? 'bg-magenta text-white' : 'text-gray-600 hover:text-magenta hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              {user.role === 'CUBE' && user.cubeProfileId ? (
                <Link to={`/cubes/${user.cubeProfileId}`} className="flex min-w-0 items-center gap-2.5 hover:opacity-80">
                  <UserAvatar name={user.name} avatarUrl={avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{user.name}</span>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-magenta">{user.role}</span>
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAvatarModalOpen(true);
                  }}
                  title="Update profile photo"
                  className="flex min-w-0 items-center gap-2.5 text-left"
                >
                  <UserAvatar name={user.name} avatarUrl={avatarUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{user.name}</span>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-magenta">{user.role}</span>
                  </span>
                </button>
              )}
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  to="/change-password"
                  className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-500 transition-all hover:bg-magenta/5 hover:text-magenta"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Password</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-500 transition-all hover:bg-magenta/5 hover:text-magenta"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className={`workspace-content flex-1 w-full ${pathname === '/forum' ? 'flex flex-col' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#111111] text-white/60 border-t border-white/5 py-12 sm:py-16 no-print">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-8 lg:gap-12 items-center">
            <div className="flex flex-col gap-4">
              <div className="w-full max-w-[420px] h-[125px] sm:h-[155px] overflow-hidden rounded-2xl bg-[#171719]">
                <img src="/images/iceberg-x-logo-blackbg.png" alt="Iceberg X Logo" className="w-full h-full object-cover object-center block" />
              </div>
              <p className="text-[11px] text-white/45 font-semibold">© {new Date().getFullYear()} Iceberg Digital. All rights reserved.</p>
            </div>
            <div className="flex flex-col gap-4 lg:items-end lg:text-right">
              <p className="text-sm sm:text-base text-white/70 font-semibold max-w-[460px] leading-relaxed">
                Iceberg X OS connects Cubes, mentors, missions, badges and demo history across the whole programme.
              </p>
              <div className="flex items-center gap-3 text-[11px] font-bold tracking-widest uppercase text-white/75">
                <span className="text-magenta">▶</span>
                <span>ONCE A CUBE, ALWAYS A CUBE.</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <AvatarUploadModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
      />
    </div>
  );
};

const MenuLink: React.FC<{ to: string; icon: LucideIcon; children: React.ReactNode }> = ({ to, icon: Icon, children }) => (
  <Link
    to={to}
    role="menuitem"
    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 hover:text-magenta"
  >
    <Icon className="h-4 w-4 text-gray-400" />
    {children}
  </Link>
);

const MenuButton: React.FC<{ icon: LucideIcon; onClick: () => void; children: React.ReactNode }> = ({ icon: Icon, onClick, children }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 hover:text-magenta"
  >
    <Icon className="h-4 w-4 text-gray-400" />
    {children}
  </button>
);
