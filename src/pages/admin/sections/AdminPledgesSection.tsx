import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusChip } from '@/components/ui/StatusChip';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { PledgeItem, Player, Round } from '@/lib/types';
import { Check, EyeOff, Copy, Edit, AlertTriangle, Trash2 } from 'lucide-react';

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

  const playerMap = new Map(players.map(p => [p.id, p]));
  const activePlayers = players.filter(p => p.status === 'Active');

  // Players who have no pledge at all
  const playersWithPledges = useMemo(() => {
    const ids = new Set(pledges.filter(p => p.status !== 'Hidden').map(p => p.pledged_by_player_id));
    return ids;
  }, [pledges]);

  const missingPlayers = useMemo(() => {
    return activePlayers.filter(p => !playersWithPledges.has(p.id));
  }, [activePlayers, playersWithPledges]);

  const toggleApproval = async (pledge: PledgeItem) => {
    const newStatus = pledge.status === 'Approved' ? 'Draft' : 'Approved';
    await supabase.from('pledge_items').update({ status: newStatus, approved: newStatus === 'Approved' }).eq('id', pledge.id);
    onReload();
  };

  const hidePledge = async (id: string) => {
    await supabase.from('pledge_items').update({ status: 'Hidden' }).eq('id', id);
    onReload();
  };

  const deletePledge = async (pledge: PledgeItem) => {
    const { data: lots } = await supabase
      .from('auction_lots')
      .select('id, status')
      .eq('pledge_item_id', pledge.id)
      .eq('status', 'Live');
    
    if (lots && lots.length > 0) {
      toast({ title: 'Cannot delete', description: 'This pledge has a live auction lot. End the auction first.', variant: 'destructive' });
      return;
    }

    await supabase.from('auction_lots').delete().eq('pledge_item_id', pledge.id);
    await supabase.from('pledge_items').delete().eq('id', pledge.id);
    toast({ title: 'Pledge permanently deleted' });
    onReload();
  };

  const saveEstimates = async (id: string) => {
    await supabase.from('pledge_items').update({
      estimate_low: estLow * 100,
      estimate_high: estHigh * 100,
      price_euro: priceEuro ? priceEuro * 100 : null,
      admin_note: adminNote || null,
    }).eq('id', id);
    setEditingPledge(null);
    toast({ title: 'Estimates saved' });
    onReload();
  };

  const exportPledges = () => {
    const block = pledges
      .filter(p => p.status === 'Approved')
      .map(p => `${p.title} (${p.category}) - by ${playerMap.get(p.pledged_by_player_id)?.full_name || '?'}`)
      .join('\n');
    navigator.clipboard.writeText(block);
    toast({ title: 'Pledge list copied' });
  };

  return (
    <div className="space-y-4">
      {/* Missing pledges warning */}
      {missingPlayers.length > 0 && (
        <div className="rounded-lg bg-chaos-orange/10 border border-chaos-orange/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-chaos-orange" />
            <p className="text-sm font-medium text-chaos-orange">
              {missingPlayers.length} player{missingPlayers.length > 1 ? 's' : ''} haven't pledged yet
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {missingPlayers.map(p => (
              <span key={p.id} className="text-xs bg-muted rounded-full px-2 py-0.5">{p.full_name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Pledge progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {playersWithPledges.size}/{activePlayers.length} players pledged · {pledges.length} items total
          </span>
        </div>
        <Progress
          value={activePlayers.length > 0 ? (playersWithPledges.size / activePlayers.length) * 100 : 0}
          className="h-2"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pledges.filter(p => p.status === 'Approved').length} approved · {pledges.filter(p => p.status === 'Draft').length} pending
        </p>
        <Button variant="outline" size="sm" onClick={exportPledges}><Copy className="mr-1 h-3 w-3" />Export</Button>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {pledges.map(pledge => (
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
                  <p className="font-medium text-sm truncate">{pledge.title}</p>
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
                <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Internal admin note (optional)" rows={2} className="text-xs" />
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
                setEstLow(Math.round((pledge.estimate_low || 0) / 100));
                setEstHigh(Math.round((pledge.estimate_high || 0) / 100));
                setPriceEuro(Math.round(((pledge as any).price_euro || 0) / 100));
                setAdminNote((pledge as any).admin_note || '');
              }}>
                <Edit className="mr-1 h-3 w-3" />Estimates
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/30" onClick={() => deletePledge(pledge)}>
                <Trash2 className="mr-1 h-3 w-3" />Delete
              </Button>
            </div>
          </div>
        ))}
        {pledges.length === 0 && <p className="text-muted-foreground text-center py-4 text-sm">No pledges yet</p>}
      </div>
    </div>
  );
}
