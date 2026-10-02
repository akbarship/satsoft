/* PWA: service worker registration + "Install App" button on the start screen. */
(() => {
  'use strict';

  // On a personal page (/2222) the installed app should reopen that same page.
  const sid = (location.pathname.match(/^\/(\d{3,8})\/?$/) || [])[1];
  const manifest = document.querySelector('link[rel="manifest"]');
  if (sid && manifest) manifest.href = `/manifest.webmanifest?s=${sid}`;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed:', err));
    });
  }

  const btn = document.getElementById('install-app');
  if (!btn) return;
  let deferred = null;

  const standalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    if (!standalone()) btn.hidden = false;
  });

  btn.addEventListener('click', async () => {
    if (!deferred) return;
    btn.hidden = true;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
  });

  window.addEventListener('appinstalled', () => {
    btn.hidden = true;
    deferred = null;
  });
})();
