import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusChip } from '@/components/ui/StatusChip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Tournament, Round, Match, Player } from '@/lib/types';
import { Copy, MessageSquare, Edit, RotateCcw, Ban } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  tournament: Tournament;
  rounds: Round[];
  matches: Match[];
  players: Player[];
  onReload: () => void;
  callEngine: (action: string, extra?: any) => Promise<any>;
  isUpdating: boolean;
}

export default function AdminMatchesSection({ tournament, rounds, matches, players, onReload, callEngine, isUpdating }: Props) {
  const { toast } = useToast();
  const [selectedRoundId, setSelectedRoundId] = useState<string>(rounds.find(r => r.status === 'Live')?.id || rounds[0]?.id || '');
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [setsA, setSetsA] = useState(0);
  const [setsB, setSetsB] = useState(0);

  const playerMap = new Map(players.map(p => [p.id, p]));
  const getName = (id: string | null) => id ? playerMap.get(id)?.full_name || '?' : '?';
  const getPhone = (id: string | null) => id ? playerMap.get(id)?.phone || '' : '';

  const roundMatches = matches.filter(m => m.round_id === selectedRoundId && !m.is_bye);

  const getMatchStatusVariant = (s: string) => {
    switch (s) {
      case 'Played': return 'success' as const;
      case 'BookingClaimed': return 'info' as const;
      case 'Overdue': case 'AutoResolved': return 'error' as const;
      default: return 'neutral' as const;
    }
  };

  const copyContacts = (m: Match) => {
    const ids = [m.team_a_player1_id, m.team_a_player2_id, m.team_b_player1_id, m.team_b_player2_id];
    const block = ids.filter(Boolean).map(id => `${getName(id)}: ${getPhone(id)}`).join('\n');
    navigator.clipboard.writeText(block);
    toast({ title: 'Contacts copied' });
  };

  const generateNudge = (m: Match) => {
    const names = [m.team_a_player1_id, m.team_a_player2_id, m.team_b_player1_id, m.team_b_player2_id]
      .filter(Boolean).map(getName).join(', ');
    const deadline = m.deadline_at ? format(new Date(m.deadline_at), 'MMM d') : 'soon';
    const msg = `🏓 Hey! Your match (${names}) is due by ${deadline}. Book it ASAP! 💪`;
    navigator.clipboard.writeText(msg);
    toast({ title: 'Nudge message copied' });
  };

  const submitResult = async (matchId: string) => {
    await callEngine('process_match_result', {
      match_id: matchId,
      sets_a: setsA,
      sets_b: setsB,
      is_unfinished: false,
      player_id: null,
    });
    setEditingMatch(null);
  };

  const resetResult = async (matchId: string) => {
    await supabase.from('matches').update({ status: 'Scheduled', sets_a: 0, sets_b: 0, played_at: null, is_unfinished: false }).eq('id', matchId);
    toast({ title: 'Result reset' });
    onReload();
  };

  const voidMatch = async (matchId: string) => {
    await supabase.from('matches').update({ status: 'AutoResolved', is_unfinished: true }).eq('id', matchId);
    toast({ title: 'Match voided' });
    onReload();
  };

  const setBooking = async (matchId: string, playerId: string | null) => {
    await supabase.from('matches').update({
      booking_claimed_by_player_id: playerId,
      booking_claimed_at: playerId ? new Date().toISOString() : null,
      status: playerId ? 'BookingClaimed' : 'Scheduled',
    }).eq('id', matchId);
    onReload();
  };

  return (
    <div className="space-y-3">
      {rounds.length > 0 && (
        <Select value={selectedRoundId} onValueChange={setSelectedRoundId}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Select round" /></SelectTrigger>
          <SelectContent>
            {rounds.map(r => (
              <SelectItem key={r.id} value={r.id}>
                {r.is_playoff ? r.playoff_type : `Round ${r.index}`} ({r.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {roundMatches.map(m => (
          <div key={m.id} className="rounded-lg bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium">{getName(m.team_a_player1_id)} & {getName(m.team_a_player2_id)}</p>
                <p className="text-muted-foreground">vs {getName(m.team_b_player1_id)} & {getName(m.team_b_player2_id)}</p>
                {m.status === 'Played' && <p className="text-primary font-mono mt-0.5">{m.sets_a}–{m.sets_b}</p>}
                {m.booking_claimed_by_player_id && (
                  <p className="text-xs text-accent">📋 {getName(m.booking_claimed_by_player_id)}</p>
                )}
              </div>
              <StatusChip variant={getMatchStatusVariant(m.status)} size="sm">{m.status}</StatusChip>
            </div>

            {/* Edit result */}
            {editingMatch === m.id && (
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={2} value={setsA} onChange={e => setSetsA(Number(e.target.value))} className="h-8 w-16" placeholder="A" />
                <span className="text-muted-foreground">–</span>
                <Input type="number" min={0} max={2} value={setsB} onChange={e => setSetsB(Number(e.target.value))} className="h-8 w-16" placeholder="B" />
                <Button size="sm" className="h-8" onClick={() => submitResult(m.id)} disabled={isUpdating}>Save</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingMatch(null)}>Cancel</Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyContacts(m)}>
                <Copy className="mr-1 h-3 w-3" />Contacts
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => generateNudge(m)}>
                <MessageSquare className="mr-1 h-3 w-3" />Nudge
              </Button>
              {m.status !== 'Played' && m.status !== 'AutoResolved' && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditingMatch(m.id); setSetsA(0); setSetsB(0); }}>
                  <Edit className="mr-1 h-3 w-3" />Result
                </Button>
              )}
              {m.status === 'Played' && (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditingMatch(m.id); setSetsA(m.sets_a); setSetsB(m.sets_b); }}>
                    <Edit className="mr-1 h-3 w-3" />Override
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => resetResult(m.id)}>
                    <RotateCcw className="mr-1 h-3 w-3" />Reset
                  </Button>
                </>
              )}
              {m.status !== 'AutoResolved' && m.status !== 'Played' && (
                <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => voidMatch(m.id)}>
                  <Ban className="mr-1 h-3 w-3" />Void
                </Button>
              )}
            </div>
          </div>
        ))}
        {roundMatches.length === 0 && <p className="text-muted-foreground text-center py-4 text-sm">No matches for this round</p>}
      </div>
    </div>
  );
}
