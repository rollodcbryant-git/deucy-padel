import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import { TournamentLobbyCard } from '@/components/lobby/TournamentLobbyCard';
import { JoinWaitlistDialog } from '@/components/waitlist/JoinWaitlistDialog';
import { useWaitlist } from '@/hooks/useWaitlist';
import { useToast } from '@/hooks/use-toast';
import type { Tournament, Round } from '@/lib/types';
import { Trophy, LogOut, Clock } from 'lucide-react';

interface TournamentWithMeta {
  tournament: Tournament;
  playerCount: number;
  liveRound: Round | null;
}

export default function TournamentsPage() {
  const navigate = useNavigate();
  const { player, tournament: enrolledTournament, session, isLoading, logout, refreshPlayer } = usePlayer();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState<TournamentWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Waitlist
  const { entry: waitlistEntry, position: waitlistPosition, loading: waitlistLoading, joinWaitlist, leaveWaitlist, refresh: refreshWaitlist } = useWaitlist(player?.phone);
  const [waitlistDialogOpen, setWaitlistDialogOpen] = useState(false);
  const [waitlistTargetTournament, setWaitlistTargetTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }
    if (session) loadTournaments();
  }, [session, isLoading, navigate]);

  const loadTournaments = async () => {
    try {
      const { data: tournamentsData } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['Draft', 'SignupOpen', 'Live', 'AuctionLive', 'Finished', 'Closed'])
        .order('created_at', { ascending: false });

      if (!tournamentsData) { setLoading(false); return; }

      const visible = (tournamentsData as Tournament[]).filter(t =>
        t.status !== 'Draft' || t.signup_open_at !== null
      );
      const results: TournamentWithMeta[] = await Promise.all(
        visible.map(async (t) => {
          const { count } = await supabase
            .from('players')
            .select('id', { count: 'exact', head: true })
            .eq('tournament_id', t.id)
            .eq('status', 'Active');

          let liveRound: Round | null = null;
          if (t.status === 'Live' || t.status === 'AuctionLive') {
            const { data: rounds } = await supabase
              .from('rounds').select('*')
              .eq('tournament_id', t.id)
              .eq('status', 'Live')
              .limit(1);
            if (rounds && rounds.length > 0) liveRound = rounds[0] as Round;
          }

          return { tournament: t, playerCount: count || 0, liveRound };
        }),
      );

      const statusOrder: Record<string, number> = {
        Live: 0, AuctionLive: 0, SignupOpen: 1, Finished: 3, Closed: 4,
      };
      results.sort((a, b) => {
        const aOrder = statusOrder[a.tournament.status] ?? 2;
        const bOrder = statusOrder[b.tournament.status] ?? 2;
        return aOrder - bOrder;
      });

      setTournaments(results);
    } catch (err) {
      console.error('Error loading tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async (tournament: Tournament) => {
    if (!player || !session) return;
    setJoiningId(tournament.id);

    try {
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('phone', player.phone)
        .eq('tournament_id', tournament.id);

      if (existing && existing.length > 0) {
        toast({ title: 'Already joined', description: 'You already have a record in this tournament.' });
        return;
      }

      const { error } = await supabase.from('players').insert({
        tournament_id: tournament.id,
        full_name: player.full_name,
        phone: player.phone,
        pin_hash: player.pin_hash,
        gender: player.gender,
        credits_balance: tournament.starting_credits,
        session_token: session.token,
      });

      if (error) throw error;

      toast({ title: 'Joined! 🎾', description: `You're now in ${tournament.name}` });
      await refreshPlayer();
      loadTournaments();
    } catch (err: any) {
      console.error('Join error:', err);
      toast({ title: 'Failed to join', description: err.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setJoiningId(null);
    }
  };

  const handleOpenWaitlistDialog = (tournament?: Tournament) => {
    setWaitlistTargetTournament(tournament || null);
    setWaitlistDialogOpen(true);
  };

  const handleWaitlistSubmit = async (data: { fullName: string; phone: string; note?: string }) => {
    const result = await joinWaitlist({
      fullName: data.fullName,
      phone: data.phone,
      note: data.note,
      tournamentId: waitlistTargetTournament?.id || null,
    });
    if (!result.error) {
      toast({ title: 'Waitlist joined 🎾', description: "We'll tap you when a seat drops." });
    }
    return result;
  };

  const handleLeaveWaitlist = async () => {
    await leaveWaitlist();
    toast({ title: 'Left the waitlist' });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Check if there are any open tournaments (SignupOpen and not full)
  const hasOpenSlots = tournaments.some(t =>
    t.tournament.status === 'SignupOpen' && t.playerCount < t.tournament.max_players
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏆</div>
      </div>
    );
  }

  return (
    <>
      <PageLayout
        header={
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="font-bold text-xl flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                Tournaments
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">Season overview</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Global waitlist banner when no open slots and not already on waitlist and not enrolled */}
          {!loading && !hasOpenSlots && !enrolledTournament && !waitlistEntry && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                No seats right now
              </div>
              <p className="text-xs text-muted-foreground">Get notified when a spot opens up</p>
              <Button
                size="sm"
                className="bg-gradient-primary text-xs"
                onClick={() => handleOpenWaitlistDialog()}
              >
                Join the Waitlist
              </Button>
            </div>
          )}

          {/* Show general waitlist status */}
          {!loading && waitlistEntry && !waitlistEntry.tournament_id && (
            <div className="rounded-xl border border-muted bg-muted/30 p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">General waitlist — position #{waitlistPosition || '…'}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-destructive px-2"
                  onClick={handleLeaveWaitlist}
                  disabled={waitlistLoading}
                >
                  Leave
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">We'll tap you when a seat drops.</p>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🏆</div>
              <p className="font-semibold">No tournaments yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back soon for upcoming events
              </p>
            </div>
          ) : (
            tournaments.map(({ tournament, playerCount, liveRound }) => (
              <TournamentLobbyCard
                key={tournament.id}
                tournament={tournament}
                liveRound={liveRound}
                playerCount={playerCount}
                isEnrolled={tournament.id === enrolledTournament?.id}
                isEnrolledElsewhere={!!enrolledTournament && tournament.id !== enrolledTournament.id}
                enrolledTournamentName={enrolledTournament?.name}
                onJoin={() => handleJoinTournament(tournament)}
                isJoining={joiningId === tournament.id}
                onView={() => navigate('/matches')}
                waitlistEntry={waitlistEntry}
                waitlistPosition={waitlistPosition}
                onJoinWaitlist={() => handleOpenWaitlistDialog(tournament)}
                onLeaveWaitlist={handleLeaveWaitlist}
                waitlistLoading={waitlistLoading}
              />
            ))
          )}
        </div>
      </PageLayout>
      <BottomNav />

      <JoinWaitlistDialog
        open={waitlistDialogOpen}
        onOpenChange={setWaitlistDialogOpen}
        tournamentName={waitlistTargetTournament?.name}
        defaultName={player?.full_name || ''}
        defaultPhone={player?.phone || ''}
        onSubmit={handleWaitlistSubmit}
      />
    </>
  );
}
