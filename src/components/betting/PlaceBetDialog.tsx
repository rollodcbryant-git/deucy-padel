import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlayerLink } from '@/components/ui/PlayerLink';
import { EuroDisclaimer } from '@/components/ui/EuroDisclaimer';
import { formatEuros } from '@/lib/euros';
import { cn } from '@/lib/utils';
import { Zap, TrendingUp, Shield } from 'lucide-react';
import type { MatchWithPlayers, Tournament } from '@/lib/types';

interface PlaceBetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchWithPlayers | null;
  tournament: Tournament;
  availableBalance: number; // cents
  roundStakedSoFar: number; // cents
  onSubmit: (matchId: string, predictedWinner: 'team_a' | 'team_b', stake: number) => Promise<void>;
}

export function PlaceBetDialog({
  open,
  onOpenChange,
  match,
  tournament,
  availableBalance,
  roundStakedSoFar,
  onSubmit,
}: PlaceBetDialogProps) {
  const [selectedTeam, setSelectedTeam] = useState<'team_a' | 'team_b' | null>(null);
  const [stake, setStake] = useState(100); // 1 euro default
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!match) return null;

  const perBetMax = tournament.per_bet_max || 300;
  const roundCap = tournament.per_round_bet_cap || 500;
  const minProtected = tournament.min_protected_balance || 200;
  const multiplier = Number(tournament.payout_multiplier) || 2.0;

  // Available cap for this bet
  const roundRemaining = Math.max(0, roundCap - roundStakedSoFar);
  const balanceForBetting = Math.max(0, availableBalance - minProtected);
  const maxBet = Math.min(perBetMax, roundRemaining, balanceForBetting);

  const quickAmounts = [100, 200, 300, 500].filter(a => a <= maxBet);

  const potentialPayout = Math.round(stake * multiplier);

  const handleSubmit = async () => {
    if (!selectedTeam || stake <= 0 || stake > maxBet) return;
    setIsSubmitting(true);
    try {
      await onSubmit(match.id, selectedTeam, stake);
      onOpenChange(false);
      setSelectedTeam(null);
      setStake(100);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-chaos-orange" />
            Place your prophecy
          </DialogTitle>
          <DialogDescription>
            Pick the winning team and put your fake € where your mouth is.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Team selection */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedTeam('team_a')}
              className={cn(
                'rounded-lg border-2 p-3 text-left transition-all',
                selectedTeam === 'team_a'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground/30',
              )}
            >
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Team A</p>
              <div className="space-y-1">
                {match.team_a_player1 && (
                  <PlayerLink player={match.team_a_player1} showAvatar avatarClassName="h-5 w-5" className="text-xs" />
                )}
                {match.team_a_player2 && (
                  <PlayerLink player={match.team_a_player2} showAvatar avatarClassName="h-5 w-5" className="text-xs" />
                )}
              </div>
            </button>
            <button
              onClick={() => setSelectedTeam('team_b')}
              className={cn(
                'rounded-lg border-2 p-3 text-left transition-all',
                selectedTeam === 'team_b'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground/30',
              )}
            >
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Team B</p>
              <div className="space-y-1">
                {match.team_b_player1 && (
                  <PlayerLink player={match.team_b_player1} showAvatar avatarClassName="h-5 w-5" className="text-xs" />
                )}
                {match.team_b_player2 && (
                  <PlayerLink player={match.team_b_player2} showAvatar avatarClassName="h-5 w-5" className="text-xs" />
                )}
              </div>
            </button>
          </div>

          {/* Stake selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Stake amount</label>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Available: {formatEuros(availableBalance)} (min {formatEuros(minProtected)} protected)
              </span>
            </div>

            <div className="flex gap-2 flex-wrap">
              {quickAmounts.map(amount => (
                <Button
                  key={amount}
                  variant={stake === amount ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setStake(amount)}
                >
                  {formatEuros(amount)}
                </Button>
              ))}
            </div>

            {maxBet <= 0 && (
              <p className="text-xs text-destructive">
                Easy tiger. {roundStakedSoFar >= roundCap ? 'Round cap reached.' : 'Not enough available balance.'}
              </p>
            )}
          </div>

          {/* Payout preview */}
          {stake > 0 && selectedTeam && (
            <div className="rounded-lg bg-muted/30 p-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Potential payout
                </span>
                <span className="font-bold text-primary">{formatEuros(potentialPayout)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {multiplier}x multiplier · Stake: {formatEuros(stake)} · Round budget: {formatEuros(roundRemaining)} left
              </p>
            </div>
          )}

          <EuroDisclaimer variant="inline" />

          {/* Submit */}
          <Button
            variant="hot"
            className="w-full touch-target"
            disabled={!selectedTeam || stake <= 0 || stake > maxBet || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Placing...' : `Stake ${formatEuros(stake)} on ${selectedTeam === 'team_a' ? 'Team A' : selectedTeam === 'team_b' ? 'Team B' : '...'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
