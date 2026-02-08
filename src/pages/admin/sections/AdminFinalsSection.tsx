import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/StatusChip';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Tournament, Player, Round } from '@/lib/types';
import { Trophy, AlertTriangle, Crown } from 'lucide-react';

interface Props {
  tournament: Tournament;
  players: Player[];
  rounds: Round[];
  onReload: () => void;
}

export default function AdminFinalsSection({ tournament, players, rounds, onReload }: Props) {
  const { toast } = useToast();

  const activePlayers = players.filter(p => p.status === 'Active' && p.confirmed);
  const completedRounds = rounds.filter(r => r.status === 'Completed' && !r.is_playoff);
  const regularRoundsCount = tournament.rounds_count || 3;
  const allRegularRoundsDone = completedRounds.length >= regularRoundsCount;

  // Sort by sets_won descending
  const ranked = [...activePlayers].sort((a, b) => b.sets_won - a.sets_won);

  // Determine top 4 and check for tie at 4th place
  const top4Cutoff = ranked[3]?.sets_won ?? 0;
  const tiedForFourth = ranked.filter((p, i) => i >= 3 && p.sets_won === top4Cutoff && top4Cutoff > 0);
  const clearTop = ranked.filter(p => p.sets_won > top4Cutoff);
  const hasTie = tiedForFourth.length > 1 && clearTop.length < 4;
  const slotsToFill = 4 - clearTop.length;

  const [tieSelection, setTieSelection] = useState<string[]>([]);

  const handleSelectTiePlayer = (index: number, playerId: string) => {
    setTieSelection(prev => {
      const next = [...prev];
      next[index] = playerId;
      return next;
    });
  };

  const finalists = useMemo(() => {
    if (!hasTie) return ranked.slice(0, 4);
    const selected = tieSelection.filter(Boolean);
    return [...clearTop, ...tiedForFourth.filter(p => selected.includes(p.id))].slice(0, 4);
  }, [ranked, hasTie, tieSelection, clearTop, tiedForFourth]);

  if (!allRegularRoundsDone) {
    return (
      <div className="text-center py-6 space-y-3">
        <Trophy className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          Finals qualification available after all {regularRoundsCount} regular rounds complete.
        </p>
        <p className="text-xs text-muted-foreground">
          {completedRounds.length}/{regularRoundsCount} rounds completed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">Top 4 by Sets Won → Finals</p>
        <p className="text-xs text-muted-foreground">All {regularRoundsCount} rounds completed</p>
      </div>

      {/* Tie warning */}
      {hasTie && (
        <Card className="border-chaos-orange/50 bg-chaos-orange/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-chaos-orange" />
              <p className="font-semibold text-sm text-chaos-orange">Tie for Finals Slot</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {tiedForFourth.length} players tied at {top4Cutoff} sets won for {slotsToFill} remaining slot{slotsToFill > 1 ? 's' : ''}.
              Choose who advances:
            </p>
            {Array.from({ length: slotsToFill }).map((_, i) => (
              <Select key={i} value={tieSelection[i] || ''} onValueChange={(v) => handleSelectTiePlayer(i, v)}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select finalist #${clearTop.length + i + 1}`} />
                </SelectTrigger>
                <SelectContent>
                  {tiedForFourth
                    .filter(p => !tieSelection.includes(p.id) || tieSelection[i] === p.id)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} — {p.sets_won} sets won
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Qualified players list */}
      <div className="space-y-2">
        {ranked.slice(0, Math.max(4, clearTop.length + tiedForFourth.length)).map((p, i) => {
          const isQualified = i < 4 && !hasTie;
          const isManuallySelected = hasTie && finalists.some(f => f.id === p.id);
          const qualified = isQualified || isManuallySelected;

          return (
            <Card
              key={p.id}
              className={`p-3 transition-all ${qualified ? 'border-primary/50 bg-primary/5' : 'opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  qualified ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </div>
                <PlayerAvatar player={p} className="h-8 w-8" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">Sets Won: {p.sets_won}</p>
                </div>
                {qualified && (
                  <StatusChip variant="success" size="sm">
                    <Crown className="h-3 w-3 mr-1" />Qualified
                  </StatusChip>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Confirmation action */}
      {finalists.length === 4 && (
        <Button
          className="w-full bg-gradient-primary"
          onClick={() => {
            toast({
              title: '🏆 Finalists confirmed!',
              description: finalists.map(f => f.full_name).join(', '),
            });
          }}
        >
          <Trophy className="mr-2 h-4 w-4" />
          Confirm {finalists.map(f => f.full_name.split(' ')[0]).join(', ')} for Finals
        </Button>
      )}
    </div>
  );
}
