import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { Users, ChevronDown } from 'lucide-react';
import { formatEuros } from '@/lib/euros';
import { WaitlistStatusBadge } from '@/components/waitlist/WaitlistStatusBadge';
import type { Tournament, Round, WaitlistEntry } from '@/lib/types';
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

/** Determine which funnel step is "current" based on tournament state + enrollment */
function getCurrentStep(status: LobbyStatus, isEnrolled: boolean): number {
  switch (status) {
    case 'filling':
    case 'coming_soon':
      return 0;
    case 'live':
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
  const isFull = playerCount >= tournament.max_players;
  const roundsCount = tournament.rounds_count || 3;
  const currentStep = getCurrentStep(lobbyStatus, isEnrolled);
  const isLiveCard = lobbyStatus === 'live' || lobbyStatus === 'auction_live';
  const isComingSoon = lobbyStatus === 'coming_soon' || lobbyStatus === 'filling';

  const isOnThisWaitlist = waitlistEntry && waitlistEntry.tournament_id === tournament.id;

  // Per-set display
  const perSetWin = formatEuros(tournament.euros_per_set_win);
  const perSetLoss = formatEuros(tournament.euros_per_set_loss);

  // Funnel steps (only shown in expanded view for non-enrolled)
  const steps = [
    { emoji: '🪪', headline: 'Join for free + pledge', detail: 'Free to enter — pick a seat and add 1 pledge to start' },
    { emoji: '🎾', headline: `${roundsCount} rounds — ${tournament.round_duration_days} days each`, detail: `You get ${tournament.round_duration_days} days to book and play your match` },
    { emoji: '💶', headline: 'Earn credits per set', detail: `Win a set: +${perSetWin} | Lose a set: -${perSetLoss}` },
    { emoji: '🔨', headline: '24-hour auction finale', detail: 'Bid with your credits — winners collect items in person' },
  ];

  // Status tag
  const statusTag = isLiveCard
    ? { label: 'LIVE', className: 'bg-primary/20 text-primary border-primary/40 animate-pulse' }
    : isComingSoon
    ? { label: 'COMING SOON', className: 'bg-chaos-orange/15 text-chaos-orange border-chaos-orange/30' }
    : lobbyStatus === 'finished'
    ? { label: 'FINISHED', className: 'bg-muted/50 text-muted-foreground border-border' }
    : { label: '', className: '' };

  // CTA button
  const renderCTA = () => {
    if (isEnrolled) {
      return (
        <Button size="sm" variant="outline" className="h-8 text-xs border-primary/30 text-primary font-semibold" onClick={onView}>
          View
        </Button>
      );
    }
    if ((lobbyStatus === 'filling' || lobbyStatus === 'live') && !isFull && !isEnrolledElsewhere && !waitlistEntry) {
      return (
        <Button size="sm" className="h-8 text-xs font-semibold bg-gradient-primary hover:opacity-90 px-5 shadow-md" onClick={onJoin} disabled={isJoining}>
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
    return null;
  };

  // For enrolled users: minimal card
  const showMinimal = isEnrolled;

  return (
    <Card className={cn(
      'chaos-card transition-all',
      isLiveCard && 'ring-2 ring-primary/50 border-primary/60 bg-primary/10 shadow-lg shadow-primary/10',
      isLiveCard && isEnrolled && 'ring-2 ring-primary/60 border-primary/70 bg-primary/15 shadow-xl shadow-primary/15',
      !isLiveCard && !isEnrolled && 'opacity-75',
    )}>
      <CardContent className="p-3 space-y-3">
        {/* Hero strip */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className={cn(
              'font-bold truncate',
              isLiveCard ? 'text-base' : 'text-sm',
            )}>
              {tournament.name}
            </h3>
          </div>
          {statusTag.label && (
            <span className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shrink-0',
              statusTag.className,
            )}>
              {statusTag.label}
            </span>
          )}
        </div>

        {/* Capacity + Countdown + CTA */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {playerCount} / {tournament.max_players}
            </span>

            {lobbyStatus === 'live' && liveRound?.end_at && (
              <span className="text-[11px]">
                R{liveRound.index} ends <CountdownTimer targetDate={liveRound.end_at} variant="compact" className="text-xs inline font-medium text-foreground" />
              </span>
            )}

            {lobbyStatus === 'filling' && tournament.signup_close_at && (
              <span className="text-[11px]">
                Closes <CountdownTimer targetDate={tournament.signup_close_at} variant="compact" className="text-xs inline" />
              </span>
            )}

            {lobbyStatus === 'coming_soon' && tournament.signup_open_at && (
              <span className="text-[11px]">
                Opens <CountdownTimer targetDate={tournament.signup_open_at} variant="compact" className="text-xs inline" />
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

        {/* Expand trigger — only show for non-enrolled or non-minimal */}
        {!showMinimal && (
          <>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{isOpen ? 'Less' : 'How it works'}</span>
              <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
            </button>

            {/* Expanded: funnel steps */}
            {isOpen && (
              <div className="space-y-2 border-t border-border pt-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
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
                        <p className={cn('text-xs font-semibold', isCurrent && 'text-primary')}>
                          {step.headline}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-snug">{step.detail}</p>
                      </div>
                      {isCurrent && (
                        <span className="text-[9px] font-semibold text-primary uppercase tracking-wider shrink-0 mt-1">Now</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
