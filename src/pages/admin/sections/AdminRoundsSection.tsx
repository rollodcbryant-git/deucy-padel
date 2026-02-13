import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Tournament, Round, Match } from '@/lib/types';
import {
  Calendar,
  RefreshCw,
  Clock,
  ChevronRight,
  AlertTriangle,
  Lock,
  Play,
  Zap,
  Swords,
  StopCircle,
} from 'lucide-react';
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
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const getStatusVariant = (s: string) => {
    switch (s) {
      case 'Live': return 'live' as const;
      case 'Completed': return 'success' as const;
      case 'Locked': return 'warning' as const;
      default: return 'neutral' as const;
    }
  };

  const liveRound = rounds.find(r => r.status === 'Live');
  const liveRoundMatches = liveRound ? matches.filter(m => m.round_id === liveRound.id && !m.is_bye) : [];
  const played = liveRoundMatches.filter(m => m.status === 'Played').length;
  const totalRoundsCount = tournament.rounds_count || 0;

  const extendRound = async (roundId: string, days: number) => {
    await callEngine('extend_round', { round_id: roundId, days });
  };

  const lockRound = async (roundId: string) => {
    await callEngine('lock_round', { round_id: roundId });
  };

  const handleRegenerate = (roundId: string) => {
    if (regenCount >= 3) {
      toast({ title: 'Max regenerations reached', variant: 'destructive' });
      return;
    }
    setConfirmAction({
      title: 'Regenerate Matches?',
      description: 'This will delete all current matches for this round and generate new ones. Only works if no matches have been played yet.',
      onConfirm: () => {
        setRegenCount(c => c + 1);
        callEngine('regenerate_matches', { round_id: roundId });
        setConfirmAction(null);
      },
    });
  };

  const handleEndRoundNow = (roundId: string) => {
    setConfirmAction({
      title: 'End Round Now?',
      description: 'This will immediately end the round, apply penalties to all unplayed matches, and create the next round. This cannot be undone.',
      onConfirm: () => {
        callEngine('end_round_now', { round_id: roundId });
        setConfirmAction(null);
      },
    });
  };

  const handleAdvanceRound = () => {
    setConfirmAction({
      title: 'Advance Round?',
      description: 'This will check for overdue matches, apply penalties, complete the current round, and create the next one.',
      onConfirm: () => {
        callEngine('check_advance_round');
        setConfirmAction(null);
      },
    });
  };

  // No rounds yet — big CTA
  if (rounds.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6 space-y-3">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground text-sm">No rounds yet. Start the tournament to create Round 1 with matches.</p>

          {(tournament.status === 'SignupOpen' || tournament.status === 'Draft') && (
            <Button
              className="w-full bg-gradient-primary"
              onClick={() => callEngine('start_tournament')}
              disabled={isUpdating}
            >
              <Play className="mr-2 h-4 w-4" />Start Tournament & Round 1
            </Button>
          )}

          {tournament.status === 'Live' && (
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => callEngine('auto_create_round_and_matches')}
                disabled={isUpdating}
              >
                <Zap className="mr-2 h-4 w-4" />Auto-generate Round + Matches
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => callEngine('create_round')}
                  disabled={isUpdating}
                >
                  <Calendar className="mr-2 h-4 w-4" />Create Round
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation dialog */}
        <ConfirmDialog action={confirmAction} onClose={() => setConfirmAction(null)} isUpdating={isUpdating} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Live Round Hero ── */}
      {liveRound && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Round</p>
              <p className="text-lg font-bold">
                {liveRound.is_playoff ? liveRound.playoff_type : `Round ${liveRound.index}`}
                {totalRoundsCount > 0 && !liveRound.is_playoff && (
                  <span className="text-muted-foreground font-normal text-sm"> / {totalRoundsCount}</span>
                )}
              </p>
            </div>
            <StatusChip variant="live" size="sm">Live</StatusChip>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-background/50 rounded-lg p-2">
              <p className="text-muted-foreground">Started</p>
              <p className="font-medium">{liveRound.start_at ? format(new Date(liveRound.start_at), 'MMM d, HH:mm') : '—'}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-2">
              <p className="text-muted-foreground">Deadline</p>
              <p className="font-medium">{liveRound.end_at ? format(new Date(liveRound.end_at), 'MMM d, HH:mm') : '—'}</p>
            </div>
          </div>

          {/* Countdown */}
          {liveRound.end_at && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Time remaining</p>
              <CountdownTimer targetDate={liveRound.end_at} variant="compact" />
            </div>
          )}

          {/* Progress */}
          <div className="flex items-center gap-2">
            <Swords className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1 bg-background/50 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${liveRoundMatches.length > 0 ? (played / liveRoundMatches.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground">{played}/{liveRoundMatches.length}</span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => extendRound(liveRound.id, 1)}>
              <Clock className="mr-1 h-3 w-3" />+1d
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => extendRound(liveRound.id, 3)}>+3d</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => extendRound(liveRound.id, 7)}>+7d</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleRegenerate(liveRound.id)} disabled={regenCount >= 3}>
              <RefreshCw className="mr-1 h-3 w-3" />Regen ({3 - regenCount})
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => lockRound(liveRound.id)}>
              <Lock className="mr-1 h-3 w-3" />Lock
            </Button>
          </div>

          <div className="flex gap-1.5 pt-1 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={handleAdvanceRound}
              disabled={isUpdating}
            >
              <ChevronRight className="mr-1 h-3 w-3" />Advance Round
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-destructive flex-1"
              onClick={() => handleEndRoundNow(liveRound.id)}
              disabled={isUpdating}
            >
              <StopCircle className="mr-1 h-3 w-3" />End Now
            </Button>
          </div>
        </div>
      )}

      {/* ── No live round but tournament is Live ── */}
      {!liveRound && tournament.status === 'Live' && (
        <div className="rounded-xl border border-dashed border-primary/40 p-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No active round. Ready for the next one?</p>
          <Button
            className="w-full"
            onClick={() => callEngine('auto_create_round_and_matches')}
            disabled={isUpdating}
          >
            <Zap className="mr-2 h-4 w-4" />Auto-generate Next Round + Matches
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" size="sm" onClick={() => callEngine('create_round')} disabled={isUpdating}>
              Create Round Only
            </Button>
          </div>
        </div>
      )}

      {/* ── Start Tournament ── */}
      {(tournament.status === 'SignupOpen' || tournament.status === 'Draft') && (
        <Button variant="hot" className="w-full" onClick={() => callEngine('start_tournament')} disabled={isUpdating}>
          <Play className="mr-2 h-4 w-4" />Start Tournament
        </Button>
      )}

      {/* ── Generate matches for a round with none ── */}
      {liveRound && liveRoundMatches.length === 0 && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => callEngine('generate_matches', { round_id: liveRound.id })}
          disabled={isUpdating}
        >
          <Swords className="mr-2 h-4 w-4" />Generate Matches for Round {liveRound.index}
        </Button>
      )}

      {/* ── All Rounds Timeline ── */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">All Rounds</p>
        {rounds.map(round => {
          const rm = matches.filter(m => m.round_id === round.id && !m.is_bye);
          const rPlayed = rm.filter(m => m.status === 'Played').length;
          const isLive = round.status === 'Live';

          return (
            <div
              key={round.id}
              className={`rounded-lg p-3 flex items-center justify-between ${
                isLive ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {round.is_playoff ? round.playoff_type : `Round ${round.index}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rPlayed}/{rm.length} played
                  {round.end_at && ` · ${isLive ? 'ends' : 'ended'} ${format(new Date(round.end_at), 'MMM d')}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isLive && round.end_at && (
                  <CountdownTimer targetDate={round.end_at} variant="compact" className="text-xs" />
                )}
                <StatusChip variant={getStatusVariant(round.status)} size="sm">{round.status}</StatusChip>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog action={confirmAction} onClose={() => setConfirmAction(null)} isUpdating={isUpdating} />
    </div>
  );
}

function ConfirmDialog({ action, onClose, isUpdating }: {
  action: { title: string; description: string; onConfirm: () => void } | null;
  onClose: () => void;
  isUpdating: boolean;
}) {
  return (
    <Dialog open={!!action} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {action?.title}
          </DialogTitle>
          <DialogDescription>{action?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isUpdating}>Cancel</Button>
          <Button variant="destructive" onClick={action?.onConfirm} disabled={isUpdating}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
