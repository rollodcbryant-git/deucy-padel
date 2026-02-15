import { cn } from '@/lib/utils';
import type { PledgeItem } from '@/lib/types';

interface PledgeIndicatorProps {
  pledge?: PledgeItem;
  className?: string;
}

const categoryEmoji: Record<string, string> = {
  food: '🍕',
  drink: '🍷',
  object: '🎁',
  service: '💆',
  chaos: '🎲',
};

export function PledgeIndicator({ pledge, className }: PledgeIndicatorProps) {
  if (!pledge) {
    return (
      <span className={cn(
        'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 shrink-0',
        className,
      )}>
        ⛔ No pledge
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20 shrink-0',
        className,
      )}
      title={`${pledge.title} (${pledge.status})`}
    >
      ✅ Pledged
    </span>
  );
}
