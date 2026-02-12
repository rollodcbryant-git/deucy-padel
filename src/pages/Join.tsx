import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { hashPin } from '@/contexts/PlayerContext';
import { normalizePhone } from '@/lib/phone';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Phone, Users, Eye, EyeOff } from 'lucide-react';
import type { PlayerGender } from '@/lib/types';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('t');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<PlayerGender | ''>('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const validatePhone = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed.startsWith('+')) {
      setPhoneError('Add country code (ex: +34) so WhatsApp links work.');
      return false;
    }
    const digits = trimmed.replace(/[\s\-().+]/g, '');
    if (digits.length < 7) {
      setPhoneError('Phone number is too short.');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (phoneError && value.trim().startsWith('+')) {
      setPhoneError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Show warning but don't block submission
    validatePhone(phone);

    if (pin.length !== 4) {
      toast({ title: 'Invalid PIN', description: 'PIN must be exactly 4 digits.', variant: 'destructive' });
      return;
    }
    if (pin !== confirmPin) {
      toast({ title: 'PINs don\'t match', description: 'Please make sure both PINs are the same.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const normalizedPhone = normalizePhone(phone);

    try {
      // Check if phone already exists
      let existingQuery = supabase
        .from('players')
        .select('id')
        .eq('phone', normalizedPhone);

      if (tournamentId) {
        existingQuery = existingQuery.eq('tournament_id', tournamentId);
      }

      const { data: existing } = await existingQuery;

      if (existing && existing.length > 0) {
        toast({
          title: 'Phone already registered',
          description: 'This phone number already has an account. Try signing in instead.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const pinHash = hashPin(pin);

      let startingCredits = 1000;
      if (tournamentId) {
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('starting_credits')
          .eq('id', tournamentId)
          .single();
        if (tournament) startingCredits = tournament.starting_credits;
      }

      const { data: newPlayer, error } = await supabase.from('players').insert({
        tournament_id: tournamentId || undefined,
        full_name: fullName,
        phone: normalizedPhone,
        pin_hash: pinHash,
        gender: gender || null,
        credits_balance: tournamentId ? startingCredits : 0,
      }).select().single();

      if (error) throw error;

      // Create StartingGrant ledger entry when joining a tournament
      if (newPlayer && tournamentId) {
        await supabase.from('credit_ledger_entries').insert({
          tournament_id: tournamentId,
          player_id: newPlayer.id,
          type: 'StartingGrant' as const,
          amount: startingCredits,
          note: 'Starting credits',
        });
      }

      // Auto-login
      if (newPlayer) {
        const token = crypto.randomUUID();
        await supabase.from('players').update({ session_token: token }).eq('id', newPlayer.id);
        const session = {
          playerId: newPlayer.id,
          tournamentId: tournamentId || null,
          playerName: fullName,
          token,
        };
        localStorage.setItem('padel_chaos_session', JSON.stringify(session));
      }

      toast({ title: 'Account created! 🎾', description: 'Welcome to Deucy!' });

      if (tournamentId) {
        window.location.href = '/complete-entry';
      } else {
        window.location.href = '/tournaments';
      }
    } catch (error: any) {
      console.error('Join error:', error);
      toast({
        title: 'Failed to create account',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gradient-primary">Deucy</h1>
          <p className="text-muted-foreground">
            {tournamentId ? 'Sign up to join the tournament' : 'Create your account'}
          </p>
        </div>

        <Card className="chaos-card">
          <CardHeader>
            <CardTitle className="text-lg">Your Info</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 touch-target"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+34 612 345 678"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onBlur={() => phone.trim() && validatePhone(phone)}
                    className={`pl-10 touch-target ${phoneError ? 'border-destructive ring-destructive/30 ring-2' : ''}`}
                    required
                  />
                </div>
                {phoneError ? (
                  <p className="text-xs text-destructive">{phoneError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g. +34) for WhatsApp
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender (optional)</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={gender} onValueChange={(value) => setGender(value as PlayerGender)}>
                    <SelectTrigger className="pl-10 touch-target">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* PIN fields */}
              <div className="space-y-2">
                <Label htmlFor="pin">Create 4-Digit PIN</Label>
                <div className="relative">
                  <Input
                    id="pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="text-center tracking-[0.5em] text-lg touch-target pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPin">Confirm PIN</Label>
                <div className="relative">
                  <Input
                    id="confirmPin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className={`text-center tracking-[0.5em] text-lg touch-target ${confirmPin && confirmPin !== pin ? 'border-destructive' : ''}`}
                    required
                  />
                </div>
                {confirmPin && confirmPin !== pin && (
                  <p className="text-xs text-destructive">PINs don't match</p>
                )}
              </div>

              <Button
                type="submit"
                variant="hot"
                className="w-full touch-target"
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Already have an account?</p>
          <Button
            variant="ghost"
            onClick={() => navigate(tournamentId ? `/login?t=${tournamentId}` : '/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Sign In Instead
          </Button>
        </div>
      </div>
    </div>
  );
}
