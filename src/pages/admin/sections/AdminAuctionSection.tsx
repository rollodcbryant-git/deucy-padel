import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/hooks/use-toast';
import type { Tournament, Auction, AuctionLot, PledgeItem, Player } from '@/lib/types';
import { Gavel, Pause, Copy, EyeOff, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  tournament: Tournament;
  players: Player[];
  onReload: () => void;
  callEngine: (action: string, extra?: any) => Promise<any>;
  isUpdating: boolean;
}

export default function AdminAuctionSection({ tournament, players, onReload, callEngine, isUpdating }: Props) {
  const { toast } = useToast();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [lots, setLots] = useState<(AuctionLot & { pledge_item?: PledgeItem })[]>([]);

  const playerMap = new Map(players.map(p => [p.id, p]));

  useEffect(() => {
    loadAuction();
  }, [tournament.id]);

  const loadAuction = async () => {
    const { data: a } = await supabase.from('auctions').select('*').eq('tournament_id', tournament.id).maybeSingle();
    setAuction(a as Auction | null);
    if (a) {
      const { data: l } = await supabase.from('auction_lots').select('*, pledge_items(*)').eq('auction_id', a.id);
      setLots((l || []).map((lot: any) => ({ ...lot, pledge_item: lot.pledge_items })));
    }
  };

  const exportWinners = () => {
    const block = lots
      .filter(l => l.current_winner_player_id && l.status === 'Ended')
      .map(l => `${l.pledge_item?.title || '?'}: ${playerMap.get(l.current_winner_player_id!)?.full_name || '?'} (${l.current_bid}c)`)
      .join('\n');
    navigator.clipboard.writeText(block || 'No winners yet');
    toast({ title: 'Winners list copied' });
  };

  const hideLot = async (lotId: string) => {
    await supabase.from('auction_lots').update({ status: 'Ended' }).eq('id', lotId);
    toast({ title: 'Lot hidden' });
    loadAuction();
  };

  const resetLotBids = async (lotId: string) => {
    await supabase.from('auction_lots').update({ current_bid: null, current_winner_player_id: null }).eq('id', lotId);
    await supabase.from('escrow_holds').update({ status: 'Released', released_at: new Date().toISOString() }).eq('lot_id', lotId).eq('status', 'Active');
    toast({ title: 'Bids reset' });
    loadAuction();
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      {tournament.status === 'Finished' && !auction && (
        <Button className="w-full bg-gradient-hot" onClick={() => callEngine('start_auction')} disabled={isUpdating}>
          <Gavel className="mr-2 h-4 w-4" />Start 24h Auction
        </Button>
      )}

      {auction && auction.status === 'Live' && (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-muted/30 text-sm">
            <p>Ends: {auction.ends_at ? format(new Date(auction.ends_at), 'MMM d, HH:mm') : '—'}</p>
            <p className="text-muted-foreground">{lots.length} lots</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => callEngine('settle_auction')} disabled={isUpdating}>
              <Pause className="mr-2 h-4 w-4" />End Auction Early
            </Button>
            <Button variant="outline" onClick={exportWinners}><Copy className="mr-1 h-4 w-4" />Winners</Button>
          </div>
        </div>
      )}

      {auction && auction.status === 'Ended' && (
        <div className="space-y-2">
          <StatusChip variant="ended" size="sm">Auction Ended</StatusChip>
          <Button variant="outline" className="w-full" onClick={exportWinners}><Copy className="mr-2 h-4 w-4" />Export Winners & Pickup List</Button>
        </div>
      )}

      {/* Lots */}
      {lots.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {lots.map(lot => (
            <div key={lot.id} className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm truncate">{lot.pledge_item?.title || '?'}</p>
                <StatusChip variant={lot.status === 'Live' ? 'live' : 'ended'} size="sm">{lot.status}</StatusChip>
              </div>
              <p className="text-xs text-muted-foreground">
                Bid: {lot.current_bid ?? '—'}c
                {lot.current_winner_player_id && ` · ${playerMap.get(lot.current_winner_player_id)?.full_name || '?'}`}
              </p>
              {lot.status === 'Live' && (
                <div className="flex gap-1 mt-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => hideLot(lot.id)}>
                    <EyeOff className="mr-1 h-3 w-3" />Hide
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => resetLotBids(lot.id)}>
                    <RotateCcw className="mr-1 h-3 w-3" />Reset Bids
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
