import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { usePlayer } from '@/contexts/PlayerContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { hashPin } from '@/contexts/PlayerContext';
import { Phone, Lock, KeyRound, Settings, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Tournament } from '@/lib/types';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const tournamentIdParam = searchParams.get('t');
  const navigate = useNavigate();
  const { login, session, isLoading: sessionLoading } = usePlayer();
  const { toast } = useToast();

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetPhone, setResetPhone] = useState('');
  const [newPin, setNewPin] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Tournament discovery
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(tournamentIdParam);
  const [loadingTournaments, setLoadingTournaments] = useState(!tournamentIdParam);

  // Redirect if already logged in
  useEffect(() => {
    if (session && !sessionLoading) {
      navigate('/');
    }
  }, [session, sessionLoading, navigate]);

  // Load available tournaments if no t= param
  useEffect(() => {
    if (tournamentIdParam) {
      setSelectedTournamentId(tournamentIdParam);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['SignupOpen', 'Live', 'AuctionLive'])
        .order('created_at', { ascending: false });
      setTournaments((data || []) as Tournament[]);
      if (data && data.length === 1) {
        setSelectedTournamentId(data[0].id);
      }
      setLoadingTournaments(false);
    };
    load();
  }, [tournamentIdParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTournamentId) {
      toast({ title: 'Error', description: 'Please select a tournament first', variant: 'destructive' });
      return;
    }

    if (pin.length !== 4) {
      toast({ title: 'Invalid PIN', description: 'PIN must be 4 digits', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const result = await login(phone, pin, selectedTournamentId);
    setIsLoading(false);

    if (result.success) {
      toast({ title: 'Welcome back! 🎾', description: 'Time to cause some chaos.' });
      navigate('/home');
    } else {
      toast({ title: 'Login failed', description: result.error || 'Invalid phone or PIN', variant: 'destructive' });
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPhone.trim()) {
      toast({ title: 'Enter your phone', description: 'We need your phone number to find your account.', variant: 'destructive' });
      return;
    }

    setIsResetting(true);
    try {
      // Search across all tournaments if none selected, or in specific tournament
      let query = supabase
        .from('players')
        .select('id, full_name, tournament_id')
        .eq('phone', resetPhone.trim());

      if (selectedTournamentId) {
        query = query.eq('tournament_id', selectedTournamentId);
      }

      const { data: players, error } = await query;

      if (error || !players || players.length === 0) {
        toast({ title: 'Not found', description: 'No player found with that phone number.', variant: 'destructive' });
        setIsResetting(false);
        return;
      }

      // Use the first match (or the one in the selected tournament)
      const player = players[0];

      // Generate new 4-digit PIN
      const generated = String(Math.floor(1000 + Math.random() * 9000));
      const pinHash = hashPin(generated);

      const { error: updateError } = await supabase
        .from('players')
        .update({ pin_hash: pinHash, session_token: null })
        .eq('id', player.id);

      if (updateError) {
        toast({ title: 'Error', description: 'Could not reset PIN. Please contact your organizer.', variant: 'destructive' });
        setIsResetting(false);
        return;
      }

      setNewPin(generated);
      toast({ title: 'PIN reset!', description: `New PIN generated for ${player.full_name}` });
    } catch {
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setIsResetting(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-6xl mb-4">🎾</div>
          <h1 className="text-3xl font-bold text-gradient-primary">Deucy</h1>
          <p className="text-muted-foreground">Enter your phone and PIN to continue</p>
        </div>

        {/* Tournament selector (if no t= param and multiple tournaments) */}
        {!tournamentIdParam && !loadingTournaments && tournaments.length > 1 && (
          <Card className="chaos-card">
            <CardContent className="p-4 space-y-2">
              <Label>Select Tournament</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={selectedTournamentId || ''}
                onChange={(e) => setSelectedTournamentId(e.target.value || null)}
              >
                <option value="">Choose a tournament…</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.club_name ? ` @ ${t.club_name}` : ''}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        )}

        {!tournamentIdParam && !loadingTournaments && tournaments.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No active tournaments found. Ask your organizer for an invite link.
          </p>
        )}

        {!showReset ? (
          <>
            {/* Login Form */}
            <Card className="chaos-card">
              <CardHeader>
                <CardTitle className="text-lg">Sign In</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pin">4-Digit PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="pl-10 touch-target text-center tracking-[0.5em] text-lg"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full touch-target bg-gradient-primary hover:opacity-90"
                    disabled={isLoading || !selectedTournamentId}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>

                <Button
                  variant="link"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={() => { setShowReset(true); setNewPin(null); }}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Forgot your PIN?
                </Button>
              </CardContent>
            </Card>

            {/* Join link for signup-open tournaments */}
            {selectedTournamentId && (
              <Button
                variant="outline"
                className="w-full touch-target"
                onClick={() => navigate(`/join?t=${selectedTournamentId}`)}
              >
                Don't have an account? Join Tournament
              </Button>
            )}
          </>
        ) : (
          /* Reset PIN Form */
          <Card className="chaos-card">
            <CardHeader>
              <CardTitle className="text-lg">Reset PIN</CardTitle>
            </CardHeader>
            <CardContent>
              {newPin ? (
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">Your new PIN is:</p>
                  <p className="text-4xl font-mono font-bold text-primary tracking-[0.5em]">{newPin}</p>
                  <p className="text-sm text-muted-foreground">⚠️ Save this PIN! It won't be shown again.</p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(newPin);
                      toast({ title: 'PIN copied!' });
                    }}
                  >
                    Copy PIN
                  </Button>
                  <Button
                    className="w-full bg-gradient-primary"
                    onClick={() => { setShowReset(false); setNewPin(null); setPin(''); }}
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPin} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter the phone number you signed up with and we'll generate a new PIN.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="resetPhone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="resetPhone"
                        type="tel"
                        placeholder="+34 612 345 678"
                        value={resetPhone}
                        onChange={(e) => setResetPhone(e.target.value)}
                        className="pl-10 touch-target"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full touch-target bg-gradient-primary hover:opacity-90"
                    disabled={isResetting}
                  >
                    {isResetting ? 'Resetting...' : 'Reset My PIN'}
                  </Button>
                </form>
              )}

              {!newPin && (
                <Button
                  variant="ghost"
                  className="w-full mt-2"
                  onClick={() => setShowReset(false)}
                >
                  Back to Sign In
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin link - small print */}
        <Link
          to="/admin"
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors pt-4"
        >
          <Settings className="h-3 w-3" />
          Admin Panel
        </Link>
      </div>
    </div>
  );
}
