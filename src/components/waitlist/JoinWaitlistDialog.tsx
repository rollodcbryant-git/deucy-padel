import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface JoinWaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentName?: string;
  defaultName?: string;
  defaultPhone?: string;
  onSubmit: (data: { fullName: string; phone: string; note?: string }) => Promise<{ error: string | null }>;
}

export function JoinWaitlistDialog({
  open,
  onOpenChange,
  tournamentName,
  defaultName = '',
  defaultPhone = '',
  onSubmit,
}: JoinWaitlistDialogProps) {
  const [fullName, setFullName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;
    setLoading(true);
    setError(null);
    const result = await onSubmit({ fullName: fullName.trim(), phone: phone.trim(), note: note.trim() || undefined });
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {tournamentName ? `Join Waitlist — ${tournamentName}` : 'Join the Waitlist'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {tournamentName
              ? "Full house. Get in line — we'll tap you when a seat drops."
              : "No seats right now. We'll let you know when something opens up."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="wl-name">Full Name</Label>
            <Input
              id="wl-name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wl-phone">Phone</Label>
            <Input
              id="wl-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+34 600 123 456"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wl-note">Note (optional)</Label>
            <Textarea
              id="wl-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="I can play mornings / evenings…"
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full bg-gradient-primary" disabled={loading || !fullName || !phone}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {loading ? 'Joining…' : 'Join Waitlist'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
