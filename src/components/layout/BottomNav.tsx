import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Trophy, Users, Gavel, Home, Calendar } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: '/home', label: 'Home', icon: <Home className="h-5 w-5" /> },
  { path: '/matches', label: 'Matches', icon: <Calendar className="h-5 w-5" /> },
  { path: '/leaderboard', label: 'Ranking', icon: <Trophy className="h-5 w-5" /> },
  { path: '/auction', label: 'Auction', icon: <Gavel className="h-5 w-5" /> },
  { path: '/players', label: 'Players', icon: <Users className="h-5 w-5" /> },
];

interface BottomNavProps {
  showAuction?: boolean;
}

export function BottomNav({ showAuction = false }: BottomNavProps) {
  const location = useLocation();

  const visibleItems = navItems.filter((item) => {
    if (item.showWhen === 'auction') return showAuction;
    if (item.showWhen === 'no-auction') return !showAuction;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
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
