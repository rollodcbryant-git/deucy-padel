import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { BottomNav } from '@/components/layout/BottomNav';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { CreditsDisplay } from '@/components/ui/CreditsDisplay';
import { StatusChip } from '@/components/ui/StatusChip';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EditNameDialog } from '@/components/profile/EditNameDialog';
import { ChangePinDialog } from '@/components/profile/ChangePinDialog';
import { ProfilePledgeCard } from '@/components/profile/ProfilePledgeCard';
import { usePlayer } from '@/contexts/PlayerContext';
import { usePledgeStatus } from '@/hooks/usePledgeStatus';
import { supabase } from '@/integrations/supabase/client';
import type { PledgeItem, Round } from '@/lib/types';
import { Camera, Pencil, AlertTriangle, ChevronRight, LogOut, User, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { player, tournament, session, isLoading, refreshPlayer, logout } = usePlayer();
  const { pledgeStatus } = usePledgeStatus(player, tournament);
  const { toast } = useToast();

  const [pledges, setPledges] = useState<PledgeItem[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [rank, setRank] = useState(0);
  const [showEditName, setShowEditName] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !session) {
      navigate('/');
      return;
    }
    if (tournament && player) loadProfile();
  }, [player?.id, tournament?.id, isLoading, session]);

  const loadProfile = async () => {
    if (!tournament || !player) return;

    const [pledgeRes, roundRes, rankRes] = await Promise.all([
      supabase
        .from('pledge_items')
        .select('*')
        .eq('pledged_by_player_id', player.id)
        .eq('tournament_id', tournament.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('rounds')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('index', { ascending: true }),
      supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id)
        .eq('status', 'Active')
        .gt('credits_balance', player.credits_balance),
    ]);

    setPledges((pledgeRes.data || []) as PledgeItem[]);
    setRounds((roundRes.data || []) as Round[]);
    setRank((rankRes.count || 0) + 1);
  };

  const handleSaveName = async (newName: string) => {
    if (!player) return;
    const { error } = await supabase
      .from('players')
      .update({ full_name: newName })
      .eq('id', player.id);
    if (error) {
      toast({ title: 'Error', description: 'Could not update name', variant: 'destructive' });
      throw error;
    }
    await refreshPlayer();
    toast({ title: 'Name updated ✏️' });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !player) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${player.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase
        .from('players')
        .update({ avatar_url: avatarUrl })
        .eq('id', player.id);

      await refreshPlayer();
      toast({ title: 'Avatar updated 📸' });
    } catch (err) {
      console.error('Upload failed:', err);
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (isLoading || !player || !tournament) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-4xl animate-pulse">👤</div>
      </div>
    );
  }

  const roundMap = new Map(rounds.map(r => [r.id, r]));
  const showDecimals = tournament.display_decimals;
  const liveRound = rounds.find(r => r.status === 'Live');
  const pledgeMissing = pledgeStatus === 'missing';

  return (
    <>
      <PageLayout
        header={
          <div className="p-4 flex items-center justify-between">
            <h1 className="font-bold text-xl flex items-center gap-2">
              <User className="h-6 w-6 text-primary" /> Profile
            </h1>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Identity header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative">
              <PlayerAvatar player={player} className="h-24 w-24 text-2xl" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
                disabled={uploading}
              >
                {uploading ? (
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{player.full_name}</h2>
              <button
                onClick={() => setShowEditName(true)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">Rank #{rank}</p>

            <CreditsDisplay
              amount={player.credits_balance}
              variant="large"
              showDisclaimer
              showDecimals={showDecimals}
            />
          </div>

          {/* Pledge missing banner */}
          {pledgeMissing && liveRound && (
            <Card className="border-chaos-orange/50 bg-chaos-orange/5">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-chaos-orange shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-chaos-orange">
                    Round {liveRound.index} pledge missing
                  </p>
                  <p className="text-xs text-muted-foreground">Submit to be scheduled</p>
                </div>
                <Button size="sm" onClick={() => navigate('/complete-entry')} className="bg-gradient-primary hover:opacity-90 shrink-0">
                  Add pledge
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Pledges section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Your pledges
            </h3>

            {pledges.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">📦</div>
                <p className="text-sm text-muted-foreground">No pledges yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pledges.map((pledge) => {
                  const round = pledge.round_id ? roundMap.get(pledge.round_id) : null;
                  return (
                    <ProfilePledgeCard
                      key={pledge.id}
                      pledge={pledge}
                      roundIndex={round?.index}
                      showDecimals={showDecimals}
                      onClick={() => navigate(`/auction/${pledge.id}`)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Tournament membership */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Tournament
            </h3>
            <Card
              className="cursor-pointer hover:border-primary/40 transition-all"
              onClick={() => navigate('/matches')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{tournament.name}</p>
                  {tournament.club_name && (
                    <p className="text-xs text-muted-foreground">{tournament.club_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip
                    variant={tournament.status === 'Live' ? 'live' : tournament.status === 'Finished' ? 'ended' : 'neutral'}
                    size="sm"
                    pulse={tournament.status === 'Live'}
                  >
                    {tournament.status}
                  </StatusChip>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Change PIN */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Security
            </h3>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowChangePin(true)}
            >
              <KeyRound className="h-4 w-4 mr-2" />
              Change PIN
            </Button>
          </div>
        </div>
      </PageLayout>

      <BottomNav />

      <EditNameDialog
        open={showEditName}
        onOpenChange={setShowEditName}
        currentName={player.full_name}
        onSave={handleSaveName}
      />
    </>
  );
}
