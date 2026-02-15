import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { PlayerLink } from '@/components/ui/PlayerLink';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Flame, Lock, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { MatchWithPlayers, MatchBet, Round, Player } from '@/lib/types';

interface BetMatchCardProps {
  match: MatchWithPlayers;
  round?: Round;
  currentPlayerId: string;
  existingBets: MatchBet[];
  allBetsCount: number;
  onPlaceBet: (match: MatchWithPlayers) => void;
  bettingLocked: boolean;
}

export function BetMatchCard({
  match,
  round,
  currentPlayerId,
  existingBets,
  allBetsCount,
  onPlaceBet,
  bettingLocked,
}: BetMatchCardProps) {
  const isPlayed = match.status === 'Played';
  const isOverdue = match.status === 'Overdue' || match.status === 'AutoResolved';
  const isSettled = isPlayed || isOverdue;

  const isInMatch = [
    match.team_a_player1_id,
    match.team_a_player2_id,
    match.team_b_player1_id,
    match.team_b_player2_id,
  ].includes(currentPlayerId);

  const myBet = existingBets.find(b => b.player_id === currentPlayerId && b.match_id === match.id);
  const canBet = !isInMatch && !isSettled && !bettingLocked && !myBet;

  // Betting market totals (values in cents, display as whole €)
  const fmtE = (cents: number) => `€${Math.round(cents / 100)}`;
  const totalTeamA = existingBets.filter(b => b.predicted_winner === 'team_a').reduce((s, b) => s + b.stake, 0);
  const totalTeamB = existingBets.filter(b => b.predicted_winner === 'team_b').reduce((s, b) => s + b.stake, 0);
  const totalStaked = totalTeamA + totalTeamB;
  const teamAPct = totalStaked > 0 ? Math.round((totalTeamA / totalStaked) * 100) : 50;
  const teamBPct = totalStaked > 0 ? 100 - teamAPct : 50;

  // Expandable ledger
  const [showLedger, setShowLedger] = useState(false);
  const [betPlayers, setBetPlayers] = useState<Map<string, Player>>(new Map());

  const loadBetPlayers = useCallback(async () => {
    if (!showLedger || existingBets.length === 0) return;
    const playerIds = [...new Set(existingBets.map(b => b.player_id))];
    const { data } = await supabase.from('players').select('*').in('id', playerIds);
    if (data) setBetPlayers(new Map(data.map(p => [p.id, p as Player])));
  }, [showLedger, existingBets]);

  useEffect(() => { loadBetPlayers(); }, [loadBetPlayers]);

  return (
    <Card className={cn(
      'chaos-card transition-all',
      myBet && 'border-chaos-orange/40',
      isInMatch && 'opacity-60',
    )}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSettled ? (
              <StatusChip variant={isPlayed ? 'success' : 'error'} size="sm">{match.sets_a}-{match.sets_b}</StatusChip>
            ) : (
              <StatusChip variant="neutral" size="sm">Pending</StatusChip>
            )}
            {allBetsCount >= 3 && (
              <Badge variant="outline" className="text-[10px] border-chaos-orange/50 text-chaos-orange gap-1">
                <Flame className="h-2.5 w-2.5" /> Hot
              </Badge>
            )}
          </div>
          {match.deadline_at && !isSettled && (
            <CountdownTimer targetDate={match.deadline_at} variant="compact" />
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-1 space-y-0.5 min-w-0">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Team A</p>
            <div className="flex flex-col gap-0.5">
              {match.team_a_player1 && <PlayerLink player={match.team_a_player1} showAvatar avatarClassName="h-5 w-5" className="text-xs font-medium min-w-0" />}
              {match.team_a_player2 && <PlayerLink player={match.team_a_player2} showAvatar avatarClassName="h-5 w-5" className="text-xs font-medium min-w-0" />}
            </div>
          </div>
          <div className="text-xs font-bold text-muted-foreground px-2 shrink-0">VS</div>
          <div className="flex-1 space-y-0.5 text-right min-w-0">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Team B</p>
            <div className="flex flex-col gap-0.5 items-end">
              {match.team_b_player1 && <PlayerLink player={match.team_b_player1} showAvatar avatarClassName="h-5 w-5" className="text-xs font-medium min-w-0" />}
              {match.team_b_player2 && <PlayerLink player={match.team_b_player2} showAvatar avatarClassName="h-5 w-5" className="text-xs font-medium min-w-0" />}
            </div>
          </div>
        </div>

        {/* Betting market bar */}
        {totalStaked > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Team A: {fmtE(totalTeamA)}</span>
              <span>{fmtE(totalStaked)} total</span>
              <span>Team B: {fmtE(totalTeamB)}</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              <div
                className="bg-primary/70 transition-all"
                style={{ width: `${teamAPct}%` }}
              />
              <div
                className="bg-chaos-orange/70 transition-all"
                style={{ width: `${teamBPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>{teamAPct}%</span>
              <button
                onClick={() => setShowLedger(!showLedger)}
                className="flex items-center gap-0.5 text-primary hover:underline"
              >
                {showLedger ? 'Hide' : 'View'} bets
                {showLedger ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
              </button>
              <span>{teamBPct}%</span>
            </div>
          </div>
        )}

        {/* Expandable bets ledger */}
        {showLedger && existingBets.length > 0 && (
          <div className="rounded-lg bg-muted/20 border border-border p-2 space-y-1 animate-in fade-in-0 slide-in-from-top-2 duration-150">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Bets Ledger</p>
            {existingBets.map(bet => {
              const betPlayer = betPlayers.get(bet.player_id);
              return (
                <div key={bet.id} className="flex items-center justify-between text-[11px]">
                  <span className="truncate flex-1">{betPlayer?.full_name || 'Loading…'}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="font-medium">{bet.predicted_winner === 'team_a' ? 'Team A' : 'Team B'}</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="font-semibold">{fmtE(bet.stake)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* My bet — display in whole € */}
        {myBet && (
          <div className={cn(
            'rounded-lg p-2 text-xs',
            myBet.status === 'Won' && 'bg-primary/10 border border-primary/30',
            myBet.status === 'Lost' && 'bg-destructive/10 border border-destructive/30',
            myBet.status === 'Pending' && 'bg-chaos-orange/10 border border-chaos-orange/30',
          )}>
            <div className="flex justify-between items-center">
              <span>Your bet: <span className="font-semibold">{myBet.predicted_winner === 'team_a' ? 'Team A' : 'Team B'}</span></span>
              <span className="font-semibold">
                {myBet.status === 'Won' ? `+${fmtE(myBet.payout || 0)}` :
                 myBet.status === 'Lost' ? `-${fmtE(myBet.stake)}` :
                 `${fmtE(myBet.stake)} staked`}
              </span>
            </div>
            {myBet.status === 'Pending' && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Your bet is on the line (fake €)</p>
            )}
          </div>
        )}

        {canBet && (
          <Button variant="hot" size="sm" className="w-full h-8 text-xs animate-pulse" onClick={() => onPlaceBet(match)}>
            <Zap className="mr-1 h-3 w-3" /> Place your bet
          </Button>
        )}

        {isInMatch && !isSettled && (
          <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <Lock className="h-3 w-3" /> Can't bet on your own match
          </p>
        )}
      </CardContent>
    </Card>
  );
}