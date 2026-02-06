import { Button } from '@/components/ui/button';
import { Clock, X } from 'lucide-react';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import type { WaitlistEntry } from '@/lib/types';

interface WaitlistStatusBadgeProps {
  entry: WaitlistEntry;
  position: number | null;
  onLeave: () => void;
  loading?: boolean;
}

export function WaitlistStatusBadge({ entry, position, onLeave, loading }: WaitlistStatusBadgeProps) {
  if (entry.status === 'invited' && entry.invite_expires_at) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 space-y-1">
        <p className="text-xs font-semibold text-primary">🎉 Seat reserved for you!</p>
        <p className="text-[11px] text-muted-foreground">
          Confirm within: <CountdownTimer targetDate={entry.invite_expires_at} variant="compact" className="text-xs inline font-medium text-primary" />
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-muted bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-2 text-xs">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">
          Waitlist{position ? ` — position #${position}` : ''}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-[10px] text-destructive hover:text-destructive px-2"
        onClick={onLeave}
        disabled={loading}
      >
        <X className="h-3 w-3 mr-1" />
        Leave
      </Button>
    </div>
  );
}
