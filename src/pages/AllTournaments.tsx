import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { Progress } from '@/components/ui/progress';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tournament, Round } from '@/lib/types';
import { ArrowLeft, Trophy } from 'lucide-react';

interface TournamentWithRound extends Tournament {
  liveRound?: Round;
  playerCount?: number;
}

export default function AllTournaments() {
  const navigate = useNavigate();
  const { player, tournament: currentTournament, session, isLoading } = usePlayer();
  const [tournaments, setTournaments] = useState<TournamentWithRound[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !session) { navigate('/'); return; }
    loadTournaments();
  }, [session, isLoading]);

  const loadTournaments = async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (!data) { setLoading(false); return; }

    const enriched: TournamentWithRound[] = [];
    for (const t of data as Tournament[]) {
      const item: TournamentWithRound = { ...t };

      // Get player count
      const { count } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', t.id)
        .eq('status', 'Active');
      item.playerCount = count || 0;

      // Get live round if any
      if (t.status === 'Live') {
        const { data: rounds } = await supabase
          .from('rounds')
          .select('*')
          .eq('tournament_id', t.id)
          .eq('status', 'Live')
          .limit(1);
        if (rounds?.length) item.liveRound = rounds[0] as Round;
      }

      enriched.push(item);
    }

    setTournaments(enriched);
    setLoading(false);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Live': case 'AuctionLive': return 'live' as const;
      case 'Finished': case 'Closed': return 'ended' as const;
      case 'SignupOpen': return 'success' as const;
      default: return 'neutral' as const;
    }
  };

  const isEnrolled = (t: Tournament) => currentTournament?.id === t.id;

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏆</div>
      </div>
    );
  }

  return (
    <PageLayout
      header={
        <div className="p-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/matches')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-xl">All Tournaments</h1>
        </div>
      }
    >
      <div className="space-y-3">
        {tournaments.map((t) => {
          const enrolled = isEnrolled(t);
          const capacityPct = (t.playerCount || 0) / t.max_players * 100;

          return (
            <Card
              key={t.id}
              className={`chaos-card transition-all ${enrolled ? 'border-primary/40' : ''}`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <h3 className="font-bold text-sm">{t.name}</h3>
                      {t.club_name && (
                        <p className="text-xs text-muted-foreground">{t.club_name}</p>
                      )}
                    </div>
                  </div>
                  <StatusChip
                    variant={getStatusVariant(t.status)}
                    size="sm"
                    pulse={t.status === 'Live'}
                  >
                    {t.status === 'SignupOpen' ? 'Joining' : t.status}
                  </StatusChip>
                </div>

                {/* Capacity */}
                {(t.status === 'SignupOpen' || t.status === 'Draft') && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>👥 {t.playerCount}/{t.max_players} players</span>
                      <span>{Math.round(capacityPct)}%</span>
                    </div>
                    <Progress value={capacityPct} className="h-1.5" />
                  </div>
                )}

                {/* Live round info */}
                {t.status === 'Live' && t.liveRound && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>📅 Round {t.liveRound.index}</span>
                    {t.liveRound.end_at && (
                      <CountdownTimer targetDate={t.liveRound.end_at} variant="compact" className="text-xs" />
                    )}
                  </div>
                )}

                {/* CTA */}
                <div>
                  {enrolled && (
                    <Button
                      size="sm"
                      className="w-full bg-gradient-primary"
                      onClick={() => navigate('/matches')}
                    >
                      View My Matches
                    </Button>
                  )}

                  {!enrolled && t.status === 'SignupOpen' && !currentTournament && (
                    <Button
                      size="sm"
                      className="w-full bg-gradient-primary"
                      onClick={() => navigate(`/join?t=${t.id}`)}
                    >
                      Join Tournament
                    </Button>
                  )}

                  {!enrolled && t.status === 'SignupOpen' && currentTournament && (
                    <p className="text-xs text-muted-foreground text-center">
                      You're already in {currentTournament.name}
                    </p>
                  )}

                  {!enrolled && t.status === 'Live' && (
                    <p className="text-xs text-muted-foreground text-center">
                      Live now — join next season
                    </p>
                  )}

                  {t.status === 'Draft' && (
                    <p className="text-xs text-muted-foreground text-center">Coming soon</p>
                  )}

                  {(t.status === 'Finished' || t.status === 'Closed') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate('/leaderboard')}
                    >
                      View Results
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {tournaments.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-muted-foreground">No tournaments yet</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
