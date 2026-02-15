import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatEuros } from '@/lib/euros';
import { cn } from '@/lib/utils';
import { Receipt } from 'lucide-react';
import type { CreditLedgerEntry } from '@/lib/types';

interface PlayerLedgerProps {
  playerId: string;
  tournamentId: string;
  showDecimals: boolean;
  startingCredits?: number;
}

const typeLabels: Record<string, string> = {
  StartingGrant: '🎁 Starting balance',
  MatchPayout: '🎾 Set win',
  BetStake: '🎲 Lost bet',
  BetPayout: '🎲 Won bet',
  Penalty: '⚠️ Penalty',
  AdminAdjustment: '🔧 Admin adjustment',
  ParticipationBonus: '🎾 Round bonus',
  AuctionHold: '🔒 Auction hold',
  AuctionRelease: '🔓 Auction release',
  AuctionSettlement: '🔨 Auction win',
};

export function PlayerLedger({ playerId, tournamentId, showDecimals, startingCredits = 2000 }: PlayerLedgerProps) {
  const [entries, setEntries] = useState<CreditLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('credit_ledger_entries')
      .select('*')
      .eq('player_id', playerId)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setEntries((data || []) as CreditLedgerEntry[]);
        setLoading(false);
      });
  }, [playerId, tournamentId]);

  const currentBalance = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Receipt className="h-4 w-4" />
        Credit Ledger
      </h3>

      {/* Balance header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-xs text-muted-foreground">Current Balance</p>
          <p className="text-lg font-bold text-primary">{formatEuros(currentBalance, showDecimals)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Starting Balance</p>
          <p className="text-sm font-medium">{formatEuros(startingCredits, showDecimals)}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted-foreground">No transactions yet</div>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto">
          {entries.map((entry) => {
            const isPositive = entry.amount > 0;
            const label = typeLabels[entry.type] || entry.type;
            const date = new Date(entry.created_at);

            return (
              <div key={entry.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{label}</p>
                  {entry.note && (
                    <p className="text-[10px] text-muted-foreground truncate">{entry.note}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn(
                    'font-bold text-sm',
                    isPositive ? 'text-primary' : 'text-destructive',
                  )}>
                    {isPositive ? '+' : ''}{formatEuros(entry.amount, showDecimals)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
