import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  LayoutDashboard,
  BookText,
  FileBarChart2,
  Users,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as api from '../api/client';
import { subscribeNotificationRefresh } from '../notificationBus';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/trainings', label: 'Trainings', Icon: BookText },
  { to: '/reports', label: 'Reports', Icon: FileBarChart2 },
  { to: '/users', label: 'HR Users', Icon: Users },
];

function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  const loadNotifications = () => {
    api.listNotifications().then(setNotifications).catch(() => { });
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    const unsubscribe = subscribeNotificationRefresh(loadNotifications);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const handleNotificationClick = async (n) => {
    setNotifOpen(false);
    if (!n.read) {
      try {
        await api.markNotificationRead(n.id);
      } catch {
        // non-critical — the list will self-correct on next poll
      }
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // non-critical
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMobileOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const desktopLinkClass = ({ isActive }) =>
    `group relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-100'
    }`;

  const mobileLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-white'
    }`;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-[#0A0A0A] transition-shadow duration-200 ${scrolled ? 'border-zinc-800 shadow-lg shadow-black/10' : 'border-zinc-800/60'
        }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo lockup */}
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-black/20"
            style={{ background: 'linear-gradient(135deg, #ff0613, #930f00)' }}
          >
            <GraduationCap className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <span className="hidden leading-tight sm:flex sm:flex-col">
            <span className="text-[15px] font-bold tracking-tight text-white">HRCD</span>
            <span className="-mt-0.5 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
              Training Management
            </span>
          </span>
        </NavLink>

        {/* Desktop nav — active item gets a red underline */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={desktopLinkClass}>
              {({ isActive }) => (
                <>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {label}
                  <span
                    className={`absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full transition-transform duration-200 ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-40'
                      }`}
                    style={{ backgroundColor: '#ff0613' }}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={notifOpen}
              aria-label="Notifications"
              className="relative rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0A0A0A]" />
              )}
            </button>
            <div
              role="menu"
              className={`absolute right-0 mt-2 w-72 origin-top-right overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl transition-all duration-150 ${notifOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
                }`}
            >
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <div className="text-sm font-semibold text-zinc-900">Notifications</div>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs font-medium text-[#ff0613] hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-400">No new notifications.</div>
              ) : (
                <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => handleNotificationClick(n)}
                        className={`flex w-full items-start gap-2 px-4 py-3 text-left text-sm hover:bg-zinc-50 ${n.read ? 'text-zinc-500' : 'text-zinc-800'
                          }`}
                      >
                        {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff0613]" />}
                        <span className={n.read ? '' : 'font-medium'}>{n.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Account menu */}
          <div className="relative hidden md:block" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-1.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: '#ff0613' }}
              >
                {initials(user?.name)}
              </span>
              <span className="max-w-[9rem] truncate">{user?.name || 'Account'}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
              role="menu"
              className={`absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl transition-all duration-150 ${menuOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
                }`}
            >
              <div className="flex items-center gap-3 px-4 py-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: '#ff0613' }}
                >
                  {initials(user?.name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-900">{user?.name || 'Account'}</div>
                  <div className="truncate text-xs text-zinc-500">@{user?.username}</div>
                </div>
              </div>
              <div className="border-t border-zinc-100 py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  <LogOut className="h-4 w-4" strokeWidth={2} />
                  Sign out
                </button>
              </div>
            </div>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-800 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      <div
        className={`grid overflow-hidden border-t border-zinc-800 transition-[grid-template-rows,opacity] duration-200 ease-out md:hidden ${mobileOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
      >
        <div className="min-h-0 bg-[#0A0A0A]">
          <div className="flex items-center gap-3 px-4 py-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: '#ff0613' }}
            >
              {initials(user?.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{user?.name}</div>
              <div className="text-xs text-zinc-400">@{user?.username}</div>
            </div>
          </div>
          <nav className="flex flex-col gap-1 px-3 pb-2">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} className={mobileLinkClass} onClick={() => setMobileOpen(false)}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-zinc-800 px-3 py-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-red-400 hover:bg-red-950/40"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}