import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { usePlayer } from '@/contexts/PlayerContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Phone, Lock } from 'lucide-react';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const tournamentId = searchParams.get('t');
  const navigate = useNavigate();
  const { login } = usePlayer();
  const { toast } = useToast();
  
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

    if (pin.length !== 4) {
      toast({
        title: 'Invalid PIN',
        description: 'PIN must be 4 digits',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await login(phone, pin, tournamentId);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: 'Welcome back! 🎾',
        description: 'Time to cause some chaos.',
      });
      navigate('/home');
    } else {
      toast({
        title: 'Login failed',
        description: result.error || 'Invalid phone or PIN',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-6xl mb-4">🎾</div>
          <h1 className="text-3xl font-bold text-gradient-primary">Welcome Back</h1>
          <p className="text-muted-foreground">Enter your phone and PIN to continue</p>
        </div>

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
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Back link */}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate(tournamentId ? `/?t=${tournamentId}` : '/')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tournament
        </Button>
      </div>
    </div>
  );
}
