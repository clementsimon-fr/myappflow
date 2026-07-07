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

// Ajout à l'écran d'accueil
const installBtn = document.getElementById('installBtn');
const iosHint = document.getElementById('iosHint');
const iosHintClose = document.getElementById('iosHintClose');
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
let deferredInstallPrompt = null;

if (!isStandalone && installBtn) {
  if (isIOS) {
    installBtn.hidden = false;
    installBtn.addEventListener('click', () => {
      iosHint.hidden = false;
    });
    iosHintClose.addEventListener('click', () => {
      iosHint.hidden = true;
    });
  } else {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      installBtn.hidden = false;
    });
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installBtn.hidden = true;
    });
  }
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
