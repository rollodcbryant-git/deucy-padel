import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import { PageLayout } from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Progress } from '@/components/ui/progress';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { getJuiceEmoji } from '@/lib/juice-names';
import { ArrowLeft, Users, Calendar, Trophy, Gavel, User, ChevronRight, Loader2 } from 'lucide-react';
import type { Tournament, Round } from '@/lib/types';

export default function TournamentOverviewPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { player } = usePlayer();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [pledgeCount, setPledgeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const userIsIn = player?.tournament_id === tournamentId;

  useEffect(() => {
    if (tournamentId) loadData();
  }, [tournamentId]);

  const loadData = async () => {
    if (!tournamentId) return;
    try {
      const [
        { data: tData },
        { data: roundsData },
        { count: pCount },
        { count: plCount },
      ] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
        supabase.from('rounds').select('*').eq('tournament_id', tournamentId).order('index', { ascending: true }),
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId).neq('status', 'Removed'),
        supabase.from('pledge_items').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId),
      ]);

      setTournament(tData as Tournament);
      setRounds((roundsData || []) as Round[]);
      setPlayerCount(pCount || 0);
      setPledgeCount(plCount || 0);
    } catch (error) {
      console.error('Error loading tournament:', error);
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

  const getRoundStatusVariant = (status: string) => {
    switch (status) {
      case 'Completed': return 'success' as const;
      case 'Live': return 'live' as const;
      case 'Locked': return 'warning' as const;
      case 'Upcoming': return 'neutral' as const;
      default: return 'neutral' as const;
    }
  };

  const currentRound = rounds.find(r => r.status === 'Live');
  const totalRounds = tournament?.rounds_count || rounds.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Tournament not found</p>
      </div>
    );
  }

  const emoji = getJuiceEmoji(tournament.name);
  const capacityPercent = Math.min(100, (playerCount / tournament.max_players) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">{emoji}</span>
              <h1 className="font-bold text-lg truncate">{tournament.name}</h1>
            </div>
          </div>
          <StatusChip
            variant={getStatusVariant(tournament.status)}
            pulse={tournament.status === 'Live'}
            size="sm"
          >
            {getStatusLabel(tournament.status)}
          </StatusChip>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Capacity + stats */}
        <Card className="chaos-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Players
              </span>
              <span className="font-mono font-semibold">
                {playerCount}/{tournament.max_players}
              </span>
            </div>
            <Progress value={capacityPercent} className="h-2" />
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="text-center">
                <p className="text-lg font-bold">{currentRound ? currentRound.index : '—'}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Round</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{totalRounds}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{pledgeCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pledges</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live round countdown */}
        {currentRound?.end_at && (
          <Card className="chaos-card border-primary/20">
            <CardContent className="p-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Round {currentRound.index} deadline</p>
              <CountdownTimer targetDate={currentRound.end_at} variant="large" />
            </CardContent>
          </Card>
        )}

        {/* Round timeline */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Round Timeline</h2>
          <div className="space-y-1">
            {rounds.map((round) => (
              <div
                key={round.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  round.status === 'Live' ? 'bg-primary/10 border border-primary/20' : 'bg-card/50'
                }`}
              >
                {/* Timeline dot */}
                <div className={`h-3 w-3 rounded-full shrink-0 ${
                  round.status === 'Completed' ? 'bg-primary' :
                  round.status === 'Live' ? 'bg-primary animate-pulse' :
                  'bg-muted-foreground/30'
                }`} />

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {round.is_playoff
                      ? (round.playoff_type === 'final' ? '🏆 Final' : '⚔️ Semi-final')
                      : `Round ${round.index}`
                    }
                  </p>
                  {round.start_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(round.start_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {round.end_at && ` — ${new Date(round.end_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </p>
                  )}
                </div>

                <StatusChip variant={getRoundStatusVariant(round.status)} size="sm">
                  {round.status}
                </StatusChip>
              </div>
            ))}

            {rounds.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Rounds will appear once the tournament starts
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {/* Join CTA */}
          {tournament.status === 'SignupOpen' && !userIsIn && playerCount < tournament.max_players && (
            <Button
              className="w-full touch-target bg-gradient-primary hover:opacity-90"
              onClick={() => navigate(`/join?t=${tournament.id}`)}
            >
              Join this tournament
            </Button>
          )}

          {/* Player actions */}
          {userIsIn && (
            <>
              <Button
                className="w-full touch-target bg-gradient-primary hover:opacity-90"
                onClick={() => navigate(`/tournament/${tournament.id}/me`)}
              >
                <User className="mr-2 h-5 w-5" />
                My Tournament
                <ChevronRight className="ml-auto h-4 w-4" />
              </Button>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="touch-target flex-col h-auto py-3"
                  onClick={() => navigate('/leaderboard')}
                >
                  <Trophy className="h-5 w-5 mb-1" />
                  <span className="text-xs">Ranking</span>
                </Button>
                <Button
                  variant="outline"
                  className="touch-target flex-col h-auto py-3"
                  onClick={() => navigate('/matches')}
                >
                  <Calendar className="h-5 w-5 mb-1" />
                  <span className="text-xs">Matches</span>
                </Button>
                <Button
                  variant="outline"
                  className="touch-target flex-col h-auto py-3"
                  onClick={() => navigate('/auction')}
                >
                  <Gavel className="h-5 w-5 mb-1" />
                  <span className="text-xs">Auction</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
