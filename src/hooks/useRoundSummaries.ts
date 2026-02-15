import { useMemo } from 'react';
import type { Round, MatchWithPlayers, Player } from '@/lib/types';

export interface RoundSummary {
  round: Round;
  matches: MatchWithPlayers[];
  playerSetsWon: number;
  playerSetsLost: number;
  playerNetCredits: number;
  matchResult: 'win' | 'loss' | 'draw' | 'pending' | 'bye' | null;
  pledgeStatus: 'missing' | 'submitted' | 'approved' | null;
}

export function useRoundSummaries(
  rounds: Round[],
  matchesByRound: Map<string, MatchWithPlayers[]>,
  currentPlayerId: string | undefined,
) {
  return useMemo(() => {
    if (!currentPlayerId) return [];

    return rounds.map((round): RoundSummary => {
      const matches = matchesByRound.get(round.id) || [];
      let playerSetsWon = 0;
      let playerSetsLost = 0;
      let matchResult: RoundSummary['matchResult'] = matches.length === 0 ? null : 'pending';

      for (const match of matches) {
        if (match.is_bye) {
          matchResult = 'bye';
          continue;
        }

        if (match.status !== 'Played' && match.status !== 'AutoResolved') continue;

        const isTeamA =
          match.team_a_player1_id === currentPlayerId ||
          match.team_a_player2_id === currentPlayerId;

        const won = isTeamA ? match.sets_a : match.sets_b;
        const lost = isTeamA ? match.sets_b : match.sets_a;
        playerSetsWon += won;
        playerSetsLost += lost;

        if (won > lost) matchResult = 'win';
        else if (lost > won) matchResult = 'loss';
        else matchResult = 'draw';
      }

      // Net credits: only sets WON earn credits (300 cents per set won by default, no loss deduction)
      const playerNetCredits = playerSetsWon * 300;

      return {
        round,
        matches,
        playerSetsWon,
        playerSetsLost,
        playerNetCredits,
        matchResult,
        pledgeStatus: null, // filled later if needed
      };
    });
  }, [rounds, matchesByRound, currentPlayerId]);
}
