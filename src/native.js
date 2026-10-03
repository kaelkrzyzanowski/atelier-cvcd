// Fonctions propres à l'application Android. Chargé seulement dans l'app (Capacitor), jamais dans un navigateur.
import { App } from '@capacitor/app';
import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import { Share } from '@capacitor/share';

/** Bouton retour Android : revient à la liste des outils, sinon quitte l'app. */
export function init() {
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) history.back();
    else if (location.hash.replace(/^#\/?/, '')) location.replace('#/');
    else void App.exitApp();
  });
  setBarsStyle();
}

/** Icônes de la barre d'état lisibles sur la barre haute (foncée en thème clair, claire en thème sombre). */
export function setBarsStyle() {
  const theme = document.documentElement.getAttribute('data-theme');
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  void SystemBars.setStyle({ style: dark ? SystemBarsStyle.Light : SystemBarsStyle.Dark }).catch(() => undefined);
}

/** Feuille de partage Android (SMS, WhatsApp, Gmail, Keep…). */
export async function shareText(title, text) {
  await Share.share({ title, text, dialogTitle: 'Partager les résultats' });
}
