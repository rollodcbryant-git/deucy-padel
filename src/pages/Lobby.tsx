import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Progress } from '@/components/ui/progress';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { Settings, Loader2, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getJuiceEmoji } from '@/lib/juice-names';
import { BottomNav } from '@/components/layout/BottomNav';
import type { Tournament } from '@/lib/types';

interface TournamentWithCount extends Tournament {
  player_count: number;
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { session, isLoading: sessionLoading, player, tournament, logout } = usePlayer();
  const [tournaments, setTournaments] = useState<TournamentWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playerRank, setPlayerRank] = useState<number>(0);

  useEffect(() => {
    loadTournaments();
  }, []);

  useEffect(() => {
    if (player && tournament) {
      loadPlayerRank();
    }
  }, [player, tournament]);

  const loadPlayerRank = async () => {
    if (!player || !tournament) return;
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id)
      .eq('status', 'Active')
      .gt('credits_balance', player.credits_balance);
    setPlayerRank((count || 0) + 1);
  };

  const loadTournaments = async () => {
    try {
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

  const handleLogout = () => {
    logout();
  };

  const isInTournament = (tId: string) => player?.tournament_id === tId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gradient-primary">Deucy</h1>
            <p className="text-xs text-muted-foreground">Tournaments</p>
          </div>
          {session && player && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5">
                <CreditsDisplay amount={player.credits_balance} variant="compact" showIcon={false} />
                {playerRank > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span className="text-xs text-accent font-semibold">#{playerRank}</span>
                  </>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Signed-in user context */}
      {session && player && tournament && (
        <div className="px-4 mb-2">
          <p className="text-xs text-muted-foreground">
            👋 {player.full_name} · Playing in <span className="text-primary font-medium">{tournament.name}</span>
          </p>
        </div>
      )}

      {/* Tournament list */}
      <div className="flex-1 p-4 pt-2 pb-24 space-y-3">
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
            <Card
              key={t.id}
              className={`chaos-card overflow-hidden cursor-pointer transition-all hover:border-primary/30 ${userIsIn ? 'border-primary/40' : ''}`}
              onClick={() => navigate(`/tournament/${t.id}`)}
            >
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
                <div onClick={(e) => e.stopPropagation()}>
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

                  {userIsIn && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/tournament/${t.id}`)}
                    >
                      View →
                    </Button>
                  )}

                  {!userIsIn && (t.status === 'Live' || t.status === 'AuctionLive') && (
                    <p className="text-sm text-center text-muted-foreground">In progress</p>
                  )}

                  {(t.status === 'Finished' || t.status === 'Closed') && !userIsIn && (
                    <p className="text-sm text-center text-muted-foreground">Finished</p>
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

      <BottomNav />
    </div>
  );
}
