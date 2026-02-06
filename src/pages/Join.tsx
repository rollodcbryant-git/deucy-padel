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
import { ArrowLeft, Copy, Check, User, Phone, Users } from 'lucide-react';
import type { PlayerGender } from '@/lib/types';

type Step = 'form' | 'pin';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('t');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPin, setGeneratedPin] = useState('');
  const [copied, setCopied] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<PlayerGender | ''>('');

  const generatePin = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const normalizedPhone = normalizePhone(phone);

    try {
      // Check if phone already exists (globally or in specific tournament)
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

      const pin = generatePin();
      const pinHash = hashPin(pin);

      // If a tournament is specified, get starting credits
      let startingCredits = 1000;
      if (tournamentId) {
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('starting_credits')
          .eq('id', tournamentId)
          .single();
        if (tournament) startingCredits = tournament.starting_credits;
      }

      // Create player (tournament_id is optional now)
      const { data: newPlayer, error } = await supabase.from('players').insert({
        tournament_id: tournamentId || undefined,
        full_name: fullName,
        phone: normalizedPhone,
        pin_hash: pinHash,
        gender: gender || null,
        credits_balance: tournamentId ? startingCredits : 0,
      }).select().single();

      if (error) throw error;

      setGeneratedPin(pin);
      setStep('pin');

      // Auto-login the new player
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

      toast({
        title: 'Account created! 🎾',
        description: 'Save your PIN - you\'ll need it to log in.',
      });
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

  const copyPin = async () => {
    await navigator.clipboard.writeText(generatedPin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    if (tournamentId) {
      window.location.href = '/complete-entry';
    } else {
      window.location.href = '/tournaments';
    }
  };

  if (step === 'pin') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-gradient-primary">Your Secret PIN</h1>
          <p className="text-muted-foreground">
            Save this PIN somewhere safe. You'll need it to log in.
          </p>

          <Card className="chaos-card">
            <CardContent className="p-8">
              <div className="text-5xl font-mono font-bold tracking-[0.5em] text-primary mb-4">
                {generatedPin}
              </div>
              <Button variant="outline" onClick={copyPin} className="touch-target">
                {copied ? (
                  <><Check className="mr-2 h-4 w-4 text-primary" />Copied!</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" />Copy PIN</>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>⚠️ This PIN will only be shown once</p>
            <p>📱 Save it in your notes or take a screenshot</p>
          </div>

          <Button
            className="w-full touch-target bg-gradient-primary hover:opacity-90"
            onClick={handleContinue}
          >
            {tournamentId ? "I've Saved It - Continue" : "I've Saved It - Browse Tournaments"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="text-6xl mb-4">🎾</div>
          <h1 className="text-3xl font-bold text-gradient-primary">Create Account</h1>
          <p className="text-muted-foreground">
            {tournamentId ? 'Sign up to join the tournament' : 'Sign up and browse available tournaments'}
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
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 touch-target"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for match coordination via WhatsApp
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Helps us create balanced team pairings
                </p>
              </div>

              <Button
                type="submit"
                className="w-full touch-target bg-gradient-primary hover:opacity-90"
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
