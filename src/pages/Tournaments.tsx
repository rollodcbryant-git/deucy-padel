import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import { TournamentLobbyCard } from '@/components/lobby/TournamentLobbyCard';
import type { Tournament, Round } from '@/lib/types';
import { Trophy, LogOut } from 'lucide-react';

interface TournamentWithMeta {
  tournament: Tournament;
  playerCount: number;
  liveRound: Round | null;
}

export default function TournamentsPage() {
  const navigate = useNavigate();
  const { player, tournament: enrolledTournament, session, isLoading, logout } = usePlayer();

  const [tournaments, setTournaments] = useState<TournamentWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }
    if (session) loadTournaments();
  }, [session, isLoading, navigate]);

  const loadTournaments = async () => {
    try {
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['SignupOpen', 'Live', 'AuctionLive', 'Finished', 'Closed', 'Draft'])
        .order('created_at', { ascending: false });

      if (!tournamentsData) { setLoading(false); return; }

      const results: TournamentWithMeta[] = await Promise.all(
        (tournamentsData as Tournament[])
          .filter(t => t.status !== 'Draft') // hide drafts from players
          .map(async (t) => {
            const { count } = await supabase
              .from('players')
              .select('id', { count: 'exact', head: true })
              .eq('tournament_id', t.id)
              .eq('status', 'Active');

            let liveRound: Round | null = null;
            if (t.status === 'Live' || t.status === 'AuctionLive') {
              const { data: rounds } = await supabase
                .from('rounds').select('*')
                .eq('tournament_id', t.id)
                .eq('status', 'Live')
                .limit(1);
              if (rounds && rounds.length > 0) liveRound = rounds[0] as Round;
            }

            return { tournament: t, playerCount: count || 0, liveRound };
          }),
      );

      // Sort: Live first, then Filling, then Coming soon, then Finished
      const statusOrder: Record<string, number> = {
        Live: 0, AuctionLive: 0, SignupOpen: 1, Finished: 3, Closed: 4,
      };
      results.sort((a, b) => {
        const aOrder = statusOrder[a.tournament.status] ?? 2;
        const bOrder = statusOrder[b.tournament.status] ?? 2;
        return aOrder - bOrder;
      });

      setTournaments(results);
    } catch (err) {
      console.error('Error loading tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏆</div>
      </div>
    );
  }

  return (
    <>
      <PageLayout
        header={
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="font-bold text-xl flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                Tournaments
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Season overview</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🏆</div>
              <p className="font-semibold">No tournaments yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back soon for upcoming events
              </p>
            </div>
          ) : (
            tournaments.map(({ tournament, playerCount, liveRound }) => (
              <TournamentLobbyCard
                key={tournament.id}
                tournament={tournament}
                liveRound={liveRound}
                playerCount={playerCount}
                isEnrolled={tournament.id === enrolledTournament?.id}
                isEnrolledElsewhere={!!enrolledTournament && tournament.id !== enrolledTournament.id}
                enrolledTournamentName={enrolledTournament?.name}
                onJoin={() => navigate(`/join?t=${tournament.id}`)}
                onView={() => navigate('/matches')}
              />
            ))
          )}
        </div>
      </PageLayout>
      <BottomNav />
    </>
  );
}
