import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BetMatchCard } from './BetMatchCard';
import { PlaceBetDialog } from './PlaceBetDialog';
import { EuroDisclaimer } from '@/components/ui/EuroDisclaimer';
import { useToast } from '@/hooks/use-toast';
import { Zap, TrendingUp } from 'lucide-react';
import type { MatchWithPlayers, MatchBet, Player, Tournament, Round } from '@/lib/types';

interface RoundBetsSectionProps {
  tournament: Tournament;
  player: Player;
  currentRound: Round | null;
}

export function RoundBetsSection({ tournament, player, currentRound }: RoundBetsSectionProps) {
  const { toast } = useToast();
  const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
  const [bets, setBets] = useState<MatchBet[]>([]);
  const [myBets, setMyBets] = useState<MatchBet[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPlayers | null>(null);
  const [showBetDialog, setShowBetDialog] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentRound) return;

    const { data: matchesData } = await supabase
      .from('matches').select('*').eq('round_id', currentRound.id).eq('is_bye', false).order('created_at');
    if (!matchesData) return;

    const playerIds = new Set<string>();
    matchesData.forEach(m => {
      [m.team_a_player1_id, m.team_a_player2_id, m.team_b_player1_id, m.team_b_player2_id]
        .forEach(id => { if (id) playerIds.add(id); });
    });

    const { data: players } = await supabase.from('players').select('*').in('id', Array.from(playerIds));
    const playerMap = new Map((players || []).map(p => [p.id, p as Player]));

    const enriched: MatchWithPlayers[] = matchesData.map(m => ({
      ...m,
      team_a_player1: playerMap.get(m.team_a_player1_id),
      team_a_player2: playerMap.get(m.team_a_player2_id),
      team_b_player1: playerMap.get(m.team_b_player1_id),
      team_b_player2: playerMap.get(m.team_b_player2_id),
    }));
    setMatches(enriched);

    const { data: betsData } = await supabase.from('match_bets').select('*').eq('round_id', currentRound.id);
    setBets((betsData || []) as MatchBet[]);
    setMyBets((betsData || []).filter((b: any) => b.player_id === player.id) as MatchBet[]);
  }, [currentRound, player.id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!tournament.betting_enabled || !currentRound) return null;

  // All values in cents
  const roundStaked = myBets.filter(b => b.status === 'Pending').reduce((sum, b) => sum + b.stake, 0);

  const handlePlaceBet = (match: MatchWithPlayers) => {
    setSelectedMatch(match);
    setShowBetDialog(true);
  };

  // stake is in whole €, convert to cents for storage
  const handleSubmitBet = async (matchId: string, predictedWinner: 'team_a' | 'team_b', stakeEuros: number) => {
    // Hard cap €5
    if (stakeEuros > 5) {
      toast({ title: 'Easy tiger 🐯', description: 'Max €5 per bet.', variant: 'destructive' });
      return;
    }

    const stakeCents = stakeEuros * 100;
    const minProtected = tournament.min_protected_balance || 200;
    if (player.credits_balance - stakeCents < minProtected) {
      toast({ title: 'Easy tiger 🐯', description: `Can't drop below the minimum balance.`, variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('match_bets').insert({
      match_id: matchId,
      player_id: player.id,
      tournament_id: tournament.id,
      round_id: currentRound!.id,
      predicted_winner: predictedWinner,
      stake: stakeCents,
      status: 'Pending',
    });

    if (error) {
      toast({ title: 'Bet failed', description: error.message, variant: 'destructive' });
      return;
    }

    // Do NOT deduct balance now — it will be deducted/credited on settlement
    toast({ title: 'Bet placed! 🎲', description: `€${stakeEuros} pending until match result (fake €)` });
    loadData();
  };

  const myWinnings = myBets.filter(b => b.status === 'Won').reduce((sum, b) => sum + (b.payout || 0), 0);
  const myLosses = myBets.filter(b => b.status === 'Lost').reduce((sum, b) => sum + b.stake, 0);
  const fmtE = (cents: number) => `€${Math.round(cents / 100)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-chaos-orange" />
          Round Bets
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {roundStaked > 0 && (
            <span>Locked in bets: {fmtE(roundStaked)}</span>
          )}
          <span>Budget: {fmtE(Math.max(0, (tournament.per_round_bet_cap * 100 || 500) - roundStaked))} left</span>
        </div>
      </div>

      {(myWinnings > 0 || myLosses > 0) && (
        <div className="rounded-lg bg-muted/30 p-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Round results</span>
          <span>
            {myWinnings > 0 && <span className="text-primary font-semibold mr-2">+{fmtE(myWinnings)}</span>}
            {myLosses > 0 && <span className="text-destructive font-semibold">-{fmtE(myLosses)}</span>}
          </span>
        </div>
      )}

      <EuroDisclaimer variant="inline" />

      <div className="space-y-2">
        {matches.map(match => (
          <BetMatchCard
            key={match.id}
            match={match}
            round={currentRound || undefined}
            currentPlayerId={player.id}
            existingBets={bets.filter(b => b.match_id === match.id)}
            allBetsCount={bets.filter(b => b.match_id === match.id).length}
            onPlaceBet={handlePlaceBet}
            bettingLocked={false}
          />
        ))}
      </div>

      {matches.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No matches to bet on yet.</p>
      )}

      <PlaceBetDialog
        open={showBetDialog}
        onOpenChange={setShowBetDialog}
        match={selectedMatch}
        tournament={tournament}
        availableBalance={Math.round(player.credits_balance / 100)}
        roundStakedSoFar={Math.round(roundStaked / 100)}
        onSubmit={handleSubmitBet}
      />
    </div>
  );
}
