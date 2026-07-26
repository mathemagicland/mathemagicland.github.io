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
      // A real Truchet tile SET, not just one design: each cell randomly
      // gets either (a) the original 1704 Truchet tile — a square split
      // by a diagonal into two contrasting triangles — or (b) the
      // quarter-circle arc tile (the common "Smith" variant). Mixing both
      // is closer to how actual Truchet tilings are built. Bigger cells,
      // lower opacity, so it stays out of the way of the text.
      const s = 96;
      const alpha = '0.05)';
      for (let y = 0; y < height + s; y += s) {
        for (let x = 0; x < width + s; x += s) {
          if (rand() < 0.5) {
            // Diagonal-split tile
            const flip = rand() < 0.5;
            const cA = pick(rand, palette).replace(/[\d.]+\)$/, alpha);
            const cB = pick(rand, palette).replace(/[\d.]+\)$/, alpha);

            ctx.beginPath();
            if (flip) { ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); }
            else { ctx.moveTo(x, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + s); }
            ctx.closePath(); ctx.fillStyle = cA; ctx.fill();

            ctx.beginPath();
            if (flip) { ctx.moveTo(x + s, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); }
            else { ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); }
            ctx.closePath(); ctx.fillStyle = cB; ctx.fill();

            ctx.strokeStyle = strokeColor; ctx.lineWidth = 1;
            ctx.beginPath();
            if (flip) { ctx.moveTo(x + s, y); ctx.lineTo(x, y + s); }
            else { ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); }
            ctx.stroke();
          } else {
            // Quarter-circle arc tile
            const cellFlip = rand() < 0.5;
            const c1 = cellFlip ? [x, y] : [x + s, y];
            const c2 = cellFlip ? [x + s, y + s] : [x, y + s];
            const a1 = cellFlip ? [Math.PI, 1.5 * Math.PI] : [1.5 * Math.PI, 2 * Math.PI];
            const a2 = cellFlip ? [0, 0.5 * Math.PI] : [0.5 * Math.PI, Math.PI];
            ctx.strokeStyle = pick(rand, palette).replace(/[\d.]+\)$/, alpha);
            ctx.lineWidth = 1.75;
            ctx.beginPath(); ctx.arc(c1[0], c1[1], s / 2, a1[0], a1[1]); ctx.stroke();
            ctx.beginPath(); ctx.arc(c2[0], c2[1], s / 2, a2[0], a2[1]); ctx.stroke();
          }
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

    function starPath(cx, cy, points, outerR, innerR, rotation) {
      ctx.beginPath();
      const step = Math.PI / points;
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = i * step - Math.PI / 2 + rotation;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    function drawIslamic(width, height, rand) {
      // Eight-pointed star grid, built from overlapping square lattices —
      // the classic geometric technique behind Islamic girih tilework.
      const s = 74;
      for (let y = 0; y < height + s; y += s) {
        for (let x = 0; x < width + s; x += s) {
          const cx = x + s / 2, cy = y + s / 2;
          starPath(cx, cy, 8, s * 0.47, s * 0.19, 0);
          if (rand() > 0.3) { ctx.fillStyle = pick(rand, palette); ctx.fill(); }
          ctx.strokeStyle = strokeColor; ctx.lineWidth = 1; ctx.stroke();

          // connecting cross at each lattice corner ties the stars together
          ctx.save();
          ctx.translate(x, y);
          ctx.strokeStyle = strokeColor; ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-s * 0.14, 0); ctx.lineTo(s * 0.14, 0);
          ctx.moveTo(0, -s * 0.14); ctx.lineTo(0, s * 0.14);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    function drawPenrose(width, height, rand) {
      // Penrose P3 (rhombus) tiling, built the standard way: subdividing
      // "robinson triangles" (golden gnomon/golden triangle pairs) outward
      // from a central "sun." Genuinely aperiodic, not a repeating grid.
      const phi = (1 + Math.sqrt(5)) / 2;
      const cx = width / 2, cy = height / 2;
      const radius = Math.sqrt(width * width + height * height) / 2 + 60;
      const targetTile = 60;
      let depth = Math.round(Math.log(radius / targetTile) / Math.log(phi));
      depth = Math.max(4, Math.min(depth, 7));

      let tris = [];
      for (let i = 0; i < 10; i++) {
        const angleA = (2 * i - 1) * Math.PI / 10;
        const angleB = (2 * i + 1) * Math.PI / 10;
        const A = { x: cx + radius * Math.cos(angleA), y: cy + radius * Math.sin(angleA) };
        const B = { x: cx + radius * Math.cos(angleB), y: cy + radius * Math.sin(angleB) };
        const center = { x: cx, y: cy };
        tris.push(i % 2 === 0 ? { c: 0, A: center, B: A, C: B } : { c: 0, A: center, B: B, C: A });
      }

      for (let d = 0; d < depth; d++) {
        const next = [];
        for (const t of tris) {
          if (t.c === 0) {
            const P = { x: t.A.x + (t.B.x - t.A.x) / phi, y: t.A.y + (t.B.y - t.A.y) / phi };
            next.push({ c: 0, A: t.C, B: P, C: t.B });
            next.push({ c: 1, A: P, B: t.C, C: t.A });
          } else {
            const Q = { x: t.B.x + (t.A.x - t.B.x) / phi, y: t.B.y + (t.A.y - t.B.y) / phi };
            const R = { x: t.B.x + (t.C.x - t.B.x) / phi, y: t.B.y + (t.C.y - t.B.y) / phi };
            next.push({ c: 1, A: R, B: t.C, C: t.A });
            next.push({ c: 1, A: Q, B: R, C: t.B });
            next.push({ c: 0, A: R, B: Q, C: t.A });
          }
        }
        tris = next;
      }

      tris.forEach(t => {
        ctx.beginPath();
        ctx.moveTo(t.A.x, t.A.y); ctx.lineTo(t.B.x, t.B.y); ctx.lineTo(t.C.x, t.C.y);
        ctx.closePath();
        if (rand() > 0.4) { ctx.fillStyle = pick(rand, palette); ctx.fill(); }
        ctx.strokeStyle = strokeColor; ctx.lineWidth = 0.75; ctx.stroke();
      });
    }

    function hatPath(cx, cy, r, rot, mirror) {
      // A stylized nod to the 2023 "hat/einstein" aperiodic monotile —
      // an irregular notched hexagon, not the exact substitution tiling
      // (that requires the full hierarchical metatile system), but built
      // from the same idea: one repeated non-convex shape, randomly
      // rotated and mirrored so no periodic grid pattern emerges.
      const baseAngles = [0, 60, 120, 180, 240, 300];
      let pts = [];
      for (let i = 0; i < 6; i++) {
        const ang = baseAngles[i] * Math.PI / 180;
        const rad = i === 4 ? r * 0.42 : r;
        pts.push([cx + rad * Math.cos(ang + rot), cy + rad * Math.sin(ang + rot)]);
        if (i === 3) {
          const midAng = ((baseAngles[3] + baseAngles[4]) / 2) * Math.PI / 180;
          pts.push([cx + r * 0.72 * Math.cos(midAng + rot), cy + r * 0.72 * Math.sin(midAng + rot)]);
        }
      }
      if (mirror) pts = pts.map(p => [2 * cx - p[0], p[1]]);
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
      ctx.closePath();
    }

    function drawEinstein(width, height, rand) {
      const r = 36;
      const hexW = Math.sqrt(3) * r * 1.15;
      const vert = r * 1.7;
      let row = 0;
      for (let y = 0; y < height + r * 2; y += vert, row++) {
        const xOff = (row % 2) * (hexW / 2);
        for (let x = xOff; x < width + hexW; x += hexW) {
          const rot = Math.floor(rand() * 6) * (Math.PI / 3);
          const mirror = rand() < 0.5;
          hatPath(x, y, r, rot, mirror);
          if (rand() > 0.35) { ctx.fillStyle = pick(rand, palette); ctx.fill(); }
          ctx.strokeStyle = strokeColor; ctx.lineWidth = 1; ctx.stroke();
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
      else if (patternType === 'islamic') drawIslamic(width, height, rand);
      else if (patternType === 'penrose') drawPenrose(width, height, rand);
      else if (patternType === 'einstein') drawEinstein(width, height, rand);
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
