import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Users, ChevronDown, Trophy } from 'lucide-react';
import { formatEuros } from '@/lib/euros';
import { WaitlistStatusBadge } from '@/components/waitlist/WaitlistStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import type { Tournament, Round, WaitlistEntry, Player } from '@/lib/types';
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
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const lobbyStatus = getLobbyStatus(tournament);
  const isFull = playerCount >= tournament.max_players;
  const roundsCount = tournament.rounds_count || 3;
  const isLiveCard = lobbyStatus === 'live' || lobbyStatus === 'auction_live';
  const isComingSoon = lobbyStatus === 'coming_soon' || lobbyStatus === 'filling';

  const isOnThisWaitlist = waitlistEntry && waitlistEntry.tournament_id === tournament.id;

  useEffect(() => {
    if (!isLiveCard) return;
    const load = async () => {
      const [playersRes, roundsRes] = await Promise.all([
        supabase.from('players').select('*').eq('tournament_id', tournament.id).eq('status', 'Active').order('sets_won', { ascending: false }).limit(3),
        supabase.from('rounds').select('*').eq('tournament_id', tournament.id).order('index', { ascending: true }),
      ]);
      setTopPlayers((playersRes.data || []) as Player[]);
      setAllRounds((roundsRes.data || []) as Round[]);
    };
    load();
  }, [isLiveCard, tournament.id]);

  const perSetWin = formatEuros(tournament.euros_per_set_win);
  const showMinimal = isEnrolled;

  const renderCTA = () => {
    if (isEnrolled) {
      return (
        <Button size="sm" variant="outline" className="h-9 text-xs border-primary/30 text-primary font-semibold px-5" onClick={onView}>
          View
        </Button>
      );
    }
    if ((lobbyStatus === 'filling' || lobbyStatus === 'live') && !isFull && !isEnrolledElsewhere && !waitlistEntry) {
      return (
        <Button size="sm" className="h-9 text-xs font-semibold bg-gradient-primary hover:opacity-90 px-6 shadow-md" onClick={onJoin} disabled={isJoining}>
          {isJoining ? 'Joining…' : '🎾 Join'}
        </Button>
      );
    }
    if ((lobbyStatus === 'filling' || lobbyStatus === 'live') && isFull && !isOnThisWaitlist && !isEnrolledElsewhere && !waitlistEntry) {
      return (
        <Button size="sm" variant="outline" className="h-8 text-xs border-primary/30 text-primary" onClick={onJoinWaitlist} disabled={waitlistLoading}>
          Join Waitlist
        </Button>
      );
    }
    return null;
  };

  // ─── COMING SOON / SECONDARY CARD ───
  if (!isLiveCard) {
    return (
      <Card className={cn(
        'chaos-card transition-all opacity-70',
        lobbyStatus === 'finished' && 'opacity-50',
      )}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm truncate flex-1">{tournament.name}</h3>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shrink-0',
              isComingSoon ? 'bg-chaos-orange/15 text-chaos-orange border-chaos-orange/30' :
              'bg-muted/50 text-muted-foreground border-border',
            )}>
              {isComingSoon ? 'COMING SOON' : 'FINISHED'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {playerCount} / {tournament.max_players}
            </span>
            {lobbyStatus === 'coming_soon' && tournament.signup_open_at && (
              <span className="text-[11px]">
                Opens <CountdownTimer targetDate={tournament.signup_open_at} variant="compact" className="text-xs inline" />
              </span>
            )}
            {lobbyStatus === 'filling' && tournament.signup_close_at && (
              <span className="text-[11px]">
                Closes <CountdownTimer targetDate={tournament.signup_close_at} variant="compact" className="text-xs inline" />
              </span>
            )}
            {lobbyStatus === 'finished' && tournament.ended_at && (
              <span className="text-[11px]">Ended {new Date(tournament.ended_at).toLocaleDateString()}</span>
            )}
            <div className="shrink-0">{renderCTA()}</div>
          </div>

          {isOnThisWaitlist && onLeaveWaitlist && (
            <WaitlistStatusBadge entry={waitlistEntry} position={waitlistPosition ?? null} onLeave={onLeaveWaitlist} loading={waitlistLoading} />
          )}
          {isEnrolledElsewhere && lobbyStatus === 'filling' && (
            <p className="text-[10px] text-muted-foreground/70">Already in: {enrolledTournamentName}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ─── LIVE CARD ───
  return (
    <Card className={cn(
      'chaos-card transition-all ring-2 ring-primary/50 border-primary/60 shadow-lg shadow-primary/10',
      isEnrolled ? 'ring-primary/60 border-primary/70 bg-primary/15 shadow-xl shadow-primary/15' : 'bg-primary/10',
    )}>
      <CardContent className="p-5 space-y-4">
        {/* A) Header row */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-xl truncate">{tournament.name}</h3>
            {tournament.club_name && (
              <p className="text-xs text-muted-foreground mt-0.5">{tournament.club_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border bg-primary/20 text-primary border-primary/40 animate-pulse">
              LIVE
            </span>
            {renderCTA()}
          </div>
        </div>

        {/* B) Core stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span className="font-medium text-foreground">{playerCount}</span>/{tournament.max_players}
          </span>
          {liveRound?.end_at && (
            <span className="flex items-center gap-1.5">
              ⏳ Round {liveRound.index} ends in{' '}
              <CountdownTimer targetDate={liveRound.end_at} variant="compact" className="text-sm inline font-medium text-foreground" />
            </span>
          )}
        </div>

        {/* C) Progress strip */}
        <div className="flex items-center gap-1.5 py-1">
          {Array.from({ length: roundsCount }, (_, i) => {
            const roundData = allRounds.find(r => r.index === i + 1 && !r.is_playoff);
            const status = roundData?.status || 'Upcoming';
            const isCurrent = status === 'Live';
            const isCompleted = status === 'Completed' || status === 'Locked';
            return (
              <div key={i} className="flex items-center gap-1.5 shrink-0">
                <div className={cn(
                  'text-xs font-bold px-2.5 py-1 rounded-md border whitespace-nowrap',
                  isCurrent && 'bg-primary/20 border-primary/40 text-primary',
                  isCompleted && 'bg-muted/60 border-border text-muted-foreground line-through',
                  !isCurrent && !isCompleted && 'bg-muted/30 border-border/50 text-muted-foreground/50',
                )}>
                  Round {i + 1}
                </div>
                {i < roundsCount - 1 && (
                  <span className="text-muted-foreground/40 text-xs">→</span>
                )}
              </div>
            );
          })}
          {tournament.playoffs_enabled && (
            <>
              <span className="text-muted-foreground/40 text-xs">→</span>
              <div className="text-xs font-bold px-2.5 py-1 rounded-md border bg-chaos-orange/10 border-chaos-orange/30 text-chaos-orange shrink-0">
                🏆 Finals
              </div>
            </>
          )}
        </div>

        {/* D) Top 3 leaders */}
        {topPlayers.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-chaos-orange" /> Top (Sets Won)
            </p>
            <div className="flex flex-col gap-1.5">
              {topPlayers.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                  <PlayerAvatar player={p} className="h-6 w-6 text-[9px]" />
                  <span className="text-sm font-medium truncate flex-1">{p.full_name}</span>
                  <span className="text-sm text-primary font-semibold">{p.sets_won} SW</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waitlist / enrollment notices */}
        {isOnThisWaitlist && onLeaveWaitlist && (
          <WaitlistStatusBadge entry={waitlistEntry} position={waitlistPosition ?? null} onLeave={onLeaveWaitlist} loading={waitlistLoading} />
        )}
        {isEnrolledElsewhere && (
          <p className="text-[10px] text-muted-foreground/70">Already in: {enrolledTournamentName}</p>
        )}
        {isEnrolled && (
          <p className="text-xs text-primary/70 font-medium">✅ You're in this tournament</p>
        )}

        {/* Expand: How it works */}
        {!showMinimal && (
          <>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{isOpen ? 'Less' : 'How it works'}</span>
              <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
              <div className="space-y-2 border-t border-border pt-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                {[
                  { emoji: '🪪', headline: 'Join for free + pledge', detail: 'Free to enter — pick a seat and add 1 pledge to start' },
                  { emoji: '🎾', headline: `${roundsCount} rounds — ${tournament.round_duration_days} days each`, detail: `You get ${tournament.round_duration_days} days to book and play your match` },
                  { emoji: '💶', headline: 'Earn credits per set', detail: `Win a set: +${perSetWin} per player` },
                  { emoji: '🔨', headline: '24-hour auction finale', detail: 'Bid with your credits — winners collect items in person' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border border-transparent">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full text-base shrink-0 bg-muted/50">
                      {step.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{step.headline}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
