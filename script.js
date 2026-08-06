const menu = document.querySelector('[data-menu]');
const nav = document.querySelector('[data-nav]');
const header = document.querySelector('[data-header]');

menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!open));
  nav?.classList.toggle('open', !open);
  menu.querySelector('.sr-only').textContent = open ? 'Open menu' : 'Close menu';
});

nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menu?.setAttribute('aria-expanded', 'false');
  const label = menu?.querySelector('.sr-only');
  if (label) label.textContent = 'Open menu';
  nav.classList.remove('open');
}));

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !nav?.classList.contains('open')) return;
  nav.classList.remove('open');
  menu?.setAttribute('aria-expanded', 'false');
  const label = menu?.querySelector('.sr-only');
  if (label) label.textContent = 'Open menu';
  menu?.focus();
});

window.addEventListener('scroll', () => header?.classList.toggle('scrolled', scrollY > 12), { passive: true });

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reducedMotion || !('IntersectionObserver' in window)) {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());
