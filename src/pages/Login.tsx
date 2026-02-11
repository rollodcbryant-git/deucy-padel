import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePlayer } from '@/contexts/PlayerContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { hashPin } from '@/contexts/PlayerContext';
import { normalizePhone } from '@/lib/phone';
import { Phone, Lock, KeyRound, Settings, Loader2, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';


const REMEMBER_PIN_KEY = 'padel_remember_pin';
const SAVED_PHONE_KEY = 'padel_saved_phone';
const SAVED_PIN_KEY = 'padel_saved_pin';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const tournamentIdParam = searchParams.get('t');
  const navigate = useNavigate();
  const { login, session, isLoading: sessionLoading } = usePlayer();
  const { toast } = useToast();

  // Load saved values
  const savedRemember = localStorage.getItem(REMEMBER_PIN_KEY) === 'true';
  const savedPhone = savedRemember ? localStorage.getItem(SAVED_PHONE_KEY) || '' : '';
  const savedPin = savedRemember ? localStorage.getItem(SAVED_PIN_KEY) || '' : '';

  const [phone, setPhone] = useState(savedPhone);
  const [pin, setPin] = useState(savedPin);
  const [rememberPin, setRememberPin] = useState(savedRemember);
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetPhone, setResetPhone] = useState('');
  const [newPin, setNewPin] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (session && !sessionLoading) {
      navigate('/tournaments');
    }
  }, [session, sessionLoading, navigate]);

  const validatePhone = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed.startsWith('+')) {
      setPhoneError('Add country code (ex: +34) so WhatsApp links work.');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (phoneError && value.trim().startsWith('+')) setPhoneError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Show warning but don't block submission
    validatePhone(phone);

    if (pin.length !== 4) {
      toast({ title: 'Invalid PIN', description: 'PIN must be 4 digits', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const normalizedPhone = normalizePhone(phone);
    const result = await login(normalizedPhone, pin, tournamentIdParam || undefined);
    setIsLoading(false);

    if (result.success) {
      // Save or clear remembered PIN
      if (rememberPin) {
        localStorage.setItem(REMEMBER_PIN_KEY, 'true');
        localStorage.setItem(SAVED_PHONE_KEY, phone);
        localStorage.setItem(SAVED_PIN_KEY, pin);
      } else {
        localStorage.removeItem(REMEMBER_PIN_KEY);
        localStorage.removeItem(SAVED_PHONE_KEY);
        localStorage.removeItem(SAVED_PIN_KEY);
      }

      toast({ title: 'Welcome back! 🎾', description: 'Time to cause some chaos.' });
      navigate('/tournaments');
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
      const normalizedPhone = normalizePhone(resetPhone);
      const { data: players, error } = await supabase
        .from('players')
        .select('id, full_name, tournament_id')
        .eq('phone', normalizedPhone);

      if (error || !players || players.length === 0) {
        toast({ title: 'Not found', description: 'No player found with that phone number.', variant: 'destructive' });
        setIsResetting(false);
        return;
      }

      const player = players[0];
      const generated = String(Math.floor(1000 + Math.random() * 9000));
      const pinHash = hashPin(generated);

      // Update ALL player records for this phone so PIN is consistent
      const { error: updateError } = await supabase
        .from('players')
        .update({ pin_hash: pinHash, session_token: null })
        .eq('phone', normalizedPhone);

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
        <div className="text-center space-y-3 py-4">
          <h1 className="text-4xl font-bold text-gradient-primary">Deucy</h1>
          <p className="text-muted-foreground">Enter your phone and PIN to continue</p>
        </div>

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
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        onBlur={() => phone.trim() && validatePhone(phone)}
                        className={`pl-10 touch-target ${phoneError ? 'border-destructive ring-destructive/30 ring-2' : ''}`}
                        required
                      />
                    </div>
                    {phoneError && (
                      <p className="text-xs text-destructive mt-1">{phoneError}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pin">4-Digit PIN</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="pin"
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="pl-10 pr-10 touch-target text-center tracking-[0.5em] text-lg"
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

                  <div className="flex items-center justify-between">
                    <Label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer">
                      Remember PIN on this device
                    </Label>
                    <Switch
                      id="remember"
                      checked={rememberPin}
                      onCheckedChange={setRememberPin}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="hot"
                    className="w-full touch-target"
                    disabled={isLoading}
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

            {/* Create account link */}
            <Button
              variant="outline"
              className="w-full touch-target"
              onClick={() => navigate(tournamentIdParam ? `/join?t=${tournamentIdParam}` : '/join')}
            >
              Don't have an account? Sign Up
            </Button>
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
                    variant="hot"
                    className="w-full"
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
                        placeholder="612 345 678"
                        value={resetPhone}
                        onChange={(e) => setResetPhone(e.target.value)}
                        className="pl-10 touch-target"
                        required
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant="hot"
                    className="w-full touch-target"
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

        {/* Admin link */}
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
