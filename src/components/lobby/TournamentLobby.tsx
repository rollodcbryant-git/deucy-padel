import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TournamentLobbyCard } from './TournamentLobbyCard';
import type { Tournament, Round } from '@/lib/types';

interface TournamentLobbyProps {
  enrolledTournamentId?: string;
  enrolledTournamentName?: string;
}

interface TournamentWithMeta {
  tournament: Tournament;
  playerCount: number;
  liveRound: Round | null;
}

export function TournamentLobby({ enrolledTournamentId, enrolledTournamentName }: TournamentLobbyProps) {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<TournamentWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      // Fetch all visible tournaments (not Draft)
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['SignupOpen', 'Live', 'AuctionLive', 'Finished'])
        .order('created_at', { ascending: false });

      if (!tournamentsData) { setLoading(false); return; }

      const results: TournamentWithMeta[] = await Promise.all(
        (tournamentsData as Tournament[]).map(async (t) => {
          // Get player count
          const { count } = await supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('tournament_id', t.id)
            .eq('status', 'Active');

          // Get live round if tournament is live
          let liveRound: Round | null = null;
          if (t.status === 'Live' || t.status === 'AuctionLive') {
            const { data: rounds } = await supabase
              .from('rounds')
              .select('*')
              .eq('tournament_id', t.id)
              .eq('status', 'Live')
              .limit(1);
            if (rounds && rounds.length > 0) {
              liveRound = rounds[0] as Round;
            }
          }

          return { tournament: t, playerCount: count || 0, liveRound };
        }),
      );

      setTournaments(results);
    } catch (err) {
      console.error('Error loading tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Tournaments</h2>
        <div className="h-16 rounded-xl bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (tournaments.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Tournaments</h2>
      <div className="space-y-2">
        {tournaments.map(({ tournament, playerCount, liveRound }) => (
          <TournamentLobbyCard
            key={tournament.id}
            tournament={tournament}
            liveRound={liveRound}
            playerCount={playerCount}
            isEnrolled={tournament.id === enrolledTournamentId}
            isEnrolledElsewhere={!!enrolledTournamentId && tournament.id !== enrolledTournamentId}
            enrolledTournamentName={enrolledTournamentName}
            onJoin={() => navigate(`/join?code=${tournament.join_code}`)}
            onView={() => {/* scroll down to accordion */}}
          />
        ))}
      </div>
    </div>
  );
}
