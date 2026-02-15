import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ReportResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (setsA: number, setsB: number, isUnfinished: boolean) => Promise<void>;
}

export function ReportResultDialog({ open, onOpenChange, onSubmit }: ReportResultDialogProps) {
  const { toast } = useToast();
  const [setsA, setSetsA] = useState('0');
  const [setsB, setSetsB] = useState('0');
  const [isUnfinished, setIsUnfinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSetsA('0');
      setSetsB('0');
      setIsUnfinished(false);
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    const a = parseInt(setsA);
    const b = parseInt(setsB);

    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a > 3 || b > 3) {
      toast({ title: 'Invalid score', description: 'Sets must be between 0 and 3', variant: 'destructive' });
      return;
    }

    const hasWinner = (a >= 2 && a > b) || (b >= 2 && b > a);
    if (!isUnfinished && !hasWinner) {
      toast({ title: 'Invalid score', description: 'One team must win 2 sets (or mark as unfinished)', variant: 'destructive' });
      return;
    }
    if (isUnfinished && (a !== 1 || b !== 1)) {
      toast({ title: 'Invalid unfinished score', description: 'Unfinished matches must be 1-1', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(a, b, isUnfinished);
    } catch (error: any) {
      toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Report Match Result</DialogTitle></DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <Label className="text-xs text-muted-foreground mb-2 block">Your Team</Label>
              <Input type="number" min="0" max="3" value={setsA}
                onChange={(e) => setSetsA(e.target.value)}
                className="text-3xl font-bold text-center w-20 h-16" />
            </div>
            <span className="text-2xl text-muted-foreground">-</span>
            <div className="text-center">
              <Label className="text-xs text-muted-foreground mb-2 block">Opponents</Label>
              <Input type="number" min="0" max="3" value={setsB}
                onChange={(e) => setSetsB(e.target.value)}
                className="text-3xl font-bold text-center w-20 h-16" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="unfinished" className="text-sm">Match unfinished (1-1 split)?</Label>
            <Switch id="unfinished" checked={isUnfinished} onCheckedChange={setIsUnfinished} />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            💰 Credits will be automatically distributed based on the score
          </p>

          <Button className="w-full touch-target bg-gradient-primary hover:opacity-90"
            onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Result'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
