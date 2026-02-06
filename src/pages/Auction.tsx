import { useNavigate } from 'react-router-dom';
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
import type { Auction, AuctionLotWithDetails, PledgeItem, Player } from '@/lib/types';
import { Gavel, Filter, Clock, TrendingUp, Inbox } from 'lucide-react';
import { formatEuros } from '@/lib/euros';

type FilterType = 'all' | 'ending_soon' | 'most_bids' | 'no_bids';

export default function AuctionPage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading } = usePlayer();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [lots, setLots] = useState<AuctionLotWithDetails[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }
    if (tournament && player) {
      loadAuction();
    }
  }, [session, tournament, player, isLoading, navigate]);

  useEffect(() => {
    if (!auction) return;
    const channel = supabase
      .channel('auction-lots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_lots', filter: `auction_id=eq.${auction.id}` }, () => loadLots())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => loadLots())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [auction]);

  const loadAuction = async () => {
    if (!tournament) return;
    const { data: auctionData } = await supabase.from('auctions').select('*').eq('tournament_id', tournament.id).single();
    if (auctionData) {
      setAuction(auctionData as Auction);
      loadLots();
    }
  };

  const loadLots = async () => {
    if (!tournament) return;
    const { data: auctionData } = await supabase.from('auctions').select('id').eq('tournament_id', tournament.id).single();
    if (!auctionData) return;
    const { data: lotsData } = await supabase.from('auction_lots').select('*').eq('auction_id', auctionData.id);
    if (!lotsData) return;
    const pledgeIds = lotsData.map(l => l.pledge_item_id);
    const { data: pledgeItems } = await supabase.from('pledge_items').select('*').in('id', pledgeIds);
    const pledgeMap = new Map((pledgeItems || []).map(p => [p.id, p as PledgeItem]));
    const lotsWithDetails: AuctionLotWithDetails[] = await Promise.all(
      lotsData.map(async (lot) => {
        const { count } = await supabase.from('bids').select('*', { count: 'exact', head: true }).eq('lot_id', lot.id);
        return { ...lot, pledge_item: pledgeMap.get(lot.pledge_item_id), bids_count: count || 0 } as AuctionLotWithDetails;
      })
    );
    setLots(lotsWithDetails);
  };

  const getFilteredLots = () => {
    let filtered = [...lots];
    switch (filter) {
      case 'ending_soon':
        filtered = filtered.filter(l => l.ends_at && l.status === 'Live').sort((a, b) => new Date(a.ends_at!).getTime() - new Date(b.ends_at!).getTime());
        break;
      case 'most_bids':
        filtered = filtered.sort((a, b) => (b.bids_count || 0) - (a.bids_count || 0));
        break;
      case 'no_bids':
        filtered = filtered.filter(l => !l.current_bid);
        break;
    }
    return filtered;
  };

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🔨</div>
      </div>
    );
  }

  if (!auction || auction.status !== 'Live') {
    return (
      <>
        <PageLayout hasBottomNav={true}>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔨</div>
            <h1 className="text-2xl font-bold mb-2">Auction Not Live</h1>
            <p className="text-muted-foreground">The auction hasn't started yet. Check back later!</p>
          </div>
        </PageLayout>
        <BottomNav />
      </>
    );
  }

  const filteredLots = getFilteredLots();
  const showDecimals = tournament.display_decimals;

  const getCategoryEmoji = (category?: string) => {
    switch (category) {
      case 'food': return '🍕'; case 'drink': return '🍷'; case 'object': return '🎁'; case 'service': return '💆'; case 'chaos': return '🎲'; default: return '📦';
    }
  };

  return (
    <>
      <PageLayout
        header={
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-xl flex items-center gap-2">
                <Gavel className="h-6 w-6 text-chaos-orange" /> Auction
              </h1>
              <StatusChip variant="live" pulse>Live</StatusChip>
            </div>
            {auction.ends_at && (
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground mb-1">Auction ends in</p>
                <CountdownTimer targetDate={auction.ends_at} variant="large" />
              </div>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* Your balance */}
          <Card className="chaos-card border-primary/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-sm text-muted-foreground">Your bidding power</span>
                <p className="text-[10px] text-muted-foreground/50">in-app € only</p>
              </div>
              <CreditsDisplay amount={player.credits_balance} variant="compact" />
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[
              { key: 'all', label: 'All', icon: Filter },
              { key: 'ending_soon', label: 'Ending Soon', icon: Clock },
              { key: 'most_bids', label: 'Most Bids', icon: TrendingUp },
              { key: 'no_bids', label: 'No Bids', icon: Inbox },
            ].map(({ key, label, icon: Icon }) => (
              <Button key={key} variant={filter === key ? 'default' : 'outline'} size="sm" className={filter === key ? 'bg-gradient-primary' : ''} onClick={() => setFilter(key as FilterType)}>
                <Icon className="h-4 w-4 mr-1" /> {label}
              </Button>
            ))}
          </div>

          {/* Lots grid */}
          <div className="space-y-3">
            {filteredLots.map((lot) => (
              <Card key={lot.id} className="chaos-card cursor-pointer hover:border-primary/50 transition-all" onClick={() => navigate(`/auction/${lot.id}`)}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center text-3xl shrink-0">
                      {lot.pledge_item?.image_url ? (
                        <img src={lot.pledge_item.image_url} alt={lot.pledge_item.title} className="h-full w-full object-cover rounded-lg" />
                      ) : getCategoryEmoji(lot.pledge_item?.category)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-semibold truncate">{lot.pledge_item?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {lot.pledge_item?.category && <span className="capitalize">{lot.pledge_item.category}</span>}
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        {lot.current_bid ? (
                          <>
                            <span className="text-primary font-bold">{formatEuros(lot.current_bid, showDecimals)}</span>
                            <span className="text-muted-foreground">({lot.bids_count} bids)</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">No bids yet</span>
                        )}
                      </div>
                      {lot.pledge_item?.estimate_low && lot.pledge_item?.estimate_high && (
                        <p className="text-xs text-muted-foreground">
                          Est: {formatEuros(lot.pledge_item.estimate_low)}–{formatEuros(lot.pledge_item.estimate_high)}
                        </p>
                      )}
                    </div>
                    {lot.ends_at && lot.status === 'Live' && (
                      <div className="text-right">
                        <CountdownTimer targetDate={lot.ends_at} variant="compact" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredLots.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🔍</div>
                <p className="text-muted-foreground">No lots match this filter</p>
              </div>
            )}
          </div>
        </div>
      </PageLayout>
      <BottomNav />
    </>
  );
}
