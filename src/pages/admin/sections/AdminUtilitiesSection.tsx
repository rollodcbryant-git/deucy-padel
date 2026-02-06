import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Tournament } from '@/lib/types';
import { Database, Trash2, Archive, Copy, ExternalLink, Eye, RotateCcw } from 'lucide-react';

interface Props {
  tournament: Tournament;
  onReload: () => void;
  callEngine: (action: string, extra?: any) => Promise<any>;
  isUpdating: boolean;
}

export default function AdminUtilitiesSection({ tournament, onReload, callEngine, isUpdating }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

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
    navigate('/tournaments');
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

  const fullReset = async () => {
    setResetting(true);
    try {
      // Delete in dependency order
      await supabase.from('match_bets').delete().eq('tournament_id', tournament.id);
      await supabase.from('credit_ledger_entries').delete().eq('tournament_id', tournament.id);
      await supabase.from('notifications').delete().eq('tournament_id', tournament.id);

      // Auction data
      const { data: auctionData } = await supabase.from('auctions').select('id').eq('tournament_id', tournament.id).maybeSingle();
      if (auctionData) {
        const { data: lots } = await supabase.from('auction_lots').select('id').eq('auction_id', auctionData.id);
        if (lots && lots.length > 0) {
          const lotIds = lots.map(l => l.id);
          await supabase.from('bids').delete().in('lot_id', lotIds);
          await supabase.from('escrow_holds').delete().in('lot_id', lotIds);
          await supabase.from('auction_lots').delete().eq('auction_id', auctionData.id);
        }
        await supabase.from('auctions').delete().eq('id', auctionData.id);
      }

      // Matches & rounds
      await supabase.from('matches').delete().eq('tournament_id', tournament.id);
      await supabase.from('rounds').delete().eq('tournament_id', tournament.id);

      // Reset player stats to starting state
      await supabase.from('players').update({
        credits_balance: tournament.starting_credits,
        matches_played: 0, sets_won: 0, sets_lost: 0,
        match_wins: 0, match_losses: 0, no_shows: 0,
        confirmed: false, status: 'Active',
      }).eq('tournament_id', tournament.id);

      // Reset tournament
      await supabase.from('tournaments').update({
        status: 'SignupOpen', started_at: null, ended_at: null,
        rounds_count: null,
      }).eq('id', tournament.id);

      toast({ title: 'Tournament fully reset ♻️', description: 'Back to SignupOpen. Roster & pledges kept.' });
      onReload();
    } catch (err: any) {
      console.error('Reset error:', err);
      toast({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    } finally {
      setResetting(false);
      setShowResetDialog(false);
      setResetConfirmText('');
    }
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
        onClick={() => setShowResetDialog(true)} disabled={resetting}>
        <RotateCcw className="mr-2 h-4 w-4" />Reset Tournament (back to start)
      </Button>

      <Button variant="outline" className="w-full justify-start"
        onClick={archiveTournament} disabled={tournament.status === 'Closed'}>
        <Archive className="mr-2 h-4 w-4" />Archive Tournament
      </Button>

      {/* Reset confirmation dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset "{tournament.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will <strong>delete all</strong> rounds, matches, bets, auction data, ledger entries, and notifications. Player stats and credits will be reset to starting values.</p>
              <p>The roster and pledges will be <strong>kept</strong>.</p>
              <p className="text-destructive font-medium">Type <strong>RESET</strong> to confirm.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Type RESET"
            value={resetConfirmText}
            onChange={e => setResetConfirmText(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={fullReset}
              disabled={resetConfirmText !== 'RESET' || resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? 'Resetting…' : 'Reset Tournament'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
