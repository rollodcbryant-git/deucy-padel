import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { hashPin } from '@/contexts/PlayerContext';
import { useToast } from '@/hooks/use-toast';

interface ChangePinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  currentPinHash: string;
}

export function ChangePinDialog({ open, onOpenChange, playerId, currentPinHash }: ChangePinDialogProps) {
  const { toast } = useToast();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hashPin(oldPin) !== currentPinHash) {
      toast({ title: 'Wrong PIN', description: 'Your current PIN is incorrect.', variant: 'destructive' });
      return;
    }

    if (newPin.length !== 4) {
      toast({ title: 'Invalid PIN', description: 'New PIN must be 4 digits.', variant: 'destructive' });
      return;
    }

    if (newPin !== confirmPin) {
      toast({ title: 'PINs don\'t match', description: 'Please re-enter your new PIN.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ pin_hash: hashPin(newPin) })
        .eq('id', playerId);

      if (error) throw error;

      toast({ title: 'PIN changed! 🔒' });
      onOpenChange(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch {
      toast({ title: 'Error', description: 'Could not change PIN.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change PIN</DialogTitle>
          <DialogDescription>Enter your current PIN and choose a new one.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Current PIN</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="••••"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="pl-10 text-center tracking-[0.5em]"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>New PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="••••"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="text-center tracking-[0.5em]"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm New PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="••••"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="text-center tracking-[0.5em]"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading} className="w-full bg-gradient-primary">
              {isLoading ? 'Changing...' : 'Change PIN'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
