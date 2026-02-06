import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { Users } from 'lucide-react';
import type { Tournament, Round } from '@/lib/types';

type LobbyStatus = 'live' | 'filling' | 'finished' | 'coming_soon';

interface TournamentLobbyCardProps {
  tournament: Tournament;
  liveRound?: Round | null;
  playerCount: number;
  isEnrolled: boolean;
  isEnrolledElsewhere: boolean;
  enrolledTournamentName?: string;
  onJoin: () => void;
  onView: () => void;
}

function getLobbyStatus(tournament: Tournament): LobbyStatus {
  if (tournament.status === 'Live' || tournament.status === 'AuctionLive') return 'live';
  if (tournament.status === 'SignupOpen') return 'filling';
  if (tournament.status === 'Finished' || tournament.status === 'Closed') return 'finished';
  return 'coming_soon';
}

function getStatusChipProps(status: LobbyStatus): { variant: 'live' | 'warning' | 'success' | 'neutral'; label: string } {
  switch (status) {
    case 'live': return { variant: 'live', label: 'Live' };
    case 'filling': return { variant: 'warning', label: 'Filling' };
    case 'finished': return { variant: 'neutral', label: 'Finished' };
    case 'coming_soon': return { variant: 'neutral', label: 'Coming Soon' };
  }
}

export function TournamentLobbyCard({
  tournament,
  liveRound,
  playerCount,
  isEnrolled,
  isEnrolledElsewhere,
  enrolledTournamentName,
  onJoin,
  onView,
}: TournamentLobbyCardProps) {
  const lobbyStatus = getLobbyStatus(tournament);
  const chipProps = getStatusChipProps(lobbyStatus);
  const isFull = playerCount >= tournament.max_players;

  return (
    <Card className={`chaos-card transition-all ${isEnrolled ? 'border-primary/40 bg-primary/5' : ''}`}>
      <CardContent className="p-3 space-y-2">
        {/* Row 1: Name + Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm truncate">{tournament.name}</h3>
            {tournament.club_name && (
              <p className="text-[11px] text-muted-foreground truncate">{tournament.club_name}</p>
            )}
          </div>
          <StatusChip variant={chipProps.variant} size="sm" pulse={lobbyStatus === 'live'}>
            {chipProps.label}
          </StatusChip>
        </div>

        {/* Row 2: Capacity + Countdown + CTA */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {playerCount}/{tournament.max_players}
            </span>

            {lobbyStatus === 'live' && liveRound?.end_at && (
              <CountdownTimer targetDate={liveRound.end_at} variant="compact" className="text-xs" />
            )}
          </div>

          <div className="shrink-0">
            {isEnrolled ? (
              <Button size="sm" variant="outline" className="h-7 text-xs border-primary/30 text-primary" onClick={onView}>
                View
              </Button>
            ) : lobbyStatus === 'filling' && !isFull && !isEnrolledElsewhere ? (
              <Button size="sm" className="h-7 text-xs bg-gradient-primary hover:opacity-90" onClick={onJoin}>
                Join
              </Button>
            ) : lobbyStatus === 'filling' && isFull ? (
              <span className="text-xs text-muted-foreground font-medium">Full</span>
            ) : lobbyStatus === 'live' && !isEnrolled ? (
              <span className="text-[10px] text-muted-foreground">Live now</span>
            ) : null}
          </div>
        </div>

        {/* Enrolled elsewhere notice */}
        {isEnrolledElsewhere && lobbyStatus === 'filling' && !isFull && (
          <p className="text-[10px] text-muted-foreground/70">
            Already in {enrolledTournamentName}
          </p>
        )}

        {/* Enrolled highlight */}
        {isEnrolled && (
          <p className="text-[10px] text-primary/70 font-medium">You're in this tournament</p>
        )}
      </CardContent>
    </Card>
  );
}
