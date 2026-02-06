import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/hooks/use-toast';
import { formatEuros } from '@/lib/euros';
import type { Tournament, MatchBet } from '@/lib/types';
import { Zap, Banknote, Shield, TrendingUp, Trash2, Pause, Play } from 'lucide-react';

interface Props {
  tournament: Tournament;
  onReload: () => void;
}

export default function AdminBettingSection({ tournament, onReload }: Props) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(tournament.betting_enabled);
  const [bankBalance, setBankBalance] = useState(tournament.bank_balance);
  const [roundCap, setRoundCap] = useState(tournament.per_round_bet_cap);
  const [betMax, setBetMax] = useState(tournament.per_bet_max);
  const [minProtected, setMinProtected] = useState(tournament.min_protected_balance);
  const [multiplier, setMultiplier] = useState(Number(tournament.payout_multiplier));
  const [bets, setBets] = useState<MatchBet[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBets();
  }, [tournament.id]);

  const loadBets = async () => {
    const { data } = await supabase
      .from('match_bets')
      .select('*')
      .eq('tournament_id', tournament.id)
      .order('created_at', { ascending: false });
    setBets((data || []) as MatchBet[]);
  };

  const saveSettings = async () => {
    setSaving(true);
    await supabase.from('tournaments').update({
      betting_enabled: enabled,
      bank_balance: bankBalance,
      per_round_bet_cap: roundCap,
      per_bet_max: betMax,
      min_protected_balance: minProtected,
      payout_multiplier: multiplier,
    } as any).eq('id', tournament.id);
    setSaving(false);
    toast({ title: 'Betting settings saved ✅' });
    onReload();
  };

  const resetAllBets = async () => {
    // Refund all pending bets
    const pendingBets = bets.filter(b => b.status === 'Pending');
    for (const bet of pendingBets) {
      // Refund player
      const { data: player } = await supabase.from('players').select('credits_balance').eq('id', bet.player_id).single();
      if (player) {
        await supabase.from('players').update({
          credits_balance: player.credits_balance + bet.stake,
        }).eq('id', bet.player_id);
      }
    }
    // Delete all bets
    await supabase.from('match_bets').delete().eq('tournament_id', tournament.id);
    toast({ title: 'All bets cleared, stakes refunded' });
    loadBets();
    onReload();
  };

  const totalStaked = bets.reduce((s, b) => s + b.stake, 0);
  const totalPaidOut = bets.filter(b => b.status === 'Won').reduce((s, b) => s + (b.payout || 0), 0);
  const totalLost = bets.filter(b => b.status === 'Lost').reduce((s, b) => s + b.stake, 0);
  const netBank = totalLost - totalPaidOut;
  const pending = bets.filter(b => b.status === 'Pending').length;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-chaos-orange" />
          <span className="text-sm font-medium">Match Betting</span>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <>
          {/* Bank summary */}
          <div className="rounded-lg bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Bank</span>
              <StatusChip variant={bankBalance > 0 ? 'success' : 'error'} size="sm">
                {formatEuros(bankBalance)}
              </StatusChip>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
              <div>
                <p>Total staked</p>
                <p className="font-semibold text-foreground">{formatEuros(totalStaked)}</p>
              </div>
              <div>
                <p>Paid out</p>
                <p className="font-semibold text-destructive">{formatEuros(totalPaidOut)}</p>
              </div>
              <div>
                <p>Net bank</p>
                <p className={`font-semibold ${netBank >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {netBank >= 0 ? '+' : ''}{formatEuros(netBank)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{pending} pending bets · {bets.length} total</p>
          </div>

          {/* Settings */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Banknote className="h-3 w-3" /> Bank starting balance (cents)
                </label>
                <Input type="number" value={bankBalance} onChange={e => setBankBalance(Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Payout multiplier
                </label>
                <Input type="number" step="0.1" value={multiplier} onChange={e => setMultiplier(Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Round cap (c)</label>
                <Input type="number" value={roundCap} onChange={e => setRoundCap(Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Per bet max (c)</label>
                <Input type="number" value={betMax} onChange={e => setBetMax(Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Floor (c)
                </label>
                <Input type="number" value={minProtected} onChange={e => setMinProtected(Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
          </div>

          <Button size="sm" className="w-full h-8 text-xs" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Betting Settings'}
          </Button>

          {/* Emergency controls */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs text-destructive border-destructive/30"
              onClick={resetAllBets}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Reset All Bets
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
