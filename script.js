document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Mobile nav toggle ---------- */
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

  /* ---------- Mailto contact forms ---------- */
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

  /* ---------- Triangular tessellation background ----------
     Draws a seamless grid of equilateral-ish triangles behind
     the page content, colored from the site palette. Redraws
     on load and on resize so it always covers the full page. */

  const canvas = document.getElementById('tess-bg');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');

    const palette = [
      'rgba(224,80,60,0.07)',   // curve-red
      'rgba(44,110,147,0.07)',  // curve-blue
      'rgba(198,148,31,0.08)',  // curve-gold
      'rgba(124,92,180,0.07)',  // curve-violet
      'transparent',
      'transparent',
      'transparent'
    ];
    const strokeColor = 'rgba(216,210,190,0.6)';
    const side = 64; // triangle side length in CSS px

    function draw() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = document.documentElement.clientWidth;
      const height = Math.max(document.documentElement.scrollHeight, window.innerHeight);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const rowH = side * Math.sqrt(3) / 2;
      let rowIndex = 0;

      for (let y = -rowH; y < height + rowH; y += rowH, rowIndex++) {
        let colIndex = 0;
        for (let x = -side; x < width + side; x += side / 2, colIndex++) {
          const up = (rowIndex + colIndex) % 2 === 0;

          ctx.beginPath();
          if (up) {
            ctx.moveTo(x, y + rowH);
            ctx.lineTo(x + side / 2, y);
            ctx.lineTo(x + side, y + rowH);
          } else {
            ctx.moveTo(x, y);
            ctx.lineTo(x + side, y);
            ctx.lineTo(x + side / 2, y + rowH);
          }
          ctx.closePath();

          const fill = palette[Math.floor(Math.random() * palette.length)];
          if (fill !== 'transparent') {
            ctx.fillStyle = fill;
            ctx.fill();
          }
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    draw();
    window.addEventListener('load', draw);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 150);
    });

    // Content (like a filled-in challenge list) can change page
    // height after load; recheck a couple of times early on.
    setTimeout(draw, 400);
    setTimeout(draw, 1200);
  }
});
