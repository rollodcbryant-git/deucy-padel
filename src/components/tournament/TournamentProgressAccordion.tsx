import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TournamentProgressCard } from './TournamentProgressCard';
import { RoundTimeline } from './RoundTimeline';
import type { Tournament, Player, Round, MatchWithPlayers } from '@/lib/types';
import type { RoundSummary } from '@/hooks/useRoundSummaries';
import { useRoundSummaries } from '@/hooks/useRoundSummaries';

interface TournamentProgressAccordionProps {
  tournament: Tournament;
  player: Player;
  rounds: Round[];
  matchesByRound: Map<string, MatchWithPlayers[]>;
  playerRank: number;
  onClaimBooking: (match: MatchWithPlayers) => void;
  onReportResult: (match: MatchWithPlayers) => void;
  onCopyContacts: (match: MatchWithPlayers) => void;
}

export function TournamentProgressAccordion({
  tournament,
  player,
  rounds,
  matchesByRound,
  onClaimBooking,
  onReportResult,
  onCopyContacts,
}: TournamentProgressAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const summaries = useRoundSummaries(rounds, matchesByRound, player.id);

  useEffect(() => {
    supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id)
      .eq('status', 'Active')
      .then(({ count }) => setTotalPlayers(count || 0));
  }, [tournament.id]);

  return (
    <div className="space-y-3">
      <TournamentProgressCard
        tournament={tournament}
        player={player}
        rounds={rounds}
        totalPlayers={totalPlayers}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />

      {isExpanded && (
        <div className="animate-in slide-in-from-top-2 duration-200">
           <RoundTimeline
             summaries={summaries}
             currentPlayerId={player.id}
             tournament={tournament}
             onClaimBooking={onClaimBooking}
             onReportResult={onReportResult}
             onCopyContacts={onCopyContacts}
           />
         </div>
       )}
     </div>
   );
 }
