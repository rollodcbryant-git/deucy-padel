import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusChip } from '@/components/ui/StatusChip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePlayer } from '@/contexts/PlayerContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PledgeItem, PledgeCategory } from '@/lib/types';
import { Gift, Plus, Check, Pencil } from 'lucide-react';

const getCategoryEmoji = (category: string) => {
  switch (category) {
    case 'food': return '🍕';
    case 'drink': return '🍷';
    case 'object': return '🎁';
    case 'service': return '💆';
    case 'chaos': return '🎲';
    default: return '📦';
  }
};

export default function PledgesPage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading } = usePlayer();
  const { toast } = useToast();

  const [myPledge, setMyPledge] = useState<PledgeItem | null>(null);
  const [allPledges, setAllPledges] = useState<PledgeItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PledgeCategory>('food');
  const [description, setDescription] = useState('');
  const [quantityText, setQuantityText] = useState('');

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }
    if (tournament && player) {
      loadPledges();
    }
  }, [session, tournament, player, isLoading, navigate]);

  const loadPledges = async () => {
    if (!tournament || !player) return;

    // Load my pledge
    const { data: mine } = await supabase
      .from('pledge_items')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('pledged_by_player_id', player.id)
      .maybeSingle();

    if (mine) {
      setMyPledge(mine as PledgeItem);
      setTitle(mine.title);
      setCategory(mine.category as PledgeCategory);
      setDescription(mine.description || '');
      setQuantityText(mine.quantity_text || '');
    }

    // Load all approved pledges
    const { data: all } = await supabase
      .from('pledge_items')
      .select('*')
      .eq('tournament_id', tournament.id)
      .in('status', ['Approved', 'Draft'])
      .order('created_at', { ascending: false });

    setAllPledges((all || []) as PledgeItem[]);
  };

  const handleSave = async () => {
    if (!tournament || !player) return;
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      if (myPledge) {
        // Update
        if (myPledge.status === 'Approved') {
          toast({ title: 'Already approved', description: "Can't edit after admin approval", variant: 'destructive' });
          return;
        }
        await supabase
          .from('pledge_items')
          .update({ title, category, description: description || null, quantity_text: quantityText || null })
          .eq('id', myPledge.id);
      } else {
        // Create
        await supabase.from('pledge_items').insert({
          tournament_id: tournament.id,
          pledged_by_player_id: player.id,
          title,
          category,
          description: description || null,
          quantity_text: quantityText || null,
          status: 'Draft',
        });
      }

      toast({ title: myPledge ? 'Pledge updated! 🎁' : 'Pledge submitted! 🎁' });
      setIsEditing(false);
      loadPledges();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">🎁</div>
      </div>
    );
  }

  const showAuction = tournament.status === 'AuctionLive';
  const canEdit = !myPledge || myPledge.status === 'Draft';
  const showForm = !myPledge || isEditing;

  return (
    <>
      <PageLayout
        header={
          <div className="p-4">
            <h1 className="font-bold text-xl flex items-center gap-2">
              <Gift className="h-6 w-6 text-chaos-orange" />
              Pledges
            </h1>
            <p className="text-sm text-muted-foreground">
              Everyone brings something to the chaos
            </p>
          </div>
        }
      >
        <div className="space-y-6">
          {/* My Pledge */}
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">Your Pledge</h2>

            {myPledge && !isEditing ? (
              <Card className="chaos-card border-primary/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getCategoryEmoji(myPledge.category)}</span>
                      <div>
                        <p className="font-semibold">{myPledge.title}</p>
                        <p className="text-sm text-muted-foreground capitalize">{myPledge.category}</p>
                      </div>
                    </div>
                    <StatusChip
                      variant={myPledge.status === 'Approved' ? 'success' : 'neutral'}
                      size="sm"
                    >
                      {myPledge.status}
                    </StatusChip>
                  </div>

                  {myPledge.description && (
                    <p className="text-sm text-muted-foreground">{myPledge.description}</p>
                  )}

                  {myPledge.estimate_low && myPledge.estimate_high && (
                    <p className="text-sm text-primary">
                      💰 Estimate: {myPledge.estimate_low} - {myPledge.estimate_high} credits
                    </p>
                  )}

                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : showForm ? (
              <Card className="chaos-card">
                <CardHeader>
                  <CardTitle className="text-base">
                    {myPledge ? 'Edit Your Pledge' : 'Submit Your Pledge'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>What are you pledging? *</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Homemade churros"
                      className="touch-target"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as PledgeCategory)}>
                      <SelectTrigger className="touch-target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="food">🍕 Food</SelectItem>
                        <SelectItem value="drink">🍷 Drink</SelectItem>
                        <SelectItem value="object">🎁 Object</SelectItem>
                        <SelectItem value="service">💆 Service</SelectItem>
                        <SelectItem value="chaos">🎲 Chaos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell people what makes it special..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Quantity (optional)</Label>
                    <Input
                      value={quantityText}
                      onChange={(e) => setQuantityText(e.target.value)}
                      placeholder="e.g., 1 bottle, 6 servings"
                      className="touch-target"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving || !title.trim()}
                      className="flex-1 touch-target bg-gradient-primary hover:opacity-90"
                    >
                      {isSaving ? 'Saving...' : myPledge ? 'Update Pledge' : 'Submit Pledge'}
                    </Button>
                    {isEditing && (
                      <Button variant="outline" onClick={() => setIsEditing(false)} className="touch-target">
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          {/* All Pledges */}
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">All Pledges ({allPledges.length})</h2>

            {allPledges.length === 0 ? (
              <Card className="chaos-card">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-3">🎁</div>
                  <p className="text-muted-foreground">No pledges yet. Be the first!</p>
                </CardContent>
              </Card>
            ) : (
              allPledges.map((pledge) => (
                <Card
                  key={pledge.id}
                  className={`chaos-card ${pledge.pledged_by_player_id === player.id ? 'border-primary/30' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getCategoryEmoji(pledge.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{pledge.title}</p>
                        {pledge.description && (
                          <p className="text-sm text-muted-foreground truncate">{pledge.description}</p>
                        )}
                      </div>
                      <StatusChip
                        variant={pledge.status === 'Approved' ? 'success' : 'neutral'}
                        size="sm"
                      >
                        {pledge.status === 'Approved' ? <Check className="h-3 w-3" /> : pledge.status}
                      </StatusChip>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </PageLayout>

      <BottomNav showAuction={showAuction} />
    </>
  );
}
