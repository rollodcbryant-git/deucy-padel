import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { PledgeCard, getCategoryConfig } from '@/components/auction/PledgeCard';
import { PledgeForm } from '@/components/auction/PledgeForm';
import { StatusChip } from '@/components/ui/StatusChip';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import type { PledgeItem, Player } from '@/lib/types';
import { Gavel, Plus, Pencil, Lock, Shuffle, TrendingDown, Clock } from 'lucide-react';
import { AuctionIntroModal } from '@/components/onboarding/AuctionIntroModal';

type CategoryFilter = 'all' | 'food' | 'drink' | 'object' | 'service' | 'chaos';
type SortMode = 'random' | 'expensive' | 'newest';

export default function AuctionHousePage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading } = usePlayer();

  const [pledges, setPledges] = useState<PledgeItem[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPledge, setMyPledge] = useState<PledgeItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortMode>('random');

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }
    if (tournament && player) loadData();
  }, [session, tournament, player, isLoading, navigate]);

  const loadData = async () => {
    if (!tournament || !player) return;

    const [pledgeRes, playerRes] = await Promise.all([
      supabase.from('pledge_items').select('*').eq('tournament_id', tournament.id).order('created_at', { ascending: false }),
      supabase.from('players').select('*').eq('tournament_id', tournament.id),
    ]);

    const allPledges = (pledgeRes.data || []) as PledgeItem[];
    setPlayers((playerRes.data || []) as Player[]);

    // Separate my pledge
    const mine = allPledges.find(p => p.pledged_by_player_id === player.id) || null;
    setMyPledge(mine);

    // Public pledges: approved ones + owner's own pending
    const visible = allPledges.filter(p =>
      p.status === 'Approved' || (p.pledged_by_player_id === player.id && p.status === 'Draft')
    );
    setPledges(visible);
  };

  const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  const filteredPledges = useMemo(() => {
    let items = filter === 'all' ? pledges : pledges.filter(p => p.category === filter);

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
  }, [pledges, filter, sort]);

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏪</div>
      </div>
    );
  }

  const canEdit = myPledge && myPledge.status === 'Draft';
  const hasSubmitted = !!myPledge;
  const auctionLive = tournament.status === 'AuctionLive';

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
      <PageLayout
        header={
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="font-bold text-xl flex items-center gap-2">
                <Gavel className="h-6 w-6 text-chaos-orange" />
                Auction House
              </h1>
              {!auctionLive && (
                <StatusChip variant="neutral" size="sm">
                  <Lock className="h-3 w-3 mr-1" />
                  Preview
                </StatusChip>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Bring your pledge. Win your credits. Spend them irresponsibly.
            </p>
          </div>
        }
      >
        <div className="space-y-4">
          {/* My pledge status / CTA */}
          {!hasSubmitted && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full rounded-xl border-2 border-dashed border-primary/40 hover:border-primary/70 transition-colors p-6 text-center space-y-2"
            >
              <Plus className="h-8 w-8 mx-auto text-primary" />
              <p className="font-semibold text-primary">Submit your pledge</p>
              <p className="text-xs text-muted-foreground">Everyone brings something to the chaos</p>
            </button>
          )}

          {hasSubmitted && !showForm && myPledge.status === 'Draft' && (
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

          {hasSubmitted && myPledge.status === 'Approved' && (
            <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
              <p className="text-sm font-medium text-primary">Your pledge is live in the gallery ✅</p>
              <p className="text-xs text-muted-foreground">It becomes a biddable lot when the auction starts</p>
            </div>
          )}

          {showForm && (
            <PledgeForm
              tournamentId={tournament.id}
              playerId={player.id}
              existing={canEdit ? myPledge : null}
              onSaved={() => { setShowForm(false); loadData(); }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Filters */}
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
            {filteredPledges.map(pledge => (
              <PledgeCard
                key={pledge.id}
                pledge={pledge}
                pledger={playerMap.get(pledge.pledged_by_player_id)}
                isOwner={pledge.pledged_by_player_id === player.id}
                onClick={() => navigate(`/auction/${pledge.id}`)}
              />
            ))}
          </div>

          {filteredPledges.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🏜️</div>
              <p className="text-muted-foreground text-sm">
                {filter === 'all' ? 'No pledges yet. Be the first!' : 'No items in this category yet'}
              </p>
            </div>
          )}

          {/* Auction info banner */}
          {!auctionLive && filteredPledges.length > 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">
                🔒 Bidding unlocks when the tournament ends
              </p>
            </div>
          )}
        </div>
      </PageLayout>

      <BottomNav />
    </>
  );
}
