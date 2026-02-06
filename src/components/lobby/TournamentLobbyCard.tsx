import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Users, ChevronDown, Zap, Award, Shield } from 'lucide-react';
import { formatEuros } from '@/lib/euros';
import type { Tournament, Round, TournamentTier } from '@/lib/types';

type LobbyStatus = 'live' | 'filling' | 'finished' | 'coming_soon' | 'ready';

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
    case 'ready': return { variant: 'success', label: 'Ready' };
    case 'finished': return { variant: 'neutral', label: 'Finished' };
    case 'coming_soon': return { variant: 'neutral', label: 'Coming Soon' };
  }
}

function TierBadge({ tier }: { tier: TournamentTier }) {
  const config = {
    Major: { icon: <Award className="h-3 w-3" />, className: 'bg-chaos-orange/15 text-chaos-orange border-chaos-orange/30' },
    League: { icon: <Shield className="h-3 w-3" />, className: 'bg-primary/15 text-primary border-primary/30' },
    Mini: { icon: <Zap className="h-3 w-3" />, className: 'bg-accent/15 text-accent border-accent/30' },
  }[tier] || { icon: <Shield className="h-3 w-3" />, className: 'bg-primary/15 text-primary border-primary/30' };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${config.className}`}>
      {config.icon}
      {tier}
    </span>
  );
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
  const [isOpen, setIsOpen] = useState(false);
  const lobbyStatus = getLobbyStatus(tournament);
  const chipProps = getStatusChipProps(lobbyStatus);
  const isFull = playerCount >= tournament.max_players;
  const tier = tournament.tier || 'League';
  const roundsCount = tournament.rounds_count || 3;
  const totalWeeks = Math.ceil((roundsCount * tournament.round_duration_days) / 7);

  return (
    <Card className={`chaos-card transition-all ${isEnrolled ? 'border-primary/40 bg-primary/5' : ''}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardContent className="p-3 space-y-2">
          {/* Row 1: Name + Tier + Status */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm truncate">{tournament.name}</h3>
                <TierBadge tier={tier} />
              </div>
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
                <span className="text-[11px]">
                  Round ends: <CountdownTimer targetDate={liveRound.end_at} variant="compact" className="text-xs inline" />
                </span>
              )}

              {lobbyStatus === 'filling' && tournament.signup_close_at && (
                <span className="text-[11px]">
                  Closes: <CountdownTimer targetDate={tournament.signup_close_at} variant="compact" className="text-xs inline" />
                </span>
              )}

              {lobbyStatus === 'filling' && !tournament.signup_close_at && (
                <span className="text-[11px]">Ends when full</span>
              )}

              {lobbyStatus === 'coming_soon' && tournament.signup_open_at && (
                <span className="text-[11px]">
                  Opens: <CountdownTimer targetDate={tournament.signup_open_at} variant="compact" className="text-xs inline" />
                </span>
              )}

              {lobbyStatus === 'finished' && tournament.ended_at && (
                <span className="text-[11px]">
                  Ended: {new Date(tournament.ended_at).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-2">
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

          {/* Enrolled notices */}
          {isEnrolledElsewhere && lobbyStatus === 'filling' && !isFull && (
            <p className="text-[10px] text-muted-foreground/70">
              Already in: {enrolledTournamentName}
            </p>
          )}
          {isEnrolled && (
            <p className="text-[10px] text-primary/70 font-medium">You're in this tournament</p>
          )}

          {/* Expand trigger */}
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors pt-1">
              <span>{isOpen ? 'Less' : 'Details'}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
        </CardContent>

        {/* Expanded details */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
            {/* Duration */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">≈ {totalWeeks} weeks</p>
              </div>
              <div>
                <p className="text-muted-foreground">Rounds</p>
                <p className="font-medium">{roundsCount} rounds × {tournament.round_duration_days}d</p>
              </div>
            </div>

            {/* Stakes */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Starting €</p>
                <p className="font-medium text-primary">{formatEuros(tournament.starting_credits)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Per set ±</p>
                <p className="font-medium">{formatEuros(tournament.euros_per_set_win)}</p>
              </div>
              {tournament.participation_bonus > 0 && (
                <div>
                  <p className="text-muted-foreground">Bonus</p>
                  <p className="font-medium">{formatEuros(tournament.participation_bonus)}</p>
                </div>
              )}
            </div>

            {/* Phases */}
            <div className="text-xs space-y-1">
              <p className="text-muted-foreground font-medium">Phases</p>
              <ol className="space-y-0.5 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  Signups (Filling)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  Rounds ({roundsCount}×)
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  Auction (24h)
                </li>
              </ol>
            </div>

            {/* Pledge requirement */}
            <div className="text-xs flex items-center gap-2">
              <span className="text-muted-foreground">Pledges per round:</span>
              <span className="font-medium">{tournament.pledge_gate_enabled ? 'Required' : 'Optional'}</span>
            </div>

            {/* Flavour text based on tier */}
            {tier === 'Major' && (
              <p className="text-[11px] text-chaos-orange/80 italic">🔥 Major event — bigger stakes, bigger glory</p>
            )}
            {tier === 'Mini' && (
              <p className="text-[11px] text-accent/80 italic">⚡ Quick blitz — fast & fun</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
