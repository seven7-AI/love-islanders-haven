import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, Heart, Bot, Flame, User, LogOut, Settings, Shield } from 'lucide-react';
import { useAuth } from '@/context/auth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/matches', label: 'Matches', icon: Heart },
  { to: '/ai-companion', label: 'Isla', icon: Bot },
  { to: '/streaks', label: 'Streaks', icon: Flame },
  { to: '/profile', label: 'Profile', icon: User },
  // Reachable from Profile on phones; listed here where there is room.
  { to: '/safety', label: 'Safety', icon: Shield, wideOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, wideOnly: true },
];

/** The app's only navigation bar: fixed at the bottom on every screen size. */
const AppNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not log out');
    }
  };

  const itemClass = (active: boolean) =>
    cn(
      'flex flex-col items-center p-2 rounded-md text-xs transition-colors',
      active ? 'text-purple-400' : 'text-gray-400 hover:text-white',
    );

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700 bg-slate-800/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-around py-1">
        {LINKS.map(({ to, label, icon: Icon, wideOnly }) => {
          const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(itemClass(active), wideOnly && 'hidden md:flex')}
            >
              <Icon size={22} aria-hidden />
              <span className="mt-1">{label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={handleLogout} className={itemClass(false)}>
          <LogOut size={22} aria-hidden />
          <span className="mt-1">Log out</span>
        </button>
      </div>
    </nav>
  );
};

export default AppNavigation;
