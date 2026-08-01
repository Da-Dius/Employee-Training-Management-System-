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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/trainings', label: 'Trainings', Icon: BookText },
  { to: '/employees', label: 'Employees', Icon: Users },
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
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
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
    `group relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
    }`;

  const mobileLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/90 backdrop-blur transition-shadow duration-200 ${scrolled ? 'border-slate-200 shadow-sm' : 'border-transparent'
        }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo lockup */}
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-blue-900/10">
            <GraduationCap className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <span className="hidden leading-tight sm:flex sm:flex-col">
            <span className="text-[15px] font-bold tracking-tight text-slate-900">HRCD</span>
            <span className="-mt-0.5 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
              Training Management
            </span>
          </span>
        </NavLink>

        {/* Desktop nav — active item gets a sliding underline */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={desktopLinkClass}>
              {({ isActive }) => (
                <>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  {label}
                  <span
                    className={`absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-blue-600 transition-transform duration-200 ${isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-40'
                      }`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Account menu */}
          <div className="relative hidden md:block" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                {initials(user?.name)}
              </span>
              <span className="max-w-[9rem] truncate">{user?.name || 'Account'}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              role="menu"
              className={`absolute right-0 mt-2 w-44 origin-top-right overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg transition-all duration-150 ${menuOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
                }`}
            >
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile panel — animated height/opacity instead of a hard toggle */}
      <div
        className={`grid overflow-hidden border-t border-slate-200 transition-[grid-template-rows,opacity] duration-200 ease-out md:hidden ${mobileOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
      >
        <div className="min-h-0">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">
              {initials(user?.name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{user?.name}</div>
              <div className="text-xs text-slate-500">Signed in</div>
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
          <div className="border-t border-slate-100 px-3 py-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium text-red-600 hover:bg-red-50"
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