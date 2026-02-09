import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed top-4 right-4 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg z-40 max-w-sm">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-blue-900">Instalar AGEMS Fiscalização</p>
          <p className="text-sm text-blue-700 mt-1">Acesse o app mesmo sem internet</p>
        </div>
        <button
          onClick={() => setShowPrompt(false)}
          className="text-blue-400 hover:text-blue-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
          onClick={handleInstall}
        >
          Instalar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowPrompt(false)}
        >
          Depois
        </Button>
      </div>
    </div>
  );
}