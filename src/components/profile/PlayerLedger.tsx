import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatEuros } from '@/lib/euros';
import { cn } from '@/lib/utils';
import { ChevronDown, Receipt } from 'lucide-react';
import type { CreditLedgerEntry } from '@/lib/types';

interface PlayerLedgerProps {
  playerId: string;
  tournamentId: string;
  showDecimals: boolean;
}

const typeLabels: Record<string, string> = {
  StartingGrant: '🎁 Starting balance',
  ParticipationBonus: '🎾 Round bonus',
  MatchPayout: '💶 Sets won',
  MatchStake: '📉 Match loss',
  Penalty: '⚠️ Penalty',
  AdminAdjustment: '🔧 Admin adjustment',
  BetStake: '🎲 Bet placed',
  BetPayout: '🎲 Bet won!',
  AuctionHold: '🔒 Auction hold',
  AuctionRelease: '🔓 Auction release',
  AuctionSettlement: '🔨 Auction win',
};

export function PlayerLedger({ playerId, tournamentId, showDecimals }: PlayerLedgerProps) {
  const [entries, setEntries] = useState<CreditLedgerEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    supabase
      .from('credit_ledger_entries')
      .select('*')
      .eq('player_id', playerId)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setEntries((data || []) as CreditLedgerEntry[]);
        setLoading(false);
      });
  }, [expanded, playerId, tournamentId]);

  let runningTotal = 0;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm font-semibold text-muted-foreground uppercase tracking-wide"
      >
        <span className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Credit Ledger
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
            ) : entries.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">No transactions yet</div>
            ) : (
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {entries.map((entry) => {
                  runningTotal += entry.amount;
                  const isPositive = entry.amount > 0;
                  const label = typeLabels[entry.type] || entry.type;
                  const date = new Date(entry.created_at);
                  
                  return (
                    <div key={entry.id} className="px-3 py-2 flex items-center gap-3 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{label}</p>
                        {entry.note && (
                          <p className="text-[10px] text-muted-foreground truncate">{entry.note}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn(
                          'font-bold',
                          isPositive ? 'text-primary' : 'text-destructive',
                        )}>
                          {isPositive ? '+' : ''}{formatEuros(entry.amount, showDecimals)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatEuros(runningTotal, showDecimals)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}