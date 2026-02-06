import { Card, CardContent } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { formatEuros } from '@/lib/euros';
import { ChevronDown, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tournament, Player, Round } from '@/lib/types';

interface TournamentProgressCardProps {
  tournament: Tournament;
  player: Player;
  rounds: Round[];
  totalPlayers: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function TournamentProgressCard({
  tournament,
  player,
  rounds,
  totalPlayers,
  isExpanded,
  onToggle,
}: TournamentProgressCardProps) {
  const liveRound = rounds.find(r => r.status === 'Live');
  const completedCount = rounds.filter(r => r.status === 'Completed').length;
  const totalRounds = tournament.rounds_count || rounds.length;
  const currentRoundLabel = liveRound
    ? `Round ${liveRound.index} of ${totalRounds}`
    : completedCount === totalRounds
      ? 'All rounds complete'
      : `${completedCount} of ${totalRounds} played`;

  const statusVariant = tournament.status === 'Live' || tournament.status === 'AuctionLive'
    ? 'live' : tournament.status === 'Finished' ? 'ended' : 'neutral';

  return (
    <Card
      className="chaos-card cursor-pointer transition-all duration-200 hover:border-primary/30"
      onClick={onToggle}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary shrink-0" />
            <div>
              <h2 className="font-bold text-sm leading-tight">{tournament.name}</h2>
              {tournament.club_name && (
                <p className="text-xs text-muted-foreground">{tournament.club_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip variant={statusVariant} size="sm" pulse={statusVariant === 'live'}>
              {tournament.status}
            </StatusChip>
            <ChevronDown className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-180'
            )} />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>👥 {totalPlayers}/{tournament.max_players}</span>
          <span>📅 {currentRoundLabel}</span>
        </div>

        <div className="flex items-center justify-between">
          {liveRound?.end_at && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">⏳</span>
              <CountdownTimer targetDate={liveRound.end_at} variant="compact" className="text-xs" />
            </div>
          )}
          <div className="flex items-center gap-3 text-xs ml-auto">
            <span className="text-muted-foreground">
              #{getRank(player, totalPlayers)} • {formatEuros(player.credits_balance)}
            </span>
          </div>
        </div>

        {!isExpanded && (
          <p className="text-[10px] text-muted-foreground/60 text-center">Tap to expand</p>
        )}
      </CardContent>
    </Card>
  );
}

function getRank(player: Player, total: number): string {
  // We don't have full leaderboard data here, so show a simple indicator
  return `${player.match_wins}W-${player.match_losses}L`;
}
