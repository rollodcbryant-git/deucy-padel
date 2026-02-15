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
import { Calendar, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { MatchCard } from '@/components/cards/MatchCard';
import { RoundTimeline } from '@/components/tournament/RoundTimeline';
import { RoundBetsSection } from '@/components/betting/RoundBetsSection';
import { CountdownTimer } from '@/components/ui/CountdownTimer';

import { ReportResultDialog } from '@/components/tournament/ReportResultDialog';
import { useRoundSummaries } from '@/hooks/useRoundSummaries';
import { useRoundPledges } from '@/hooks/useRoundPledges';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function MatchesPage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading, refreshPlayer } = usePlayer();
  const { toast } = useToast();
  const { pledgeStatus } = usePledgeStatus(player, tournament);

  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchWithPlayers[]>>(new Map());
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPlayers | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [showBets, setShowBets] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [betsCount, setBetsCount] = useState(0);

  const isEnrolled = !!player && !!tournament;

  const liveRound = rounds.find(r => r.status === 'Live') || null;
  const myLiveMatches = liveRound ? (matches.get(liveRound.id) || []) : [];
  const myActiveMatch = myLiveMatches.find(m => m.status !== 'Played' && m.status !== 'AutoResolved') || myLiveMatches[0] || null;

  const summaries = useRoundSummaries(rounds, matches, player?.id || '');
  const { pledges: roundPledges, refresh: refreshPledges } = useRoundPledges(tournament?.id, liveRound?.id);

  useEffect(() => {
    if (!isLoading && !session) { navigate('/'); return; }
    if (tournament && player) loadMatches();
  }, [session, tournament, player, isLoading, navigate]);

  // Load bet count for active match
  useEffect(() => {
    if (!myActiveMatch || myActiveMatch.is_bye) return;
    supabase.from('match_bets').select('id', { count: 'exact', head: true }).eq('match_id', myActiveMatch.id)
      .then(({ count }) => setBetsCount(count || 0));
  }, [myActiveMatch?.id]);

  const loadMatches = async () => {
    if (!tournament || !player) return;

    const { count } = await supabase.from('players').select('id', { count: 'exact', head: true }).eq('tournament_id', tournament.id).eq('status', 'Active');
    setPlayerCount(count || 0);

    const { data: roundsData } = await supabase.from('rounds').select('*').eq('tournament_id', tournament.id).order('index', { ascending: true });
    setRounds((roundsData || []) as Round[]);

    const liveR = (roundsData || []).find((r: any) => r.status === 'Live');
    if (liveR) {
      try {
        await supabase.functions.invoke('tournament-engine', {
          body: { action: 'auto_match_remaining', tournament_id: tournament.id, round_id: liveR.id },
        });
      } catch (e) { console.log('Auto-match check:', e); }
    }

    const { data: matchesData } = await supabase.from('matches').select('*').eq('tournament_id', tournament.id)
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
    const allPlayers = [match.team_a_player1, match.team_a_player2, match.team_b_player1, match.team_b_player2].filter(Boolean) as Player[];
    const text = allPlayers.map(p => `${p.full_name}: ${p.phone}`).join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Contacts copied! 📋', description: 'Paste into your WhatsApp group' });
  };

  const handleSubmitResult = async (setsA: number, setsB: number, isUnfinished: boolean) => {
    if (!selectedMatch || !player) return;
    const { data, error } = await supabase.functions.invoke('tournament-engine', {
      body: { action: 'process_match_result', match_id: selectedMatch.id, sets_a: setsA, sets_b: setsB, is_unfinished: isUnfinished, player_id: player.id },
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
  const roundsCount = tournament?.rounds_count || 3;

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
            {/* Pledge missing warning */}
            {pledgeMissing && (
              <Card className="chaos-card border-chaos-orange/50 bg-chaos-orange/5">
                <CardContent className="p-5 flex items-center gap-4">
                  <Lock className="h-6 w-6 text-chaos-orange shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-chaos-orange">Locked until pledge submitted</p>
                    <p className="text-xs text-muted-foreground">Add your pledge to be scheduled for matches</p>
                  </div>
                  <Button size="sm" onClick={() => navigate('/complete-entry')} className="bg-gradient-primary hover:opacity-90 shrink-0">
                    Add Pledge
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* A) YOUR MATCH - always expanded */}
            {myActiveMatch && !myActiveMatch.is_bye && (
              <MatchCard
                match={myActiveMatch}
                currentPlayerId={player!.id}
                round={liveRound || undefined}
                tournament={tournament!}
                roundPledges={roundPledges}
                betsCount={betsCount}
                onClaimBooking={() => handleClaimBooking(myActiveMatch)}
                onReportResult={() => handleReportResult(myActiveMatch)}
                onPledgeSaved={refreshPledges}
              />
            )}

            {myActiveMatch?.is_bye && (
              <Card className="chaos-card border-accent/30">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl mb-2">😎</div>
                  <p className="text-accent font-medium">Bye Round</p>
                  <p className="text-sm text-muted-foreground">Enjoy the rest!</p>
                </CardContent>
              </Card>
            )}

            {/* No match yet */}
            {!myActiveMatch && liveRound && (() => {
              const remainder = (tournament!.max_players > 0 ? Math.min(playerCount, tournament!.max_players) : playerCount) % 4;
              if (remainder === 0) return null;
              const needed = 4 - remainder;
              return (
                <Card className="chaos-card border-primary/20 bg-primary/5">
                  <CardContent className="p-4 text-center space-y-1">
                    <p className="text-sm font-medium">⏳ Waiting for {needed} more player{needed > 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">Matches need groups of 4.</p>
                  </CardContent>
                </Card>
              );
            })()}

            {/* B) TOURNAMENT PROGRESS - compact collapsible */}
            <div className="space-y-2">
              <button
                onClick={() => setShowProgress(!showProgress)}
                className="w-full flex items-center justify-between text-sm"
              >
                <span className="font-semibold text-muted-foreground uppercase tracking-wide text-xs">Tournament Progress</span>
                {showProgress ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {/* Compact progress strip always visible */}
              <div className="flex items-center gap-1.5 py-1 overflow-x-auto">
                {Array.from({ length: roundsCount }, (_, i) => {
                  const rd = rounds.find(r => r.index === i + 1 && !r.is_playoff);
                  const status = rd?.status || 'Upcoming';
                  const isCurrent = status === 'Live';
                  const isCompleted = status === 'Completed' || status === 'Locked';
                  return (
                    <div key={i} className="flex items-center gap-1 shrink-0">
                      <div className={cn(
                        'text-[10px] font-bold px-2 py-1 rounded-md border whitespace-nowrap',
                        isCurrent && 'bg-primary/20 border-primary/40 text-primary',
                        isCompleted && 'bg-muted/60 border-border text-muted-foreground line-through',
                        !isCurrent && !isCompleted && 'bg-muted/30 border-border/50 text-muted-foreground/50',
                      )}>
                        Round {i + 1}
                      </div>
                      {i < roundsCount - 1 && <span className="text-muted-foreground/40 text-[10px]">→</span>}
                    </div>
                  );
                })}
                {tournament!.playoffs_enabled && (
                  <>
                    <span className="text-muted-foreground/40 text-[10px]">→</span>
                    <div className="text-[10px] font-bold px-2 py-1 rounded-md border bg-chaos-orange/10 border-chaos-orange/30 text-chaos-orange shrink-0">🏆 Finals</div>
                  </>
                )}
              </div>

              {liveRound?.end_at && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  ⏳ Round {liveRound.index} ends in <CountdownTimer targetDate={liveRound.end_at} variant="compact" className="text-xs inline font-medium text-foreground" />
                </div>
              )}

              {/* Full round timeline when expanded */}
              {showProgress && (
                <div className="animate-in slide-in-from-top-2 duration-200 pt-2">
                  <RoundTimeline
                    summaries={summaries}
                    currentPlayerId={player!.id}
                    tournament={tournament!}
                    onClaimBooking={handleClaimBooking}
                    onReportResult={handleReportResult}
                    onCopyContacts={handleCopyContacts}
                  />
                </div>
              )}
            </div>

            {/* C) ROUND BETS - always visible */}
            {tournament!.betting_enabled && liveRound && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2 px-1">
                  🎲 Round Bets
                </h3>
                <div className="rounded-xl bg-muted/30 border border-border p-4">
                  <RoundBetsSection
                    tournament={tournament!}
                    player={player!}
                    currentRound={liveRound}
                  />
                </div>
              </div>
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
              <p className="text-sm text-muted-foreground">Join a tournament to start playing</p>
              <Button variant="outline" onClick={() => navigate('/tournaments')} className="mt-2">Browse Tournaments</Button>
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
