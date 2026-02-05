import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import type { MatchWithPlayers, Round, Player } from '@/lib/types';
import { Calendar, Copy } from 'lucide-react';
import { MatchCard } from '@/components/cards/MatchCard';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

export default function MatchesPage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading, refreshPlayer } = usePlayer();
  const { toast } = useToast();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchWithPlayers[]>>(new Map());
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPlayers | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);

  const [setsA, setSetsA] = useState('0');
  const [setsB, setSetsB] = useState('0');
  const [isUnfinished, setIsUnfinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) { navigate('/'); return; }
    if (tournament && player) loadMatches();
  }, [session, tournament, player, isLoading, navigate]);

  const loadMatches = async () => {
    if (!tournament || !player) return;

    const { data: roundsData } = await supabase
      .from('rounds').select('*').eq('tournament_id', tournament.id)
      .order('index', { ascending: false });
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
    setSetsA('0');
    setSetsB('0');
    setIsUnfinished(false);
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

  const submitResult = async () => {
    if (!selectedMatch || !player) return;

    const a = parseInt(setsA);
    const b = parseInt(setsB);

    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a > 3 || b > 3) {
      toast({ title: 'Invalid score', description: 'Sets must be between 0 and 3', variant: 'destructive' });
      return;
    }

    const hasWinner = a === 2 || b === 2;
    if (!isUnfinished && !hasWinner) {
      toast({ title: 'Invalid score', description: 'One team must win 2 sets (or mark as unfinished)', variant: 'destructive' });
      return;
    }
    if (isUnfinished && (a !== 1 || b !== 1)) {
      toast({ title: 'Invalid unfinished score', description: 'Unfinished matches must be 1-1', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Call edge function for credits processing
      const { data, error } = await supabase.functions.invoke('tournament-engine', {
        body: {
          action: 'process_match_result',
          match_id: selectedMatch.id,
          sets_a: a,
          sets_b: b,
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
    } catch (error: any) {
      toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' });
    }
    setIsSubmitting(false);
  };

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">📅</div>
      </div>
    );
  }

  

  return (
    <>
      <PageLayout
        header={
          <div className="p-4">
            <h1 className="font-bold text-xl flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />Your Matches
            </h1>
            <p className="text-sm text-muted-foreground">
              {rounds.length} rounds • {Array.from(matches.values()).flat().filter(m => m.status === 'Played').length} played
            </p>
          </div>
        }
      >
        <div className="space-y-6">
          {rounds.map((round) => {
            const roundMatches = matches.get(round.id) || [];
            return (
              <div key={round.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">
                      {round.is_playoff
                        ? (round.playoff_type === 'final' ? '🏆 Final' : '⚔️ Semi-Final')
                        : `Round ${round.index}`}
                    </h2>
                    <StatusChip
                      variant={round.status === 'Live' ? 'live' : round.status === 'Completed' ? 'success' : 'neutral'}
                      pulse={round.status === 'Live'}>
                      {round.status}
                    </StatusChip>
                  </div>
                  {round.end_at && round.status === 'Live' && (
                    <CountdownTimer targetDate={round.end_at} variant="compact" />
                  )}
                </div>

                {roundMatches.length === 0 ? (
                  <Card className="chaos-card">
                    <CardContent className="p-4 text-center text-muted-foreground">No match this round</CardContent>
                  </Card>
                ) : (
                  roundMatches.map((match) => (
                    match.is_bye ? (
                      <Card key={match.id} className="chaos-card border-accent/30">
                        <CardContent className="p-4 text-center">
                          <div className="text-2xl mb-2">😎</div>
                          <p className="text-accent font-medium">Bye Round</p>
                          <p className="text-sm text-muted-foreground">Enjoy the rest!</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div key={match.id} className="space-y-2">
                        <MatchCard
                          match={match}
                          currentPlayerId={player.id}
                          onClaimBooking={() => handleClaimBooking(match)}
                          onReportResult={() => handleReportResult(match)}
                          bookingUrl={tournament.booking_url || undefined}
                        />
                        {/* Copy contacts button */}
                        {match.status !== 'Played' && match.status !== 'AutoResolved' && (
                          <Button variant="ghost" size="sm" className="w-full text-muted-foreground"
                            onClick={() => handleCopyContacts(match)}>
                            <Copy className="mr-1 h-3 w-3" />Copy Match Contacts
                          </Button>
                        )}
                      </div>
                    )
                  ))
                )}
              </div>
            );
          })}

          {rounds.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-muted-foreground">No rounds yet</p>
              <p className="text-sm text-muted-foreground">Matches will appear when the tournament starts</p>
            </div>
          )}
        </div>
      </PageLayout>

      <BottomNav showAuction={showAuction} />

      {/* Report Result Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Report Match Result</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <Label className="text-xs text-muted-foreground mb-2 block">Your Team</Label>
                <Input type="number" min="0" max="3" value={setsA}
                  onChange={(e) => setSetsA(e.target.value)}
                  className="text-3xl font-bold text-center w-20 h-16" />
              </div>
              <span className="text-2xl text-muted-foreground">-</span>
              <div className="text-center">
                <Label className="text-xs text-muted-foreground mb-2 block">Opponents</Label>
                <Input type="number" min="0" max="3" value={setsB}
                  onChange={(e) => setSetsB(e.target.value)}
                  className="text-3xl font-bold text-center w-20 h-16" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="unfinished" className="text-sm">Match unfinished (1-1 split)?</Label>
              <Switch id="unfinished" checked={isUnfinished} onCheckedChange={setIsUnfinished} />
            </div>

            <p className="text-xs text-muted-foreground text-center">
              💰 Credits will be automatically distributed based on the score
            </p>

            <Button className="w-full touch-target bg-gradient-primary hover:opacity-90"
              onClick={submitResult} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Result'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
