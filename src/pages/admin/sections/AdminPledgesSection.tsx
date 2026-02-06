import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusChip } from '@/components/ui/StatusChip';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { PledgeItem, Player, Round } from '@/lib/types';
import { Check, EyeOff, Copy, Edit, AlertTriangle } from 'lucide-react';

interface Props {
  pledges: PledgeItem[];
  players: Player[];
  rounds: Round[];
  onReload: () => void;
}

export default function AdminPledgesSection({ pledges, players, rounds, onReload }: Props) {
  const { toast } = useToast();
  const [editingPledge, setEditingPledge] = useState<string | null>(null);
  const [estLow, setEstLow] = useState(0);
  const [estHigh, setEstHigh] = useState(0);
  const [priceEuro, setPriceEuro] = useState(0);
  const [adminNote, setAdminNote] = useState('');
  const [selectedRound, setSelectedRound] = useState<string>('all');

  const playerMap = new Map(players.map(p => [p.id, p]));
  const activePlayers = players.filter(p => p.status === 'Active');

  // Group pledges by round
  const pledgesByRound = useMemo(() => {
    const map = new Map<string, PledgeItem[]>();
    for (const p of pledges) {
      const key = p.round_id || 'unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [pledges]);

  // Missing pledges for a round
  const getMissingPlayers = (roundId: string) => {
    const roundPledges = pledgesByRound.get(roundId) || [];
    const pledgedIds = new Set(roundPledges.map(p => p.pledged_by_player_id));
    return activePlayers.filter(p => !pledgedIds.has(p.id));
  };

  const currentRound = rounds.find(r => r.status === 'Live');
  const missingForCurrentRound = currentRound ? getMissingPlayers(currentRound.id) : [];

  const displayedPledges = useMemo(() => {
    if (selectedRound === 'all') return pledges;
    if (selectedRound === 'unassigned') return pledges.filter(p => !p.round_id);
    return pledges.filter(p => p.round_id === selectedRound);
  }, [pledges, selectedRound]);

  const toggleApproval = async (pledge: PledgeItem) => {
    const newStatus = pledge.status === 'Approved' ? 'Draft' : 'Approved';
    await supabase.from('pledge_items').update({ status: newStatus, approved: newStatus === 'Approved' }).eq('id', pledge.id);
    onReload();
  };

  const hidePledge = async (id: string) => {
    await supabase.from('pledge_items').update({ status: 'Hidden' }).eq('id', id);
    onReload();
  };

  const saveEstimates = async (id: string) => {
    await supabase.from('pledge_items').update({
      estimate_low: estLow,
      estimate_high: estHigh,
      admin_note: adminNote || null,
    }).eq('id', id);
    setEditingPledge(null);
    toast({ title: 'Estimates saved' });
    onReload();
  };

  const exportPledges = () => {
    const block = pledges
      .filter(p => p.status === 'Approved')
      .map(p => {
        const r = rounds.find(r => r.id === p.round_id);
        return `[R${r?.index || '?'}] ${p.title} (${p.category}) - by ${playerMap.get(p.pledged_by_player_id)?.full_name || '?'}`;
      })
      .join('\n');
    navigator.clipboard.writeText(block);
    toast({ title: 'Pledge list copied' });
  };

  return (
    <div className="space-y-4">
      {/* Missing pledges warning */}
      {currentRound && missingForCurrentRound.length > 0 && (
        <div className="rounded-lg bg-chaos-orange/10 border border-chaos-orange/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-chaos-orange" />
            <p className="text-sm font-medium text-chaos-orange">
              Round {currentRound.index}: {missingForCurrentRound.length} player{missingForCurrentRound.length > 1 ? 's' : ''} haven't pledged
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {missingForCurrentRound.map(p => (
              <span key={p.id} className="text-xs bg-muted rounded-full px-2 py-0.5">{p.full_name}</span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            These players won't be assigned matches if pledge gate is enabled
          </p>
        </div>
      )}

      {/* Round progress */}
      {currentRound && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Round {currentRound.index} pledges: {(pledgesByRound.get(currentRound.id) || []).length}/{activePlayers.length}
            </span>
          </div>
          <Progress
            value={activePlayers.length > 0 ? ((pledgesByRound.get(currentRound.id) || []).length / activePlayers.length) * 100 : 0}
            className="h-2"
          />
        </div>
      )}

      {/* Round filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        <Button
          variant={selectedRound === 'all' ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={() => setSelectedRound('all')}
        >
          All ({pledges.length})
        </Button>
        {rounds.map(r => {
          const count = (pledgesByRound.get(r.id) || []).length;
          return (
            <Button
              key={r.id}
              variant={selectedRound === r.id ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => setSelectedRound(r.id)}
            >
              R{r.index} ({count})
            </Button>
          );
        })}
        {(pledgesByRound.get('unassigned') || []).length > 0 && (
          <Button
            variant={selectedRound === 'unassigned' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => setSelectedRound('unassigned')}
          >
            Unassigned ({(pledgesByRound.get('unassigned') || []).length})
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {displayedPledges.filter(p => p.status === 'Approved').length} approved · {displayedPledges.filter(p => p.status === 'Draft').length} pending
        </p>
        <Button variant="outline" size="sm" onClick={exportPledges}><Copy className="mr-1 h-3 w-3" />Export</Button>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {displayedPledges.map(pledge => {
          const pledgeRound = rounds.find(r => r.id === pledge.round_id);
          return (
            <div key={pledge.id} className="rounded-lg bg-muted/30 p-3 space-y-2">
              <div className="flex gap-3">
                <div className="h-16 w-16 rounded-lg bg-muted shrink-0 overflow-hidden">
                  {pledge.image_url ? (
                    <img src={pledge.image_url} alt={pledge.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-2xl opacity-40">📦</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {pledgeRound && (
                        <span className="shrink-0 text-[10px] font-bold bg-primary/20 text-primary rounded px-1.5 py-0.5">
                          R{pledgeRound.index}
                        </span>
                      )}
                      <p className="font-medium text-sm truncate">{pledge.title}</p>
                    </div>
                    <StatusChip variant={pledge.status === 'Approved' ? 'success' : pledge.status === 'Hidden' ? 'error' : 'warning'} size="sm">
                      {pledge.status}
                    </StatusChip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pledge.category} · by {playerMap.get(pledge.pledged_by_player_id)?.full_name || '?'}
                    {pledge.estimate_low != null && ` · €${Math.round((pledge.estimate_low || 0) / 100)}–€${Math.round((pledge.estimate_high || 0) / 100)}`}
                  </p>
                </div>
              </div>

              {editingPledge === pledge.id && (
                <div className="space-y-3 bg-muted/50 rounded-lg p-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Expert estimate (€)</label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                        <Input type="number" value={estLow} onChange={e => setEstLow(Number(e.target.value))} placeholder="Min" className="h-8 pl-6" />
                      </div>
                      <span className="text-muted-foreground text-xs">–</span>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                        <Input type="number" value={estHigh} onChange={e => setEstHigh(Number(e.target.value))} placeholder="Max" className="h-8 pl-6" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Price (€)</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                      <Input type="number" value={priceEuro} onChange={e => setPriceEuro(Number(e.target.value))} placeholder="Starting price" className="h-8 pl-6 w-32" />
                    </div>
                  </div>
                  <Textarea
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    placeholder="Internal admin note (optional)"
                    rows={2}
                    className="text-xs"
                  />
                  <Button size="sm" className="h-8" onClick={() => saveEstimates(pledge.id)}>Save</Button>
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toggleApproval(pledge)}>
                  <Check className="mr-1 h-3 w-3" />{pledge.status === 'Approved' ? 'Revoke' : 'Approve'}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => hidePledge(pledge.id)}>
                  <EyeOff className="mr-1 h-3 w-3" />Hide
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                  setEditingPledge(pledge.id);
                  setEstLow(pledge.estimate_low || 0);
                  setEstHigh(pledge.estimate_high || 0);
                  setAdminNote((pledge as any).admin_note || '');
                }}>
                  <Edit className="mr-1 h-3 w-3" />Estimates
                </Button>
              </div>
            </div>
          );
        })}
        {displayedPledges.length === 0 && <p className="text-muted-foreground text-center py-4 text-sm">No pledges in this view</p>}
      </div>
    </div>
  );
}
