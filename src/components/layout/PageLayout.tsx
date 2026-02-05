import { cn } from '@/lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  hasBottomNav?: boolean;
  header?: React.ReactNode;
}

export function PageLayout({ children, className, hasBottomNav = true, header }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {header && (
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border safe-top">
          {header}
        </header>
      )}
      <main
        className={cn(
          'container max-w-lg mx-auto px-4 py-6',
          hasBottomNav && 'pb-24',
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}
