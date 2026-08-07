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
    // redraw so the pattern itself never changes mid-visit, unless
    // a page opts into auto-refresh via data-refresh (see bottom).
    let seed = Math.floor(Math.random() * 2 ** 31);
    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

    let truchetBuffer = null; // offscreen canvas, reused across redraws

    function drawTruchet(width, height, rand) {
      // Classic Truchet tile: two quarter-circle arcs per square,
      // randomly oriented, flowing into their neighbors. Arcs are
      // drawn fully opaque onto an offscreen buffer first, then the
      // whole buffer is composited onto the page ONCE with a single
      // alpha — that's what keeps overlapping arc endpoints from
      // stacking into darker blobs (drawing each arc semi-transparent
      // individually would double up wherever two arcs touch).
      const s = 96;
      const thickness = 30;
      const overallAlpha = 50 / 255;

      if (!truchetBuffer) truchetBuffer = document.createElement('canvas');
      if (truchetBuffer.width !== Math.ceil(width) || truchetBuffer.height !== Math.ceil(height)) {
        truchetBuffer.width = Math.ceil(width);
        truchetBuffer.height = Math.ceil(height);
      }
      const bctx = truchetBuffer.getContext('2d');
      bctx.clearRect(0, 0, width, height);
      bctx.lineCap = 'butt'; // avoids round-cap overlap blobs at tile junctions
      bctx.lineWidth = thickness;

      for (let y = 0; y < height + s; y += s) {
        for (let x = 0; x < width + s; x += s) {
          const flip = rand() < 0.5;
          const r = s / 2;
          bctx.strokeStyle = pick(rand, palette).replace(/[\d.]+\)$/, '1)'); // full opacity in the buffer

          bctx.beginPath();
          if (flip) {
            bctx.arc(x, y, r, 0, Math.PI / 2);
          } else {
            bctx.arc(x + s, y, r, Math.PI / 2, Math.PI);
          }
          bctx.stroke();

          bctx.beginPath();
          if (flip) {
            bctx.arc(x + s, y + s, r, Math.PI, 1.5 * Math.PI);
          } else {
            bctx.arc(x, y + s, r, 1.5 * Math.PI, 2 * Math.PI);
          }
          bctx.stroke();
        }
      }

      ctx.save();
      ctx.globalAlpha = overallAlpha;
      ctx.drawImage(truchetBuffer, 0, 0, width, height);
      ctx.restore();
    }

    function drawTriangles(width, height, rand) {
      const side = 92;
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
        // -90° makes this a pointy-top hexagon, matching the pointy-top
        // spacing formula used below (hexW/vert/row-offset). Without
        // this, the hexagons were flat-top shaped but spaced like
        // pointy-top ones, causing overlaps/gaps between tiles.
        const angle = (Math.PI / 180) * (60 * i - 90);
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

    // ============================================================
    // Poincaré disk hyperbolic tiling {3,12}, ported from the p5.js
    // version built in the playground. Geometry is built once (in
    // normalized disk space, radius ≤ 1) and cached — cheap to
    // re-render with a new random rotation on every refresh, instead
    // of rebuilding the whole tiling each time.
    // ============================================================

    const PC_P = 3, PC_Q = 12;
    const PC_MAX_DEPTH = 100;
    const PC_MAX_POLYGONS = 2500;
    const pcPalette = [
      [224, 80, 60], [44, 110, 147], [198, 148, 31], [124, 92, 180], [255, 255, 255],
    ];
    const pcEdgeColor = [33, 42, 53];
    const pcFillAlpha = 190 / 255;

    function pcVertexRadius(p, q) {
      return Math.sqrt(Math.cos(Math.PI/p + Math.PI/q) / Math.cos(Math.PI/p - Math.PI/q));
    }
    function pcGeodesicCircle(A, B) {
      const det = A.x * B.y - A.y * B.x;
      if (Math.abs(det) < 1e-9) return { isLine: true, angle: Math.atan2(A.y, A.x) };
      const rhsA = (A.x*A.x + A.y*A.y + 1) / 2;
      const rhsB = (B.x*B.x + B.y*B.y + 1) / 2;
      const ccx = (rhsA*B.y - rhsB*A.y) / det;
      const ccy = (A.x*rhsB - B.x*rhsA) / det;
      return { isLine: false, cx: ccx, cy: ccy, r2: ccx*ccx + ccy*ccy - 1 };
    }
    function pcReflectPoint(P, circle) {
      if (circle.isLine) {
        const t2 = 2 * circle.angle;
        const c = Math.cos(t2), s = Math.sin(t2);
        return { x: c*P.x + s*P.y, y: s*P.x - c*P.y };
      }
      const dx = P.x - circle.cx, dy = P.y - circle.cy;
      const k = circle.r2 / (dx*dx + dy*dy);
      return { x: circle.cx + k*dx, y: circle.cy + k*dy };
    }
    function pcPolyKey(verts) {
      let sx = 0, sy = 0;
      for (const v of verts) { sx += v.x; sy += v.y; }
      sx /= verts.length; sy /= verts.length;
      return Math.round(sx*2000) + ',' + Math.round(sy*2000);
    }

    let pcBuilt = null; // cached — geometry doesn't depend on canvas size

    function pcBuildTiling() {
      if (pcBuilt) return pcBuilt;
      const r0 = pcVertexRadius(PC_P, PC_Q);
      const centralVerts = [];
      for (let i = 0; i < PC_P; i++) {
        const ang = (2 * Math.PI * i / PC_P) - Math.PI / 2;
        centralVerts.push({ x: r0 * Math.cos(ang), y: r0 * Math.sin(ang) });
      }
      const out = [{ verts: centralVerts, depth: 0 }];
      const visited = new Set([pcPolyKey(centralVerts)]);
      let head = 0;
      while (head < out.length && out.length < PC_MAX_POLYGONS) {
        const cur = out[head++];
        if (cur.depth >= PC_MAX_DEPTH) continue;
        for (let i = 0; i < PC_P; i++) {
          const A = cur.verts[i], B = cur.verts[(i+1) % PC_P];
          const circle = pcGeodesicCircle(A, B);
          const newVerts = cur.verts.map(v => pcReflectPoint(v, circle));
          const key = pcPolyKey(newVerts);
          if (!visited.has(key)) {
            visited.add(key);
            out.push({ verts: newVerts, depth: cur.depth + 1 });
            if (out.length >= PC_MAX_POLYGONS) break;
          }
        }
      }
      pcBuilt = out;
      return out;
    }

    function pcDrawPolygon(verts, transform) {
      ctx.beginPath();
      const n = verts.length;
      const segs = 12;
      let started = false;
      for (let i = 0; i < n; i++) {
        const A = verts[i], B = verts[(i+1) % n];
        const circle = pcGeodesicCircle(A, B);
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          let local;
          if (circle.isLine) {
            local = { x: A.x + (B.x-A.x)*t, y: A.y + (B.y-A.y)*t };
          } else {
            const a0 = Math.atan2(A.y-circle.cy, A.x-circle.cx);
            let a1 = Math.atan2(B.y-circle.cy, B.x-circle.cx);
            let da = a1 - a0;
            while (da > Math.PI) da -= 2*Math.PI;
            while (da < -Math.PI) da += 2*Math.PI;
            const a = a0 + da*t;
            const r = Math.sqrt(circle.r2);
            local = { x: circle.cx + r*Math.cos(a), y: circle.cy + r*Math.sin(a) };
          }
          const sp = transform(local);
          if (!started) { ctx.moveTo(sp.x, sp.y); started = true; } else { ctx.lineTo(sp.x, sp.y); }
        }
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    function drawPoincare(width, height, rand) {
      const polygons = pcBuildTiling();
      const diskScale = Math.min(width, height) * 0.47;
      const cx = width / 2, cy = height / 2;
      const rot = rand() * Math.PI * 2; // new spin each refresh

      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      function transform(p) {
        const rx = p.x*cosR - p.y*sinR, ry = p.x*sinR + p.y*cosR;
        return { x: cx + rx*diskScale, y: cy + ry*diskScale };
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, diskScale, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${pcEdgeColor[0]},${pcEdgeColor[1]},${pcEdgeColor[2]},0.35)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      for (const poly of polygons) {
        const c = pcPalette[poly.depth % pcPalette.length];
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${pcFillAlpha})`;
        ctx.strokeStyle = `rgba(${pcEdgeColor[0]},${pcEdgeColor[1]},${pcEdgeColor[2]},0.45)`;
        ctx.lineWidth = 1.2;
        pcDrawPolygon(poly.verts, transform);
      }
      ctx.restore();
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

    // ============================================================
    // Real "hat" aperiodic monotile tiling (Smith/Myers/Kaplan/
    // Goodman-Strauss, 2023), ported from the p5.js version built
    // in the playground — same substitution math (originally from
    // https://github.com/isohedral/hatviz), translated to plain
    // canvas calls and wired into this file's seeded-redraw system.
    // ============================================================

    const hatHr3 = 0.8660254037844386;
    const hatIdent = [1,0,0,0,1,0];

    // Site palette + the paper/background color, used for both fills
    // and (uniformly) for every tile's outline.
    const hatPalette = [
      [224, 80, 60],   // red
      [44, 110, 147],  // blue
      [198, 148, 31],  // gold
      [124, 92, 180],  // violet
      [250, 246, 236], // paper (site background) — lets some hats "disappear"
    ];
    const HAT_BG_IDX = hatPalette.length - 1;
    const hatOutlineWeight = 4;
    const hatAlpha = 50 / 255;
    const hatLevels = 2;    // substitution rounds — higher = more, smaller hats
    const hatCoverage = 1;  // how far the tiling overflows the canvas

    function hatPt(x, y) { return { x, y }; }
    function hatHexPt(x, y) { return hatPt(x + 0.5 * y, hatHr3 * y); }
    function hatInv(T) {
      const det = T[0]*T[4] - T[1]*T[3];
      return [T[4]/det, -T[1]/det, (T[1]*T[5]-T[2]*T[4])/det,
        -T[3]/det, T[0]/det, (T[2]*T[3]-T[0]*T[5])/det];
    }
    function hatMul(A, B) {
      return [A[0]*B[0] + A[1]*B[3], A[0]*B[1] + A[1]*B[4], A[0]*B[2] + A[1]*B[5] + A[2],
        A[3]*B[0] + A[4]*B[3], A[3]*B[1] + A[4]*B[4], A[3]*B[2] + A[4]*B[5] + A[5]];
    }
    function hatPadd(p, q) { return { x: p.x + q.x, y: p.y + q.y }; }
    function hatPsub(p, q) { return { x: p.x - q.x, y: p.y - q.y }; }
    function hatTrot(ang) { const c = Math.cos(ang), s = Math.sin(ang); return [c, -s, 0, s, c, 0]; }
    function hatTtrans(tx, ty) { return [1, 0, tx, 0, 1, ty]; }
    function hatRotAbout(p, ang) { return hatMul(hatTtrans(p.x, p.y), hatMul(hatTrot(ang), hatTtrans(-p.x, -p.y))); }
    function hatTransPt(M, P) { return hatPt(M[0]*P.x + M[1]*P.y + M[2], M[3]*P.x + M[4]*P.y + M[5]); }
    function hatMatchSeg(p, q) { return [q.x-p.x, p.y-q.y, p.x, q.y-p.y, q.x-p.x, p.y]; }
    function hatMatchTwo(p1, q1, p2, q2) { return hatMul(hatMatchSeg(p2, q2), hatInv(hatMatchSeg(p1, q1))); }
    function hatIntersect(p1, q1, p2, q2) {
      const d = (q2.y-p2.y)*(q1.x-p1.x) - (q2.x-p2.x)*(q1.y-p1.y);
      const uA = ((q2.x-p2.x)*(p1.y-p2.y) - (q2.y-p2.y)*(p1.x-p2.x)) / d;
      return hatPt(p1.x + uA*(q1.x-p1.x), p1.y + uA*(q1.y-p1.y));
    }

    class HatGeom {
      constructor(pgon) { this.shape = pgon; this.children = []; }
      addChild(T, geom) { this.children.push({ T, geom }); }
      evalChild(n, i) { return hatTransPt(this.children[n].T, this.children[n].geom.shape[i]); }
      recentre() {
        let cx = 0, cy = 0;
        for (const p of this.shape) { cx += p.x; cy += p.y; }
        cx /= this.shape.length; cy /= this.shape.length;
        for (let i = 0; i < this.shape.length; i++) this.shape[i] = hatPadd(this.shape[i], hatPt(-cx, -cy));
        const M = hatTtrans(-cx, -cy);
        for (const ch of this.children) ch.T = hatMul(M, ch.T);
      }
    }

    const hat_outline = [
      hatHexPt(0,0), hatHexPt(-1,-1), hatHexPt(0,-2), hatHexPt(2,-2),
      hatHexPt(2,-1), hatHexPt(4,-2), hatHexPt(5,-1), hatHexPt(4,0),
      hatHexPt(3,0), hatHexPt(2,2), hatHexPt(0,3), hatHexPt(0,2), hatHexPt(-1,2)
    ];
    const H1_hat = new HatGeom(hat_outline);
    const H_hat = new HatGeom(hat_outline);
    const T_hat = new HatGeom(hat_outline);
    const P_hat = new HatGeom(hat_outline);
    const F_hat = new HatGeom(hat_outline);

    const H_init = (function () {
      const H_outline = [hatPt(0,0), hatPt(4,0), hatPt(4.5,hatHr3), hatPt(2.5,5*hatHr3), hatPt(1.5,5*hatHr3), hatPt(-0.5,hatHr3)];
      const geom = new HatGeom(H_outline);
      geom.addChild(hatMatchTwo(hat_outline[5], hat_outline[7], H_outline[5], H_outline[0]), H_hat);
      geom.addChild(hatMatchTwo(hat_outline[9], hat_outline[11], H_outline[1], H_outline[2]), H_hat);
      geom.addChild(hatMatchTwo(hat_outline[5], hat_outline[7], H_outline[3], H_outline[4]), H_hat);
      geom.addChild(hatMul(hatTtrans(2.5, hatHr3), hatMul([-0.5,-hatHr3,0,hatHr3,-0.5,0], [0.5,0,0,0,-0.5,0])), H1_hat);
      return geom;
    }());

    const T_init = (function () {
      const T_outline = [hatPt(0,0), hatPt(3,0), hatPt(1.5,3*hatHr3)];
      const geom = new HatGeom(T_outline);
      geom.addChild([0.5,0,0.5,0,0.5,hatHr3], T_hat);
      return geom;
    }());

    const P_init = (function () {
      const P_outline = [hatPt(0,0), hatPt(4,0), hatPt(3,2*hatHr3), hatPt(-1,2*hatHr3)];
      const geom = new HatGeom(P_outline);
      geom.addChild([0.5,0,1.5,0,0.5,hatHr3], P_hat);
      geom.addChild(hatMul(hatTtrans(0,2*hatHr3), hatMul([0.5,hatHr3,0,-hatHr3,0.5,0],[0.5,0,0,0,0.5,0])), P_hat);
      return geom;
    }());

    const F_init = (function () {
      const F_outline = [hatPt(0,0), hatPt(3,0), hatPt(3.5,hatHr3), hatPt(3,2*hatHr3), hatPt(-1,2*hatHr3)];
      const geom = new HatGeom(F_outline);
      geom.addChild([0.5,0,1.5,0,0.5,hatHr3], F_hat);
      geom.addChild(hatMul(hatTtrans(0,2*hatHr3), hatMul([0.5,hatHr3,0,-hatHr3,0.5,0],[0.5,0,0,0,0.5,0])), F_hat);
      return geom;
    }());

    function hatConstructPatch(H, T, P, F) {
      const rules = [
        ['H'], [0,0,'P',2], [1,0,'H',2], [2,0,'P',2], [3,0,'H',2], [4,4,'P',2],
        [0,4,'F',3], [2,4,'F',3], [4,1,3,2,'F',0], [8,3,'H',0], [9,2,'P',0],
        [10,2,'H',0], [11,4,'P',2], [12,0,'H',2], [13,0,'F',3], [14,2,'F',1],
        [15,3,'H',4], [8,2,'F',1], [17,3,'H',0], [18,2,'P',0], [19,2,'H',2],
        [20,4,'F',3], [20,0,'P',2], [22,0,'H',2], [23,4,'F',3], [23,0,'F',3],
        [16,0,'P',2], [9,4,0,2,'T',2], [4,0,'F',3]
      ];
      const ret = new HatGeom([]);
      const shapes = { H, T, P, F };
      for (const r of rules) {
        if (r.length === 1) {
          ret.addChild(hatIdent, shapes[r[0]]);
        } else if (r.length === 4) {
          const poly = ret.children[r[0]].geom.shape;
          const Tm = ret.children[r[0]].T;
          const P0 = hatTransPt(Tm, poly[(r[1]+1)%poly.length]);
          const Q0 = hatTransPt(Tm, poly[r[1]]);
          const nshp = shapes[r[2]], npoly = nshp.shape;
          ret.addChild(hatMatchTwo(npoly[r[3]], npoly[(r[3]+1)%npoly.length], P0, Q0), nshp);
        } else {
          const chP = ret.children[r[0]], chQ = ret.children[r[2]];
          const P0 = hatTransPt(chQ.T, chQ.geom.shape[r[3]]);
          const Q0 = hatTransPt(chP.T, chP.geom.shape[r[1]]);
          const nshp = shapes[r[4]], npoly = nshp.shape;
          ret.addChild(hatMatchTwo(npoly[r[5]], npoly[(r[5]+1)%npoly.length], P0, Q0), nshp);
        }
      }
      return ret;
    }

    function hatConstructMetatiles(patch) {
      const bps1 = patch.evalChild(8,2), bps2 = patch.evalChild(21,2);
      const rbps = hatTransPt(hatRotAbout(bps1, -2.0*Math.PI/3.0), bps2);
      const p72 = patch.evalChild(7,2), p252 = patch.evalChild(25,2);
      const llc = hatIntersect(bps1, rbps, patch.evalChild(6,2), p72);
      let w = hatPsub(patch.evalChild(6,2), llc);

      const new_H_outline = [llc, bps1];
      w = hatTransPt(hatTrot(-Math.PI/3), w);
      new_H_outline.push(hatPadd(new_H_outline[1], w));
      new_H_outline.push(patch.evalChild(14,2));
      w = hatTransPt(hatTrot(-Math.PI/3), w);
      new_H_outline.push(hatPsub(new_H_outline[3], w));
      new_H_outline.push(patch.evalChild(6,2));

      const new_H = new HatGeom(new_H_outline);
      for (const ch of [0,9,16,27,26,6,1,8,10,15]) new_H.addChild(patch.children[ch].T, patch.children[ch].geom);

      const new_P_outline = [p72, hatPadd(p72, hatPsub(bps1, llc)), bps1, llc];
      const new_P = new HatGeom(new_P_outline);
      for (const ch of [7,2,3,4,28]) new_P.addChild(patch.children[ch].T, patch.children[ch].geom);

      const new_F_outline = [bps2, patch.evalChild(24,2), patch.evalChild(25,0), p252, hatPadd(p252, hatPsub(llc, bps1))];
      const new_F = new HatGeom(new_F_outline);
      for (const ch of [21,20,22,23,24,25]) new_F.addChild(patch.children[ch].T, patch.children[ch].geom);

      const AAA = new_H_outline[2];
      const BBB = hatPadd(new_H_outline[1], hatPsub(new_H_outline[4], new_H_outline[5]));
      const CCC = hatTransPt(hatRotAbout(BBB, -Math.PI/3), AAA);
      const new_T = new HatGeom([BBB, CCC, AAA]);
      new_T.addChild(patch.children[11].T, patch.children[11].geom);

      new_H.recentre(); new_P.recentre(); new_F.recentre(); new_T.recentre();
      return [new_H, new_T, new_P, new_F];
    }

    function hatCollectPolygons(geom, S, level, out) {
      if (level > 0) {
        for (const g of geom.children) hatCollectPolygons(g.geom, hatMul(S, g.T), level - 1, out);
      } else {
        out.push({ pts: geom.shape.map(p => hatTransPt(S, p)), colorIdx: -1 });
      }
    }

    function hatBuildAdjacency(polys) {
      function ptKey(p) { return Math.round(p.x) + ',' + Math.round(p.y); }
      function edgeKey(a, b) {
        const k1 = ptKey(a), k2 = ptKey(b);
        return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
      }
      const edgeMap = new Map();
      polys.forEach((poly, idx) => {
        const n = poly.pts.length;
        for (let i = 0; i < n; i++) {
          const k = edgeKey(poly.pts[i], poly.pts[(i+1)%n]);
          if (!edgeMap.has(k)) edgeMap.set(k, []);
          edgeMap.get(k).push(idx);
        }
      });
      const neighbors = polys.map(() => new Set());
      edgeMap.forEach(list => {
        for (let i = 0; i < list.length; i++) {
          for (let j = i+1; j < list.length; j++) {
            neighbors[list[i]].add(list[j]);
            neighbors[list[j]].add(list[i]);
          }
        }
      });
      return neighbors;
    }

    // Welsh-Powell-style greedy coloring on the real edge-adjacency
    // graph: most-constrained hats colored first, least-conflict
    // fallback if a hat genuinely has more neighbors than colors.
    // Uses the page's seeded `rand` so it's static per redraw, like
    // every other pattern here, and only changes on an actual reseed.
    function hatAssignColors(polys, rand) {
      if (polys.length === 0) return;
      const neighbors = hatBuildAdjacency(polys);

      const order = polys.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i+1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      order.sort((a, b) => neighbors[b].size - neighbors[a].size);

      const colorOf = new Array(polys.length).fill(-1);
      for (const idx of order) {
        const usedCounts = new Array(hatPalette.length).fill(0);
        neighbors[idx].forEach(n => { if (colorOf[n] !== -1) usedCounts[colorOf[n]]++; });
        const minUses = Math.min(...usedCounts);
        const choices = [];
        for (let c = 0; c < hatPalette.length; c++) if (usedCounts[c] === minUses) choices.push(c);
        colorOf[idx] = choices[Math.floor(rand() * choices.length)];
      }
      polys.forEach((p, i) => { p.colorIdx = colorOf[i]; });
    }

    // The tiling geometry itself (shapes/positions) only depends on
    // canvas size, not on color — cached so the periodic auto-refresh
    // only has to redo the (cheap) coloring step, not rebuild hats.
    let hatCache = null;
    let hatBuffer = null;

    function hatBuildTiling(width, height) {
      let tiles = [H_init, T_init, P_init, F_init];
      let drawLevel = 1;
      for (let i = 0; i < hatLevels; i++) {
        const patch = hatConstructPatch(...tiles);
        tiles = hatConstructMetatiles(patch);
        drawLevel++;
      }
      const chosenTile = tiles[0];

      let maxR = 0;
      for (const p of chosenTile.shape) maxR = Math.max(maxR, Math.hypot(p.x, p.y));
      const targetR = Math.max(width, height) * hatCoverage;
      const scale = targetR / maxR;
      const to_screen = [scale, 0, 0, 0, -scale, 0];
      const S = hatMul(hatTtrans(width/2, height/2), to_screen);

      const polys = [];
      hatCollectPolygons(chosenTile, S, drawLevel, polys);
      hatCache = { w: width, h: height, polys };
    }

    function drawEinstein(width, height, rand) {
      if (!hatCache || hatCache.w !== width || hatCache.h !== height) {
        hatBuildTiling(width, height);
      }
      const polys = hatCache.polys;
      hatAssignColors(polys, rand);

      if (!hatBuffer) hatBuffer = document.createElement('canvas');
      if (hatBuffer.width !== Math.ceil(width) || hatBuffer.height !== Math.ceil(height)) {
        hatBuffer.width = Math.ceil(width);
        hatBuffer.height = Math.ceil(height);
      }
      const bctx = hatBuffer.getContext('2d');
      bctx.clearRect(0, 0, width, height);

      const bg = hatPalette[HAT_BG_IDX];
      bctx.lineWidth = hatOutlineWeight;
      bctx.strokeStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
      bctx.lineJoin = 'round';

      for (const poly of polys) {
        const c = hatPalette[poly.colorIdx];
        bctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        bctx.beginPath();
        poly.pts.forEach((p, i) => i === 0 ? bctx.moveTo(p.x, p.y) : bctx.lineTo(p.x, p.y));
        bctx.closePath();
        bctx.fill();
        bctx.stroke();
      }

      ctx.save();
      ctx.globalAlpha = hatAlpha;
      ctx.drawImage(hatBuffer, 0, 0, width, height);
      ctx.restore();
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
      else if (patternType === 'poincare') drawPoincare(width, height, rand);
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

    // Optional auto-refresh: <canvas id="tess-bg" data-refresh="5000">
    // rerolls to a new random layout on that interval (in ms).
    // Pages without data-refresh keep the normal static-per-load behavior.
    const refreshMs = parseInt(canvas.dataset.refresh, 10);
    if (!isNaN(refreshMs) && refreshMs > 0) {
      setInterval(() => {
        seed = Math.floor(Math.random() * 2 ** 31);
        draw();
      }, refreshMs);
    }
  }
});
