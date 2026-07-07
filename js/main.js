document.getElementById('year').textContent = new Date().getFullYear();

const themeButtons = document.querySelectorAll('.theme-btn');
const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  themeButtons.forEach((btn) => {
    const active = btn.dataset.themeChoice === theme;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
};
themeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.themeChoice;
    localStorage.setItem('myappflow-theme', theme);
    applyTheme(theme);
  });
});
applyTheme(document.documentElement.getAttribute('data-theme'));

// Enregistrer le site sur le téléphone
const installBtn = document.getElementById('installBtn');
const installHint = document.getElementById('installHint');
const installHintText = document.getElementById('installHintText');
const installHintClose = document.getElementById('installHintClose');
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
let deferredInstallPrompt = null;

const IOS_MESSAGE = "Sur iPhone : appuyez sur Partager ⬆️ en bas de Safari, puis « Sur l'écran d'accueil ».";
const FALLBACK_MESSAGE = "Ouvrez le menu de votre navigateur, puis « Installer l'application » ou « Ajouter à l'écran d'accueil ».";

if (isStandalone && installBtn) {
  installBtn.hidden = true;
} else if (installBtn) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });

  installBtn.addEventListener('click', async () => {
    if (!isIOS && deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return;
    }
    installHintText.textContent = isIOS ? IOS_MESSAGE : FALLBACK_MESSAGE;
    installHint.hidden = false;
  });

  installHintClose.addEventListener('click', () => {
    installHint.hidden = true;
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const revealTargets = document.querySelectorAll(
  '.pillar, .step, .benefit, .arch-card, .benefits-callout, .case, .approach-item, .contact-card'
);
revealTargets.forEach((el) => el.classList.add('reveal'));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealTargets.forEach((el) => observer.observe(el));
