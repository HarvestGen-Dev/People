const form = document.querySelector('[data-preview-form]');
const result = form.querySelector('[role="status"]');
const submit = form.querySelector('button[type="submit"]');

form.addEventListener('input', () => {
  result.textContent = '';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  const phone = String(fields.get('phone') ?? '').trim();
  const digits = phone.replace(/[^0-9]/g, '');
  if (!String(fields.get('firstName')).trim() || !String(fields.get('lastName')).trim()) {
    result.textContent = 'Enter a first and last name.';
  } else if (fields.has('phone') && (!/^\+?[\d ().-]+$/.test(phone) || digits.length < 7 || digits.length > 15)) {
    result.textContent = 'Enter a phone number with 7 to 15 digits.';
  } else {
    result.textContent = 'Form checked. Your answers were not sent.';
  }
});

submit.disabled = false;
