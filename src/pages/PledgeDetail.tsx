import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { PledgeForm } from '@/components/auction/PledgeForm';
import { getCategoryConfig } from '@/components/auction/PledgeCard';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import type { PledgeItem, Player } from '@/lib/types';
import { ArrowLeft, Pencil, Lock } from 'lucide-react';

export default function PledgeDetailPage() {
  const { pledgeId } = useParams();
  const navigate = useNavigate();
  const { player, tournament, session, isLoading } = usePlayer();

  const [pledge, setPledge] = useState<PledgeItem | null>(null);
  const [pledger, setPledger] = useState<Player | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) { navigate('/'); return; }
    if (pledgeId && player) loadPledge();
  }, [pledgeId, session, player, isLoading, navigate]);

  const loadPledge = async () => {
    if (!pledgeId) return;
    const { data } = await supabase.from('pledge_items').select('*').eq('id', pledgeId).single();
    if (!data) { navigate('/auction'); return; }
    setPledge(data as PledgeItem);

    const { data: p } = await supabase.from('players').select('*').eq('id', data.pledged_by_player_id).single();
    setPledger(p as Player);
  };

  if (isLoading || !player || !tournament || !pledge) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏪</div>
      </div>
    );
  }

  const isOwner = pledge.pledged_by_player_id === player.id;
  const canEdit = isOwner && pledge.status === 'Draft';
  const cat = getCategoryConfig(pledge.category);
  const hasEstimate = pledge.estimate_low != null || pledge.estimate_high != null;

  if (editing && canEdit) {
    return (
      <>
      <PageLayout hasBottomNav={true} header={
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg">Edit Pledge</h1>
        </div>
      }>
        <PledgeForm
          tournamentId={tournament.id}
          playerId={player.id}
          existing={pledge}
          onSaved={() => { setEditing(false); loadPledge(); }}
          onCancel={() => setEditing(false)}
        />
      </PageLayout>
      <BottomNav />
      </>
    );
  }

  const formatEstimate = () => {
    if (pledge.estimate_low != null && pledge.estimate_high != null && pledge.estimate_low !== pledge.estimate_high) {
      return `${pledge.estimate_low}–${pledge.estimate_high} credits`;
    }
    return `${pledge.estimate_low ?? pledge.estimate_high} credits`;
  };

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
            <h1 className="font-bold text-lg truncate">{pledge.title}</h1>
          </div>
          <StatusChip
            variant={pledge.status === 'Approved' ? 'success' : 'warning'}
            size="sm"
          >
            {pledge.status === 'Approved' ? 'Approved' : 'Pending'}
          </StatusChip>
        </div>
      }
    >
      <div className="space-y-4 pb-8">
        {/* Large image */}
        <div className="aspect-[4/3] rounded-xl bg-muted overflow-hidden">
          {pledge.image_url ? (
            <img src={pledge.image_url} alt={pledge.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-7xl opacity-30">
              {cat.emoji}
            </div>
          )}
        </div>

        {/* Category chip */}
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${cat.color}`}>
          {cat.emoji} {cat.label}
        </span>

        {/* Pledger */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-lg">
            {pledger?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-medium">Pledged by {pledger?.full_name || 'Unknown'}</p>
            {isOwner && <p className="text-xs text-primary">That's you!</p>}
          </div>
        </div>

        {/* Description */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm">{pledge.description || 'No description provided'}</p>
          </CardContent>
        </Card>

        {/* Estimate */}
        {hasEstimate && (
          <Card className="border-primary/30">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Estimated Value</p>
              <p className="text-2xl font-bold text-primary">💰 {formatEstimate()}</p>
            </CardContent>
          </Card>
        )}

        {/* Status message */}
        {pledge.status === 'Approved' && (
          <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 text-center">
            <Lock className="h-5 w-5 mx-auto text-primary mb-2" />
            <p className="text-sm text-muted-foreground">
              This becomes a live lot when the auction starts.
            </p>
          </div>
        )}

        {/* Edit button */}
        {canEdit && (
          <Button onClick={() => setEditing(true)} variant="outline" className="w-full touch-target">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Pledge
          </Button>
        )}
      </div>
    </PageLayout>
    <BottomNav />
    </>
  );
}
