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
