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

    if (!tournamentId) {
      toast({
        title: 'Error',
        description: 'No tournament specified',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const normalizedPhone = normalizePhone(phone);

    try {
      // Check if phone already exists in this tournament
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('phone', normalizedPhone)
        .single();

      if (existing) {
        toast({
          title: 'Phone already registered',
          description: 'This phone number is already in the tournament. Try logging in instead.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Get tournament for starting credits
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('starting_credits')
        .eq('id', tournamentId)
        .single();

      const pin = generatePin();
      const pinHash = hashPin(pin);

      // Create player
      const { data: newPlayer, error } = await supabase.from('players').insert({
        tournament_id: tournamentId,
        full_name: fullName,
        phone,
        pin_hash: pinHash,
        gender: gender || null,
        credits_balance: tournament?.starting_credits || 1000,
      }).select().single();

      if (error) {
        throw error;
      }

      setGeneratedPin(pin);
      setStep('pin');

      // Auto-login the new player so CompleteEntry page works
      if (newPlayer) {
        const token = crypto.randomUUID();
        await supabase.from('players').update({ session_token: token }).eq('id', newPlayer.id);
        const session = {
          playerId: newPlayer.id,
          tournamentId,
          playerName: fullName,
          token,
        };
        localStorage.setItem('padel_chaos_session', JSON.stringify(session));
      }

      toast({
        title: 'Welcome to the chaos! 🎾',
        description: 'Save your PIN - you\'ll need it to log in.',
      });
    } catch (error: any) {
      console.error('Join error:', error);
      toast({
        title: 'Failed to join',
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
    // Full reload so PlayerContext picks up the new session from localStorage
    window.location.href = '/complete-entry';
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

          {/* PIN Display */}
          <Card className="chaos-card">
            <CardContent className="p-8">
              <div className="text-5xl font-mono font-bold tracking-[0.5em] text-primary mb-4">
                {generatedPin}
              </div>
              <Button
                variant="outline"
                onClick={copyPin}
                className="touch-target"
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy PIN
                  </>
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
            I've Saved It - Continue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-6xl mb-4">🎾</div>
          <h1 className="text-3xl font-bold text-gradient-primary">Join the Chaos</h1>
          <p className="text-muted-foreground">Enter your details to join the tournament</p>
        </div>

        {/* Join Form */}
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
                  <Select
                    value={gender}
                    onValueChange={(value) => setGender(value as PlayerGender)}
                  >
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
                {isLoading ? 'Joining...' : 'Join Tournament'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Already have account */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Already joined?</p>
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
