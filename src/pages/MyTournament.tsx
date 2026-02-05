import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePledgeStatus } from '@/hooks/usePledgeStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { MatchCard } from '@/components/cards/MatchCard';
import { getJuiceEmoji } from '@/lib/juice-names';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import type { MatchWithPlayers, Player, Round } from '@/lib/types';

export default function MyTournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { player, tournament, session, isLoading: ctxLoading, refreshPlayer } = usePlayer();
  const { pledgeStatus } = usePledgeStatus(player, tournament);

  const [currentMatch, setCurrentMatch] = useState<MatchWithPlayers | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [playerRank, setPlayerRank] = useState(0);
  const [loading, setLoading] = useState(true);

  // Redirect if not in this tournament
  useEffect(() => {
    if (!ctxLoading && (!session || !player || player.tournament_id !== tournamentId)) {
      navigate(`/tournament/${tournamentId}`);
      return;
    }
    if (player && tournament) {
      loadData();
    }
  }, [ctxLoading, session, player, tournament, tournamentId]);

  const loadData = async () => {
    if (!player || !tournament) return;
    try {
      // Get rank
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id)
        .eq('status', 'Active')
        .gt('credits_balance', player.credits_balance);
      setPlayerRank((count || 0) + 1);

      // Get live round
      const { data: rounds } = await supabase
        .from('rounds')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('status', 'Live')
        .limit(1);

      if (rounds && rounds.length > 0) {
        setCurrentRound(rounds[0] as Round);

        // Get match
        const { data: matches } = await supabase
          .from('matches')
          .select('*')
          .eq('round_id', rounds[0].id)
          .or(`team_a_player1_id.eq.${player.id},team_a_player2_id.eq.${player.id},team_b_player1_id.eq.${player.id},team_b_player2_id.eq.${player.id},bye_player_id.eq.${player.id}`);

        if (matches && matches.length > 0) {
          const match = matches[0];
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
    } catch (error) {
      console.error('Error loading my tournament data:', error);
    } finally {
      setLoading(false);
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
    if (!error) loadData();
  };

  if (ctxLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!player || !tournament) return null;

  const emoji = getJuiceEmoji(tournament.name);

  const pledgeLabel = {
    loading: 'Checking...',
    missing: 'Missing',
    submitted: 'Pending approval',
    approved: 'Approved ✅',
  }[pledgeStatus];

  const pledgeVariant = {
    loading: 'neutral' as const,
    missing: 'error' as const,
    submitted: 'warning' as const,
    approved: 'success' as const,
  }[pledgeStatus];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/tournament/${tournamentId}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">My Tournament</p>
            <div className="flex items-center gap-1.5">
              <span>{emoji}</span>
              <h1 className="font-bold text-sm truncate">{tournament.name}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-6 pb-24 space-y-5">
        {/* Balance */}
        <Card className="chaos-card bg-gradient-dark border-primary/20">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Your balance</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">You're currently <span className="text-accent font-semibold">#{playerRank}</span></p>
            </div>
            <CreditsDisplay
              amount={player.credits_balance}
              variant="large"
              showDisclaimer
              showDecimals={tournament.display_decimals}
            />
          </CardContent>
        </Card>

        {/* Pledge status */}
        <Card className="chaos-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Pledge status</p>
              <StatusChip variant={pledgeVariant} size="sm" className="mt-1">
                {pledgeLabel}
              </StatusChip>
            </div>
            {pledgeStatus === 'missing' && (
              <Button
                size="sm"
                className="bg-gradient-primary hover:opacity-90"
                onClick={() => navigate('/complete-entry')}
              >
                Add Pledge
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Next match */}
        {tournament.status === 'Live' && currentMatch && !currentMatch.is_bye && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
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

        {/* Bye */}
        {tournament.status === 'Live' && currentMatch?.is_bye && (
          <Card className="chaos-card border-accent/30">
            <CardContent className="p-5 text-center">
              <div className="text-3xl mb-2">😎</div>
              <p className="font-semibold text-accent">You're on a bye this round</p>
              <p className="text-xs text-muted-foreground mt-1">Enjoy the break. You still get your participation bonus.</p>
            </CardContent>
          </Card>
        )}

        {/* No match */}
        {tournament.status === 'Live' && !currentMatch && pledgeStatus !== 'missing' && (
          <Card className="chaos-card">
            <CardContent className="p-5 text-center">
              <div className="text-3xl mb-2">⏳</div>
              <p className="font-semibold">No active match</p>
              <p className="text-xs text-muted-foreground mt-1">Check back when the next round starts</p>
            </CardContent>
          </Card>
        )}

        {/* Club booking */}
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
      </main>

      <BottomNav />
    </div>
  );
}
