(() => {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  if (!form || !status) return;

  function setStatus(text, kind) {
    status.textContent = text;
    status.classList.remove('success', 'error');
    if (kind) status.classList.add(kind);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot — bots will fill this; humans cannot see it.
    if (form.company_url && form.company_url.value) {
      setStatus('Thanks. We will be in touch.', 'success');
      form.reset();
      return;
    }

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !message) {
      setStatus('Name, email, and a brief summary are required.', 'error');
      return;
    }

    // Basic email shape check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('That email address does not look right. Please check and try again.', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type=submit]');
    const original = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    setStatus('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: form.phone.value.trim(),
          company: form.company.value.trim(),
          message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Submission failed');
      setStatus('Thanks. Your message landed. We will respond within one (1) business day.', 'success');
      form.reset();
    } catch (err) {
      setStatus('Something went wrong. Please email Josh@OffenhartzLaw.Com or call (480) 621-0082.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = original;
    }
  });
})();
