import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Player } from '@/lib/types';

interface PlayerAvatarProps {
  player: Pick<Player, 'full_name' | 'avatar_url'>;
  className?: string;
}

export function PlayerAvatar({ player, className }: PlayerAvatarProps) {
  const initials = player.full_name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Avatar className={cn('h-10 w-10', className)}>
      {player.avatar_url && (
        <AvatarImage src={player.avatar_url} alt={player.full_name} />
      )}
      <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-sm">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
