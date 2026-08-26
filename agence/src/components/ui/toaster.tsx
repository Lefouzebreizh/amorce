'use client';

import { Toaster as Sonner } from 'sonner';

/*
 * Les notifications. `richColors` reprend nos jetons via les variables CSS de
 * Sonner ; `closeButton` évite qu'un message d'erreur un peu long disparaisse
 * avant d'avoir été lu.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      toastOptions={{ duration: 5000 }}
    />
  );
}
