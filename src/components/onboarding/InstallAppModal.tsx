import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share, PlusSquare, MoreVertical, Download, Copy, Check, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InstallAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isIos: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  canNativeInstall: boolean;
  onDismiss: () => void;
  onTriggerInstall: () => Promise<boolean>;
}

export function InstallAppModal({
  open,
  onOpenChange,
  isIos,
  isSafari,
  canNativeInstall,
  onDismiss,
  onTriggerInstall,
}: InstallAppModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleGotIt = () => {
    onDismiss();
    onOpenChange(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      toast({ title: 'Link copied! 📋' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy link', variant: 'destructive' });
    }
  };

  const handleOpenSafari = () => {
    // On iOS in a non-Safari browser, we can only copy the link
    handleCopyLink();
    toast({
      title: 'Paste this link in Safari',
      description: 'Open Safari and paste the copied link to install.',
    });
  };

  const handleNativeInstall = async () => {
    const accepted = await onTriggerInstall();
    if (accepted) {
      onDismiss();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="h-5 w-5 text-primary" />
            <DialogTitle>Add Deucy to your Home Screen</DialogTitle>
          </div>
          <DialogDescription>
            Install Deucy for quick access — it works like a real app!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Native install prompt (Android/Desktop Chrome) */}
          {canNativeInstall && (
            <div className="space-y-3">
              <Button className="w-full" onClick={handleNativeInstall}>
                <Download className="h-4 w-4 mr-2" /> Install Deucy
              </Button>
            </div>
          )}

          {/* iOS flow */}
          {isIos && (
            <div className="space-y-3">
              {!isSafari && (
                <div className="rounded-lg border border-chaos-orange/40 bg-chaos-orange/5 p-3">
                  <p className="text-sm font-medium text-chaos-orange mb-2">
                    Safari is required to install on iPhone
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleOpenSafari}
                  >
                    <Copy className="h-4 w-4 mr-2" /> Copy link for Safari
                  </Button>
                </div>
              )}

              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">1</span>
                  <span className="flex items-center gap-2">
                    Tap <Share className="h-4 w-4 text-primary inline" /> <strong>Share</strong> (bottom of Safari)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">2</span>
                  <span className="flex items-center gap-2">
                    Tap <PlusSquare className="h-4 w-4 text-primary inline" /> <strong>Add to Home Screen</strong>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">3</span>
                  <span>Tap <strong>Add</strong> — done! 🎉</span>
                </li>
              </ol>
            </div>
          )}

          {/* Android/Desktop without native prompt */}
          {!isIos && !canNativeInstall && (
            <div className="space-y-3">
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">1</span>
                  <span className="flex items-center gap-2">
                    Tap <MoreVertical className="h-4 w-4 text-primary inline" /> <strong>Menu</strong> in your browser
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">2</span>
                  <span className="flex items-center gap-2">
                    Tap <Download className="h-4 w-4 text-primary inline" /> <strong>Add to Home Screen</strong> or <strong>Install App</strong>
                  </span>
                </li>
              </ol>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCopyLink}
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy install link'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={handleGotIt}
            >
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
