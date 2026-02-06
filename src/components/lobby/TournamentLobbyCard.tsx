import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { Users, Award, Shield, Zap, ChevronDown } from 'lucide-react';
import { formatEuros } from '@/lib/euros';
import { WaitlistStatusBadge } from '@/components/waitlist/WaitlistStatusBadge';
import type { Tournament, Round, TournamentTier, WaitlistEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

type LobbyStatus = 'live' | 'filling' | 'finished' | 'coming_soon' | 'auction_live';

interface TournamentLobbyCardProps {
  tournament: Tournament;
  liveRound?: Round | null;
  playerCount: number;
  isEnrolled: boolean;
  isEnrolledElsewhere: boolean;
  enrolledTournamentName?: string;
  isJoining?: boolean;
  onJoin: () => void;
  onView: () => void;
  waitlistEntry?: WaitlistEntry | null;
  waitlistPosition?: number | null;
  onJoinWaitlist?: () => void;
  onLeaveWaitlist?: () => void;
  waitlistLoading?: boolean;
}

function getLobbyStatus(tournament: Tournament): LobbyStatus {
  if (tournament.status === 'AuctionLive') return 'auction_live';
  if (tournament.status === 'Live') return 'live';
  if (tournament.status === 'SignupOpen') return 'filling';
  if (tournament.status === 'Finished' || tournament.status === 'Closed') return 'finished';
  return 'coming_soon';
}

function getStatusChipProps(status: LobbyStatus): { variant: 'live' | 'warning' | 'success' | 'neutral'; label: string } {
  switch (status) {
    case 'live': return { variant: 'live', label: 'Live' };
    case 'auction_live': return { variant: 'live', label: 'Auction Live' };
    case 'filling': return { variant: 'warning', label: 'Filling' };
    case 'finished': return { variant: 'neutral', label: 'Finished' };
    case 'coming_soon': return { variant: 'neutral', label: 'Coming Soon' };
  }
}

function TierBadge({ tier }: { tier: TournamentTier }) {
  const config = {
    Major: { icon: <Award className="h-3 w-3" />, className: 'bg-chaos-orange/15 text-chaos-orange border-chaos-orange/30', label: 'Major' },
    League: { icon: <Shield className="h-3 w-3" />, className: 'bg-primary/15 text-primary border-primary/30', label: 'League' },
    Mini: { icon: <Zap className="h-3 w-3" />, className: 'bg-accent/15 text-accent border-accent/30', label: 'Blitz' },
  }[tier] || { icon: <Shield className="h-3 w-3" />, className: 'bg-primary/15 text-primary border-primary/30', label: 'League' };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

/** Determine which funnel step is "current" based on tournament state + enrollment */
function getCurrentStep(status: LobbyStatus, isEnrolled: boolean): number {
  switch (status) {
    case 'filling':
    case 'coming_soon':
      return 0;
    case 'live':
      // When enrolled, highlight steps 1 AND 2 (play rounds + earn credits)
      return isEnrolled ? 2 : 1;
    case 'auction_live':
      return 3;
    case 'finished':
      return 4;
  }
}

/** Check if a step should be highlighted as "now" */
function isStepCurrent(stepIndex: number, status: LobbyStatus, isEnrolled: boolean): boolean {
  if (status === 'live' && isEnrolled) {
    return stepIndex === 1 || stepIndex === 2;
  }
  return stepIndex === getCurrentStep(status, isEnrolled);
}

export function TournamentLobbyCard({
  tournament,
  liveRound,
  playerCount,
  isEnrolled,
  isEnrolledElsewhere,
  enrolledTournamentName,
  isJoining,
  onJoin,
  onView,
  waitlistEntry,
  waitlistPosition,
  onJoinWaitlist,
  onLeaveWaitlist,
  waitlistLoading,
}: TournamentLobbyCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const lobbyStatus = getLobbyStatus(tournament);
  const chipProps = getStatusChipProps(lobbyStatus);
  const isFull = playerCount >= tournament.max_players;
  const tier = tournament.tier || 'League';
  const roundsCount = tournament.rounds_count || 3;
  const currentStep = getCurrentStep(lobbyStatus, isEnrolled);
  const isLiveCard = lobbyStatus === 'live' || lobbyStatus === 'auction_live';

  const isOnThisWaitlist = waitlistEntry && waitlistEntry.tournament_id === tournament.id;

  // Computed duration
  const totalRoundDays = roundsCount * tournament.round_duration_days;
  const auctionDays = 1;
  const durationLabel = `${totalRoundDays} days + ${auctionDays} day auction`;

  // Per-set display (cents → euros)
  const perSetWin = formatEuros(tournament.euros_per_set_win);
  const perSetLoss = formatEuros(tournament.euros_per_set_loss);

  // Funnel steps
  const steps = [
    {
      emoji: '🪪',
      headline: 'Join for free + pledge',
      detail: `Free to enter — pick a seat and add 1 pledge to start`,
    },
    {
      emoji: '🎾',
      headline: `${roundsCount} rounds — ${tournament.round_duration_days} days each`,
      detail: `You get ${tournament.round_duration_days} days to book and play your match`,
    },
    {
      emoji: '💶',
      headline: 'Earn credits per set',
      detail: `Win a set: +${perSetWin} | Lose a set: -${perSetLoss}`,
    },
    {
      emoji: '🔨',
      headline: '24-hour auction finale',
      detail: 'Bid with your credits — winners collect items in person',
    },
  ];

  // Key rules chips
  const rules: string[] = [];
  if (tournament.betting_enabled) rules.push(`Max bet per match: ${formatEuros(tournament.per_bet_max)}`);
  if (tournament.pledge_gate_enabled) rules.push('Pledge required each round');
  rules.push("Can't bid on your own pledge");
  if (tournament.booking_url) rules.push('Book via club website');

  // CTA button
  const renderCTA = () => {
    if (isEnrolled) {
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs border-primary/30 text-primary" onClick={onView}>
          View
        </Button>
      );
    }
    if ((lobbyStatus === 'filling' || lobbyStatus === 'live') && !isFull && !isEnrolledElsewhere && !waitlistEntry) {
      return (
        <Button size="sm" className="h-8 text-xs font-semibold bg-gradient-primary hover:opacity-90 px-4 shadow-md" onClick={onJoin} disabled={isJoining}>
          {isJoining ? 'Joining…' : '🎾 Join'}
        </Button>
      );
    }
    if ((lobbyStatus === 'filling' || lobbyStatus === 'live') && isFull && !isOnThisWaitlist && !isEnrolledElsewhere && !waitlistEntry) {
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs border-primary/30 text-primary" onClick={onJoinWaitlist} disabled={waitlistLoading}>
          Join Waitlist
        </Button>
      );
    }
    if (lobbyStatus === 'live' && !isEnrolled) {
      return <span className="text-[10px] text-muted-foreground">Live now</span>;
    }
    return null;
  };

  return (
    <Card className={cn(
      'chaos-card transition-all',
      isEnrolled && 'border-primary/40 bg-primary/5',
      isLiveCard && 'ring-2 ring-primary/50 border-primary/60 bg-primary/10 shadow-lg shadow-primary/10',
    )}>
      <CardContent className="p-3 space-y-3">
        {/* A) HERO STRIP */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm truncate">{tournament.name}</h3>
              <TierBadge tier={tier} />
        </div>

        {/* Free entry notice */}
        <p className="text-[10px] text-muted-foreground/60">🆓 Free to enter · All € are in-app credits, not real money</p>
            {tournament.club_name && (
              <p className="text-[11px] text-muted-foreground truncate">{tournament.club_name}</p>
            )}
          </div>
          <StatusChip variant={chipProps.variant} size="sm" pulse={isLiveCard}>
            {chipProps.label}
          </StatusChip>
        </div>

        {/* Capacity + Countdown + CTA */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {playerCount} / {tournament.max_players} seats
            </span>

            {lobbyStatus === 'live' && liveRound?.end_at && (
              <span className="text-[11px]">
                Round {liveRound.index} ends in <CountdownTimer targetDate={liveRound.end_at} variant="compact" className="text-xs inline font-medium text-foreground" />
              </span>
            )}

            {lobbyStatus === 'filling' && tournament.signup_close_at && (
              <span className="text-[11px]">
                Closes in <CountdownTimer targetDate={tournament.signup_close_at} variant="compact" className="text-xs inline" />
              </span>
            )}

            {lobbyStatus === 'filling' && !tournament.signup_close_at && (
              <span className="text-[11px]">Ends when full</span>
            )}

            {lobbyStatus === 'coming_soon' && tournament.signup_open_at && (
              <span className="text-[11px]">
                Opens in <CountdownTimer targetDate={tournament.signup_open_at} variant="compact" className="text-xs inline" />
              </span>
            )}

            {lobbyStatus === 'finished' && tournament.ended_at && (
              <span className="text-[11px]">
                Ended {new Date(tournament.ended_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="shrink-0">{renderCTA()}</div>
        </div>

        {/* Waitlist status */}
        {isOnThisWaitlist && onLeaveWaitlist && (
          <WaitlistStatusBadge
            entry={waitlistEntry}
            position={waitlistPosition ?? null}
            onLeave={onLeaveWaitlist}
            loading={waitlistLoading}
          />
        )}

        {/* Enrolled notices */}
        {isEnrolledElsewhere && (lobbyStatus === 'filling' || lobbyStatus === 'live') && (
          <p className="text-[10px] text-muted-foreground/70">Already in: {enrolledTournamentName}</p>
        )}
        {isEnrolled && (
          <p className="text-[10px] text-primary/70 font-medium">You're in this tournament</p>
        )}

        {/* Expand trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{isOpen ? 'Less' : 'How it works'}</span>
          <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
        </button>

        {/* B) HOW IT WORKS FUNNEL + C) KEY RULES */}
        {isOpen && (
          <div className="space-y-4 border-t border-border pt-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            {/* Funnel steps */}
            <div className="space-y-2">
              {steps.map((step, i) => {
                const isCurrent = isStepCurrent(i, lobbyStatus, isEnrolled);
                const isFuture = i > currentStep;
                const isPast = i < currentStep && !isCurrent;

                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-3 p-2.5 rounded-lg transition-all',
                      isCurrent && 'bg-primary/10 border border-primary/30',
                      isPast && 'opacity-60',
                      isFuture && 'opacity-40',
                      !isCurrent && 'border border-transparent',
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full text-base shrink-0',
                      isCurrent ? 'bg-primary/20' : 'bg-muted/50',
                    )}>
                      {step.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        'text-xs font-semibold',
                        isCurrent && 'text-primary',
                      )}>
                        {step.headline}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{step.detail}</p>
                      {i === 2 && (
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">€ = in-app credits (not real money)</p>
                      )}
                    </div>
                    {isCurrent && (
                      <span className="text-[9px] font-semibold text-primary uppercase tracking-wider shrink-0 mt-1">Now</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Duration */}
            <div className="text-xs text-muted-foreground text-center">
              Total: {durationLabel}
            </div>

            {/* Participation bonus */}
            {tournament.participation_bonus > 0 && (
              <div className="text-[11px] text-muted-foreground text-center">
                Participation bonus: +{formatEuros(tournament.participation_bonus)} when you submit your round pledge on time
              </div>
            )}

            {/* C) KEY RULES CHIPS */}
            <div className="flex flex-wrap gap-1.5">
              {rules.map((rule, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-1 rounded-md bg-muted/40 border border-border text-[10px] text-muted-foreground"
                >
                  {rule}
                </span>
              ))}
            </div>

            {tier === 'Major' && (
              <p className="text-[11px] text-chaos-orange/80 italic text-center">🔥 Major event — bigger stakes, bigger glory</p>
            )}
            {tier === 'Mini' && (
              <p className="text-[11px] text-accent/80 italic text-center">⚡ Quick blitz — fast and fun</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
