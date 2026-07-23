// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const axis = document.querySelector('.axis');
  if (toggle && axis) {
    toggle.addEventListener('click', () => {
      axis.classList.toggle('open');
    });
    axis.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => axis.classList.remove('open'))
    );
  }

  // Generic mailto-form handling.
  // Any <form data-mailto="address@example.com"> on the page will,
  // on submit, build a mailto: link from its fields and open the
  // visitor's email client instead of submitting anywhere.
  document.querySelectorAll('form[data-mailto]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const to = form.getAttribute('data-mailto');
      const subjectPrefix = form.getAttribute('data-subject') || 'Message from Mathemagicland site';

      const fields = Array.from(form.querySelectorAll('input, select, textarea'));
      let bodyLines = [];
      let nameValue = '';

      fields.forEach(f => {
        const fieldLabel = f.getAttribute('data-label') || f.name || '';
        const value = f.value.trim();
        if (!value) return;
        if (f.name === 'name') nameValue = value;
        bodyLines.push(`${fieldLabel}: ${value}`);
      });

      const subject = nameValue
        ? `${subjectPrefix} — ${nameValue}`
        : subjectPrefix;

      const body = bodyLines.join('\n');
      const mailtoUrl = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      window.location.href = mailtoUrl;
    });
  });
});
