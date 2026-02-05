import { useNavigate } from 'react-router-dom';
import { PlayerAvatar } from './PlayerAvatar';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PlayerLinkProps {
  player: Pick<Player, 'id' | 'full_name' | 'avatar_url'>;
  showAvatar?: boolean;
  className?: string;
  avatarClassName?: string;
  children?: React.ReactNode;
  isSelf?: boolean;
}

export function PlayerLink({ player, showAvatar = false, className, avatarClassName, children, isSelf }: PlayerLinkProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigate(`/player/${player.id}`); }}
      className={cn('inline-flex items-center gap-2 hover:text-primary transition-colors text-left', className)}
    >
      {showAvatar && <PlayerAvatar player={player} className={avatarClassName} />}
      {children || (
        <span className="font-semibold truncate">
          {player.full_name}
          {isSelf && <span className="text-primary ml-1">(you)</span>}
        </span>
      )}
    </button>
  );
}
