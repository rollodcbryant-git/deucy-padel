import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

// Default admin passcode — stored here for easy change
const ADMIN_PASSCODE = '1111';
const PASSCODE_STORAGE_KEY = 'deucy_admin_passcode';

function getPasscode(): string {
  return localStorage.getItem(PASSCODE_STORAGE_KEY) || ADMIN_PASSCODE;
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const currentPasscode = getPasscode();
      if (passcode !== currentPasscode) {
        toast({ title: 'Access Denied', description: 'Invalid passcode.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      // Sign in with a fixed admin account via Supabase Auth
      // We still need Supabase auth for RLS policies on admin operations
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@deucy.app',
        password: 'admin-deucy-2024',
      });

      if (error) {
        // If the admin account doesn't exist yet, create it
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: 'admin@deucy.app',
          password: 'admin-deucy-2024',
        });
        if (signUpError) {
          // Fallback: proceed without Supabase auth (passcode was correct)
          localStorage.setItem('deucy_admin_authenticated', 'true');
          navigate('/admin/dashboard');
          return;
        }
      }

      localStorage.setItem('deucy_admin_authenticated', 'true');
      navigate('/admin/dashboard');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasscode.length < 4) {
      toast({ title: 'Too short', description: 'Passcode must be at least 4 characters.', variant: 'destructive' });
      return;
    }
    if (newPasscode !== confirmPasscode) {
      toast({ title: 'Mismatch', description: 'Passcodes don\'t match.', variant: 'destructive' });
      return;
    }
    localStorage.setItem(PASSCODE_STORAGE_KEY, newPasscode);
    toast({ title: 'Passcode updated! 🔐' });
    setShowChangeForm(false);
    setNewPasscode('');
    setConfirmPasscode('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link 
        to="/" 
        className="absolute top-4 left-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="text-5xl mb-6">⚙️</div>
      
      <Card className="w-full max-w-sm chaos-card">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Admin Panel</CardTitle>
          <CardDescription>Enter passcode to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {!showChangeForm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passcode">Passcode</Label>
                <div className="relative">
                  <Input
                    id="passcode"
                    type={showPasscode ? 'text' : 'password'}
                    inputMode="numeric"
                    placeholder="••••"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="text-center tracking-[0.3em] text-lg touch-target pr-10"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full touch-target bg-gradient-primary"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enter'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setShowChangeForm(true)}
              >
                Change passcode
              </Button>
            </form>
          ) : (
            <form onSubmit={handleChangePasscode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPasscode">Current Passcode</Label>
                <Input
                  id="currentPasscode"
                  type="password"
                  placeholder="••••"
                  className="text-center tracking-[0.3em] touch-target"
                  required
                  onChange={(e) => {
                    if (e.target.value !== getPasscode()) {
                      e.target.setCustomValidity('Wrong current passcode');
                    } else {
                      e.target.setCustomValidity('');
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPasscode">New Passcode</Label>
                <Input
                  id="newPasscode"
                  type="password"
                  placeholder="••••"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  className="text-center tracking-[0.3em] touch-target"
                  required
                  minLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPasscode">Confirm New Passcode</Label>
                <Input
                  id="confirmNewPasscode"
                  type="password"
                  placeholder="••••"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  className={`text-center tracking-[0.3em] touch-target ${confirmPasscode && confirmPasscode !== newPasscode ? 'border-destructive' : ''}`}
                  required
                />
              </div>
              <Button type="submit" className="w-full touch-target bg-gradient-primary">
                Update Passcode
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setShowChangeForm(false)}>
                Cancel
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
