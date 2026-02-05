import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, Gavel, Gift } from 'lucide-react';

interface OnboardingCarouselProps {
  open: boolean;
  onComplete: () => void;
}

const steps = [
  {
    icon: Coins,
    emoji: '💶',
    title: 'Your € balance',
    body: 'Win sets → your € balance goes up. Spend it in the auction. In-app only — no real money.',
    gradient: 'from-primary to-accent',
  },
  {
    icon: Gavel,
    emoji: '🏪',
    title: 'The Auction House',
    body: 'After the tournament, a 24h auction goes live. The richer you are, the more chaos you can buy.',
    gradient: 'from-chaos-orange to-chaos-pink',
  },
  {
    icon: Gift,
    emoji: '🎁',
    title: 'Pledge something',
    body: 'Everyone brings 1 item. It becomes a prize in the auction. Bring something weird, tasty, or legendary.',
    gradient: 'from-chaos-purple to-accent',
  },
];

export function OnboardingCarousel({ open, onComplete }: OnboardingCarouselProps) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const current = steps[step];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className={`bg-gradient-to-br ${current.gradient} p-8 flex flex-col items-center justify-center min-h-[200px]`}>
            <span className="text-6xl mb-2">{current.emoji}</span>
          </div>
          <div className="p-6 space-y-4">
            <h2 className="text-xl font-bold text-foreground text-center">{current.title}</h2>
            <p className="text-sm text-muted-foreground text-center leading-relaxed">{current.body}</p>
            <div className="flex items-center justify-center gap-2">
              {steps.map((_, i) => (
                <div key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-2 bg-muted'}`} />
              ))}
            </div>
            <div className="flex gap-2">
              {step < steps.length - 1 && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onComplete}>Skip</Button>
              )}
              <Button onClick={handleNext} className="flex-1 touch-target bg-gradient-primary hover:opacity-90 text-primary-foreground">
                {step === steps.length - 1 ? "Let's go 🚀" : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
