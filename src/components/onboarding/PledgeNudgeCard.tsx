import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PledgeNudgeCard() {
  const navigate = useNavigate();

  return (
    <Card className="chaos-card border-chaos-orange/30 bg-chaos-orange/5">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-chaos-orange/20 flex items-center justify-center shrink-0">
          <Gift className="h-5 w-5 text-chaos-orange" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Add your pledge</p>
          <p className="text-xs text-muted-foreground">Takes 2 mins — bring something to the chaos</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate('/auction')}>
          Go
        </Button>
      </CardContent>
    </Card>
  );
}
