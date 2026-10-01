// Enregistre le service worker pour le mode hors ligne (site web et appli installée).
// Pas dans l'appli Android : Capacitor embarque déjà les fichiers sur le téléphone.
export function registerServiceWorker() {
  const isNativeApp = Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (!import.meta.env.PROD || isNativeApp || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[PharmaGuide] Service worker non enregistré :', err);
    });
  });
}
