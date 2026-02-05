import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/hooks/use-toast';
import type { Tournament, Round, Match } from '@/lib/types';
import { Calendar, RefreshCw, Clock, ChevronRight, AlertTriangle, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  tournament: Tournament;
  rounds: Round[];
  matches: Match[];
  onReload: () => void;
  callEngine: (action: string, extra?: any) => Promise<any>;
  isUpdating: boolean;
}

export default function AdminRoundsSection({ tournament, rounds, matches, onReload, callEngine, isUpdating }: Props) {
  const { toast } = useToast();
  const [regenCount, setRegenCount] = useState(0);

  const getStatusVariant = (s: string) => {
    switch (s) {
      case 'Live': return 'live' as const;
      case 'Completed': return 'success' as const;
      case 'Locked': return 'warning' as const;
      default: return 'neutral' as const;
    }
  };

  const extendRound = async (roundId: string, days: number) => {
    const round = rounds.find(r => r.id === roundId);
    if (!round?.end_at) return;
    const newEnd = new Date(new Date(round.end_at).getTime() + days * 24 * 60 * 60 * 1000);
    await supabase.from('rounds').update({ end_at: newEnd.toISOString() }).eq('id', roundId);
    // Also extend match deadlines
    await supabase.from('matches').update({ deadline_at: newEnd.toISOString() })
      .eq('round_id', roundId).in('status', ['Scheduled', 'BookingClaimed']);
    toast({ title: `Extended by ${days} day(s)` });
    onReload();
  };

  const lockRound = async (roundId: string) => {
    await supabase.from('rounds').update({ status: 'Locked' }).eq('id', roundId);
    toast({ title: 'Round locked' });
    onReload();
  };

  const handleRegenerate = (roundId: string) => {
    if (regenCount >= 3) {
      toast({ title: 'Max regenerations reached', variant: 'destructive' });
      return;
    }
    setRegenCount(c => c + 1);
    callEngine('regenerate_matches', { round_id: roundId });
  };

  const liveRound = rounds.find(r => r.status === 'Live');

  return (
    <div className="space-y-3">
      {/* Start / Advance controls */}
      {tournament.status === 'SignupOpen' && (
        <Button className="w-full bg-gradient-primary" onClick={() => callEngine('start_tournament')} disabled={isUpdating}>
          Start Tournament
        </Button>
      )}
      {tournament.status === 'Live' && liveRound && (
        <Button className="w-full" variant="secondary" onClick={() => callEngine('check_advance_round')} disabled={isUpdating}>
          <ChevronRight className="mr-2 h-4 w-4" />Check & Advance Round
        </Button>
      )}

      {/* Round list */}
      <div className="space-y-2">
        {rounds.map(round => {
          const rm = matches.filter(m => m.round_id === round.id);
          const played = rm.filter(m => m.status === 'Played').length;
          const isLive = round.status === 'Live';

          return (
            <div key={round.id} className="rounded-lg bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">
                    {round.is_playoff ? round.playoff_type : `Round ${round.index}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {played}/{rm.length} played
                    {round.end_at && ` · ends ${format(new Date(round.end_at), 'MMM d, HH:mm')}`}
                  </p>
                </div>
                <StatusChip variant={getStatusVariant(round.status)} size="sm">{round.status}</StatusChip>
              </div>

              {isLive && (
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => extendRound(round.id, 1)}>
                    <Clock className="mr-1 h-3 w-3" />+1d
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => extendRound(round.id, 3)}>+3d</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => extendRound(round.id, 7)}>+7d</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRegenerate(round.id)} disabled={regenCount >= 3}>
                    <RefreshCw className="mr-1 h-3 w-3" />Regen ({3 - regenCount})
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => lockRound(round.id)}>
                    <Lock className="mr-1 h-3 w-3" />Lock
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => callEngine('check_advance_round')} disabled={isUpdating}>
                    <AlertTriangle className="mr-1 h-3 w-3" />Force Advance
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {rounds.length === 0 && <p className="text-muted-foreground text-center py-4 text-sm">No rounds yet</p>}
      </div>
    </div>
  );
}
