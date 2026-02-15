import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'install_popup_dismissed';

export function usePwaInstall(playerId?: string) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(ios);

    const android = /Android/i.test(ua);
    setIsAndroid(android);

    // Safari detection (not Chrome on iOS, not other browsers)
    const safari = ios
      ? !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua)
      : /^((?!chrome|android).)*safari/i.test(ua);
    setIsSafari(safari);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const isDismissed = useCallback(() => {
    if (!playerId) return false;
    return localStorage.getItem(`${DISMISSED_KEY}_${playerId}`) === 'true';
  }, [playerId]);

  const dismiss = useCallback(() => {
    if (playerId) {
      localStorage.setItem(`${DISMISSED_KEY}_${playerId}`, 'true');
    }
  }, [playerId]);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome === 'accepted';
  }, [deferredPrompt]);

  const shouldShowAuto = !isStandalone && !isDismissed();
  const canNativeInstall = !!deferredPrompt;

  return {
    isStandalone,
    isIos,
    isAndroid,
    isSafari,
    canNativeInstall,
    shouldShowAuto,
    triggerInstall,
    dismiss,
  };
}
