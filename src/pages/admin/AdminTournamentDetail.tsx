import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Tournament, Player, Round } from '@/lib/types';
import { 
  ArrowLeft, 
  Copy, 
  Users, 
  Play, 
  Pause, 
  Trophy,
  Calendar,
  Loader2,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminTournamentDetail() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, [tournamentId]);

  const loadData = async () => {
    if (!tournamentId) return;

    try {
      // Load tournament
      const { data: tournamentData, error: tError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tError) throw tError;
      setTournament(tournamentData as Tournament);

      // Load players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('credits_balance', { ascending: false });

      setPlayers((playersData || []) as Player[]);

      // Load rounds
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('index', { ascending: true });

      setRounds((roundsData || []) as Round[]);
    } catch (error) {
      console.error('Error loading tournament:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tournament data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/?t=${tournamentId}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Copied!',
      description: 'Invite link copied to clipboard',
    });
  };

  const updateTournamentStatus = async (newStatus: 'Draft' | 'SignupOpen' | 'Live' | 'Finished' | 'AuctionLive' | 'Closed') => {
    if (!tournament) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ status: newStatus })
        .eq('id', tournament.id);

      if (error) throw error;

      setTournament({ ...tournament, status: newStatus });
      toast({
        title: 'Status updated',
        description: `Tournament is now ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
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
      case 'Live': return 'live';
      case 'SignupOpen': return 'success';
      case 'AuctionLive': return 'warning';
      case 'Finished':
      case 'Closed': return 'ended';
      default: return 'neutral';
    }
  };

  const confirmedPlayers = players.filter(p => p.confirmed);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
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

      {/* Content */}
      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <Card className="chaos-card">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full touch-target justify-start"
              onClick={copyInviteLink}
            >
              <Copy className="mr-2 h-5 w-5" />
              Copy Invite Link
            </Button>

            {tournament.status === 'Draft' && (
              <Button
                className="w-full touch-target bg-gradient-primary"
                onClick={() => updateTournamentStatus('SignupOpen')}
                disabled={isUpdating}
              >
                <Play className="mr-2 h-5 w-5" />
                Open Signups
              </Button>
            )}

            {tournament.status === 'SignupOpen' && (
              <Button
                className="w-full touch-target bg-gradient-primary"
                onClick={() => updateTournamentStatus('Live')}
                disabled={isUpdating || confirmedPlayers.length < tournament.min_players}
              >
                <Trophy className="mr-2 h-5 w-5" />
                Start Tournament ({confirmedPlayers.length}/{tournament.min_players} min)
              </Button>
            )}

            {tournament.status === 'Live' && (
              <Button
                className="w-full touch-target"
                variant="secondary"
                onClick={() => updateTournamentStatus('AuctionLive')}
                disabled={isUpdating}
              >
                <Trophy className="mr-2 h-5 w-5" />
                Start Auction Phase
              </Button>
            )}

            {tournament.status === 'AuctionLive' && (
              <Button
                className="w-full touch-target"
                variant="secondary"
                onClick={() => updateTournamentStatus('Finished')}
                disabled={isUpdating}
              >
                <Pause className="mr-2 h-5 w-5" />
                End Tournament
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full touch-target justify-start"
              onClick={() => window.open(`/?t=${tournamentId}`, '_blank')}
            >
              <ExternalLink className="mr-2 h-5 w-5" />
              View Player Landing Page
            </Button>
          </CardContent>
        </Card>

        {/* Join Code */}
        {tournament.join_code && (
          <Card className="chaos-card border-primary/30">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Join Code</p>
              <p className="text-3xl font-mono font-bold text-primary tracking-wider">
                {tournament.join_code}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Players */}
        <Card className="chaos-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Players ({players.length})
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {confirmedPlayers.length} confirmed
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No players yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{player.full_name}</p>
                        <p className="text-xs text-muted-foreground">{player.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-primary">
                        {player.credits_balance}c
                      </span>
                      {player.confirmed && (
                        <StatusChip variant="success" size="sm">✓</StatusChip>
                      )}
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
              <Calendar className="h-5 w-5 text-primary" />
              Rounds ({rounds.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rounds.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Rounds will be generated when the tournament starts
              </p>
            ) : (
              <div className="space-y-2">
                {rounds.map((round) => (
                  <div
                    key={round.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">
                        {round.is_playoff ? round.playoff_type : `Round ${round.index}`}
                      </p>
                    </div>
                    <StatusChip variant={getStatusVariant(round.status)} size="sm">
                      {round.status}
                    </StatusChip>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Summary */}
        <Card className="chaos-card">
          <CardHeader>
            <CardTitle className="text-lg">Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Starting Credits</p>
                <p className="font-medium">{tournament.starting_credits}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Stake/Player</p>
                <p className="font-medium">{tournament.stake_per_player}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Participation Bonus</p>
                <p className="font-medium">{tournament.participation_bonus}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Penalty Amount</p>
                <p className="font-medium">{tournament.penalty_amount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Round Duration</p>
                <p className="font-medium">{tournament.round_duration_days} days</p>
              </div>
              <div>
                <p className="text-muted-foreground">Player Range</p>
                <p className="font-medium">{tournament.min_players}-{tournament.max_players}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
