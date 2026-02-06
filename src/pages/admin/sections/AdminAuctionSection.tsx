import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/hooks/use-toast';
import type { Tournament, Auction, AuctionLot, PledgeItem, Player } from '@/lib/types';
import { Gavel, Pause, Copy, EyeOff, RotateCcw, Play, Trash2, Clock, Zap, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { formatEuros } from '@/lib/euros';

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
  const [durationHours, setDurationHours] = useState(24);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [deliveryMapsUrl, setDeliveryMapsUrl] = useState('');

  const playerMap = new Map(players.map(p => [p.id, p]));

  useEffect(() => { loadAuction(); }, [tournament.id]);

  const loadAuction = async () => {
    const { data: a } = await supabase.from('auctions').select('*').eq('tournament_id', tournament.id).maybeSingle();
    setAuction(a as Auction | null);
    if (a) {
      setDurationHours((a as any).duration_hours || 24);
      setDeliveryLocation((a as any).delivery_location || '');
      setDeliveryMapsUrl((a as any).delivery_maps_url || '');
      const { data: l } = await supabase.from('auction_lots').select('*, pledge_items(*)').eq('auction_id', a.id);
      setLots((l || []).map((lot: any) => ({ ...lot, pledge_item: lot.pledge_items })));
    }
  };

  const launchAuction = async (hours: number) => {
    await callEngine('start_auction', { duration_hours: hours });
    loadAuction();
  };

  const resetAuction = async () => {
    if (!auction) return;
    // Delete all bids, escrow holds, lots, then the auction itself
    for (const lot of lots) {
      await supabase.from('bids').delete().eq('lot_id', lot.id);
      await supabase.from('escrow_holds').delete().eq('lot_id', lot.id);
    }
    await supabase.from('auction_lots').delete().eq('auction_id', auction.id);
    await supabase.from('auctions').delete().eq('id', auction.id);
    // Reset tournament status back to Finished if it was AuctionLive/Closed
    if (tournament.status === 'AuctionLive' || tournament.status === 'Closed') {
      await supabase.from('tournaments').update({ status: 'Finished' }).eq('id', tournament.id);
    }
    setAuction(null);
    setLots([]);
    toast({ title: 'Auction reset — all bids cleared' });
    onReload();
  };

  const saveDeliverySettings = async () => {
    if (!auction) return;
    await supabase.from('auctions').update({
      delivery_location: deliveryLocation || null,
      delivery_maps_url: deliveryMapsUrl || null,
    } as any).eq('id', auction.id);
    toast({ title: 'Delivery settings saved' });
  };

  const exportWinners = () => {
    const block = lots
      .filter(l => l.current_winner_player_id && l.status === 'Ended')
      .map(l => `${l.pledge_item?.title || '?'}: ${playerMap.get(l.current_winner_player_id!)?.full_name || '?'} (${formatEuros(l.current_bid || 0)})`)
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

  const auctionStatus: 'Locked' | 'Live' | 'Ended' = !auction ? 'Locked' : auction.status === 'Live' ? 'Live' : 'Ended';

  return (
    <div className="space-y-4">
      {/* Auction status */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Status:</span>
        <StatusChip
          variant={auctionStatus === 'Live' ? 'live' : auctionStatus === 'Ended' ? 'ended' : 'neutral'}
          pulse={auctionStatus === 'Live'}
        >
          {auctionStatus}
        </StatusChip>
      </div>

      {/* LOCKED STATE - Launch controls */}
      {!auction && (
        <div className="space-y-3">
          {tournament.status !== 'Finished' && tournament.status !== 'AuctionLive' && tournament.status !== 'Closed' && (
            <div className="rounded-lg bg-chaos-orange/10 border border-chaos-orange/30 p-3">
              <p className="text-xs text-chaos-orange">
                ⚠️ Recommended: finish the tournament before launching the auction.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Duration (hours)</label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={durationHours}
                onChange={e => setDurationHours(Number(e.target.value))}
                className="h-9 w-24"
                min={1}
              />
              <span className="text-sm text-muted-foreground self-center">hours</span>
            </div>
          </div>

          <Button
            className="w-full bg-gradient-hot"
            onClick={() => launchAuction(durationHours)}
            disabled={isUpdating}
          >
            <Play className="mr-2 h-4 w-4" />Launch Auction ({durationHours}h)
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => launchAuction(0.167)}
              disabled={isUpdating}
            >
              <Zap className="mr-1 h-3 w-3" />Test (10 min)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => launchAuction(1)}
              disabled={isUpdating}
            >
              <Clock className="mr-1 h-3 w-3" />Test (1h)
            </Button>
          </div>
        </div>
      )}

      {/* LIVE STATE */}
      {auction && auction.status === 'Live' && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-sm space-y-1">
            <p className="font-medium">🔴 Auction is Live</p>
            <p className="text-muted-foreground">Ends: {auction.ends_at ? format(new Date(auction.ends_at), 'MMM d, HH:mm') : '—'}</p>
            <p className="text-muted-foreground">{lots.length} lots active</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => callEngine('settle_auction')} disabled={isUpdating}>
              <Pause className="mr-2 h-4 w-4" />End Auction Now
            </Button>
            <Button variant="outline" onClick={exportWinners}><Copy className="mr-1 h-4 w-4" />Winners</Button>
          </div>
        </div>
      )}

      {/* ENDED STATE */}
      {auction && auction.status === 'Ended' && (
        <div className="space-y-3">
          <StatusChip variant="ended" size="sm">Auction Ended</StatusChip>

          <Button variant="outline" className="w-full" onClick={exportWinners}>
            <Copy className="mr-2 h-4 w-4" />Export Winners & Pickup List
          </Button>

          {/* Delivery settings */}
          <div className="space-y-2 rounded-lg bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Delivery Settings
            </p>
            <Input
              value={deliveryLocation}
              onChange={e => setDeliveryLocation(e.target.value)}
              placeholder="Pickup location (e.g. Club bar)"
              className="h-8 text-xs"
            />
            <Input
              value={deliveryMapsUrl}
              onChange={e => setDeliveryMapsUrl(e.target.value)}
              placeholder="Google Maps link (optional)"
              className="h-8 text-xs"
            />
            <Button size="sm" className="h-7 text-xs" onClick={saveDeliverySettings}>Save</Button>
          </div>
        </div>
      )}

      {/* Reset button (always available when auction exists) */}
      {auction && (
        <Button variant="outline" size="sm" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10" onClick={resetAuction}>
          <Trash2 className="mr-2 h-3 w-3" />Reset Auction (clear all bids)
        </Button>
      )}

      {/* Lots list */}
      {lots.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground">{lots.length} Lots</p>
          {lots.map(lot => (
            <div key={lot.id} className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm truncate">{lot.pledge_item?.title || '?'}</p>
                <StatusChip variant={lot.status === 'Live' ? 'live' : 'ended'} size="sm">{lot.status}</StatusChip>
              </div>
              <p className="text-xs text-muted-foreground">
                Bid: {lot.current_bid != null ? formatEuros(lot.current_bid) : '—'}
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
