import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminTournamentCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    club_name: '',
    booking_url: '',
    tier: 'League' as 'Major' | 'League' | 'Mini',
    min_players: 8,
    max_players: 8,
    round_duration_days: 10,
    rounds_count: 3,
    starting_credits: 2000,
    stake_per_player: 20,
    participation_bonus: 50,
    penalty_amount: 50,
  });

  const generateJoinCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          ...formData,
          join_code: generateJoinCode(),
          created_by_admin_id: user.id,
          status: 'Draft',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Tournament created!',
        description: 'You can now configure and launch it.',
      });

      navigate(`/admin/tournaments/${data.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create tournament',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Create Tournament</h1>
            <p className="text-sm text-muted-foreground">Set up a new padel chaos</p>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="container max-w-lg mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card className="chaos-card">
            <CardHeader>
              <CardTitle className="text-lg">Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tournament Name *</Label>
                <Input
                  id="name"
                  placeholder="Padel Chaos Cup 2026"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                  className="touch-target"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="club_name">Club Name</Label>
                <Input
                  id="club_name"
                  placeholder="Local Padel Club"
                  value={formData.club_name}
                  onChange={(e) => updateField('club_name', e.target.value)}
                  className="touch-target"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="booking_url">Booking URL</Label>
                <Input
                  id="booking_url"
                  type="url"
                  placeholder="https://club.com/book"
                  value={formData.booking_url}
                  onChange={(e) => updateField('booking_url', e.target.value)}
                  className="touch-target"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier">Tier</Label>
                <select
                  id="tier"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm touch-target"
                  value={formData.tier}
                  onChange={(e) => updateField('tier', e.target.value)}
                >
                  <option value="Major">Major</option>
                  <option value="League">League</option>
                  <option value="Mini">Mini</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Player Settings */}
          <Card className="chaos-card">
            <CardHeader>
              <CardTitle className="text-lg">Player Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max_players">Capacity</Label>
                <Input
                  id="max_players"
                  type="number"
                  min={4}
                  max={24}
                  value={formData.max_players}
                  onChange={(e) => updateField('max_players', parseInt(e.target.value))}
                  className="touch-target"
                />
                <p className="text-xs text-muted-foreground">Number of player slots</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="round_duration_days">Round Duration (days)</Label>
                <Input
                  id="round_duration_days"
                  type="number"
                  min={3}
                  max={30}
                  value={formData.round_duration_days}
                  onChange={(e) => updateField('round_duration_days', parseInt(e.target.value))}
                  className="touch-target"
                />
              </div>
            </CardContent>
          </Card>

          {/* Credits Economy */}
          <Card className="chaos-card">
            <CardHeader>
              <CardTitle className="text-lg">Credits Economy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="starting_credits">Starting Credits</Label>
                <Input
                  id="starting_credits"
                  type="number"
                  min={0}
                  value={formData.starting_credits}
                  onChange={(e) => updateField('starting_credits', parseInt(e.target.value))}
                  className="touch-target"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stake_per_player">Stake/Player</Label>
                  <Input
                    id="stake_per_player"
                    type="number"
                    min={0}
                    value={formData.stake_per_player}
                    onChange={(e) => updateField('stake_per_player', parseInt(e.target.value))}
                    className="touch-target"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participation_bonus">Participation Bonus</Label>
                  <Input
                    id="participation_bonus"
                    type="number"
                    min={0}
                    value={formData.participation_bonus}
                    onChange={(e) => updateField('participation_bonus', parseInt(e.target.value))}
                    className="touch-target"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="penalty_amount">Overdue Penalty</Label>
                <Input
                  id="penalty_amount"
                  type="number"
                  min={0}
                  value={formData.penalty_amount}
                  onChange={(e) => updateField('penalty_amount', parseInt(e.target.value))}
                  className="touch-target"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full touch-target bg-gradient-primary"
            disabled={isLoading || !formData.name}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Create Tournament'
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
