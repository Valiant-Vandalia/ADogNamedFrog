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

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

// Progressive enhancement: links still open original pages if dialogs are unavailable.
const previewDialog = document.querySelector('[data-preview-dialog]');
const previewLinks = [...document.querySelectorAll('[data-preview]')];
if (previewDialog && typeof previewDialog.showModal === 'function') {
  const pageImage = previewDialog.querySelector('[data-preview-image]');
  const position = previewDialog.querySelector('[data-preview-position]');
  const previous = previewDialog.querySelector('[data-preview-previous]');
  const next = previewDialog.querySelector('[data-preview-next]');
  let current = 0;
  const showPage = (index) => {
    current = index;
    const image = previewLinks[current].querySelector('img');
    pageImage.src = previewLinks[current].href;
    previewDialog.querySelector('[data-preview-original]').href = previewLinks[current].href;
    pageImage.alt = image.alt;
    position.textContent = `Selected page ${current + 1} of ${previewLinks.length}`;
    previous.disabled = current === 0;
    next.disabled = current === previewLinks.length - 1;
  };
  previewLinks.forEach((link, index) => link.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showPage(index);
    previewDialog.showModal();
  }));
  previous.addEventListener('click', () => {
    showPage(current - 1);
    if (previous.disabled) next.focus();
  });
  next.addEventListener('click', () => {
    showPage(current + 1);
    if (next.disabled) previous.focus();
  });
  previewDialog.querySelector('[data-preview-close]').addEventListener('click', () => previewDialog.close());
}
