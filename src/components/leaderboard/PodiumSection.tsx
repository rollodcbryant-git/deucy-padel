import { useNavigate } from 'react-router-dom';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import type { Player } from '@/lib/types';

interface PodiumSectionProps {
  players: Player[];
  currentPlayerId: string;
}

export function PodiumSection({ players, currentPlayerId }: PodiumSectionProps) {
  const navigate = useNavigate();
  const top3 = players.slice(0, 3);

  if (top3.length === 0) return null;

  // Reorder: [#2, #1, #3] for podium layout
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2
      ? [top3[1], top3[0]]
      : [top3[0]];

  const podiumHeights = ['h-20', 'h-28', 'h-16'];
  const avatarSizes = ['h-14 w-14', 'h-18 w-18', 'h-12 w-12'];
  const rankLabels = ['#2', '#1', '#3'];
  const podiumColors = [
    'bg-muted/60 border-foreground/20',
    'bg-gradient-hot border-chaos-orange/40',
    'bg-muted/40 border-chaos-orange/10',
  ];

  const getConfig = (displayIndex: number, totalPlayers: number) => {
    if (totalPlayers === 1) {
      return { height: podiumHeights[1], avatar: 'h-18 w-18', rank: '#1', color: podiumColors[1], actualRank: 1 };
    }
    if (totalPlayers === 2) {
      return displayIndex === 0
        ? { height: podiumHeights[0], avatar: avatarSizes[0], rank: '#2', color: podiumColors[0], actualRank: 2 }
        : { height: podiumHeights[1], avatar: 'h-18 w-18', rank: '#1', color: podiumColors[1], actualRank: 1 };
    }
    return {
      height: podiumHeights[displayIndex],
      avatar: displayIndex === 1 ? 'h-18 w-18' : avatarSizes[displayIndex],
      rank: rankLabels[displayIndex],
      color: podiumColors[displayIndex],
      actualRank: displayIndex === 0 ? 2 : displayIndex === 1 ? 1 : 3,
    };
  };

  return (
    <div className="flex items-end justify-center gap-3 pt-4 pb-2">
      {podiumOrder.map((p, i) => {
        const config = getConfig(i, podiumOrder.length);
        const isCurrentPlayer = p.id === currentPlayerId;
        return (
          <button
            key={p.id}
            onClick={() => navigate(`/player/${p.id}`)}
            className="flex flex-col items-center gap-2 group"
          >
            {/* Avatar + name */}
            <div className="relative">
              <PlayerAvatar
                player={p}
                className={`${config.avatar} ${isCurrentPlayer ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
              />
              <span className={`absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold h-5 w-5 ${
                config.actualRank === 1 ? 'bg-chaos-orange text-background' :
                config.actualRank === 2 ? 'bg-foreground text-background' :
                'bg-chaos-orange/70 text-background'
              }`}>
                {config.rank}
              </span>
            </div>

            <p className={`text-xs font-semibold truncate max-w-[80px] ${isCurrentPlayer ? 'text-primary' : 'text-foreground'}`}>
              {p.full_name.split(' ')[0]}
            </p>

            {/* Podium bar */}
            <div className={`${config.height} w-20 rounded-t-lg border-t border-x flex flex-col items-center justify-start pt-2 ${config.color}`}>
              <CreditsDisplay amount={p.credits_balance} variant="compact" showIcon={false} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
