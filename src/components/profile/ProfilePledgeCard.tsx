import { Card, CardContent } from '@/components/ui/card';
import { StatusChip } from '@/components/ui/StatusChip';
import { getCategoryConfig } from '@/components/auction/PledgeCard';
import { formatEuros } from '@/lib/euros';
import type { PledgeItem } from '@/lib/types';

interface ProfilePledgeCardProps {
  pledge: PledgeItem;
  roundIndex?: number;
  showDecimals?: boolean;
  onClick?: () => void;
}

const statusVariantMap: Record<string, 'neutral' | 'warning' | 'success' | 'error'> = {
  Draft: 'neutral',
  Approved: 'success',
  Hidden: 'error',
};

export function ProfilePledgeCard({ pledge, roundIndex, showDecimals = false, onClick }: ProfilePledgeCardProps) {
  const cat = getCategoryConfig(pledge.category);
  const estimate = pledge.estimate_low != null || pledge.estimate_high != null;

  return (
    <Card
      className="overflow-hidden cursor-pointer hover:border-primary/40 transition-all"
      onClick={onClick}
    >
      <div className="flex">
        {/* Thumbnail */}
        {pledge.image_url && (
          <div className="w-20 h-20 shrink-0 bg-muted overflow-hidden">
            <img
              src={pledge.image_url}
              alt={pledge.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <CardContent className="p-3 flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm truncate">{pledge.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {roundIndex != null && (
                <span className="text-[10px] font-bold rounded-full bg-muted px-2 py-0.5">
                  R{roundIndex}
                </span>
              )}
              <StatusChip
                variant={statusVariantMap[pledge.status] ?? 'neutral'}
                size="sm"
              >
                {pledge.status}
              </StatusChip>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cat.color}`}>
              {cat.emoji} {cat.label}
            </span>
            {estimate && (
              <span className="text-xs text-primary font-medium">
                {formatEuros(pledge.estimate_low ?? 0, showDecimals)}–{formatEuros(pledge.estimate_high ?? 0, showDecimals)}
              </span>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
