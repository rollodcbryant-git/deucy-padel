import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePledgeStatus } from '@/hooks/usePledgeStatus';
import { supabase } from '@/integrations/supabase/client';
import type { MatchWithPlayers, Round, Player } from '@/lib/types';
import { Calendar, Lock } from 'lucide-react';
import { TournamentProgressAccordion } from '@/components/tournament/TournamentProgressAccordion';
import { ReportResultDialog } from '@/components/tournament/ReportResultDialog';
import { RoundBetsSection } from '@/components/betting/RoundBetsSection';
import { useToast } from '@/hooks/use-toast';

export default function MatchesPage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading, refreshPlayer } = usePlayer();
  const { toast } = useToast();
  const { pledgeStatus } = usePledgeStatus(player, tournament);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchWithPlayers[]>>(new Map());
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPlayers | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const isEnrolled = !!player && !!tournament;

  useEffect(() => {
    if (!isLoading && !session) { navigate('/'); return; }
    if (tournament && player) loadMatches();
  }, [session, tournament, player, isLoading, navigate]);

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
    const text = allPlayers.map(p => `${p.full_name}: ${p.phone}`).join('\n');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">📅</div>
      </div>
    );
  }

  const pledgeMissing = isEnrolled && pledgeStatus === 'missing';

  return (
    <>
      <PageLayout
        header={
          <div className="p-4">
            <h1 className="font-bold text-xl flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              {isEnrolled ? tournament!.name : 'Matches'}
            </h1>
            {isEnrolled && (
              <p className="text-xs text-muted-foreground mt-0.5">Your matches & progress</p>
            )}
          </div>
        }
      >
        {isEnrolled ? (
          <div className="space-y-4">
            {pledgeMissing && (
              <Card className="chaos-card border-chaos-orange/50 bg-chaos-orange/5">
                <CardContent className="p-5 flex items-center gap-4">
                  <Lock className="h-6 w-6 text-chaos-orange shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-chaos-orange">Locked until pledge submitted</p>
                    <p className="text-xs text-muted-foreground">Add your pledge to be scheduled for matches</p>
                  </div>
                  <Button size="sm" onClick={() => navigate('/complete-entry')}
                    className="bg-gradient-primary hover:opacity-90 shrink-0">
                    Add Pledge
                  </Button>
                </CardContent>
              </Card>
            )}

            <TournamentProgressAccordion
              tournament={tournament!}
              player={player!}
              rounds={rounds}
              matchesByRound={matches}
              onClaimBooking={handleClaimBooking}
              onReportResult={handleReportResult}
              onCopyContacts={handleCopyContacts}
            />

            {/* Round Bets section */}
            {tournament!.betting_enabled && (
              <RoundBetsSection
                tournament={tournament!}
                player={player!}
                currentRound={rounds.find(r => r.status === 'Live') || null}
              />
            )}

            {rounds.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-muted-foreground">No rounds yet</p>
                <p className="text-sm text-muted-foreground">Matches will appear when the tournament starts</p>
              </div>
            )}
          </div>
        ) : (
          <Card className="chaos-card">
            <CardContent className="p-8 text-center space-y-4">
              <div className="text-4xl">🎾</div>
              <p className="font-semibold">No active tournament</p>
              <p className="text-sm text-muted-foreground">
                Join a tournament to start playing
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/tournaments')}
                className="mt-2"
              >
                Browse Tournaments
              </Button>
            </CardContent>
          </Card>
        )}
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
