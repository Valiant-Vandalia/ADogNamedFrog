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

const hero = document.querySelector('.hero');
const mobileBuy = document.querySelector('[data-mobile-buy]');
const updateMobileBuy = () => {
  const heroHasPassed = hero ? hero.getBoundingClientRect().bottom <= 72 : false;
  mobileBuy?.classList.toggle('is-visible', heroHasPassed);
};
window.addEventListener('scroll', updateMobileBuy, { passive: true });
window.addEventListener('resize', updateMobileBuy, { passive: true });
updateMobileBuy();

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

const preorderForm = document.querySelector('#preorder-form');
if (preorderForm) {
  const section = document.querySelector('#signed-hardcover');
  const readers = preorderForm.querySelector('#preorder-readers');
  const note = preorderForm.querySelector('#preorder-note');
  const preview = section.querySelector('.inscription-preview');
  const paws = section.querySelectorAll('.paw-progress .paw');
  const mailing = section.querySelector('.mailing-reveal');
  let mailingTimer;
  let mailShown = false;

  const updatePreorder = () => {
    const firstReader = readers.value.split(/\r?\n/)[0].trim();
    section.querySelector('[data-preview-reader]').textContent = firstReader;
    const noteEl = section.querySelector('[data-preview-note]');
    if (note.value.trim()) {
      noteEl.textContent = note.value;
      noteEl.classList.remove('is-personal');
    } else {
      noteEl.textContent = firstReader ? `Josh will personally write an inscription for ${firstReader}.` : 'Josh will personally write the inscription for your reader.';
      noteEl.classList.add('is-personal');
    }
    preview.classList.toggle('is-stamped', Boolean(readers.value.trim()));
    preorderForm.querySelectorAll('fieldset').forEach((group, index) => {
      const complete = [...group.querySelectorAll('[required]')].every((field) => {
        if (field.type === 'radio') return Boolean(group.querySelector('input[type="radio"]:checked'));
        return Boolean(field.value.trim()) && field.validity.valid;
      });
      paws[index].classList.toggle('is-complete', complete);
    });

    const wantsMail = preorderForm.querySelector('#delivery-mail').checked;
    if (wantsMail === mailShown) return;
    mailShown = wantsMail;
    clearTimeout(mailingTimer);
    mailing.inert = !wantsMail;
    mailing.setAttribute('aria-hidden', String(!wantsMail));
    if (wantsMail) {
      mailing.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (mailShown) mailing.classList.add('is-open');
      }));
    } else {
      mailing.classList.remove('is-open');
      mailingTimer = setTimeout(() => { mailing.hidden = true; }, reducedMotion ? 0 : 280);
    }
  };
  preorderForm.addEventListener('input', updatePreorder);
  preorderForm.addEventListener('change', updatePreorder);
  updatePreorder();

  preorderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!preorderForm.reportValidity()) return;
    const button = preorderForm.querySelector('[type="submit"]');
    if (button.disabled) return;
    const error = preorderForm.querySelector('.submit-error');
    button.disabled = true;
    button.textContent = 'Reserving...';
    error.hidden = true;
    try {
      await fetch(preorderForm.dataset.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        body: new FormData(preorderForm)
      });
      preorderForm.hidden = true;
      section.querySelector('.paw-progress').hidden = true;
      const thanks = section.querySelector('.preorder-thanks');
      thanks.hidden = false;
      thanks.classList.add('is-stamped');
      thanks.querySelector('h3').focus({ preventScroll: true });
      thanks.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
    } catch {
      error.textContent = 'Something went wrong sending that. Please try the Google form instead: ';
      const fallback = section.querySelector('.preorder-fallback a').cloneNode(true);
      fallback.textContent = 'Open the Google form';
      error.append(fallback);
      error.hidden = false;
      button.disabled = false;
      button.textContent = 'Reserve my signed copy';
    }
  });
}
