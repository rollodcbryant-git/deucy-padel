import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Trophy, Gavel, Home, Calendar, User } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export function BottomNav() {
  const location = useLocation();
  const { player } = usePlayer();

  // Hide on login/join pages only
  const hiddenPaths = ['/login', '/join', '/admin'];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  const tournamentId = player?.tournament_id;

  const navItems: NavItem[] = [
    { path: '/', label: 'Home', icon: <Home className="h-5 w-5" /> },
    ...(tournamentId ? [
      { path: `/tournament/${tournamentId}/me`, label: 'My Game', icon: <User className="h-5 w-5" /> },
      { path: '/matches', label: 'Matches', icon: <Calendar className="h-5 w-5" /> },
      { path: '/leaderboard', label: 'Ranking', icon: <Trophy className="h-5 w-5" /> },
      { path: '/auction', label: 'Auction', icon: <Gavel className="h-5 w-5" /> },
    ] : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === '/' && location.pathname === '/lobby');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all touch-target',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn('transition-transform', isActive && 'scale-110')}>
                {item.icon}
              </div>
              <span className={cn('text-xs font-medium', isActive && 'text-primary')}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-0 w-8 h-1 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
