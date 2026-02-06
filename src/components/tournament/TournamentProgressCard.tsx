import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { ChevronDown, Trophy, List } from 'lucide-react';
import { ChevronDown, Trophy, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tournament, Player, Round } from '@/lib/types';

interface TournamentProgressCardProps {
  tournament: Tournament;
  player: Player;
  rounds: Round[];
  totalPlayers: number;
  playerRank: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export function TournamentProgressCard({
  tournament,
  player,
  rounds,
  totalPlayers,
  playerRank,
  isExpanded,
  onToggle,
}: TournamentProgressCardProps) {
  const navigate = useNavigate();
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
          <div className="flex items-center gap-2 text-xs ml-auto">
            <CreditsDisplay amount={player.credits_balance} variant="compact" showIcon={false} />
            <span className="text-muted-foreground">• #{playerRank}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground h-6 px-2"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/tournaments');
            }}
          >
            <List className="mr-1 h-3 w-3" /> All tournaments
          </Button>
          {!isExpanded && (
            <p className="text-[10px] text-muted-foreground/60">Tap to expand</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
