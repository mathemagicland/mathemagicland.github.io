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

  /* ============================================================
     Tessellated background
     Each page picks a different tiling via the canvas's
     data-pattern attribute (truchet / triangles / hex / rhombille
     / versitile). Colors are randomized once per page load using
     a seeded PRNG, so a refresh gives new colors, but the pattern
     never re-randomizes mid-visit (no flicker on resize / late
     redraw — every draw() call reuses the same seed).
     ============================================================ */

  const canvas = document.getElementById('tess-bg');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    const patternType = canvas.dataset.pattern || 'triangles';

    const palette = [
      'rgba(224,80,60,0.09)',   // curve-red
      'rgba(44,110,147,0.09)',  // curve-blue
      'rgba(198,148,31,0.10)',  // curve-gold
      'rgba(124,92,180,0.09)',  // curve-violet
    ];
    const strokeColor = 'rgba(216,210,190,0.65)';

    // Seeded once per page load (per refresh) — reused on every
    // redraw so the pattern itself never changes mid-visit.
    const seed = Math.floor(Math.random() * 2 ** 31);
    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

    function drawTruchet(width, height, rand) {
      // Quarter-circle arcs, randomly oriented per cell — flowing,
      // non-repeating maze-like pattern.
      const s = 56;
      for (let y = 0; y < height + s; y += s) {
        for (let x = 0; x < width + s; x += s) {
          const flip = rand() < 0.5;
          const c1 = flip ? [x, y] : [x + s, y];
          const c2 = flip ? [x + s, y + s] : [x, y + s];
          const a1 = flip ? [Math.PI, 1.5 * Math.PI] : [1.5 * Math.PI, 2 * Math.PI];
          const a2 = flip ? [0, 0.5 * Math.PI] : [0.5 * Math.PI, Math.PI];
          ctx.strokeStyle = pick(rand, palette).replace(/[\d.]+\)$/, '0.9)');
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(c1[0], c1[1], s / 2, a1[0], a1[1]); ctx.stroke();
          ctx.beginPath(); ctx.arc(c2[0], c2[1], s / 2, a2[0], a2[1]); ctx.stroke();
        }
      }
    }

    function drawTriangles(width, height, rand) {
      const side = 64;
      const rowH = side * Math.sqrt(3) / 2;
      let rowIndex = 0;
      for (let y = -rowH; y < height + rowH; y += rowH, rowIndex++) {
        let colIndex = 0;
        for (let x = -side; x < width + side; x += side / 2, colIndex++) {
          const up = (rowIndex + colIndex) % 2 === 0;
          ctx.beginPath();
          if (up) {
            ctx.moveTo(x, y + rowH); ctx.lineTo(x + side / 2, y); ctx.lineTo(x + side, y + rowH);
          } else {
            ctx.moveTo(x, y); ctx.lineTo(x + side, y); ctx.lineTo(x + side / 2, y + rowH);
          }
          ctx.closePath();
          const fillOrNot = rand();
          if (fillOrNot > 0.55) { ctx.fillStyle = pick(rand, palette); ctx.fill(); }
          ctx.strokeStyle = strokeColor; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }

    function hexPoints(cx, cy, r) {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
      }
      return pts;
    }

    function drawHex(width, height, rand) {
      const r = 42;
      const hexW = Math.sqrt(3) * r;
      const vert = r * 1.5;
      let row = 0;
      for (let y = 0; y < height + r * 2; y += vert, row++) {
        const xOff = (row % 2) * (hexW / 2);
        for (let x = xOff; x < width + hexW; x += hexW) {
          const pts = hexPoints(x, y, r);
          ctx.beginPath();
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
          ctx.closePath();
          if (rand() > 0.5) { ctx.fillStyle = pick(rand, palette); ctx.fill(); }
          ctx.strokeStyle = strokeColor; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }

    function drawRhombille(width, height, rand) {
      // Three rhombi per hex vertex — classic "isometric cube" tiling.
      const r = 46;
      const hexW = Math.sqrt(3) * r;
      const vert = r * 1.5;
      let row = 0;
      for (let y = 0; y < height + r * 2; y += vert, row++) {
        const xOff = (row % 2) * (hexW / 2);
        for (let x = xOff; x < width + hexW; x += hexW) {
          const pts = hexPoints(x, y, r);
          const baseColor = pick(rand, palette);
          const shades = [0.06, 0.11, 0.16];
          for (let i = 0; i < 3; i++) {
            const p1 = pts[(i * 2) % 6];
            const p2 = pts[(i * 2 + 1) % 6];
            const p3 = pts[(i * 2 + 2) % 6];
            ctx.beginPath();
            ctx.moveTo(x, y); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]);
            ctx.closePath();
            ctx.fillStyle = baseColor.replace(/[\d.]+\)$/, shades[i] + ')');
            ctx.fill();
            ctx.strokeStyle = strokeColor; ctx.lineWidth = 1; ctx.stroke();
          }
        }
      }
    }

    function drawVersitile(width, height, rand) {
      // Patchwork of squares and diagonally-split triangle pairs.
      const s = 60;
      for (let y = 0; y < height + s; y += s) {
        for (let x = 0; x < width + s; x += s) {
          const mode = rand();
          if (mode < 0.34) {
            ctx.beginPath(); ctx.rect(x, y, s, s);
            if (rand() > 0.4) { ctx.fillStyle = pick(rand, palette); ctx.fill(); }
            ctx.strokeStyle = strokeColor; ctx.stroke();
          } else if (mode < 0.67) {
            const flip = rand() < 0.5;
            const c1 = pick(rand, palette), c2 = pick(rand, palette);
            ctx.beginPath();
            if (flip) { ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); }
            else { ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s); }
            ctx.closePath(); ctx.fillStyle = c1; ctx.fill();
            ctx.strokeStyle = strokeColor; ctx.stroke();

            ctx.beginPath();
            if (flip) { ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); }
            else { ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); }
            ctx.closePath(); ctx.fillStyle = c2; ctx.fill();
            ctx.strokeStyle = strokeColor; ctx.stroke();
          } else {
            ctx.beginPath(); ctx.rect(x, y, s, s);
            ctx.strokeStyle = strokeColor; ctx.stroke();
          }
        }
      }
    }

    function draw() {
      const rand = mulberry32(seed); // same seed every call -> identical output, no flicker
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = document.documentElement.clientWidth;
      const height = Math.max(document.documentElement.scrollHeight, window.innerHeight);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      if (patternType === 'truchet') drawTruchet(width, height, rand);
      else if (patternType === 'hex') drawHex(width, height, rand);
      else if (patternType === 'rhombille') drawRhombille(width, height, rand);
      else if (patternType === 'versitile') drawVersitile(width, height, rand);
      else drawTriangles(width, height, rand);
    }

    draw();
    window.addEventListener('load', draw);

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 150);
    });

    // One late correction in case content (fonts, forms) shifts
    // page height right after load — same seed, so no visible change
    // beyond the pattern extending to cover any new height.
    setTimeout(draw, 500);
  }
});
