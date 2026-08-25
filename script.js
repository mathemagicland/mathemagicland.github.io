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

  /* ---------- Contact forms (Formspree) ----------
     Submits via fetch() so the page never navigates away — shows an
     inline "sending / thanks / error" message instead. Every form
     needs a required "email" field (already true for all three
     forms) so Formspree can set it as the reply-to address on the
     notification email. */
  document.querySelectorAll('form[data-formspree]').forEach(form => {
    const endpoint = form.getAttribute('data-formspree');

    const status = document.createElement('p');
    status.className = 'form-status';
    status.setAttribute('role', 'status');
    form.appendChild(status);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalLabel = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      status.textContent = '';
      status.classList.remove('form-status-success', 'form-status-error');

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
          form.reset();
          status.textContent = "Thanks, your message is on its way. I'll get back to you soon.";
          status.classList.add('form-status-success');
        } else {
          const data = await response.json().catch(() => null);
          const detail = data && Array.isArray(data.errors)
            ? data.errors.map(er => er.message).join(', ')
            : null;
          status.textContent = detail || `Something went wrong sending that — please try again, or email ${form.getAttribute('data-fallback-email') || 'mathemagicland314159@gmail.com'} directly.`;
          status.classList.add('form-status-error');
        }
      } catch (err) {
        status.textContent = `Network error — please try again, or email ${form.getAttribute('data-fallback-email') || 'mathemagicland314159@gmail.com'} directly.`;
        status.classList.add('form-status-error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    });
  });

  /* ============================================================
     Tessellated background
     Each page picks a different tiling via the canvas's
     data-pattern attribute
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
      // randomly oriented
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

    let triangleTruchetBuffer = null; // offscreen canvas, reused across redraws

    function drawTriangleTruchet(width, height, rand) {
      // One right triangle per cell, randomly rotated to one of 4 positions
      const s = 96;
      const overallAlpha = 50 / 255;

      if (!triangleTruchetBuffer) triangleTruchetBuffer = document.createElement('canvas');
      if (triangleTruchetBuffer.width !== Math.ceil(width) || triangleTruchetBuffer.height !== Math.ceil(height)) {
        triangleTruchetBuffer.width = Math.ceil(width);
        triangleTruchetBuffer.height = Math.ceil(height);
      }
      const bctx = triangleTruchetBuffer.getContext('2d');
      bctx.clearRect(0, 0, width, height);

      for (let y = 0; y < height + s; y += s) {
        for (let x = 0; x < width + s; x += s) {
          const orientation = Math.floor(rand() * 4);
          let pts;
          if (orientation === 0) pts = [[x, y], [x + s, y], [x, y + s]];
          else if (orientation === 1) pts = [[x, y], [x + s, y], [x + s, y + s]];
          else if (orientation === 2) pts = [[x + s, y], [x + s, y + s], [x, y + s]];
          else pts = [[x, y], [x + s, y + s], [x, y + s]];

          bctx.fillStyle = pick(rand, palette).replace(/[\d.]+\)$/, '1)'); // full opacity in the buffer
          bctx.beginPath();
          pts.forEach((p, i) => i === 0 ? bctx.moveTo(p[0], p[1]) : bctx.lineTo(p[0], p[1]));
          bctx.closePath();
          bctx.fill();
        }
      }

      ctx.save();
      ctx.globalAlpha = overallAlpha;
      ctx.drawImage(triangleTruchetBuffer, 0, 0, width, height);
      ctx.restore();
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
      const r = 64;
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
    
function drawArcBlobs(width, height, rand) {
  // ---- settings ----
  const tileSize = 96;
  const alpha = 50;          // 0-255 overall opacity
  const lineWeight = 15;     // stroke weight of the off-white curve lines
  const arcPalette = [
    [224, 80, 60],   // red
    [44, 110, 147],  // blue
    [198, 148, 31],  // gold
    [124, 92, 180],  // violet
  ];
  const offWhite = [250, 246, 236];

  class UnionFind {
    constructor() { this.parent = new Map(); }
    find(a) {
      if (!this.parent.has(a)) this.parent.set(a, a);
      if (this.parent.get(a) !== a) this.parent.set(a, this.find(this.parent.get(a)));
      return this.parent.get(a);
    }
    union(a, b) {
      const ra = this.find(a), rb = this.find(b);
      if (ra !== rb) this.parent.set(ra, rb);
    }
  }

  // offscreen buffer — tiles are drawn here at full opacity, then
  // composited onto the visible canvas once with a single alpha
  const pg = document.createElement('canvas');
  pg.width = width;
  pg.height = height;
  const g = pg.getContext('2d');

  const xs = [];
  for (let x = 0; x < width + tileSize; x += tileSize) xs.push(x);
  const ys = [];
  for (let y = 0; y < height + tileSize; y += tileSize) ys.push(y);
  const cols = xs.length;
  const rows = ys.length;

  const flips = [];
  for (let ry = 0; ry < rows; ry++) {
    flips.push([]);
    for (let rx = 0; rx < cols; rx++) flips[ry].push(rand() < 0.5);
  }

  function regionMap(flip) {
    return flip
      ? { topTL: 'A', leftTL: 'A', rightBR: 'B', bottomBR: 'B',
          topTR: 'M', rightTR: 'M', bottomBL: 'M', leftBL: 'M' }
      : { topTR: 'A', rightTR: 'A', bottomBL: 'B', leftBL: 'B',
          topTL: 'M', leftTL: 'M', rightBR: 'M', bottomBR: 'M' };
  }

  const uf = new UnionFind();
  const rid = (ry, rx, key) => `${ry}_${rx}_${key}`;

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const rm = regionMap(flips[ry][rx]);
      uf.find(rid(ry, rx, rm.topTL));
      uf.find(rid(ry, rx, rm.leftTL));
      uf.find(rid(ry, rx, rm.rightBR));
      uf.find(rid(ry, rx, rm.bottomBR));

      if (ry > 0) {
        const rmAbove = regionMap(flips[ry - 1][rx]);
        uf.union(rid(ry, rx, rm.topTL), rid(ry - 1, rx, rmAbove.bottomBL));
        uf.union(rid(ry, rx, rm.topTR), rid(ry - 1, rx, rmAbove.bottomBR));
      }
      if (rx > 0) {
        const rmLeft = regionMap(flips[ry][rx - 1]);
        uf.union(rid(ry, rx, rm.leftTL), rid(ry, rx - 1, rmLeft.rightTR));
        uf.union(rid(ry, rx, rm.leftBL), rid(ry, rx - 1, rmLeft.rightBR));
      }
    }
  }

  const adj = new Map();
  const allRoots = new Set();
  function addRoot(r) {
    allRoots.add(r);
    if (!adj.has(r)) adj.set(r, new Set());
  }
  function addEdge(r1, r2) {
    if (r1 === r2) return;
    addRoot(r1); addRoot(r2);
    adj.get(r1).add(r2);
    adj.get(r2).add(r1);
  }

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const rootA = uf.find(rid(ry, rx, 'A'));
      const rootB = uf.find(rid(ry, rx, 'B'));
      const rootM = uf.find(rid(ry, rx, 'M'));
      addRoot(rootA); addRoot(rootB); addRoot(rootM);
      addEdge(rootA, rootM);
      addEdge(rootB, rootM);
    }
  }

  const order = [...allRoots].sort((a, b) => adj.get(b).size - adj.get(a).size);
  const blobColorIndex = new Map();

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function backtrack(i) {
    if (i === order.length) return true;
    const node = order[i];
    const usedByNeighbors = new Set();
    for (const nb of adj.get(node)) {
      if (blobColorIndex.has(nb)) usedByNeighbors.add(blobColorIndex.get(nb));
    }
    const candidates = shuffleArray([0, 1, 2, 3]);
    for (const c of candidates) {
      if (!usedByNeighbors.has(c)) {
        blobColorIndex.set(node, c);
        if (backtrack(i + 1)) return true;
        blobColorIndex.delete(node);
      }
    }
    return false;
  }
  backtrack(0);

  function colorFor(regionId) {
    const root = uf.find(regionId);
    return arcPalette[blobColorIndex.get(root)];
  }

  function drawArcTile(x, y, s, flip, ry, rx) {
    const r = s / 2;
    const id = (key) => `${ry}_${rx}_${key}`;

    const midColor = colorFor(id('M'));
    const colorA = colorFor(id('A'));
    const colorB = colorFor(id('B'));

    let cA, cB, angles;
    if (flip) {
      cA = { cx: x,     cy: y     };
      cB = { cx: x + s, cy: y + s };
      angles = { a: 0, b: Math.PI / 2, aOff: Math.PI, bOff: Math.PI * 1.5 };
    } else {
      cA = { cx: x + s, cy: y     };
      cB = { cx: x,     cy: y + s };
      angles = { a: Math.PI / 2, b: Math.PI, aOff: Math.PI * 1.5, bOff: Math.PI * 2 };
    }

    g.fillStyle = `rgb(${midColor[0]}, ${midColor[1]}, ${midColor[2]})`;
    g.fillRect(x, y, s, s);

    g.fillStyle = `rgb(${colorA[0]}, ${colorA[1]}, ${colorA[2]})`;
    g.beginPath();
    g.moveTo(cA.cx, cA.cy);
    g.arc(cA.cx, cA.cy, r, angles.a, angles.b);
    g.closePath();
    g.fill();

    g.fillStyle = `rgb(${colorB[0]}, ${colorB[1]}, ${colorB[2]})`;
    g.beginPath();
    g.moveTo(cB.cx, cB.cy);
    g.arc(cB.cx, cB.cy, r, angles.aOff, angles.bOff);
    g.closePath();
    g.fill();

    g.strokeStyle = `rgb(${offWhite[0]}, ${offWhite[1]}, ${offWhite[2]})`;
    g.lineWidth = lineWeight;
    g.lineCap = 'square';
    g.beginPath();
    g.arc(cA.cx, cA.cy, r, angles.a, angles.b);
    g.stroke();
    g.beginPath();
    g.arc(cB.cx, cB.cy, r, angles.aOff, angles.bOff);
    g.stroke();
  }

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      drawArcTile(xs[rx], ys[ry], tileSize, flips[ry][rx], ry, rx);
    }
  }

  // paint the paper-color background, then composite the buffer once
  // with a single overall alpha (keeps overlapping edges from
  // stacking into darker blobs)
  ctx.fillStyle = `rgb(${offWhite[0]}, ${offWhite[1]}, ${offWhite[2]})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = alpha / 255;
  ctx.drawImage(pg, 0, 0);
  ctx.globalAlpha = 1;
}
    
   
    // ============================================================
    // "hat" aperiodic monotile tiling (Smith/Myers/Kaplan/
    // Goodman-Strauss, 2023), substitution math (originally from
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
      else if (patternType === 'triangletruchet') drawTriangleTruchet(width, height, rand);
      else if (patternType === 'filledtruchet') drawArcBlobs(width, height, rand);
      else if (patternType === 'hex') drawHex(width, height, rand);
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
