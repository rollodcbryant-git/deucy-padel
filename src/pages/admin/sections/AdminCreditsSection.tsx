import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Player, CreditLedgerEntry } from '@/lib/types';
import { Plus, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { formatEuros } from '@/lib/euros';

interface Props {
  tournamentId: string;
  players: Player[];
  onReload: () => void;
}

export default function AdminCreditsSection({ tournamentId, players, onReload }: Props) {
  const { toast } = useToast();
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [adjustPlayer, setAdjustPlayer] = useState<string | null>(null);
  const [adjustAmountEuros, setAdjustAmountEuros] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Only show active roster players (not Removed)
  const rosterPlayers = players.filter(p => p.status !== 'Removed');

  const loadLedger = async (playerId: string) => {
    const { data } = await supabase
      .from('credit_ledger_entries')
      .select('*')
      .eq('player_id', playerId)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })
      .limit(50);
    setLedger((data || []) as CreditLedgerEntry[]);
  };

  const toggleExpand = (playerId: string) => {
    if (expandedPlayer === playerId) {
      setExpandedPlayer(null);
    } else {
      setExpandedPlayer(playerId);
      loadLedger(playerId);
    }
  };

  const submitAdjustment = async () => {
    const amountCents = Math.round(parseFloat(adjustAmountEuros || '0') * 100);
    if (!adjustPlayer || amountCents === 0 || !adjustReason.trim()) {
      toast({ title: 'Fill all fields', variant: 'destructive' });
      return;
    }
    const player = rosterPlayers.find(p => p.id === adjustPlayer);
    if (!player) return;

    await supabase.from('credit_ledger_entries').insert({
      tournament_id: tournamentId,
      player_id: adjustPlayer,
      type: 'AdminAdjustment',
      amount: amountCents,
      note: adjustReason,
    });
    await supabase.from('players').update({
      credits_balance: player.credits_balance + amountCents,
    }).eq('id', adjustPlayer);

    toast({ title: `Adjusted ${player.full_name} by ${amountCents > 0 ? '+' : ''}${formatEuros(amountCents)}` });
    setAdjustPlayer(null);
    setAdjustAmountEuros('');
    setAdjustReason('');
    onReload();
  };

  /** Sync Ledger with Roster: remove orphan entries + recalculate balances */
  const syncLedgerWithRoster = async () => {
    const rosterIds = rosterPlayers.map(p => p.id);
    
    // Get all ledger entries for this tournament
    const { data: allEntries } = await supabase
      .from('credit_ledger_entries')
      .select('id, player_id')
      .eq('tournament_id', tournamentId);

    // Find orphans (player_id not in current roster)
    const orphanEntries = (allEntries || []).filter(e => !rosterIds.includes(e.player_id));
    
    if (orphanEntries.length > 0) {
      for (const entry of orphanEntries) {
        await supabase.from('credit_ledger_entries').delete().eq('id', entry.id);
      }
    }

    // Recalculate each roster player's balance from ledger
    for (const player of rosterPlayers) {
      const { data: entries } = await supabase
        .from('credit_ledger_entries')
        .select('amount')
        .eq('player_id', player.id)
        .eq('tournament_id', tournamentId);
      
      const calculatedBalance = (entries || []).reduce((sum, e) => sum + e.amount, 0);
      await supabase.from('players').update({ credits_balance: calculatedBalance }).eq('id', player.id);
    }

    toast({ title: `Synced! Removed ${orphanEntries.length} orphan entries, recalculated ${rosterPlayers.length} balances` });
    onReload();
  };

  const sorted = [...rosterPlayers].sort((a, b) => b.credits_balance - a.credits_balance);

  return (
    <div className="space-y-3">
      {/* Sync utility */}
      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={syncLedgerWithRoster}>
        <RefreshCw className="mr-1 h-3 w-3" /> Sync Ledger with Roster
      </Button>

      {/* Leaderboard + Ledger */}
      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {sorted.map((p, i) => (
          <div key={p.id}>
            <button
              onClick={() => toggleExpand(p.id)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-5 text-xs">#{i + 1}</span>
                <div className="text-left">
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.matches_played}MP · {p.sets_won}-{p.sets_lost}S · {p.no_shows}NS</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary">{formatEuros(p.credits_balance)}</span>
                {expandedPlayer === p.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </div>
            </button>

            {expandedPlayer === p.id && (
              <div className="ml-7 mt-1 mb-2 space-y-1">
                {ledger.map(e => (
                  <div key={e.id} className="flex justify-between text-xs p-1.5 rounded bg-muted/20">
                    <span className="text-muted-foreground">{e.type}{e.note ? ` · ${e.note}` : ''}</span>
                    <span className={e.amount >= 0 ? 'text-primary' : 'text-destructive'}>{e.amount > 0 ? '+' : ''}{formatEuros(e.amount)}</span>
                  </div>
                ))}
                {ledger.length === 0 && <p className="text-xs text-muted-foreground py-1">No transactions</p>}
                <Button variant="outline" size="sm" className="h-7 text-xs mt-1" onClick={() => setAdjustPlayer(p.id)}>
                  <Plus className="mr-1 h-3 w-3" />Adjust Balance
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Adjustment form */}
      {adjustPlayer && (
        <div className="p-3 rounded-lg border border-border space-y-2">
          <p className="text-sm font-medium">Adjust: {rosterPlayers.find(p => p.id === adjustPlayer)?.full_name}</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              <Input type="number" value={adjustAmountEuros} onChange={e => setAdjustAmountEuros(e.target.value)} placeholder="Amount (+/-)" className="h-8 pl-7" step="0.5" />
            </div>
          </div>
          <Textarea value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Reason (required)" className="min-h-[60px]" />
          <div className="flex gap-2">
            <Button size="sm" onClick={submitAdjustment} className="bg-gradient-primary">Apply</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdjustPlayer(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
