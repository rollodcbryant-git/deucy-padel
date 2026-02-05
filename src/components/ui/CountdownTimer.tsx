import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  targetDate: Date | string;
  onComplete?: () => void;
  className?: string;
  variant?: 'default' | 'large' | 'compact';
  showLabels?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date().getTime();
  const target = targetDate.getTime();
  const difference = target - now;

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    total: difference,
  };
}

export function CountdownTimer({
  targetDate,
  onComplete,
  className,
  variant = 'default',
  showLabels = true,
}: CountdownTimerProps) {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(target));

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(target);
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.total <= 0) {
        clearInterval(timer);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [target, onComplete]);

  const isUrgent = timeLeft.total > 0 && timeLeft.total < 24 * 60 * 60 * 1000; // Less than 24h
  const isExpired = timeLeft.total <= 0;

  if (isExpired) {
    return (
      <div className={cn('text-destructive font-semibold', className)}>
        Expired
      </div>
    );
  }

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (variant === 'compact') {
    if (timeLeft.days > 0) {
      return (
        <span className={cn('font-mono font-semibold', isUrgent && 'text-chaos-orange', className)}>
          {timeLeft.days}d {pad(timeLeft.hours)}h
        </span>
      );
    }
    return (
      <span className={cn('font-mono font-semibold', isUrgent && 'text-chaos-orange countdown-urgent', className)}>
        {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </span>
    );
  }

  if (variant === 'large') {
    return (
      <div className={cn('flex items-center justify-center gap-3', className)}>
        {timeLeft.days > 0 && (
          <TimeUnit value={timeLeft.days} label="days" isUrgent={isUrgent} />
        )}
        <TimeUnit value={timeLeft.hours} label="hours" isUrgent={isUrgent} />
        <TimeUnit value={timeLeft.minutes} label="min" isUrgent={isUrgent} />
        <TimeUnit value={timeLeft.seconds} label="sec" isUrgent={isUrgent} animate />
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('flex items-center gap-1 font-mono', isUrgent && 'text-chaos-orange', className)}>
      {timeLeft.days > 0 && (
        <>
          <span className="font-semibold">{timeLeft.days}</span>
          {showLabels && <span className="text-muted-foreground text-xs">d</span>}
        </>
      )}
      <span className="font-semibold">{pad(timeLeft.hours)}</span>
      {showLabels && <span className="text-muted-foreground text-xs">h</span>}
      <span className="font-semibold">{pad(timeLeft.minutes)}</span>
      {showLabels && <span className="text-muted-foreground text-xs">m</span>}
      {timeLeft.days === 0 && (
        <>
          <span className={cn('font-semibold', isUrgent && 'animate-count-down')}>
            {pad(timeLeft.seconds)}
          </span>
          {showLabels && <span className="text-muted-foreground text-xs">s</span>}
        </>
      )}
    </div>
  );
}

function TimeUnit({ value, label, isUrgent, animate }: { 
  value: number; 
  label: string; 
  isUrgent: boolean;
  animate?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'bg-card border border-border rounded-lg px-4 py-3 min-w-[60px]',
          isUrgent && 'border-chaos-orange/50 bg-chaos-orange/10',
          animate && isUrgent && 'animate-count-down'
        )}
      >
        <span className={cn(
          'text-2xl font-bold font-mono',
          isUrgent ? 'text-chaos-orange' : 'text-foreground'
        )}>
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <span className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}
