import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { Tournament } from '@/lib/types';
import { Save, Lock, Unlock } from 'lucide-react';

interface Props {
  tournament: Tournament;
  onReload: () => void;
}

export default function AdminSetupSection({ tournament, onReload }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: tournament.name,
    club_name: tournament.club_name || '',
    booking_url: tournament.booking_url || '',
    round_duration_days: tournament.round_duration_days,
    rounds_count: tournament.rounds_count || 3,
    starting_credits: tournament.starting_credits,
    stake_per_player: tournament.stake_per_player,
    participation_bonus: tournament.participation_bonus,
    penalty_amount: tournament.penalty_amount,
    playoffs_enabled: tournament.playoffs_enabled,
  });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('tournaments').update({
      name: form.name,
      club_name: form.club_name || null,
      booking_url: form.booking_url || null,
      round_duration_days: form.round_duration_days,
      rounds_count: form.rounds_count,
      starting_credits: form.starting_credits,
      stake_per_player: form.stake_per_player,
      participation_bonus: form.participation_bonus,
      penalty_amount: form.penalty_amount,
      playoffs_enabled: form.playoffs_enabled,
    }).eq('id', tournament.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved!' });
      onReload();
    }
  };

  const toggleRoster = async () => {
    const newStatus = tournament.status === 'SignupOpen' ? 'Draft' : 'SignupOpen';
    await supabase.from('tournaments').update({ status: newStatus }).eq('id', tournament.id);
    toast({ title: newStatus === 'SignupOpen' ? 'Roster unlocked' : 'Roster locked' });
    onReload();
  };

  const field = (label: string, key: keyof typeof form, type: string = 'text', props: any = {}) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={form[key] as string | number}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="h-9"
        {...props}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {field('Tournament Name', 'name')}
        {field('Club Name', 'club_name')}
        {field('Booking URL', 'booking_url')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field('Round Duration (days)', 'round_duration_days', 'number', { min: 7, max: 14 })}
        {field('Rounds Count', 'rounds_count', 'number', { min: 3, max: 5 })}
      </div>

      <p className="text-xs text-muted-foreground">Player range: 8–24. Auto-recommended rounds: 8-12→3, 13-18→4, 19-24→5</p>

      <div className="grid grid-cols-2 gap-3">
        {field('Starting Credits', 'starting_credits', 'number')}
        {field('Stake / Player', 'stake_per_player', 'number')}
        {field('Participation Bonus', 'participation_bonus', 'number')}
        {field('Penalty Amount', 'penalty_amount', 'number')}
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
        <Label className="text-sm">Playoffs enabled</Label>
        <Switch checked={form.playoffs_enabled} onCheckedChange={v => setForm(f => ({ ...f, playoffs_enabled: v }))} />
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="flex-1 bg-gradient-primary">
          <Save className="mr-2 h-4 w-4" />Save Settings
        </Button>
        {(tournament.status === 'Draft' || tournament.status === 'SignupOpen') && (
          <Button variant="outline" onClick={toggleRoster}>
            {tournament.status === 'SignupOpen' ? <Lock className="mr-2 h-4 w-4" /> : <Unlock className="mr-2 h-4 w-4" />}
            {tournament.status === 'SignupOpen' ? 'Lock Roster' : 'Open Signups'}
          </Button>
        )}
      </div>
    </div>
  );
}
