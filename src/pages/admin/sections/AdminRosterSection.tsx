import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/hooks/use-toast';
import type { Player, Tournament } from '@/lib/types';
import { hashPin } from '@/contexts/PlayerContext';
import { UserX, UserCheck, Copy, RotateCcw, KeyRound, MessageSquare, Filter } from 'lucide-react';

interface Props {
  players: Player[];
  tournament?: Tournament;
  onReload: () => void;
}

type PledgeStatusMap = Record<string, 'Missing' | 'Submitted' | 'Approved' | 'Hidden'>;

export default function AdminRosterSection({ players, tournament, onReload }: Props) {
  const { toast } = useToast();
  const [resetPinResult, setResetPinResult] = useState<{ name: string; pin: string } | null>(null);
  const [pledgeStatuses, setPledgeStatuses] = useState<PledgeStatusMap>({});
  const [showIncomplete, setShowIncomplete] = useState(false);

  useEffect(() => {
    if (tournament) loadPledgeStatuses();
  }, [tournament, players]);

  const loadPledgeStatuses = async () => {
    if (!tournament) return;
    const { data } = await supabase
      .from('pledge_items')
      .select('pledged_by_player_id, status')
      .eq('tournament_id', tournament.id);

    const map: PledgeStatusMap = {};
    players.forEach(p => { map[p.id] = 'Missing'; });
    (data || []).forEach(item => {
      const current = map[item.pledged_by_player_id];
      // Priority: Approved > Submitted(Draft) > Hidden > Missing
      if (item.status === 'Approved' && current !== 'Approved') {
        map[item.pledged_by_player_id] = 'Approved';
      } else if (item.status === 'Draft' && current === 'Missing') {
        map[item.pledged_by_player_id] = 'Submitted';
      } else if (item.status === 'Hidden' && current === 'Missing') {
        map[item.pledged_by_player_id] = 'Hidden';
      }
    });
    setPledgeStatuses(map);
  };

  const resetPin = async (player: Player) => {
    const generated = String(Math.floor(1000 + Math.random() * 9000));
    const pinHash = hashPin(generated);
    await supabase.from('players').update({ pin_hash: pinHash, session_token: null }).eq('id', player.id);
    setResetPinResult({ name: player.full_name, pin: generated });
    toast({ title: `PIN reset for ${player.full_name}` });
  };

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

  const copyNudgeForMissingPledges = () => {
    const missing = players.filter(p => p.status !== 'Removed' && pledgeStatuses[p.id] === 'Missing');
    if (missing.length === 0) {
      toast({ title: 'All pledges in! 🎉' });
      return;
    }
    const names = missing.map(p => p.full_name).join(', ');
    const msg = `🎁 Hey! We're still waiting on pledges from: ${names}. Drop yours to be scheduled for matches! 💪🏓`;
    navigator.clipboard.writeText(msg);
    toast({ title: `Nudge copied for ${missing.length} players` });
  };

  const getPledgeVariant = (status: string) => {
    switch (status) {
      case 'Approved': return 'success' as const;
      case 'Submitted': return 'info' as const;
      case 'Hidden': return 'neutral' as const;
      default: return 'error' as const;
    }
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
  const missingPledgeCount = players.filter(p => p.status !== 'Removed' && pledgeStatuses[p.id] === 'Missing').length;

  const displayPlayers = showIncomplete
    ? players.filter(p => p.status !== 'Removed' && (pledgeStatuses[p.id] === 'Missing' || !p.confirmed))
    : players;

  return (
    <div className="space-y-3">
      {/* PIN reset result banner */}
      {resetPinResult && (
        <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
          <p className="text-sm font-medium">New PIN for {resetPinResult.name}:</p>
          <p className="text-3xl font-mono font-bold text-primary text-center tracking-[0.5em]">{resetPinResult.pin}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => {
              navigator.clipboard.writeText(resetPinResult.pin);
              toast({ title: 'PIN copied!' });
            }}>
              <Copy className="mr-1 h-3 w-3" />Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setResetPinResult(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {confirmed.length} confirmed / {players.length} total
          {missingPledgeCount > 0 && (
            <span className="text-chaos-orange ml-1">· {missingPledgeCount} missing pledges</span>
          )}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          <Button variant={showIncomplete ? 'default' : 'outline'} size="sm"
            onClick={() => setShowIncomplete(!showIncomplete)}>
            <Filter className="mr-1 h-3 w-3" />{showIncomplete ? 'All' : 'Incomplete'}
          </Button>
          <Button variant="outline" size="sm" onClick={confirmAll}><UserCheck className="mr-1 h-3 w-3" />Confirm All</Button>
          <Button variant="outline" size="sm" onClick={exportContacts}><Copy className="mr-1 h-3 w-3" />Export</Button>
          <Button variant="outline" size="sm" onClick={copyNudgeForMissingPledges}>
            <MessageSquare className="mr-1 h-3 w-3" />Nudge Missing
          </Button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {displayPlayers.map((p, i) => (
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
              <StatusChip variant={getPledgeVariant(pledgeStatuses[p.id] || 'Missing')} size="sm">
                {pledgeStatuses[p.id] || 'Missing'}
              </StatusChip>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resetPin(p)} title="Reset PIN">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
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
        {displayPlayers.length === 0 && (
          <p className="text-muted-foreground text-center py-4 text-sm">
            {showIncomplete ? 'All entries complete! 🎉' : 'No players yet'}
          </p>
        )}
      </div>
    </div>
  );
}
