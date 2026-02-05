import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { Tournament } from '@/lib/types';
import { Database, Trash2, Archive, Copy, ExternalLink, Eye } from 'lucide-react';

interface Props {
  tournament: Tournament;
  onReload: () => void;
  callEngine: (action: string, extra?: any) => Promise<any>;
  isUpdating: boolean;
}

export default function AdminUtilitiesSection({ tournament, onReload, callEngine, isUpdating }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const previewAsPlayer = async () => {
    const { data: players } = await supabase
      .from('players')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('status', 'Active')
      .limit(1);
    
    if (!players || players.length === 0) {
      toast({ title: 'No active players to preview as', variant: 'destructive' });
      return;
    }

    const player = players[0];
    const token = crypto.randomUUID();
    await supabase.from('players').update({ session_token: token }).eq('id', player.id);

    const session = {
      playerId: player.id,
      tournamentId: tournament.id,
      playerName: player.full_name,
      token,
    };
    localStorage.setItem('padel_chaos_session', JSON.stringify(session));
    navigate('/home');
  };
  const getPublishedUrl = () => {
    const origin = window.location.origin;
    if (origin.includes('preview--') || origin.includes('lovable.dev')) {
      return 'https://padel-chaos-cup.lovable.app';
    }
    return origin;
  };

  const copyInviteLink = () => {
    const link = `${getPublishedUrl()}/?t=${tournament.id}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Invite link copied!' });
  };

  const resetRoundsMatches = async () => {
    // Delete matches, rounds, ledger entries (keep players)
    await supabase.from('matches').delete().eq('tournament_id', tournament.id);
    await supabase.from('rounds').delete().eq('tournament_id', tournament.id);
    await supabase.from('credit_ledger_entries').delete().eq('tournament_id', tournament.id);
    // Reset player stats
    await supabase.from('players').update({
      credits_balance: 0, matches_played: 0, sets_won: 0, sets_lost: 0,
      match_wins: 0, match_losses: 0, no_shows: 0,
    }).eq('tournament_id', tournament.id);
    await supabase.from('tournaments').update({ status: 'SignupOpen', rounds_count: null }).eq('id', tournament.id);
    toast({ title: 'Rounds & matches reset. Roster kept.' });
    onReload();
  };

  const archiveTournament = async () => {
    await supabase.from('tournaments').update({ status: 'Closed' }).eq('id', tournament.id);
    toast({ title: 'Tournament archived' });
    onReload();
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" className="w-full justify-start text-primary border-primary/30" onClick={previewAsPlayer}>
        <Eye className="mr-2 h-4 w-4" />Preview as Player
      </Button>

      <Button variant="outline" className="w-full justify-start" onClick={copyInviteLink}>
        <Copy className="mr-2 h-4 w-4" />Copy Invite Link
      </Button>

      <Button variant="outline" className="w-full justify-start" onClick={() => window.open(`${getPublishedUrl()}/?t=${tournament.id}`, '_blank')}>
        <ExternalLink className="mr-2 h-4 w-4" />View Player Page
      </Button>

      {tournament.join_code && (
        <div className="p-3 rounded-lg bg-muted/30 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Join Code</p>
          <p className="text-2xl font-mono font-bold text-primary tracking-wider">{tournament.join_code}</p>
        </div>
      )}

      <Button variant="outline" className="w-full justify-start text-chaos-orange border-chaos-orange/30"
        onClick={() => callEngine('seed_demo')} disabled={isUpdating}>
        <Database className="mr-2 h-4 w-4" />Seed Demo (8 players + start)
      </Button>

      <Button variant="outline" className="w-full justify-start text-destructive border-destructive/30"
        onClick={resetRoundsMatches}>
        <Trash2 className="mr-2 h-4 w-4" />Reset Rounds & Matches (keep roster)
      </Button>

      <Button variant="outline" className="w-full justify-start"
        onClick={archiveTournament} disabled={tournament.status === 'Closed'}>
        <Archive className="mr-2 h-4 w-4" />Archive Tournament
      </Button>
    </div>
  );
}
