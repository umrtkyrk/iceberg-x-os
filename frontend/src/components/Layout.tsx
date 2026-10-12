import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, LogOut, LayoutDashboard, Users, Rocket, Award, FolderOpen, Calendar, Shield, KeyRound, GraduationCap, Send, ChevronDown, Trophy, ShieldCheck, BookOpen, Crown, Radar as RadarIcon, Mountain } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { UserAvatar } from './UserAvatar';
import { AvatarUploadModal } from './AvatarUploadModal';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdminOrMentor = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [recognitionOpen, setRecognitionOpen] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setAdminDropdownOpen(false);
        setRecognitionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLinkActive = (path: string) => {
    if (location.pathname === path) return true;
    if (path === '/admin/documents' && location.pathname === '/admin/nda') return true;
    return false;
  };

  const getMainLinks = () => {
    return [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/directory', label: 'Directory', icon: Users },
      { path: '/missions', label: 'Missions', icon: Rocket },
      { path: '/fundamentals', label: 'Fundamentals', icon: BookOpen },
      { path: '/meetings', label: 'Meetings', icon: Calendar },
      { path: '/badges', label: 'Badges', icon: Award },
      { path: '/quests', label: 'Quests', icon: Trophy },
      { path: '/vault', label: 'Vault', icon: FolderOpen },
    ];
  };

  // Recognition lives in one dropdown so the header stays readable.
  const getRecognitionLinks = () => [
    { path: '/mvcubes', label: 'MVCubes', icon: Crown },
    { path: '/hall-of-fame', label: 'Hall of Fame', icon: Mountain }
  ];

  const getAdminLinks = () => {
    const list = [
      { path: '/radar', label: 'Radar', icon: RadarIcon },
      { path: '/teams', label: 'Teams', icon: Shield },
      { path: '/demodays', label: 'Demo Days', icon: Calendar },
      { path: '/offboarding', label: 'Offboarding', icon: GraduationCap },
      { path: '/admin/documents', label: 'Document Tracking', icon: ShieldCheck },
      { path: '/notifications', label: 'Broadcast', icon: Send },
    ];
    if (user.role === 'ADMIN') {
      list.push({ path: '/admin/users', label: 'Users Admin', icon: Users });
      list.push({ path: '/admin/quests', label: 'Quests Admin', icon: Trophy });
    }
    return list;
  };

  const links = [...getMainLinks(), ...getRecognitionLinks(), ...(isAdminOrMentor ? getAdminLinks() : [])];

  return (
    <div className="min-h-screen bg-slate-50 text-dark flex flex-col font-sans">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm no-print">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 min-h-20">
            <div className="flex items-center min-w-0">
              <Link to="/" className="flex items-center hover:opacity-90 transition-opacity" title="Iceberg X OS">
                <img src="/images/xicon.jpg" alt="Iceberg X" className="w-16 h-16 rounded-[1.35rem] object-cover shadow-xl shadow-black/10 border border-gray-100 shrink-0" />
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center justify-center gap-1.5 min-w-0" ref={adminDropdownRef}>
              {getMainLinks().map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold leading-none whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? 'bg-magenta text-white shadow-md shadow-magenta/20'
                        : 'text-gray-600 hover:text-magenta hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              {/* Recognition dropdown: MVCubes and the Hall of Fame */}
              <div className="relative">
                <button
                  onClick={() => {
                    setRecognitionOpen(!recognitionOpen);
                    setAdminDropdownOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold leading-none whitespace-nowrap transition-all duration-200 ${
                    recognitionOpen || getRecognitionLinks().some(l => isLinkActive(l.path))
                      ? 'bg-magenta text-white shadow-md shadow-magenta/20'
                      : 'text-gray-600 hover:text-magenta hover:bg-gray-50'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>Recognition</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {recognitionOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 animate-fadeIn">
                    {getRecognitionLinks().map((link) => {
                      const Icon = link.icon;
                      const isActive = isLinkActive(link.path);
                      return (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setRecognitionOpen(false)}
                          className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                            isActive ? 'text-magenta bg-magenta/5' : 'text-gray-600 hover:text-magenta hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Administration Dropdown (Mentors & Admins only) */}
              {isAdminOrMentor && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setAdminDropdownOpen(!adminDropdownOpen);
                      setRecognitionOpen(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold leading-none whitespace-nowrap transition-all duration-200 ${
                      adminDropdownOpen || getAdminLinks().some(l => isLinkActive(l.path))
                        ? 'bg-gray-800 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Manage</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {adminDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-50 animate-fadeIn">
                      {getAdminLinks().map((link) => {
                        const Icon = link.icon;
                        const isActive = isLinkActive(link.path);
                        return (
                          <Link
                            key={link.path}
                            to={link.path}
                            onClick={() => setAdminDropdownOpen(false)}
                            className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold transition-colors ${
                              isActive
                                ? 'text-magenta bg-magenta/5'
                                : 'text-gray-600 hover:text-magenta hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{link.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right-side User Actions */}
            <div className="hidden lg:flex items-center justify-end gap-2.5 min-w-0">
              {user.role === 'CUBE' && user.cubeProfileId ? (
                <Link to={`/cubes/${user.cubeProfileId}`} className="flex items-center gap-2.5 min-w-0 hover:opacity-85 group">
                  <div className="text-right min-w-0 max-w-[160px]">
                    <p className="text-xs font-bold leading-tight text-gray-900 truncate group-hover:text-magenta transition-colors">{user.name}</p>
                    <p className="text-[10px] text-magenta font-bold tracking-wider uppercase">{user.role}</p>
                  </div>
                  <UserAvatar name={user.name} avatarUrl={user.avatarUrl || user.avatar_url} size="sm" />
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="text-right min-w-0 max-w-[160px]">
                    <p className="text-xs font-bold leading-tight text-gray-900 truncate">{user.name}</p>
                    <p className="text-[10px] text-magenta font-bold tracking-wider uppercase">{user.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAvatarModalOpen(true)}
                    title="Click to update profile photo"
                    className="focus:outline-none group rounded-full"
                  >
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl || user.avatar_url} size="sm" className="group-hover:ring-2 group-hover:ring-magenta/40 transition" />
                  </button>
                </div>
              )}
              <NotificationBell />
              <Link
                to="/change-password"
                className="p-1.5 text-gray-400 hover:text-magenta hover:bg-gray-50 rounded-full transition-colors duration-200"
                title="Change password"
              >
                <KeyRound className="w-4 h-4" />
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-magenta hover:bg-gray-50 rounded-full transition-colors duration-200"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center justify-end lg:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-500 hover:text-magenta hover:bg-gray-50 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-gray-100 px-4 pt-2 pb-4 space-y-1 shadow-inner animate-fadeIn">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = isLinkActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-magenta text-white'
                      : 'text-gray-600 hover:text-magenta hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              {user.role === 'CUBE' && user.cubeProfileId ? (
                <Link
                  to={`/cubes/${user.cubeProfileId}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 hover:opacity-80 group animate-fadeIn"
                >
                  <UserAvatar name={user.name} avatarUrl={user.avatarUrl || user.avatar_url} size="sm" />
                  <div>
                    <p className="text-sm font-bold group-hover:text-magenta transition-colors">{user.name}</p>
                    <p className="text-xs text-magenta font-semibold tracking-wider uppercase">{user.role}</p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setAvatarModalOpen(true);
                    }}
                    title="Click to update profile photo"
                    className="focus:outline-none"
                  >
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl || user.avatar_url} size="sm" />
                  </button>
                  <div>
                    <p className="text-sm font-bold">{user.name}</p>
                    <p className="text-xs text-magenta font-semibold tracking-wider uppercase">{user.role}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Link
                  to="/change-password"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 text-gray-500 hover:text-magenta hover:bg-magenta/5 border border-gray-100 rounded-xl text-sm font-semibold transition-all duration-200"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Password</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 text-gray-500 hover:text-magenta hover:bg-magenta/5 border border-gray-100 rounded-xl text-sm font-semibold transition-all duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
