import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Player, CreditLedgerEntry } from '@/lib/types';
import { Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

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
    if (!adjustPlayer || adjustAmount === 0 || !adjustReason.trim()) {
      toast({ title: 'Fill all fields', variant: 'destructive' });
      return;
    }
    const player = players.find(p => p.id === adjustPlayer);
    if (!player) return;

    await supabase.from('credit_ledger_entries').insert({
      tournament_id: tournamentId,
      player_id: adjustPlayer,
      type: 'AdminAdjustment',
      amount: adjustAmount,
      note: adjustReason,
    });
    await supabase.from('players').update({
      credits_balance: player.credits_balance + adjustAmount,
    }).eq('id', adjustPlayer);

    toast({ title: `Adjusted ${player.full_name} by ${adjustAmount > 0 ? '+' : ''}${adjustAmount}c` });
    setAdjustPlayer(null);
    setAdjustAmount(0);
    setAdjustReason('');
    onReload();
  };

  const sorted = [...players].sort((a, b) => b.credits_balance - a.credits_balance);

  return (
    <div className="space-y-3">
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
                <span className="font-mono text-primary">{p.credits_balance}c</span>
                {expandedPlayer === p.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </div>
            </button>

            {expandedPlayer === p.id && (
              <div className="ml-7 mt-1 mb-2 space-y-1">
                {ledger.map(e => (
                  <div key={e.id} className="flex justify-between text-xs p-1.5 rounded bg-muted/20">
                    <span className="text-muted-foreground">{e.type}{e.note ? ` · ${e.note}` : ''}</span>
                    <span className={e.amount >= 0 ? 'text-primary' : 'text-destructive'}>{e.amount > 0 ? '+' : ''}{e.amount}</span>
                  </div>
                ))}
                {ledger.length === 0 && <p className="text-xs text-muted-foreground py-1">No transactions</p>}
                <Button variant="outline" size="sm" className="h-7 text-xs mt-1" onClick={() => setAdjustPlayer(p.id)}>
                  <Plus className="mr-1 h-3 w-3" />Adjust Credits
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Adjustment form */}
      {adjustPlayer && (
        <div className="p-3 rounded-lg border border-border space-y-2">
          <p className="text-sm font-medium">Adjust: {players.find(p => p.id === adjustPlayer)?.full_name}</p>
          <div className="flex gap-2">
            <Input type="number" value={adjustAmount} onChange={e => setAdjustAmount(Number(e.target.value))} placeholder="Amount (+/-)" className="h-8" />
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
