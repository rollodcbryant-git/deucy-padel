import { useNavigate, useParams } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { usePlayer } from '@/contexts/PlayerContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AuctionLot, PledgeItem, Bid, Player } from '@/lib/types';
import { ArrowLeft, Gavel, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { formatEuros, getMinBidIncrement } from '@/lib/euros';

interface BidWithPlayer extends Bid {
  player?: Player;
}

export default function LotDetailPage() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const { player, tournament, session, isLoading, refreshPlayer } = usePlayer();
  const { toast } = useToast();

  const [lot, setLot] = useState<AuctionLot | null>(null);
  const [pledgeItem, setPledgeItem] = useState<PledgeItem | null>(null);
  const [bids, setBids] = useState<BidWithPlayer[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }
    if (lotId && player) {
      loadLot();
    }
  }, [lotId, session, player, isLoading, navigate]);

  useEffect(() => {
    if (!lotId) return;
    const channel = supabase
      .channel(`lot-${lotId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_lots', filter: `id=eq.${lotId}` }, () => loadLot())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `lot_id=eq.${lotId}` }, () => { loadBids(); refreshPlayer(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [lotId]);

  const loadLot = async () => {
    if (!lotId) return;
    const { data: lotData } = await supabase.from('auction_lots').select('*').eq('id', lotId).single();
    if (lotData) {
      setLot(lotData as AuctionLot);
      const { data: pledgeData } = await supabase.from('pledge_items').select('*').eq('id', lotData.pledge_item_id).single();
      setPledgeItem(pledgeData as PledgeItem);
    }
    loadBids();
  };

  const loadBids = async () => {
    if (!lotId) return;
    const { data: bidsData } = await supabase.from('bids').select('*').eq('lot_id', lotId).order('created_at', { ascending: false });
    if (!bidsData) return;
    const playerIds = [...new Set(bidsData.map(b => b.bidder_player_id))];
    const { data: players } = await supabase.from('players').select('*').in('id', playerIds);
    const playerMap = new Map((players || []).map(p => [p.id, p as Player]));
    setBids(bidsData.map(b => ({ ...b, player: playerMap.get(b.bidder_player_id) })) as BidWithPlayer[]);
  };

  const getMinBid = () => {
    if (!lot) return 0;
    if (!lot.current_bid) {
      return pledgeItem?.estimate_low || 100; // minimum €1
    }
    const increment = getMinBidIncrement(lot.current_bid);
    return lot.current_bid + increment;
  };

  const handlePlaceBid = async () => {
    if (!lot || !player || !pledgeItem || !tournament) return;

    // Parse as euros, convert to cents
    const eurosInput = parseFloat(bidAmount);
    if (isNaN(eurosInput)) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    const amount = Math.round(eurosInput * 100);
    const minBid = getMinBid();

    if (amount < minBid) {
      toast({ title: 'Bid too low', description: `Minimum bid is ${formatEuros(minBid)}`, variant: 'destructive' });
      return;
    }

    if (amount > player.credits_balance) {
      toast({ title: 'Insufficient balance', description: `You only have ${formatEuros(player.credits_balance)}`, variant: 'destructive' });
      return;
    }

    if (pledgeItem.pledged_by_player_id === player.id) {
      toast({ title: "Can't bid on your own item", description: 'Nice try though!', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: bidError } = await supabase.from('bids').insert({ lot_id: lot.id, bidder_player_id: player.id, amount });
      if (bidError) throw bidError;

      const { error: lotError } = await supabase.from('auction_lots').update({ current_bid: amount, current_winner_player_id: player.id }).eq('id', lot.id);
      if (lotError) throw lotError;

      const { error: escrowError } = await supabase.from('escrow_holds').insert({ lot_id: lot.id, bidder_player_id: player.id, reserved_amount: amount });
      if (escrowError) throw escrowError;

      if (lot.current_winner_player_id && lot.current_winner_player_id !== player.id) {
        await supabase.from('escrow_holds').update({ status: 'Released', released_at: new Date().toISOString() }).eq('lot_id', lot.id).eq('bidder_player_id', lot.current_winner_player_id).eq('status', 'Active');
      }

      toast({ title: 'Bid placed! 🎉', description: `You're now the top bidder at ${formatEuros(amount)}` });
      setBidAmount('');
      refreshPlayer();
    } catch (error: any) {
      toast({ title: 'Failed to place bid', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !player || !tournament || !lot || !pledgeItem) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🔨</div>
      </div>
    );
  }

  const getCategoryEmoji = (category?: string) => {
    switch (category) {
      case 'food': return '🍕';
      case 'drink': return '🍷';
      case 'object': return '🎁';
      case 'service': return '💆';
      case 'chaos': return '🎲';
      default: return '📦';
    }
  };

  const isWinning = lot.current_winner_player_id === player.id;
  const isOwner = pledgeItem.pledged_by_player_id === player.id;
  const minBid = getMinBid();
  const isEnded = lot.status === 'Ended';
  const showDecimals = tournament.display_decimals;

  return (
    <>
    <PageLayout
      hasBottomNav={true}
      header={
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/auction')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-lg truncate">{pledgeItem.title}</h1>
          </div>
          <StatusChip variant={isEnded ? 'ended' : 'live'} pulse={!isEnded}>
            {isEnded ? 'Ended' : 'Live'}
          </StatusChip>
        </div>
      }
    >
      <div className="space-y-4 pb-32">
        {/* Image */}
        <div className="h-48 rounded-xl bg-muted flex items-center justify-center text-6xl">
          {pledgeItem.image_url ? (
            <img src={pledgeItem.image_url} alt={pledgeItem.title} className="h-full w-full object-cover rounded-xl" />
          ) : (
            getCategoryEmoji(pledgeItem.category)
          )}
        </div>

        {/* Countdown */}
        {lot.ends_at && !isEnded && (
          <Card className="chaos-card border-chaos-orange/30">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> Ends in
              </p>
              <CountdownTimer targetDate={lot.ends_at} variant="large" />
              {lot.extensions_count > 0 && (
                <p className="text-xs text-chaos-orange mt-2">⚡ Extended {lot.extensions_count}x (anti-sniping)</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current bid */}
        <Card className={`chaos-card ${isWinning ? 'border-primary/50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Current Bid</p>
                <p className="text-3xl font-bold text-primary">
                  {lot.current_bid ? formatEuros(lot.current_bid, showDecimals) : 'No bids'}
                </p>
              </div>
              {isWinning && !isEnded && <StatusChip variant="success">You're winning!</StatusChip>}
              {isWinning && isEnded && <StatusChip variant="success">You won! 🎉</StatusChip>}
            </div>

            {pledgeItem.estimate_low && pledgeItem.estimate_high && (
              <p className="text-sm text-muted-foreground mt-2">
                Estimate: {formatEuros(pledgeItem.estimate_low, showDecimals)} – {formatEuros(pledgeItem.estimate_high, showDecimals)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Description */}
        <Card className="chaos-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Description</p>
            <p>{pledgeItem.description || 'No description provided'}</p>
            {pledgeItem.quantity_text && <p className="text-sm text-muted-foreground">Quantity: {pledgeItem.quantity_text}</p>}
            <p className="text-sm text-muted-foreground capitalize">Category: {pledgeItem.category}</p>
          </CardContent>
        </Card>

        {/* Bid history */}
        <div className="space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Bid History ({bids.length})
          </h3>
          {bids.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bids yet — be the first!</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {bids.map((bid, index) => (
                <div key={bid.id} className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-primary/10' : 'bg-muted/50'}`}>
                  <div className="flex items-center gap-2">
                    {index === 0 && <Gavel className="h-4 w-4 text-primary" />}
                    <span className={index === 0 ? 'font-semibold' : ''}>
                      {bid.player?.full_name || 'Unknown'}
                      {bid.bidder_player_id === player.id && <span className="text-primary ml-1">(you)</span>}
                    </span>
                  </div>
                  <span className="font-mono font-semibold">{formatEuros(bid.amount, showDecimals)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixed bid input */}
      {!isEnded && !isOwner && (
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 safe-bottom">
          <div className="max-w-lg mx-auto space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your balance</span>
              <CreditsDisplay amount={player.credits_balance} variant="compact" />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                <Input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Min: ${formatEuros(minBid)}`}
                  className="pl-8 touch-target"
                  step="1"
                />
              </div>
              <Button
                onClick={handlePlaceBid}
                disabled={isSubmitting || !bidAmount}
                className="touch-target bg-gradient-primary hover:opacity-90 px-6"
              >
                {isSubmitting ? 'Bidding...' : 'Place Bid'}
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setBidAmount((minBid / 100).toString())}
            >
              Quick bid: {formatEuros(minBid)}
            </Button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border p-4 safe-bottom">
          <div className="max-w-lg mx-auto flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <span>This is your pledged item — you can't bid on it</span>
          </div>
        </div>
      )}
    </PageLayout>
    <BottomNav />
    </>
  );
}
