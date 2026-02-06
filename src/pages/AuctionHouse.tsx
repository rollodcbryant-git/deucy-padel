import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { PledgeCard } from '@/components/auction/PledgeCard';
import { PledgeForm } from '@/components/auction/PledgeForm';
import { StatusChip } from '@/components/ui/StatusChip';
import { Progress } from '@/components/ui/progress';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { EuroDisclaimer } from '@/components/ui/EuroDisclaimer';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import type { PledgeItem, Player, Round, Auction } from '@/lib/types';
import { Gavel, Plus, Pencil, Lock, Shuffle, TrendingDown, Clock } from 'lucide-react';
import { AuctionIntroModal } from '@/components/onboarding/AuctionIntroModal';

type CategoryFilter = 'all' | 'food' | 'drink' | 'object' | 'service' | 'chaos';
type SortMode = 'random' | 'expensive' | 'newest';

export default function AuctionHousePage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading } = usePlayer();

  const [pledges, setPledges] = useState<PledgeItem[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [myCurrentRoundPledge, setMyCurrentRoundPledge] = useState<PledgeItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortMode>('random');
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [showIntro, setShowIntro] = useState(false);

  const currentRound = useMemo(() => rounds.find(r => r.status === 'Live') || null, [rounds]);
  const roundMap = useMemo(() => new Map(rounds.map(r => [r.id, r])), [rounds]);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }
    if (tournament && player) {
      loadData();
      if (!player.has_seen_auction_intro) {
        setShowIntro(true);
      }
    }
  }, [session, tournament, player, isLoading, navigate]);

  const handleIntroComplete = async (action: 'view' | 'pledge' | 'skip') => {
    setShowIntro(false);
    if (player) {
      await supabase.from('players').update({ has_seen_auction_intro: true }).eq('id', player.id);
    }
    if (action === 'pledge') {
      setShowForm(true);
    }
  };

  const loadData = async () => {
    if (!tournament || !player) return;

    const [pledgeRes, playerRes, roundRes, auctionRes] = await Promise.all([
      supabase.from('pledge_items').select('*').eq('tournament_id', tournament.id).order('created_at', { ascending: false }),
      supabase.from('players').select('*').eq('tournament_id', tournament.id),
      supabase.from('rounds').select('*').eq('tournament_id', tournament.id).order('index', { ascending: true }),
      supabase.from('auctions').select('*').eq('tournament_id', tournament.id).maybeSingle(),
    ]);

    const allPledges = (pledgeRes.data || []) as PledgeItem[];
    const allRounds = (roundRes.data || []) as Round[];
    setPlayers((playerRes.data || []) as Player[]);
    setRounds(allRounds);
    setAuction(auctionRes.data as Auction | null);

    const liveRound = allRounds.find(r => r.status === 'Live');
    const mine = liveRound
      ? allPledges.find(p => p.pledged_by_player_id === player.id && p.round_id === liveRound.id) || null
      : allPledges.find(p => p.pledged_by_player_id === player.id && !p.round_id) || null;
    setMyCurrentRoundPledge(mine);

    const visible = allPledges.filter(p =>
      p.status === 'Approved' || p.status === 'Draft'
    );
    setPledges(visible);
  };

  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  const activePlayers = useMemo(() => players.filter(p => p.status === 'Active'), [players]);

  const currentRoundPledgeCount = useMemo(() => {
    if (!currentRound) return 0;
    return pledges.filter(p => p.round_id === currentRound.id).length;
  }, [pledges, currentRound]);

  const filteredPledges = useMemo(() => {
    let items = pledges;
    if (roundFilter !== 'all') {
      items = items.filter(p => p.round_id === roundFilter || (!p.round_id && roundFilter === 'none'));
    }
    if (filter !== 'all') {
      items = items.filter(p => p.category === filter);
    }
    switch (sort) {
      case 'expensive':
        items = [...items].sort((a, b) => (b.estimate_high ?? b.estimate_low ?? 0) - (a.estimate_high ?? a.estimate_low ?? 0));
        break;
      case 'newest':
        items = [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'random':
        items = [...items].sort(() => Math.random() - 0.5);
        break;
    }
    return items;
  }, [pledges, filter, sort, roundFilter]);

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏪</div>
      </div>
    );
  }

  const canEdit = myCurrentRoundPledge && myCurrentRoundPledge.status === 'Draft';
  const hasSubmittedThisRound = !!myCurrentRoundPledge;
  const auctionLive = auction?.status === 'Live';
  const auctionEnded = auction?.status === 'Ended';

  const categories: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'food', label: '🍕 Food' },
    { key: 'drink', label: '🍷 Drink' },
    { key: 'object', label: '🎁 Object' },
    { key: 'service', label: '💆 Service' },
    { key: 'chaos', label: '🎲 Chaos' },
  ];

  return (
    <>
      <AuctionIntroModal
        open={showIntro}
        hasPledged={hasSubmittedThisRound}
        onViewGallery={() => handleIntroComplete('view')}
        onAddPledge={() => handleIntroComplete('pledge')}
        onSkip={() => handleIntroComplete('skip')}
      />
      <PageLayout
        header={
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-xl flex items-center gap-2">
                <Gavel className="h-6 w-6 text-chaos-orange" />
                Auction House
              </h1>
              {auctionLive ? (
                <StatusChip variant="live" pulse>Live</StatusChip>
              ) : auctionEnded ? (
                <StatusChip variant="ended">Ended</StatusChip>
              ) : (
                <StatusChip variant="neutral" size="sm">
                  <Lock className="h-3 w-3 mr-1" />
                  Gallery
                </StatusChip>
              )}
            </div>

            {/* Auction countdown when live */}
            {auctionLive && auction?.ends_at && (
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Auction ends in</p>
                <CountdownTimer targetDate={auction.ends_at} variant="large" />
                <EuroDisclaimer variant="inline" />
              </div>
            )}

            {!auctionLive && !auctionEnded && (
              <p className="text-sm text-muted-foreground">
                Browse pledges. Bidding unlocks when the auction goes live.
              </p>
            )}

            {/* Round pledge progress */}
            {currentRound && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Round {currentRound.index}: {currentRoundPledgeCount}/{activePlayers.length} pledges
                  </span>
                  <span className="font-medium text-primary">
                    {currentRoundPledgeCount === activePlayers.length ? '✅ All in!' : `${activePlayers.length - currentRoundPledgeCount} missing`}
                  </span>
                </div>
                <Progress value={activePlayers.length > 0 ? (currentRoundPledgeCount / activePlayers.length) * 100 : 0} className="h-2" />
              </div>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {/* My pledge status / CTA for current round */}
          {!hasSubmittedThisRound && !showForm && currentRound && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-xl border-2 border-dashed border-primary/40 hover:border-primary/70 transition-colors p-6 text-center space-y-2"
            >
              <Plus className="h-8 w-8 mx-auto text-primary" />
              <p className="font-semibold text-primary">Submit Round {currentRound.index} pledge</p>
              <p className="text-xs text-muted-foreground">Required to play this round</p>
            </button>
          )}

          {!hasSubmittedThisRound && !showForm && !currentRound && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-xl border-2 border-dashed border-primary/40 hover:border-primary/70 transition-colors p-6 text-center space-y-2"
            >
              <Plus className="h-8 w-8 mx-auto text-primary" />
              <p className="font-semibold text-primary">Submit your pledge</p>
              <p className="text-xs text-muted-foreground">Everyone brings something to the chaos</p>
            </button>
          )}

          {hasSubmittedThisRound && !showForm && myCurrentRoundPledge.status === 'Draft' && (
            <div className="rounded-xl bg-chaos-orange/10 border border-chaos-orange/30 p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Your pledge is pending approval ⏳</p>
                <p className="text-xs text-muted-foreground">Sit tight — the chaos council is reviewing it</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Pencil className="h-3 w-3 mr-1" />Edit
              </Button>
            </div>
          )}

          {hasSubmittedThisRound && myCurrentRoundPledge.status === 'Approved' && (
            <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
              <p className="text-sm font-medium text-primary">
                {currentRound ? `Round ${currentRound.index} pledge is live ✅` : 'Your pledge is live ✅'}
              </p>
              <p className="text-xs text-muted-foreground">It becomes a biddable lot when the auction starts</p>
            </div>
          )}

          {showForm && (
            <PledgeForm
              tournamentId={tournament.id}
              playerId={player.id}
              roundId={currentRound?.id}
              existing={canEdit ? myCurrentRoundPledge : null}
              onSaved={() => { setShowForm(false); loadData(); }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Round filter */}
          {rounds.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <Button
                variant={roundFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                className={roundFilter === 'all' ? 'bg-gradient-primary shrink-0' : 'shrink-0'}
                onClick={() => setRoundFilter('all')}
              >
                All rounds
              </Button>
              {rounds.map(r => (
                <Button
                  key={r.id}
                  variant={roundFilter === r.id ? 'default' : 'outline'}
                  size="sm"
                  className={roundFilter === r.id ? 'bg-gradient-primary shrink-0' : 'shrink-0'}
                  onClick={() => setRoundFilter(r.id)}
                >
                  R{r.index}
                </Button>
              ))}
            </div>
          )}

          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {categories.map(c => (
              <Button
                key={c.key}
                variant={filter === c.key ? 'default' : 'outline'}
                size="sm"
                className={filter === c.key ? 'bg-gradient-primary shrink-0' : 'shrink-0'}
                onClick={() => setFilter(c.key)}
              >
                {c.label}
              </Button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort:</span>
            {([
              { key: 'random', label: 'Random', icon: Shuffle },
              { key: 'expensive', label: 'Top value', icon: TrendingDown },
              { key: 'newest', label: 'Newest', icon: Clock },
            ] as const).map(s => (
              <Button
                key={s.key}
                variant={sort === s.key ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSort(s.key)}
              >
                <s.icon className="h-3 w-3 mr-1" />{s.label}
              </Button>
            ))}
          </div>

          {/* Gallery grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredPledges.map(pledge => {
              const pledgeRound = pledge.round_id ? roundMap.get(pledge.round_id) : null;
              return (
                <PledgeCard
                  key={pledge.id}
                  pledge={pledge}
                  pledger={playerMap.get(pledge.pledged_by_player_id)}
                  isOwner={pledge.pledged_by_player_id === player.id}
                  roundIndex={pledgeRound?.index}
                  onClick={() => {
                    if (auctionLive) {
                      // Navigate to lot detail if auction is live
                      navigate(`/auction/live`);
                    } else {
                      navigate(`/auction/${pledge.id}`);
                    }
                  }}
                />
              );
            })}
          </div>

          {filteredPledges.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🏜️</div>
              <p className="text-muted-foreground text-sm">
                {filter === 'all' ? 'No pledges yet. Be the first!' : 'No items in this category yet'}
              </p>
            </div>
          )}

          {/* Lock state message */}
          {!auctionLive && !auctionEnded && filteredPledges.length > 0 && (
            <div className="rounded-lg bg-muted/50 border border-border p-4 text-center space-y-1">
              <Lock className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                Bidding unlocks when auction goes live
              </p>
              <p className="text-xs text-muted-foreground/70">
                Admin will launch the auction after the tournament ends
              </p>
            </div>
          )}

          {/* Go to live auction */}
          {auctionLive && (
            <Button
              onClick={() => navigate('/auction/live')}
              variant="hot"
              className="w-full touch-target"
            >
              <Gavel className="mr-2 h-5 w-5" />
              Go to Live Auction →
            </Button>
          )}
        </div>
      </PageLayout>

      <BottomNav />
    </>
  );
}
