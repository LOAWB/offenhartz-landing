(() => {
  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('success', 'error');
    if (kind) el.classList.add(kind);
  }

  function emailLooksValid(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  async function submitForm(form, statusEl, opts = {}) {
    const requireMessage = !!opts.requireMessage;
    // Honeypot
    if (form.company_url && form.company_url.value) {
      setStatus(statusEl, 'Thanks. We will be in touch.', 'success');
      form.reset();
      return;
    }
    const name = (form.name?.value || '').trim();
    const email = (form.email?.value || '').trim();
    const phone = (form.phone?.value || '').trim();
    const company = (form.company?.value || '').trim();
    const message = (form.message?.value || '').trim();

    if (!name || !email || !phone || (requireMessage && !message)) {
      setStatus(statusEl, 'Name, email, and phone are required.', 'error');
      return;
    }
    if (!emailLooksValid(email)) {
      setStatus(statusEl, 'That email address does not look right. Please check and try again.', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type=submit]');
    const original = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    setStatus(statusEl, '');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, company, message, source: form.id || 'unknown' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Submission failed');
      setStatus(statusEl, 'Thanks. Your message landed. We will respond within one (1) business day.', 'success');
      form.reset();
    } catch (err) {
      setStatus(statusEl, 'Something went wrong. Please email Josh@OffenhartzLaw.Com or call (480) 621-0082.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  }

  const hero = document.getElementById('hero-form');
  const heroStatus = document.getElementById('hero-form-status');
  if (hero) {
    hero.addEventListener('submit', (e) => { e.preventDefault(); submitForm(hero, heroStatus); });
  }

  const contact = document.getElementById('contact-form');
  const contactStatus = document.getElementById('form-status');
  if (contact) {
    contact.addEventListener('submit', (e) => { e.preventDefault(); submitForm(contact, contactStatus); });
  }
})();
