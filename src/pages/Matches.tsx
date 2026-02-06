import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePledgeStatus } from '@/hooks/usePledgeStatus';
import { supabase } from '@/integrations/supabase/client';
import type { MatchWithPlayers, Round, Player } from '@/lib/types';
import { Calendar, Lock, CheckCircle, LogOut } from 'lucide-react';
import { TournamentProgressAccordion } from '@/components/tournament/TournamentProgressAccordion';
import { ReportResultDialog } from '@/components/tournament/ReportResultDialog';
import { OnboardingCarousel } from '@/components/onboarding/OnboardingCarousel';
import { useToast } from '@/hooks/use-toast';

export default function MatchesPage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading, refreshPlayer, logout } = usePlayer();
  const { toast } = useToast();
  const { pledgeStatus } = usePledgeStatus(player, tournament);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchWithPlayers[]>>(new Map());
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPlayers | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [playerRank, setPlayerRank] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) { navigate('/'); return; }
    if (tournament && player) {
      loadMatches();
      if (!player.has_seen_onboarding) {
        setShowOnboarding(true);
      }
    }
  }, [session, tournament, player, isLoading, navigate]);

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    if (player) {
      await supabase.from('players').update({ has_seen_onboarding: true }).eq('id', player.id);
    }
  };

  const loadMatches = async () => {
    if (!tournament || !player) return;

    const { data: roundsData } = await supabase
      .from('rounds').select('*').eq('tournament_id', tournament.id)
      .order('index', { ascending: true });
    setRounds((roundsData || []) as Round[]);

    const { data: matchesData } = await supabase
      .from('matches').select('*').eq('tournament_id', tournament.id)
      .or(`team_a_player1_id.eq.${player.id},team_a_player2_id.eq.${player.id},team_b_player1_id.eq.${player.id},team_b_player2_id.eq.${player.id},bye_player_id.eq.${player.id}`);

    if (!matchesData) return;

    const playerIds = new Set<string>();
    matchesData.forEach(m => {
      [m.team_a_player1_id, m.team_a_player2_id, m.team_b_player1_id, m.team_b_player2_id].forEach(id => { if (id) playerIds.add(id); });
    });

    const { data: players } = await supabase.from('players').select('*').in('id', Array.from(playerIds));
    const playerMap = new Map((players || []).map(p => [p.id, p as Player]));

    const matchesByRound = new Map<string, MatchWithPlayers[]>();
    matchesData.forEach(match => {
      const mwp: MatchWithPlayers = {
        ...match,
        team_a_player1: playerMap.get(match.team_a_player1_id),
        team_a_player2: playerMap.get(match.team_a_player2_id),
        team_b_player1: playerMap.get(match.team_b_player1_id),
        team_b_player2: playerMap.get(match.team_b_player2_id),
      };
      const existing = matchesByRound.get(match.round_id) || [];
      existing.push(mwp);
      matchesByRound.set(match.round_id, existing);
    });
    setMatches(matchesByRound);

    // Compute rank
    const { data: allPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('status', 'Active')
      .order('credits_balance', { ascending: false });
    const rank = (allPlayers || []).findIndex(p => p.id === player.id) + 1;
    setPlayerRank(rank || 0);
  };

  const handleClaimBooking = async (match: MatchWithPlayers) => {
    if (!player) return;
    const { error } = await supabase.from('matches').update({
      booking_claimed_by_player_id: player.id,
      booking_claimed_at: new Date().toISOString(),
      status: 'BookingClaimed',
    }).eq('id', match.id);
    if (!error) {
      loadMatches();
      toast({ title: 'Booking claimed! 📅', description: "You're on court duty. Don't forget!" });
    }
  };

  const handleReportResult = (match: MatchWithPlayers) => {
    setSelectedMatch(match);
    setShowReportDialog(true);
  };

  const handleCopyContacts = (match: MatchWithPlayers) => {
    const allPlayers = [
      match.team_a_player1, match.team_a_player2,
      match.team_b_player1, match.team_b_player2,
    ].filter(Boolean) as Player[];

    const text = allPlayers
      .map(p => `${p.full_name}: ${p.phone}`)
      .join('\n');

    navigator.clipboard.writeText(text);
    toast({ title: 'Contacts copied! 📋', description: 'Paste into your WhatsApp group' });
  };

  const handleSubmitResult = async (setsA: number, setsB: number, isUnfinished: boolean) => {
    if (!selectedMatch || !player) return;

    const { data, error } = await supabase.functions.invoke('tournament-engine', {
      body: {
        action: 'process_match_result',
        match_id: selectedMatch.id,
        sets_a: setsA,
        sets_b: setsB,
        is_unfinished: isUnfinished,
        player_id: player.id,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    toast({ title: 'Score submitted! 🎾', description: 'Scores locked. Credits distributed.' });
    setShowReportDialog(false);
    loadMatches();
    refreshPlayer();
  };

  const handleConfirmParticipation = async () => {
    if (!player) return;
    const { error } = await supabase
      .from('players')
      .update({ confirmed: true })
      .eq('id', player.id);
    if (!error) await refreshPlayer();
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🎾</div>
      </div>
    );
  }

  const pledgeMissing = pledgeStatus === 'missing';

  return (
    <>
      <OnboardingCarousel open={showOnboarding} onComplete={handleOnboardingComplete} />
      <PageLayout
        header={
          <div className="p-4 flex items-center justify-between">
            <h1 className="font-bold text-xl flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />Matches
            </h1>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Confirm participation (signup phase) */}
          {tournament.status === 'SignupOpen' && !player.confirmed && (
            <Card className="chaos-card border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Confirm Participation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4 text-sm">
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

          {/* Locked banner when pledge missing */}
          {pledgeMissing && (
            <Card className="chaos-card border-chaos-orange/50 bg-chaos-orange/5">
              <CardContent className="p-5 flex items-center gap-4">
                <Lock className="h-6 w-6 text-chaos-orange shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-chaos-orange">Pledge required</p>
                  <p className="text-xs text-muted-foreground">Add your pledge to be scheduled for matches</p>
                </div>
                <Button size="sm" onClick={() => navigate('/complete-entry')}
                  className="bg-gradient-primary hover:opacity-90 shrink-0">
                  Add Pledge
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tournament Progress Accordion (lobby header) */}
          <TournamentProgressAccordion
            tournament={tournament}
            player={player}
            rounds={rounds}
            matchesByRound={matches}
            playerRank={playerRank}
            onClaimBooking={handleClaimBooking}
            onReportResult={handleReportResult}
            onCopyContacts={handleCopyContacts}
          />

          {rounds.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-muted-foreground">No rounds yet</p>
              <p className="text-sm text-muted-foreground">Matches will appear when the tournament starts</p>
            </div>
          )}
        </div>
      </PageLayout>

      <BottomNav />

      <ReportResultDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onSubmit={handleSubmitResult}
      />
    </>
  );
}
