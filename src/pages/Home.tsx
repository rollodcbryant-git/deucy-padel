import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePledgeStatus } from '@/hooks/usePledgeStatus';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MatchWithPlayers, Player, Round } from '@/lib/types';
import { Trophy, Calendar, CheckCircle, LogOut, ExternalLink, AlertTriangle } from 'lucide-react';
import { MatchCard } from '@/components/cards/MatchCard';
import { OnboardingCarousel } from '@/components/onboarding/OnboardingCarousel';

export default function HomePage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading, logout, refreshPlayer } = usePlayer();

  const [currentMatch, setCurrentMatch] = useState<MatchWithPlayers | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [playerRank, setPlayerRank] = useState<number>(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasPledgedCurrentRound, setHasPledgedCurrentRound] = useState(true);
  const [pledgeGateActive, setPledgeGateActive] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }

    if (session && player && tournament) {
      loadData();
      // Show onboarding on first login
      if (!player.has_seen_onboarding) {
        setShowOnboarding(true);
      }
      // Check if player has pledged for current round
      checkPledgeStatus();
    }
  }, [session, player, tournament, isLoading, navigate]);

  const checkPledgeStatus = async () => {
    if (!player || !tournament) return;
    // Find current live round
    const { data: liveRounds } = await supabase
      .from('rounds')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('status', 'Live')
      .limit(1);

    if (liveRounds && liveRounds.length > 0) {
      const liveRoundId = liveRounds[0].id;
      const { data: roundPledges } = await supabase
        .from('pledge_items')
        .select('id')
        .eq('pledged_by_player_id', player.id)
        .eq('round_id', liveRoundId)
        .limit(1);
      const hasPledged = (roundPledges || []).length > 0;
      setHasPledgedCurrentRound(hasPledged);
      setPledgeGateActive(tournament.pledge_gate_enabled && !hasPledged);
    } else {
      // No live round - check for any pledge
      const { data } = await supabase
        .from('pledge_items')
        .select('id')
        .eq('pledged_by_player_id', player.id)
        .limit(1);
      setHasPledgedCurrentRound((data || []).length > 0);
      setPledgeGateActive(false);
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (player) {
      await supabase.from('players').update({ has_seen_onboarding: true }).eq('id', player.id);
    }
  };

  const loadData = async () => {
    if (!player || !tournament) return;

    try {
      // Get current round
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('status', 'Live')
        .limit(1);

      if (rounds && rounds.length > 0) {
        setCurrentRound(rounds[0] as Round);

        // Get player's match in current round
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .eq('round_id', rounds[0].id)
          .or(`team_a_player1_id.eq.${player.id},team_a_player2_id.eq.${player.id},team_b_player1_id.eq.${player.id},team_b_player2_id.eq.${player.id},bye_player_id.eq.${player.id}`);

        if (matches && matches.length > 0) {
          const match = matches[0];
          
          // Load player details for the match
          const playerIds = [
            match.team_a_player1_id,
            match.team_a_player2_id,
            match.team_b_player1_id,
            match.team_b_player2_id,
          ].filter(Boolean);

          const { data: players } = await supabase
            .from('players')
            .select('*')
            .in('id', playerIds);

          const playerMap = new Map((players || []).map(p => [p.id, p as Player]));

          setCurrentMatch({
            ...match,
            team_a_player1: playerMap.get(match.team_a_player1_id),
            team_a_player2: playerMap.get(match.team_a_player2_id),
            team_b_player1: playerMap.get(match.team_b_player1_id),
            team_b_player2: playerMap.get(match.team_b_player2_id),
          } as MatchWithPlayers);
        }
      }

      // Get leaderboard (top 10)
      const { data: topPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('status', 'Active')
        .order('credits_balance', { ascending: false })
        .limit(10);

      setLeaderboard((topPlayers || []) as Player[]);

      // Calculate player's rank
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id)
        .eq('status', 'Active')
        .gt('credits_balance', player.credits_balance);

      setPlayerRank((count || 0) + 1);
    } catch (error) {
      console.error('Error loading home data:', error);
    }
  };

  const handleConfirmParticipation = async () => {
    if (!player) return;

    const { error } = await supabase
      .from('players')
      .update({ confirmed: true })
      .eq('id', player.id);

    if (!error) {
      await refreshPlayer();
    }
  };

  const handleClaimBooking = async () => {
    if (!currentMatch || !player) return;

    const { error } = await supabase
      .from('matches')
      .update({
        booking_claimed_by_player_id: player.id,
        booking_claimed_at: new Date().toISOString(),
        status: 'BookingClaimed',
      })
      .eq('id', currentMatch.id);

    if (!error) {
      loadData();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🎾</div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!player || !tournament) {
    return null;
  }

  

  return (
    <>
      <OnboardingCarousel open={showOnboarding} onComplete={handleOnboardingComplete} />
      <PageLayout
        header={
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="font-bold text-lg">{tournament.name}</h1>
              <StatusChip 
                variant={tournament.status === 'Live' ? 'live' : 'neutral'}
                pulse={tournament.status === 'Live'}
              >
                {tournament.status}
              </StatusChip>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Credits display */}
          <Card className="chaos-card bg-gradient-dark border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Welcome back,</p>
                  <p className="text-xl font-bold">{player.full_name}</p>
                </div>
                <CreditsDisplay
                  amount={player.credits_balance}
                  variant="large"
                  rank={playerRank}
                />
              </div>
            </CardContent>
          </Card>

          {/* Next action card */}
          {tournament.status === 'SignupOpen' && !player.confirmed && (
            <Card className="chaos-card border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Confirm Participation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Tap below to confirm you're playing in this tournament
                </p>
                <Button
                  className="w-full touch-target bg-gradient-primary hover:opacity-90"
                  onClick={handleConfirmParticipation}
                >
                  I'm In! 🎾
                </Button>
              </CardContent>
            </Card>
          )}

          {tournament.status === 'SignupOpen' && player.confirmed && (
            <Card className="chaos-card border-primary/30">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="font-semibold text-primary">You're confirmed!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Waiting for the tournament to start...
                </p>
              </CardContent>
            </Card>
          )}

          {/* Current match */}
          {tournament.status === 'Live' && currentMatch && !currentMatch.is_bye && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Your Next Match
              </h2>
              <MatchCard
                match={currentMatch}
                currentPlayerId={player.id}
                onClaimBooking={handleClaimBooking}
                onReportResult={() => navigate('/matches')}
              />
            </div>
          )}

          {/* Bye message */}
          {tournament.status === 'Live' && currentMatch?.is_bye && (
            <Card className="chaos-card border-accent/30">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">😎</div>
                <p className="font-semibold text-accent">You're on a bye this round</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enjoy the ego boost. You still get your participation bonus.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Pledge gate warning */}
          {tournament.status === 'Live' && pledgeGateActive && (
            <Card className="chaos-card border-chaos-orange/50 bg-chaos-orange/5">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">🎁</div>
                <p className="font-semibold text-chaos-orange">Pledge missing for this round</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Drop a pledge to stay eligible for matches
                </p>
                <Button
                  className="w-full touch-target bg-gradient-primary hover:opacity-90"
                  onClick={() => navigate('/auction')}
                >
                  Add your pledge
                </Button>
              </CardContent>
            </Card>
          )}

          {/* No match yet */}
          {tournament.status === 'Live' && !currentMatch && !pledgeGateActive && (
            <Card className="chaos-card">
              <CardContent className="p-6 text-center">
                <div className="text-4xl mb-3">⏳</div>
                <p className="font-semibold">No active match right now</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check back when the next round starts
                </p>
              </CardContent>
            </Card>
          )}

          {/* Club booking link */}
          {tournament.booking_url && (
            <Button
              variant="outline"
              className="w-full touch-target"
              onClick={() => window.open(tournament.booking_url!, '_blank')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Book Court at {tournament.club_name || 'Club'}
            </Button>
          )}

          {/* Leaderboard preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-chaos-orange" />
                Top Players
              </h2>
              <Button variant="link" className="text-primary" onClick={() => navigate('/leaderboard')}>
                See all
              </Button>
            </div>

            <div className="space-y-2">
              {leaderboard.slice(0, 5).map((p, index) => (
                <Card
                  key={p.id}
                  className={`chaos-card p-3 ${p.id === player.id ? 'border-primary/50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm
                      ${index === 0 ? 'bg-chaos-orange/20 text-chaos-orange' :
                        index === 1 ? 'bg-muted text-foreground' :
                        index === 2 ? 'bg-chaos-orange/10 text-chaos-orange/80' :
                        'bg-muted/50 text-muted-foreground'}
                    `}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">
                        {p.full_name}
                        {p.id === player.id && <span className="text-primary ml-1">(you)</span>}
                      </p>
                    </div>
                    <CreditsDisplay amount={p.credits_balance} variant="compact" showIcon={false} />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Pledge nudge */}
          {!hasPledgedCurrentRound && !pledgeGateActive && (
            <PledgeNudgeCard />
          )}
        </div>
      </PageLayout>

      <BottomNav />
    </>
  );
}
