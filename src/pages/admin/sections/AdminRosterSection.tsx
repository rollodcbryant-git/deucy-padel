import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/hooks/use-toast';
import type { Player } from '@/lib/types';
import { hashPin } from '@/contexts/PlayerContext';
import { UserX, UserCheck, Copy, RotateCcw, KeyRound } from 'lucide-react';

interface Props {
  players: Player[];
  onReload: () => void;
}

export default function AdminRosterSection({ players, onReload }: Props) {
  const { toast } = useToast();

  const toggleConfirm = async (id: string, confirmed: boolean) => {
    await supabase.from('players').update({ confirmed }).eq('id', id);
    onReload();
  };

  const removePlayer = async (id: string) => {
    await supabase.from('players').update({ status: 'Removed' }).eq('id', id);
    toast({ title: 'Player removed' });
    onReload();
  };

  const reinstatePlayer = async (id: string) => {
    await supabase.from('players').update({ status: 'Active' }).eq('id', id);
    toast({ title: 'Player reinstated' });
    onReload();
  };

  const confirmAll = async () => {
    const unconfirmed = players.filter(p => !p.confirmed && p.status !== 'Removed');
    for (const p of unconfirmed) {
      await supabase.from('players').update({ confirmed: true }).eq('id', p.id);
    }
    toast({ title: `Confirmed ${unconfirmed.length} players` });
    onReload();
  };

  const exportContacts = () => {
    const block = players
      .filter(p => p.status !== 'Removed')
      .map(p => `${p.full_name}: ${p.phone}`)
      .join('\n');
    navigator.clipboard.writeText(block);
    toast({ title: 'Copied!', description: 'Contact list copied' });
  };

  const getStatusLabel = (p: Player) => {
    if (p.status === 'Removed') return 'Removed';
    return p.confirmed ? 'Confirmed' : 'Joined';
  };

  const getStatusVariant = (p: Player) => {
    if (p.status === 'Removed') return 'error' as const;
    return p.confirmed ? 'success' as const : 'neutral' as const;
  };

  const confirmed = players.filter(p => p.confirmed && p.status !== 'Removed');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{confirmed.length} confirmed / {players.length} total</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={confirmAll}><UserCheck className="mr-1 h-3 w-3" />Confirm All</Button>
          <Button variant="outline" size="sm" onClick={exportContacts}><Copy className="mr-1 h-3 w-3" />Export</Button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground w-5 text-xs">#{i + 1}</span>
              <div className="min-w-0">
                <p className="font-medium truncate">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{p.phone} · {p.gender || '?'} · {p.credits_balance}c</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <StatusChip variant={getStatusVariant(p)} size="sm">{getStatusLabel(p)}</StatusChip>
              {p.status === 'Removed' ? (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => reinstatePlayer(p.id)}>
                  <RotateCcw className="h-3.5 w-3.5 text-primary" />
                </Button>
              ) : (
                <>
                  <Switch checked={p.confirmed} onCheckedChange={v => toggleConfirm(p.id, v)} className="scale-75" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePlayer(p.id)}>
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
        {players.length === 0 && <p className="text-muted-foreground text-center py-4 text-sm">No players yet</p>}
      </div>
    </div>
  );
}
