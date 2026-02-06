import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tournament } from '@/lib/types';

interface DeleteTournamentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  hasPlayersOrPledges: boolean;
  onDeleted: () => void;
}

export function DeleteTournamentDialog({ open, onOpenChange, tournament, hasPlayersOrPledges, onDeleted }: DeleteTournamentDialogProps) {
  const { toast } = useToast();
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [forceConfirmed, setForceConfirmed] = useState(false);

  const nameMatches = confirmName.trim().toLowerCase() === tournament.name.trim().toLowerCase();
  const needsForce = hasPlayersOrPledges;
  const canDelete = nameMatches && (!needsForce || forceConfirmed);

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      // Delete in order: bids → escrow → auction_lots → auctions → credit_ledger → matches → rounds → pledge_items → notifications → players → tournament
      const tid = tournament.id;
      
      // Get auction IDs first
      const { data: auctions } = await supabase.from('auctions').select('id').eq('tournament_id', tid);
      const auctionIds = (auctions || []).map(a => a.id);
      
      if (auctionIds.length > 0) {
        const { data: lots } = await supabase.from('auction_lots').select('id').in('auction_id', auctionIds);
        const lotIds = (lots || []).map(l => l.id);
        if (lotIds.length > 0) {
          await supabase.from('bids').delete().in('lot_id', lotIds);
          await supabase.from('escrow_holds').delete().in('lot_id', lotIds);
          await supabase.from('auction_lots').delete().in('auction_id', auctionIds);
        }
        await supabase.from('auctions').delete().eq('tournament_id', tid);
      }

      await supabase.from('credit_ledger_entries').delete().eq('tournament_id', tid);
      await supabase.from('matches').delete().eq('tournament_id', tid);
      await supabase.from('rounds').delete().eq('tournament_id', tid);
      await supabase.from('pledge_items').delete().eq('tournament_id', tid);
      await supabase.from('notifications').delete().eq('tournament_id', tid);
      await supabase.from('players').delete().eq('tournament_id', tid);
      
      const { error } = await supabase.from('tournaments').delete().eq('id', tid);
      if (error) throw error;

      toast({ title: 'Tournament deleted', description: `"${tournament.name}" has been permanently removed.` });
      onDeleted();
    } catch (err: any) {
      console.error('Delete error:', err);
      toast({ title: 'Delete failed', description: err.message || 'Could not delete tournament.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setConfirmName(''); setForceConfirmed(false); } onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Tournament
          </DialogTitle>
          <DialogDescription>
            This permanently removes the tournament, rounds, matches, pledges, credits, and all player data. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type <span className="font-bold">"{tournament.name}"</span> to confirm</Label>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={tournament.name}
            />
          </div>

          {needsForce && nameMatches && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2">
              <p className="text-xs text-destructive font-medium">
                ⚠️ This tournament has players and/or pledges. Force delete?
              </p>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceConfirmed}
                  onChange={(e) => setForceConfirmed(e.target.checked)}
                  className="rounded"
                />
                Yes, permanently delete everything
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || isDeleting}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {isDeleting ? 'Deleting...' : 'Delete Forever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
