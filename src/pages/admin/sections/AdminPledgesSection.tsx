import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/hooks/use-toast';
import type { PledgeItem, Player } from '@/lib/types';
import { Check, EyeOff, Copy, Edit } from 'lucide-react';

interface Props {
  pledges: PledgeItem[];
  players: Player[];
  onReload: () => void;
}

export default function AdminPledgesSection({ pledges, players, onReload }: Props) {
  const { toast } = useToast();
  const [editingPledge, setEditingPledge] = useState<string | null>(null);
  const [estLow, setEstLow] = useState(0);
  const [estHigh, setEstHigh] = useState(0);

  const playerMap = new Map(players.map(p => [p.id, p]));

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
    await supabase.from('pledge_items').update({ estimate_low: estLow, estimate_high: estHigh }).eq('id', id);
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
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportPledges}><Copy className="mr-1 h-3 w-3" />Export</Button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {pledges.map(pledge => (
          <div key={pledge.id} className="rounded-lg bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{pledge.title}</p>
                <p className="text-xs text-muted-foreground">
                  {pledge.category} · by {playerMap.get(pledge.pledged_by_player_id)?.full_name || '?'}
                  {pledge.estimate_low != null && ` · ${pledge.estimate_low}–${pledge.estimate_high}c`}
                </p>
              </div>
              <StatusChip variant={pledge.status === 'Approved' ? 'success' : pledge.status === 'Hidden' ? 'error' : 'neutral'} size="sm">
                {pledge.status}
              </StatusChip>
            </div>

            {editingPledge === pledge.id && (
              <div className="flex items-center gap-2">
                <Input type="number" value={estLow} onChange={e => setEstLow(Number(e.target.value))} placeholder="Low" className="h-8 w-20" />
                <span className="text-muted-foreground text-xs">–</span>
                <Input type="number" value={estHigh} onChange={e => setEstHigh(Number(e.target.value))} placeholder="High" className="h-8 w-20" />
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
              }}>
                <Edit className="mr-1 h-3 w-3" />Estimates
              </Button>
            </div>
          </div>
        ))}
        {pledges.length === 0 && <p className="text-muted-foreground text-center py-4 text-sm">No pledges yet</p>}
      </div>
    </div>
  );
}
