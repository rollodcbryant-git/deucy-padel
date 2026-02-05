import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/StatusChip';
import { Switch } from '@/components/ui/switch';
import type { Tournament, Player, Round, Match, PledgeItem } from '@/lib/types';
import {
  ArrowLeft, Copy, Users, Play, Pause, Trophy, Calendar, Loader2,
  ExternalLink, RefreshCw, UserX, CheckCircle, Gavel, Database, Gift
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminTournamentDetail() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [pledges, setPledges] = useState<PledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [regenCount, setRegenCount] = useState(0);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    if (!tournamentId) return;
    try {
      const [tRes, pRes, rRes, mRes, plRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
        supabase.from('players').select('*').eq('tournament_id', tournamentId).order('credits_balance', { ascending: false }),
        supabase.from('rounds').select('*').eq('tournament_id', tournamentId).order('index', { ascending: true }),
        supabase.from('matches').select('*').eq('tournament_id', tournamentId).order('created_at', { ascending: false }),
        supabase.from('pledge_items').select('*').eq('tournament_id', tournamentId).order('created_at', { ascending: false }),
      ]);

      if (tRes.error) throw tRes.error;
      setTournament(tRes.data as Tournament);
      setPlayers((pRes.data || []) as Player[]);
      setRounds((rRes.data || []) as Round[]);
      setMatches((mRes.data || []) as Match[]);
      setPledges((plRes.data || []) as PledgeItem[]);
    } catch (error) {
      console.error('Error loading tournament:', error);
      toast({ title: 'Error', description: 'Failed to load tournament data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getPublishedUrl = () => {
    const origin = window.location.origin;
    if (origin.includes('preview--') || origin.includes('lovable.dev')) {
      return 'https://padel-chaos-cup.lovable.app';
    }
    return origin;
  };

  const copyInviteLink = () => {
    const link = `${getPublishedUrl()}/?t=${tournamentId}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Copied!', description: 'Invite link copied to clipboard' });
  };

  const callEngine = async (action: string, extra = {}) => {
    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('tournament-engine', {
        body: { action, tournament_id: tournamentId, ...extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Done!', description: JSON.stringify(data).slice(0, 100) });
      await loadData();
      return data;
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleConfirm = async (playerId: string, confirmed: boolean) => {
    await supabase.from('players').update({ confirmed }).eq('id', playerId);
    loadData();
  };

  const removePlayer = async (playerId: string) => {
    await supabase.from('players').update({ status: 'Removed' }).eq('id', playerId);
    toast({ title: 'Player removed' });
    loadData();
  };

  const togglePledgeApproval = async (pledge: PledgeItem) => {
    const newStatus = pledge.status === 'Approved' ? 'Draft' : 'Approved';
    await supabase
      .from('pledge_items')
      .update({ status: newStatus, approved: newStatus === 'Approved' })
      .eq('id', pledge.id);
    loadData();
  };

  const handleRegenerate = () => {
    if (regenCount >= 3) {
      toast({ title: 'Max regenerations reached', variant: 'destructive' });
      return;
    }
    const liveRound = rounds.find(r => r.status === 'Live');
    if (!liveRound) {
      toast({ title: 'No live round', variant: 'destructive' });
      return;
    }
    setRegenCount(c => c + 1);
    callEngine('regenerate_matches', { round_id: liveRound.id });
  };

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

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Live': return 'live' as const;
      case 'SignupOpen': return 'success' as const;
      case 'AuctionLive': return 'warning' as const;
      case 'Finished': case 'Closed': return 'ended' as const;
      default: return 'neutral' as const;
    }
  };

  const confirmedPlayers = players.filter(p => p.confirmed);
  const activePlayers = players.filter(p => p.status === 'Active');
  const liveRound = rounds.find(r => r.status === 'Live');
  const liveRoundMatches = liveRound ? matches.filter(m => m.round_id === liveRound.id) : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{tournament.name}</h1>
            <StatusChip variant={getStatusVariant(tournament.status)} size="sm">
              {tournament.status}
            </StatusChip>
          </div>
          <Button variant="ghost" size="icon" onClick={loadData}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <Card className="chaos-card">
          <CardHeader><CardTitle className="text-lg">Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full touch-target justify-start" onClick={copyInviteLink}>
              <Copy className="mr-2 h-5 w-5" />Copy Invite Link
            </Button>

            {tournament.status === 'Draft' && (
              <Button className="w-full touch-target bg-gradient-primary"
                onClick={() => callEngine('start_tournament')} // just opens signups first
                disabled={isUpdating}>
                <Play className="mr-2 h-5 w-5" />Open Signups
              </Button>
            )}

            {/* Use direct status update for opening signups */}
            {tournament.status === 'Draft' && (
              <Button className="w-full touch-target" variant="outline"
                onClick={async () => {
                  await supabase.from('tournaments').update({ status: 'SignupOpen' }).eq('id', tournament.id);
                  loadData();
                }} disabled={isUpdating}>
                <Play className="mr-2 h-5 w-5" />Open Signups (Manual)
              </Button>
            )}

            {tournament.status === 'SignupOpen' && (
              <Button className="w-full touch-target bg-gradient-primary"
                onClick={() => callEngine('start_tournament')}
                disabled={isUpdating || confirmedPlayers.length < tournament.min_players}>
                <Trophy className="mr-2 h-5 w-5" />
                Start Tournament ({confirmedPlayers.length}/{tournament.min_players} min)
              </Button>
            )}

            {tournament.status === 'Live' && liveRound && (
              <>
                <Button className="w-full touch-target" variant="secondary"
                  onClick={() => callEngine('check_advance_round')} disabled={isUpdating}>
                  <Calendar className="mr-2 h-5 w-5" />Check & Advance Round
                </Button>
                <Button className="w-full touch-target" variant="outline"
                  onClick={handleRegenerate}
                  disabled={isUpdating || regenCount >= 3}>
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Regenerate Matches ({3 - regenCount} left)
                </Button>
              </>
            )}

            {tournament.status === 'Finished' && (
              <Button className="w-full touch-target bg-gradient-hot"
                onClick={() => callEngine('start_auction')} disabled={isUpdating}>
                <Gavel className="mr-2 h-5 w-5" />Start 24h Auction
              </Button>
            )}

            {tournament.status === 'AuctionLive' && (
              <Button className="w-full touch-target" variant="secondary"
                onClick={() => callEngine('settle_auction')} disabled={isUpdating}>
                <Pause className="mr-2 h-5 w-5" />Settle Auction & Close
              </Button>
            )}

            {/* Seed Demo */}
            <Button variant="outline" className="w-full touch-target justify-start text-chaos-orange border-chaos-orange/30"
              onClick={() => callEngine('seed_demo')} disabled={isUpdating}>
              <Database className="mr-2 h-5 w-5" />
              Seed Demo (8 players + start)
            </Button>

            <Button variant="outline" className="w-full touch-target justify-start"
              onClick={() => window.open(`${getPublishedUrl()}/?t=${tournamentId}`, '_blank')}>
              <ExternalLink className="mr-2 h-5 w-5" />View Player Page
            </Button>
          </CardContent>
        </Card>

        {/* Join Code */}
        {tournament.join_code && (
          <Card className="chaos-card border-primary/30">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Join Code</p>
              <p className="text-3xl font-mono font-bold text-primary tracking-wider">{tournament.join_code}</p>
            </CardContent>
          </Card>
        )}

        {/* Players */}
        <Card className="chaos-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />Players ({players.length})
              </CardTitle>
              <span className="text-sm text-muted-foreground">{confirmedPlayers.length} confirmed</span>
            </div>
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No players yet</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {players.map((p, index) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground">{p.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-primary">{p.credits_balance}c</span>
                      {p.status === 'Removed' ? (
                        <StatusChip variant="error" size="sm">Removed</StatusChip>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {p.confirmed ? '✓' : '○'}
                            </span>
                            <Switch
                              checked={p.confirmed}
                              onCheckedChange={(v) => toggleConfirm(p.id, v)}
                              className="scale-75"
                            />
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => removePlayer(p.id)}>
                            <UserX className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pledges */}
        <Card className="chaos-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="h-5 w-5 text-chaos-orange" />Pledges ({pledges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pledges.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No pledges yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pledges.map((pledge) => (
                  <div key={pledge.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{pledge.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{pledge.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip variant={pledge.status === 'Approved' ? 'success' : 'neutral'} size="sm">
                        {pledge.status}
                      </StatusChip>
                      <Button variant="ghost" size="sm"
                        onClick={() => togglePledgeApproval(pledge)}
                        className={pledge.status === 'Approved' ? 'text-destructive' : 'text-primary'}>
                        {pledge.status === 'Approved' ? 'Revoke' : 'Approve'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rounds */}
        <Card className="chaos-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />Rounds ({rounds.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rounds.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Rounds will be generated when tournament starts</p>
            ) : (
              <div className="space-y-2">
                {rounds.map((round) => {
                  const roundMatches = matches.filter(m => m.round_id === round.id);
                  const played = roundMatches.filter(m => m.status === 'Played').length;
                  return (
                    <div key={round.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <p className="font-medium">
                          {round.is_playoff ? round.playoff_type : `Round ${round.index}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {played}/{roundMatches.length} matches played
                        </p>
                      </div>
                      <StatusChip variant={getStatusVariant(round.status)} size="sm">
                        {round.status}
                      </StatusChip>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Summary */}
        <Card className="chaos-card">
          <CardHeader><CardTitle className="text-lg">Settings</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-muted-foreground">Starting Credits</p><p className="font-medium">{tournament.starting_credits}</p></div>
              <div><p className="text-muted-foreground">Stake/Player</p><p className="font-medium">{tournament.stake_per_player}</p></div>
              <div><p className="text-muted-foreground">Participation Bonus</p><p className="font-medium">{tournament.participation_bonus}</p></div>
              <div><p className="text-muted-foreground">Penalty Amount</p><p className="font-medium">{tournament.penalty_amount}</p></div>
              <div><p className="text-muted-foreground">Round Duration</p><p className="font-medium">{tournament.round_duration_days} days</p></div>
              <div><p className="text-muted-foreground">Player Range</p><p className="font-medium">{tournament.min_players}-{tournament.max_players}</p></div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
