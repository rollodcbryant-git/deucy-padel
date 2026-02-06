import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { PlayerLink } from '@/components/ui/PlayerLink';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Flame, Lock, Zap } from 'lucide-react';
import type { MatchWithPlayers, MatchBet, Round } from '@/lib/types';

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

        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-0.5">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Team A</p>
            <div className="flex flex-col gap-0.5">
              {match.team_a_player1 && <PlayerLink player={match.team_a_player1} showAvatar avatarClassName="h-5 w-5" className="text-xs font-medium" />}
              {match.team_a_player2 && <PlayerLink player={match.team_a_player2} showAvatar avatarClassName="h-5 w-5" className="text-xs font-medium" />}
            </div>
          </div>
          <div className="text-xs font-bold text-muted-foreground px-2">VS</div>
          <div className="flex-1 space-y-0.5 text-right">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Team B</p>
            <div className="flex flex-col gap-0.5 items-end">
              {match.team_b_player1 && <PlayerLink player={match.team_b_player1} showAvatar avatarClassName="h-5 w-5" className="text-xs font-medium" />}
              {match.team_b_player2 && <PlayerLink player={match.team_b_player2} showAvatar avatarClassName="h-5 w-5" className="text-xs font-medium" />}
            </div>
          </div>
        </div>

        {/* My bet — display in whole € */}
        {myBet && (
          <div className={cn(
            'rounded-lg p-2 text-xs',
            myBet.status === 'Won' && 'bg-primary/10 border border-primary/30',
            myBet.status === 'Lost' && 'bg-destructive/10 border border-destructive/30',
            myBet.status === 'Pending' && 'bg-chaos-orange/10 border border-chaos-orange/30',
          )}>
            <div className="flex justify-between items-center">
              <span>Your prophecy: <span className="font-semibold">{myBet.predicted_winner === 'team_a' ? 'Team A' : 'Team B'}</span></span>
              <span className="font-semibold">
                {myBet.status === 'Won' ? `+€${myBet.payout || 0}` :
                 myBet.status === 'Lost' ? `-€${myBet.stake}` :
                 `€${myBet.stake} staked`}
              </span>
            </div>
            {myBet.status === 'Pending' && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Juice on the line (fake €)</p>
            )}
          </div>
        )}

        {canBet && (
          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => onPlaceBet(match)}>
            <Zap className="mr-1 h-3 w-3" /> Place your prophecy
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
