import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { StatusChip } from '@/components/ui/StatusChip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import type { Tournament, MatchBet } from '@/lib/types';
import { Zap, Banknote, Shield, TrendingUp, Trash2, Sparkles } from 'lucide-react';

interface Props {
  tournament: Tournament;
  onReload: () => void;
}

const MICRO_DEFAULTS = {
  bankBalance: 100,
  multiplier: 2.0,
  roundCap: 10,
  betMax: 5,
  minProtected: 5,
};

export default function AdminBettingSection({ tournament, onReload }: Props) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(tournament.betting_enabled);
  const [bankBalance, setBankBalance] = useState(tournament.bank_balance);
  const [roundCap, setRoundCap] = useState(tournament.per_round_bet_cap);
  const [betMax, setBetMax] = useState(Math.min(tournament.per_bet_max, 5));
  const [minProtected, setMinProtected] = useState(tournament.min_protected_balance);
  const [multiplier, setMultiplier] = useState(Number(tournament.payout_multiplier));
  const [bets, setBets] = useState<MatchBet[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadBets(); }, [tournament.id]);

  const loadBets = async () => {
    const { data } = await supabase.from('match_bets').select('*').eq('tournament_id', tournament.id).order('created_at', { ascending: false });
    setBets((data || []) as MatchBet[]);
  };

  const applyMicroDefaults = () => {
    setBankBalance(MICRO_DEFAULTS.bankBalance);
    setMultiplier(MICRO_DEFAULTS.multiplier);
    setRoundCap(MICRO_DEFAULTS.roundCap);
    setBetMax(MICRO_DEFAULTS.betMax);
    setMinProtected(MICRO_DEFAULTS.minProtected);
    toast({ title: 'Micro-bet defaults applied 🎯' });
  };

  const saveSettings = async () => {
    const clampedBetMax = Math.min(betMax, 5);
    const clampedRoundCap = Math.max(0, Math.min(roundCap, 50));
    const clampedFloor = Math.max(0, Math.min(minProtected, 20));
    const clampedMultiplier = Math.max(1.5, Math.min(multiplier, 3.0));
    const clampedBank = Math.max(0, bankBalance);

    setSaving(true);
    await supabase.from('tournaments').update({
      betting_enabled: enabled,
      bank_balance: clampedBank,
      per_round_bet_cap: clampedRoundCap,
      per_bet_max: clampedBetMax,
      min_protected_balance: clampedFloor,
      payout_multiplier: clampedMultiplier,
    } as any).eq('id', tournament.id);
    setSaving(false);
    toast({ title: 'Betting settings saved ✅' });
    onReload();
  };

  const resetAllBets = async () => {
    const pendingBets = bets.filter(b => b.status === 'Pending');
    for (const bet of pendingBets) {
      const { data: player } = await supabase.from('players').select('credits_balance').eq('id', bet.player_id).single();
      if (player) {
        await supabase.from('players').update({ credits_balance: player.credits_balance + bet.stake }).eq('id', bet.player_id);
      }
    }
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

  const fmtEuro = (v: number) => `€${v}`;

  return (
    <div className="space-y-4">
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
                {fmtEuro(bankBalance)}
              </StatusChip>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
              <div>
                <p>Total staked</p>
                <p className="font-semibold text-foreground">{fmtEuro(totalStaked)}</p>
              </div>
              <div>
                <p>Paid out</p>
                <p className="font-semibold text-destructive">{fmtEuro(totalPaidOut)}</p>
              </div>
              <div>
                <p>Net bank</p>
                <p className={`font-semibold ${netBank >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {netBank >= 0 ? '+' : ''}{fmtEuro(netBank)}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{pending} pending bets · {bets.length} total</p>
          </div>

          {/* Micro-bet preset */}
          <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={applyMicroDefaults}>
            <Sparkles className="mr-1.5 h-3 w-3" />
            Use micro-bet defaults
          </Button>

          {/* Core settings */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Banknote className="h-3 w-3" /> Bank balance (€)
                </label>
                <Input type="number" min={0} value={bankBalance} onChange={e => setBankBalance(Math.max(0, Number(e.target.value)))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Payout multiplier
                </label>
                <Input type="number" step="0.1" min={1.5} max={3.0} value={multiplier} onChange={e => setMultiplier(Math.max(1.5, Math.min(3.0, Number(e.target.value))))} className="h-8 text-xs" />
                <p className="text-[9px] text-muted-foreground">1.5x – 3.0x range</p>
              </div>
            </div>

            {/* Max per match — locked at 5 */}
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground font-medium">Max per match (€)</label>
              <div className="h-8 rounded-md border border-border bg-muted/50 px-3 flex items-center text-xs text-muted-foreground">
                €5 (hard cap)
              </div>
              <p className="text-[9px] text-muted-foreground">Players can never bet more than €5 on a single match.</p>
            </div>

            {/* Advanced settings */}
            <Accordion type="single" collapsible>
              <AccordionItem value="advanced" className="border-none">
                <AccordionTrigger className="text-[10px] text-muted-foreground py-1 hover:no-underline">
                  Advanced limits
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-medium">Max you can bet per round (€)</label>
                    <Input type="number" min={0} max={50} value={roundCap} onChange={e => setRoundCap(Math.max(0, Math.min(50, Number(e.target.value))))} className="h-8 text-xs" />
                    <p className="text-[9px] text-muted-foreground">Total across ALL matches in a round. Keep it small. Default €10.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Protected minimum balance (€)
                    </label>
                    <Input type="number" min={0} max={20} value={minProtected} onChange={e => setMinProtected(Math.max(0, Math.min(20, Number(e.target.value))))} className="h-8 text-xs" />
                    <p className="text-[9px] text-muted-foreground">Players can't bet below this balance, so they always have € left for the auction. Default €5.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Summary line */}
          <div className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">
              Players can bet up to <span className="font-semibold text-foreground">€5 per match</span>, <span className="font-semibold text-foreground">€{roundCap} per round</span>, cannot drop below <span className="font-semibold text-foreground">€{minProtected}</span>.
            </p>
          </div>

          <p className="text-[10px] text-muted-foreground">€ = in-app points (not real money).</p>

          <Button size="sm" className="w-full h-8 text-xs" onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Betting Settings'}
          </Button>

          <Button variant="outline" size="sm" className="w-full h-8 text-xs text-destructive border-destructive/30" onClick={resetAllBets}>
            <Trash2 className="mr-1 h-3 w-3" /> Reset All Bets
          </Button>
        </>
      )}
    </div>
  );
}
