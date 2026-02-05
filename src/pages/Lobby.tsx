import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Progress } from '@/components/ui/progress';
import { Settings, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getJuiceEmoji } from '@/lib/juice-names';
import type { Tournament } from '@/lib/types';

interface TournamentWithCount extends Tournament {
  player_count: number;
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { session, isLoading: sessionLoading, player } = usePlayer();
  const [tournaments, setTournaments] = useState<TournamentWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playerTournamentIds, setPlayerTournamentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTournaments();
  }, []);

  // If player is logged in and has an active tournament, allow quick access
  useEffect(() => {
    if (!sessionLoading && session && player) {
      // Player has an active session — they can still browse the lobby
    }
  }, [sessionLoading, session, player]);

  const loadTournaments = async () => {
    try {
      // Load all non-Draft tournaments ordered by series
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['SignupOpen', 'Live', 'AuctionLive', 'Finished', 'Closed'])
        .order('series_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!tournamentsData) {
        setIsLoading(false);
        return;
      }

      // Get player counts for each tournament
      const withCounts: TournamentWithCount[] = [];
      for (const t of tournamentsData) {
        const { count } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id)
          .neq('status', 'Removed');
        withCounts.push({ ...(t as Tournament), player_count: count || 0 });
      }

      setTournaments(withCounts);

      // Check which tournaments the current user (by phone) is in
      if (session && player) {
        const ids = new Set<string>();
        ids.add(player.tournament_id);
        setPlayerTournamentIds(ids);
      }
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'SignupOpen': return 'success' as const;
      case 'Live': return 'live' as const;
      case 'AuctionLive': return 'warning' as const;
      case 'Finished':
      case 'Closed': return 'ended' as const;
      default: return 'neutral' as const;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SignupOpen': return 'Open';
      case 'Live': return 'Live';
      case 'AuctionLive': return 'Auction';
      case 'Finished': return 'Finished';
      case 'Closed': return 'Closed';
      default: return status;
    }
  };

  const getPlayfulMessage = (t: TournamentWithCount) => {
    if (t.status === 'Live' || t.status === 'AuctionLive') {
      return 'This juice is bottled. Next batch is open below.';
    }
    if (t.status === 'Finished' || t.status === 'Closed') {
      return 'This batch has been served. 🍹';
    }
    if (t.player_count >= t.max_players) {
      return 'Full! Next one opens below.';
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isInTournament = (tId: string) => playerTournamentIds.has(tId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-6 pb-2 text-center">
        <h1 className="text-3xl font-bold text-gradient-primary">Deucy</h1>
        <p className="text-sm text-muted-foreground mt-1">Tournaments</p>
      </div>

      {/* Active session banner */}
      {session && player && (
        <div className="px-4 mb-2">
          <Card className="chaos-card border-primary/30">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Signed in as </span>
                <span className="font-semibold">{player.full_name}</span>
              </div>
              <Button size="sm" variant="default" onClick={() => navigate('/home')}>
                My Tournament →
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tournament list */}
      <div className="flex-1 p-4 space-y-3">
        {tournaments.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🧃</div>
            <p className="text-muted-foreground">No tournaments yet</p>
            <p className="text-sm text-muted-foreground mt-1">Ask your organizer to create one</p>
          </div>
        )}

        {tournaments.map((t) => {
          const capacityPercent = Math.min(100, (t.player_count / t.max_players) * 100);
          const isFull = t.player_count >= t.max_players;
          const playfulMsg = getPlayfulMessage(t);
          const emoji = getJuiceEmoji(t.name);
          const userIsIn = isInTournament(t.id);

          return (
            <Card key={t.id} className={`chaos-card overflow-hidden ${userIsIn ? 'border-primary/40' : ''}`}>
              <CardContent className="p-4 space-y-3">
                {/* Title row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{emoji}</span>
                    <h2 className="text-xl font-bold">{t.name}</h2>
                  </div>
                  <StatusChip
                    variant={getStatusVariant(t.status)}
                    pulse={t.status === 'Live'}
                  >
                    {getStatusLabel(t.status)}
                  </StatusChip>
                </div>

                {/* Capacity bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Players</span>
                    <span className={`font-mono font-semibold ${isFull ? 'text-primary' : ''}`}>
                      {t.player_count}/{t.max_players}
                    </span>
                  </div>
                  <Progress value={capacityPercent} className="h-2" />
                </div>

                {/* Meta line */}
                <p className="text-xs text-muted-foreground">
                  Rounds: {t.rounds_count || '?'} · {t.round_duration_days} days each
                  {t.club_name && ` · @ ${t.club_name}`}
                </p>

                {/* Playful message */}
                {playfulMsg && (
                  <p className="text-xs italic text-muted-foreground">{playfulMsg}</p>
                )}

                {/* CTA */}
                <div>
                  {t.status === 'SignupOpen' && !userIsIn && !isFull && (
                    <Button
                      className="w-full bg-gradient-primary hover:opacity-90"
                      onClick={() => navigate(`/join?t=${t.id}`)}
                    >
                      Join this tournament
                    </Button>
                  )}

                  {t.status === 'SignupOpen' && !userIsIn && isFull && (
                    <p className="text-sm text-center text-muted-foreground">Full — next one below is open</p>
                  )}

                  {userIsIn && (t.status === 'SignupOpen' || t.status === 'Live' || t.status === 'AuctionLive') && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate('/home')}
                    >
                      View my tournament
                    </Button>
                  )}

                  {!userIsIn && (t.status === 'Live' || t.status === 'AuctionLive') && (
                    <p className="text-sm text-center text-muted-foreground">In progress</p>
                  )}

                  {(t.status === 'Finished' || t.status === 'Closed') && userIsIn && (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => navigate('/home')}
                    >
                      View results
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 space-y-3 safe-bottom">
        {!session && tournaments.some(t => t.status === 'SignupOpen') && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            Already joined? Sign In
          </Button>
        )}

        <Link
          to="/admin"
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          <Settings className="h-3 w-3" />
          Admin Panel
        </Link>
      </div>
    </div>
  );
}
