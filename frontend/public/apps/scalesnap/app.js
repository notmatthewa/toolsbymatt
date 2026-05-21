(() => {
  // ================================================================
  //  DOM REFS
  // ================================================================
  const dropZone      = document.getElementById('drop-zone');
  const fileInput     = document.getElementById('file-input');
  const workspace     = document.getElementById('workspace');
  const canvas        = document.getElementById('canvas');
  const ctx           = canvas.getContext('2d');
  const canvasWrap    = document.getElementById('canvas-wrap');
  const btnRef        = document.getElementById('btn-reference');
  const btnMeasure    = document.getElementById('btn-measure');
  const btnPersp      = document.getElementById('btn-perspective');
  const refLabel      = document.getElementById('ref-label');
  const refInput      = document.getElementById('reference-input');
  const refValue      = document.getElementById('ref-value');
  const refUnit       = document.getElementById('ref-unit');
  const btnSetRef     = document.getElementById('btn-set-ref');
  const planeInput    = document.getElementById('plane-input');
  const planeWInput   = document.getElementById('plane-w');
  const planeDInput   = document.getElementById('plane-d');
  const planeUnitSel  = document.getElementById('plane-unit');
  const btnSetPlane   = document.getElementById('btn-set-plane');
  const measureModes  = document.getElementById('measure-modes');
  const btnModeSurf   = document.getElementById('btn-mode-surface');
  const btnModeHeight = document.getElementById('btn-mode-height');
  const instructions  = document.getElementById('instructions');
  const resultBar     = document.getElementById('result-bar');
  const resultValue   = document.getElementById('result-value');
  const resultBadge   = document.getElementById('result-badge');
  const outputUnitSel = document.getElementById('output-unit');
  const historyPanel  = document.getElementById('measure-history');
  const historyList   = document.getElementById('history-list');
  const btnClearHist  = document.getElementById('btn-clear-history');
  const btnResetImage = document.getElementById('btn-reset-image');

  // ================================================================
  //  STATE
  // ================================================================
  let img = null;
  let mode = 'reference';         // 'reference' | 'measure'
  let points = [];                // current line's [{x,y}, {x,y}]

  // Flat-mode calibration
  let refLine  = null;            // {p1, p2}
  let refReal  = null;            // {value, unit}
  let scale    = 1;               // corrected-px per real unit

  // Perspective plane
  let perspEnabled  = false;
  let perspCorners  = null;       // [{x,y} x4] TL TR BR BL
  let homography    = null;       // flat [9] — corrected-px mapping (non-calibrated)

  // 3D calibration (plane dimensions set)
  let planeCalibrated = false;
  let planeW = 0, planeD = 0;
  let planeUnit = 'ft';
  let calibH        = null;       // flat [9] — image → real-world ground coords
  let camera        = null;       // {P, Vz, vanishLine, f}
  let measureMode   = 'surface';  // 'surface' | 'height'

  // Drag
  let dragType  = null;           // 'point' | 'corner'
  let dragIndex = -1;
  let isDragging = false;
  let didDrag    = false;

  // Measurements
  let measurements = [];          // [{p1, p2, type, realLen, unit}]

  // Unit conversion (everything through meters)
  const toMeters = { in:0.0254, ft:0.3048, yd:0.9144, mi:1609.344, mm:0.001, cm:0.01, m:1, km:1000 };
  function convert(value, from, to) {
    if (from === to || !toMeters[from] || !toMeters[to]) return value;
    return value * toMeters[from] / toMeters[to];
  }

  // ================================================================
  //  IMAGE LOADING
  // ================================================================
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadImage(f);
  });

  function loadImage(file) {
    const r = new FileReader();
    r.onload = e => {
      img = new Image();
      img.onload = () => {
        resetState();
        dropZone.classList.add('hidden');
        workspace.classList.remove('hidden');
        sizeCanvas();
        draw();
      };
      img.src = e.target.result;
    };
    r.readAsDataURL(file);
  }

  function sizeCanvas() {
    const maxW = canvasWrap.clientWidth;
    const ratio = img.naturalWidth / img.naturalHeight;
    const w = Math.min(img.naturalWidth, maxW);
    canvas.width = w;
    canvas.height = w / ratio;
  }

  function resetState() {
    mode = 'reference'; points = [];
    refLine = null; refReal = null; scale = 1;
    perspEnabled = false; perspCorners = null; homography = null;
    planeCalibrated = false; planeW = 0; planeD = 0;
    calibH = null; camera = null; measureMode = 'surface';
    dragType = null; dragIndex = -1; isDragging = false; didDrag = false;
    measurements = [];
    refValue.value = ''; planeWInput.value = ''; planeDInput.value = '';
    btnRef.classList.add('active'); btnRef.classList.remove('done');
    btnMeasure.classList.remove('active'); btnMeasure.disabled = true;
    btnPersp.classList.remove('active');
    refLabel.textContent = 'Reference';
    refInput.classList.remove('hidden');
    planeInput.classList.add('hidden');
    measureModes.classList.add('hidden');
    btnSetRef.disabled = true; btnSetPlane.disabled = true;
    outputUnitSel.value = 'ft';
    resultBar.classList.add('hidden');
    historyPanel.classList.add('hidden');
    historyList.innerHTML = '';
    updateInstructions();
  }

  btnResetImage.addEventListener('click', () => {
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
    img = null;
  });

  // ================================================================
  //  LINEAR ALGEBRA
  // ================================================================
  function solveLinear8(A, b) {
    const n = 8;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let mx = 0, mr = col;
      for (let r = col; r < n; r++) {
        if (Math.abs(M[r][col]) > mx) { mx = Math.abs(M[r][col]); mr = r; }
      }
      if (mx < 1e-12) return null;
      [M[col], M[mr]] = [M[mr], M[col]];
      for (let r = col + 1; r < n; r++) {
        const f = M[r][col] / M[col][col];
        for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
      }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = M[i][n];
      for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
      x[i] /= M[i][i];
    }
    return x;
  }

  function cross3(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  }

  // ================================================================
  //  HOMOGRAPHY
  // ================================================================
  function computeHomography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const sx = src[i].x, sy = src[i].y, dx = dst[i].x, dy = dst[i].y;
      A.push([sx, sy, 1, 0, 0, 0, -sx*dx, -sy*dx]); b.push(dx);
      A.push([0, 0, 0, sx, sy, 1, -sx*dy, -sy*dy]); b.push(dy);
    }
    const h = solveLinear8(A, b);
    return h ? [h[0],h[1],h[2], h[3],h[4],h[5], h[6],h[7],1] : null;
  }

  function applyH(H, p) {
    const w = H[6]*p.x + H[7]*p.y + H[8];
    if (Math.abs(w) < 1e-12) return {x:0, y:0};
    return { x:(H[0]*p.x+H[1]*p.y+H[2])/w, y:(H[3]*p.x+H[4]*p.y+H[5])/w };
  }

  // ================================================================
  //  PROJECTIVE GEOMETRY — vanishing points, Vz, camera matrix
  // ================================================================
  function toH(p) { return [p.x, p.y, 1]; }
  function fromH(h) {
    if (Math.abs(h[2]) < 1e-12) {
      const s = 1e6;
      return { x: h[0]*s, y: h[1]*s };
    }
    return { x: h[0]/h[2], y: h[1]/h[2] };
  }
  function linePts(p1, p2) { return cross3(toH(p1), toH(p2)); }
  function lineIsect(l1, l2) { return fromH(cross3(l1, l2)); }

  function getVanishingGeometry(corners) {
    const [TL, TR, BR, BL] = corners;
    const lTop = linePts(TL, TR), lBot = linePts(BL, BR);
    const V1 = lineIsect(lTop, lBot);                     // width VP
    const lLeft = linePts(TL, BL), lRight = linePts(TR, BR);
    const V2 = lineIsect(lLeft, lRight);                   // depth VP
    const vanishLine = linePts(V1, V2);                    // horizon
    return { V1, V2, vanishLine };
  }

  function estimateVz(V1, V2, cx, cy) {
    let f2 = -((V1.x-cx)*(V2.x-cx) + (V1.y-cy)*(V2.y-cy));
    if (f2 <= 0) f2 = (cx*2)**2;                          // fallback: f = image width
    const vLine = linePts(V1, V2);
    const a = vLine[0], b = vLine[1], c = vLine[2];
    const den = a*a + b*b;
    const foot = {
      x: (b*b*cx - a*b*cy - a*c) / den,
      y: (a*a*cy - a*b*cx - b*c) / den
    };
    const d = pdist(foot, {x:cx, y:cy});
    if (d < 1e-6) return { x: cx, y: cy - 1e5 };
    const dir = { x: (cx - foot.x)/d, y: (cy - foot.y)/d };
    const t = f2 / d;
    return { x: cx + dir.x*t, y: cy + dir.y*t, f2 };
  }

  function buildCamera(corners, W, D) {
    const wc = [{x:0,y:0},{x:W,y:0},{x:W,y:D},{x:0,y:D}];
    const H = computeHomography(wc, corners);              // world → image
    if (!H) return null;

    const { V1, V2, vanishLine } = getVanishingGeometry(corners);
    const cx = canvas.width/2, cy = canvas.height/2;
    let f2 = -((V1.x-cx)*(V2.x-cx) + (V1.y-cy)*(V2.y-cy));
    if (f2 <= 0) f2 = (cx*2)**2;
    const f = Math.sqrt(f2);

    // K^{-1} applied to a column of H
    const col = i => [H[i], H[3+i], H[6+i]];
    const ki  = c => [(c[0]-cx*c[2])/f, (c[1]-cy*c[2])/f, c[2]];

    const kh1 = ki(col(0)), kh2 = ki(col(1)), kh3 = ki(col(2));
    const lam = 1.0 / Math.sqrt(kh1[0]**2+kh1[1]**2+kh1[2]**2);

    const r1 = kh1.map(v=>v*lam);
    const r2 = kh2.map(v=>v*lam);
    const t  = kh3.map(v=>v*lam);
    const r3 = cross3(r1, r2);

    // P = K * [r1 r2 r3 t]  (3×4)
    const cols = [r1, r2, r3, t];
    const P = [
      cols.map(c => f*c[0] + cx*c[2]),
      cols.map(c => f*c[1] + cy*c[2]),
      cols.map(c => c[2])
    ];

    const Vz = estimateVz(V1, V2, cx, cy);
    return { P, Vz, vanishLine, f, V1, V2 };
  }

  // ================================================================
  //  HEIGHT COMPUTATION
  // ================================================================
  function solveHeight(basePt, topPt) {
    if (!camera || !calibH) return null;

    // Map base to world ground coords
    const B = applyH(calibH, basePt);
    const Bx = B.x, By = B.y;

    // Project top onto the vertical line (base → Vz) for robustness
    const proj = projectOntoVertical(basePt, topPt, camera.Vz);
    const tx = proj.x, ty = proj.y;

    const P = camera.P;

    // From rows 0&2:  Z * (P[0][2] - tx*P[2][2]) = tx*(P[2][0]*Bx+P[2][1]*By+P[2][3]) - (P[0][0]*Bx+P[0][1]*By+P[0][3])
    const numX = tx*(P[2][0]*Bx+P[2][1]*By+P[2][3]) - (P[0][0]*Bx+P[0][1]*By+P[0][3]);
    const denX = P[0][2] - tx*P[2][2];

    // From rows 1&2:
    const numY = ty*(P[2][0]*Bx+P[2][1]*By+P[2][3]) - (P[1][0]*Bx+P[1][1]*By+P[1][3]);
    const denY = P[1][2] - ty*P[2][2];

    let Z;
    if (Math.abs(denX) > Math.abs(denY)) {
      if (Math.abs(denX) < 1e-10) return null;
      Z = numX / denX;
    } else {
      if (Math.abs(denY) < 1e-10) return null;
      Z = numY / denY;
    }
    return Math.abs(Z);
  }

  function projectOntoVertical(basePt, clickPt, Vz) {
    const dx = Vz.x - basePt.x, dy = Vz.y - basePt.y;
    const len2 = dx*dx + dy*dy;
    if (len2 < 1) return clickPt;
    const t = ((clickPt.x-basePt.x)*dx + (clickPt.y-basePt.y)*dy) / len2;
    return { x: basePt.x + t*dx, y: basePt.y + t*dy };
  }

  // ================================================================
  //  DISTANCE COMPUTATION (unified)
  // ================================================================
  function computeDistance(p1, p2) {
    if (perspEnabled && planeCalibrated && calibH) {
      const a = applyH(calibH, p1), b = applyH(calibH, p2);
      return pdist(a, b);
    }
    if (perspEnabled && homography) {
      const a = applyH(homography, p1), b = applyH(homography, p2);
      return pdist(a, b);
    }
    return pdist(p1, p2);
  }

  function recalibrateAll() {
    updateHomography();
    if (planeCalibrated && perspEnabled) {
      scale = 1;
    } else if (refLine && refReal) {
      scale = computeDistance(refLine.p1, refLine.p2) / refReal.value;
    }
    measurements.forEach(m => {
      if (m.type === 'height') {
        const h = solveHeight(m.p1, m.p2);
        if (h !== null) m.realLen = h;
      } else {
        m.realLen = computeDistance(m.p1, m.p2) / scale;
      }
    });
    renderHistory();
  }

  // ================================================================
  //  PERSPECTIVE PLANE
  // ================================================================
  function updateHomography() {
    if (!perspEnabled || !perspCorners) { homography = null; calibH = null; camera = null; return; }
    if (planeCalibrated && planeW > 0 && planeD > 0) {
      const wc = [{x:0,y:0},{x:planeW,y:0},{x:planeW,y:planeD},{x:0,y:planeD}];
      calibH = computeHomography(perspCorners, wc);
      camera = buildCamera(perspCorners, planeW, planeD);
      // Also compute uncalibrated homography for drawing grid etc.
      const c = perspCorners;
      const topW = pdist(c[0],c[1]), botW = pdist(c[3],c[2]);
      const leftH = pdist(c[0],c[3]), rightH = pdist(c[1],c[2]);
      const dW = Math.max(topW,botW), dH = Math.max(leftH,rightH);
      if (dW >= 1 && dH >= 1) {
        homography = computeHomography(c, [{x:0,y:0},{x:dW,y:0},{x:dW,y:dH},{x:0,y:dH}]);
      }
    } else {
      calibH = null; camera = null;
      const c = perspCorners;
      const topW = pdist(c[0],c[1]), botW = pdist(c[3],c[2]);
      const leftH = pdist(c[0],c[3]), rightH = pdist(c[1],c[2]);
      const dW = Math.max(topW,botW), dH = Math.max(leftH,rightH);
      if (dW < 1 || dH < 1) { homography = null; return; }
      homography = computeHomography(c, [{x:0,y:0},{x:dW,y:0},{x:dW,y:dH},{x:0,y:dH}]);
    }
  }

  btnPersp.addEventListener('click', () => {
    perspEnabled = !perspEnabled;
    btnPersp.classList.toggle('active', perspEnabled);

    if (perspEnabled) {
      if (!perspCorners) {
        const mx = canvas.width*0.15, my = canvas.height*0.15;
        const w = canvas.width*0.7, h = canvas.height*0.7;
        perspCorners = [
          {x:mx, y:my}, {x:mx+w, y:my}, {x:mx+w, y:my+h}, {x:mx, y:my+h}
        ];
      }
      refLabel.textContent = 'Plane Size';
      refInput.classList.add('hidden');
      if (planeCalibrated) {
        planeInput.classList.add('hidden');
      } else {
        planeInput.classList.remove('hidden');
      }
    } else {
      refLabel.textContent = 'Reference';
      planeInput.classList.add('hidden');
      measureModes.classList.add('hidden');
      measureMode = 'surface';
      if (mode === 'reference') {
        refInput.classList.remove('hidden');
      } else if (!refLine) {
        // No flat reference set — go back to reference mode
        mode = 'reference';
        refInput.classList.remove('hidden');
        btnRef.classList.add('active'); btnRef.classList.remove('done');
        btnMeasure.classList.remove('active'); btnMeasure.disabled = true;
      }
    }
    updateHomography();
    recalibrateAll();
    draw();
    updateInstructions();
  });

  // ================================================================
  //  DRAWING
  // ================================================================
  function draw() {
    if (!img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Perspective plane
    if (perspEnabled && perspCorners) drawPerspPlane();

    // Reference line
    if (refLine) {
      drawLine(refLine.p1, refLine.p2, '#6c8cff',
        refReal ? `${refReal.value} ${unitLabel(refReal.unit)}` : null);
    }

    // Saved measurements
    measurements.forEach(m => {
      if (m.type === 'height') {
        drawHeightDim(m.p1, m.p2, 'rgba(34,211,238,0.45)', null, true);
      } else {
        drawLine(m.p1, m.p2, 'rgba(74,222,128,0.5)', null, true);
      }
    });

    // In-progress reference (flat mode)
    if (mode === 'reference' && !perspEnabled && !refLine && points.length > 0) {
      drawPoints(points, '#6c8cff');
      if (points.length === 2) drawLine(points[0], points[1], '#6c8cff');
    }

    // In-progress measurement
    if (mode === 'measure' && points.length > 0) {
      const isH = perspEnabled && planeCalibrated && measureMode === 'height';
      const color = isH ? '#22d3ee' : '#4ade80';
      drawPoints(points, color);

      // Vertical guide line in height mode
      if (isH && points.length >= 1 && camera) {
        drawVerticalGuide(points[0], camera.Vz);
      }

      if (points.length === 2) {
        if (isH) {
          const proj = projectOntoVertical(points[0], points[1], camera.Vz);
          const h = solveHeight(points[0], proj);
          const ou = outUnit();
          const label = h !== null ? `${formatNum(convert(h, planeUnit, ou))} ${unitLabel(ou)}` : '—';
          drawHeightDim(points[0], proj, '#22d3ee', label);
        } else {
          const realLen = computeDistance(points[0], points[1]) / scale;
          const fromU = planeCalibrated ? planeUnit : (refReal ? refReal.unit : '');
          const ou = outUnit();
          drawLine(points[0], points[1], '#4ade80', `${formatNum(convert(realLen, fromU, ou))} ${unitLabel(ou)}`);
        }
      }
    }
  }

  function drawPerspPlane() {
    const c = perspCorners;
    ctx.save();
    // Fill
    ctx.beginPath();
    ctx.moveTo(c[0].x, c[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(c[i].x, c[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(251,146,60,0.06)';
    ctx.fill();
    // Edges
    ctx.strokeStyle = 'rgba(251,146,60,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6,4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Grid
    const N = 4;
    ctx.strokeStyle = 'rgba(251,146,60,0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i < N; i++) {
      const t = i / N;
      const lp = lerp2(c[0],c[3],t), rp = lerp2(c[1],c[2],t);
      ctx.beginPath(); ctx.moveTo(lp.x,lp.y); ctx.lineTo(rp.x,rp.y); ctx.stroke();
      const tp = lerp2(c[0],c[1],t), bp = lerp2(c[3],c[2],t);
      ctx.beginPath(); ctx.moveTo(tp.x,tp.y); ctx.lineTo(bp.x,bp.y); ctx.stroke();
    }
    // Edge dimension labels when calibrated
    if (planeCalibrated) {
      const midTop = lerp2(c[0],c[1],0.5);
      const midLeft = lerp2(c[0],c[3],0.5);
      drawSmallLabel(midTop.x, midTop.y - 16, `${planeW} ${unitLabel(planeUnit)}`, 'rgba(251,146,60,0.8)');
      drawSmallLabel(midLeft.x - 10, midLeft.y, `${planeD}`, 'rgba(251,146,60,0.8)', true);
    }
    // Corner handles
    const labels = ['TL','TR','BR','BL'];
    c.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x,p.y,8,0,Math.PI*2);
      ctx.fillStyle = 'rgba(251,146,60,0.25)'; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x,p.y,4.5,0,Math.PI*2);
      ctx.fillStyle = '#fb923c'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '600 10px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(251,146,60,0.85)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(labels[i], p.x, p.y - 12);
    });
    // Vanishing line (subtle)
    if (camera) {
      const vl = camera.vanishLine;
      const a = vl[0], b = vl[1], cv = vl[2];
      if (Math.abs(b) > 1e-6) {
        const y0 = -(a*0+cv)/b, y1 = -(a*canvas.width+cv)/b;
        ctx.strokeStyle = 'rgba(251,146,60,0.12)';
        ctx.lineWidth = 1; ctx.setLineDash([2,6]);
        ctx.beginPath(); ctx.moveTo(0,y0); ctx.lineTo(canvas.width,y1); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  function drawSmallLabel(x, y, text, color, vertical) {
    ctx.save();
    ctx.font = '600 10px -apple-system, sans-serif';
    if (vertical) {
      ctx.translate(x, y);
      ctx.rotate(-Math.PI/2);
      ctx.fillStyle = color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 0);
    } else {
      ctx.fillStyle = color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  function drawVerticalGuide(base, Vz) {
    ctx.save();
    const dx = Vz.x - base.x, dy = Vz.y - base.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 1) { ctx.restore(); return; }
    const ext = Math.max(canvas.width, canvas.height) * 2;
    ctx.strokeStyle = 'rgba(34,211,238,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,8]);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(base.x + dx/len*ext, base.y + dy/len*ext);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawHeightDim(base, top, color, label, dimmed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = dimmed ? 1.5 : 2.5;
    ctx.setLineDash(dimmed ? [4,4] : []);
    ctx.beginPath(); ctx.moveTo(base.x,base.y); ctx.lineTo(top.x,top.y); ctx.stroke();
    ctx.setLineDash([]);
    // Architectural ticks
    if (!dimmed) {
      const angle = Math.atan2(top.y-base.y, top.x-base.x);
      const px = Math.cos(angle+Math.PI/2)*8, py = Math.sin(angle+Math.PI/2)*8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(base.x-px, base.y-py); ctx.lineTo(base.x+px, base.y+py);
      ctx.moveTo(top.x-px, top.y-py);   ctx.lineTo(top.x+px, top.y+py);
      ctx.stroke();
      drawEndpoint(base, color);
      drawEndpoint(top, color);
    }
    if (label) {
      const mx = (base.x+top.x)/2, my = (base.y+top.y)/2;
      ctx.font = '600 13px -apple-system, sans-serif';
      const tw = ctx.measureText(label).width;
      const pad = 6, bw = tw+pad*2, bh = 22;
      const ox = 16; // offset to the side
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, mx+ox, my-bh/2, bw, bh, 4);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, mx+ox+pad, my);
    }
    ctx.restore();
  }

  function drawLine(p1, p2, color, label, dimmed) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = dimmed ? 1.5 : 2.5;
    ctx.setLineDash(dimmed ? [4,4] : []);
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
    if (!dimmed) { drawEndpoint(p1, color); drawEndpoint(p2, color); }
    if (label) {
      const mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
      ctx.font = '600 13px -apple-system, sans-serif';
      const tw = ctx.measureText(label).width;
      const pad = 6, bw = tw+pad*2, bh = 22;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      roundRect(ctx, mx-bw/2, my-bh/2-12, bw, bh, 4);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my-12);
    }
    ctx.restore();
  }

  function drawEndpoint(p, color) {
    ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawPoints(pts, color) { pts.forEach(p => drawEndpoint(p, color)); }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
  }

  // ================================================================
  //  CANVAS INTERACTION
  // ================================================================
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height) };
  }

  canvas.addEventListener('mousedown', e => {
    const pos = getPos(e);
    let best = 14; dragType = null; dragIndex = -1;

    for (let i = 0; i < points.length; i++) {
      const d = pdist(pos, points[i]);
      if (d < best) { best = d; dragType = 'point'; dragIndex = i; }
    }
    if (perspEnabled && perspCorners) {
      for (let i = 0; i < 4; i++) {
        const d = pdist(pos, perspCorners[i]);
        if (d < best) { best = d; dragType = 'corner'; dragIndex = i; }
      }
    }
    if (dragType) { isDragging = true; didDrag = false; }
  });

  canvas.addEventListener('mousemove', e => {
    if (!isDragging) return;
    didDrag = true;
    const pos = getPos(e);
    if (dragType === 'point') {
      points[dragIndex] = pos;
      draw();
      updateLiveResult();
    } else if (dragType === 'corner') {
      perspCorners[dragIndex] = pos;
      updateHomography();
      recalibrateAll();
      draw();
      updateLiveResult();
    }
  });

  canvas.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      if (dragType === 'point') updateSetButton();
      dragType = null; dragIndex = -1;
    }
  });

  canvas.addEventListener('click', e => {
    if (didDrag) { didDrag = false; return; }
    const pos = getPos(e);

    // ---- Reference mode (flat only — perspective uses plane dims) ----
    if (mode === 'reference' && !perspEnabled) {
      if (refLine) return;
      if (points.length < 2) {
        points.push(pos); draw();
        if (points.length === 1) updateInstructions('Click a second point to complete the reference line.');
        if (points.length === 2) {
          updateInstructions('Enter the known length and click <strong>Set</strong>. Drag endpoints to adjust.');
          updateSetButton();
        }
      }
      return;
    }

    // ---- Measure mode ----
    if (mode === 'measure') {
      const isH = perspEnabled && planeCalibrated && measureMode === 'height';

      if (points.length < 2) {
        points.push(pos); draw();
        if (points.length === 1) {
          updateInstructions(isH
            ? 'Click the <strong>top</strong> of the object to measure its height.'
            : 'Click a second point to complete the measurement.');
        }
        if (points.length === 2) {
          if (isH) {
            const proj = projectOntoVertical(points[0], points[1], camera.Vz);
            points[1] = proj;                     // snap to vertical
            const h = solveHeight(points[0], proj);
            if (h !== null) showResult(h, planeUnit, true);
            updateInstructions('Height shown. Click to start a new measurement, or drag endpoints.');
          } else {
            const realLen = computeDistance(points[0], points[1]) / scale;
            const unit = planeCalibrated ? planeUnit : (refReal ? refReal.unit : '');
            showResult(realLen, unit, false);
            updateInstructions('Measurement shown. Click to start a new measurement, or drag endpoints.');
          }
          draw();
        }
      } else {
        // New measurement — save old
        saveMeasurement();
        points = [pos];
        resultBar.classList.add('hidden');
        updateInstructions(isH
          ? 'Click the <strong>base</strong> of the object on the ground plane.'
          : 'Click a second point to complete the measurement.');
        draw();
      }
    }
  });

  function updateLiveResult() {
    if (mode !== 'measure' || points.length !== 2) return;
    const isH = perspEnabled && planeCalibrated && measureMode === 'height';
    if (isH && camera) {
      const proj = projectOntoVertical(points[0], points[1], camera.Vz);
      const h = solveHeight(points[0], proj);
      if (h !== null) showResult(h, planeUnit, true);
    } else {
      const unit = planeCalibrated ? planeUnit : (refReal ? refReal.unit : '');
      const realLen = computeDistance(points[0], points[1]) / scale;
      showResult(realLen, unit, false);
    }
  }

  // ================================================================
  //  REFERENCE / PLANE CALIBRATION
  // ================================================================
  refValue.addEventListener('input', updateSetButton);
  planeWInput.addEventListener('input', updatePlaneButton);
  planeDInput.addEventListener('input', updatePlaneButton);

  function updateSetButton() {
    const hasLine = points.length === 2;
    const hasVal  = refValue.value && parseFloat(refValue.value) > 0;
    btnSetRef.disabled = !(hasLine && hasVal);
  }

  function updatePlaneButton() {
    const w = parseFloat(planeWInput.value);
    const d = parseFloat(planeDInput.value);
    btnSetPlane.disabled = !(w > 0 && d > 0);
  }

  btnSetRef.addEventListener('click', () => {
    if (points.length !== 2) return;
    const val = parseFloat(refValue.value);
    if (!val || val <= 0) return;
    refLine = { p1: points[0], p2: points[1] };
    refReal = { value: val, unit: refUnit.value };
    scale = computeDistance(refLine.p1, refLine.p2) / val;
    outputUnitSel.value = refUnit.value;
    points = [];
    enterMeasureMode();
    draw();
  });

  btnSetPlane.addEventListener('click', () => {
    const w = parseFloat(planeWInput.value);
    const d = parseFloat(planeDInput.value);
    if (!w || !d || w <= 0 || d <= 0) return;
    planeW = w; planeD = d;
    planeUnit = planeUnitSel.value;
    planeCalibrated = true;
    scale = 1;
    refReal = { value: null, unit: planeUnit };
    outputUnitSel.value = planeUnit;
    updateHomography();
    planeInput.classList.add('hidden');
    measureModes.classList.remove('hidden');
    enterMeasureMode();
    draw();
  });

  function enterMeasureMode() {
    mode = 'measure'; points = [];
    btnRef.classList.remove('active'); btnRef.classList.add('done');
    btnMeasure.disabled = false; btnMeasure.classList.add('active');
    refInput.classList.add('hidden');
    planeInput.classList.add('hidden');
    if (perspEnabled && planeCalibrated) {
      measureModes.classList.remove('hidden');
    }
    updateInstructions();
  }

  // ================================================================
  //  MODE SWITCHING
  // ================================================================
  btnRef.addEventListener('click', () => {
    if (mode === 'reference') return;
    if (points.length === 2) saveMeasurement();
    mode = 'reference'; points = [];
    resultBar.classList.add('hidden');
    measureModes.classList.add('hidden');

    if (perspEnabled) {
      // Re-enter plane calibration
      planeCalibrated = false; calibH = null; camera = null;
      planeInput.classList.remove('hidden');
      refLabel.textContent = 'Plane Size';
    } else {
      const oldRef = refLine;
      refLine = null; refReal = null;
      refInput.classList.remove('hidden');
      refLabel.textContent = 'Reference';
      points = oldRef ? [oldRef.p1, oldRef.p2] : [];
    }
    btnRef.classList.add('active'); btnRef.classList.remove('done');
    btnMeasure.classList.remove('active'); btnMeasure.disabled = true;
    updateHomography();
    updateInstructions();
    draw();
  });

  btnMeasure.addEventListener('click', () => {
    if (mode === 'measure') return;
    if (!perspEnabled && !refLine) return;
    if (perspEnabled && !planeCalibrated) return;
    mode = 'measure';
    if (points.length === 2) saveMeasurement();
    points = [];
    btnMeasure.classList.add('active'); btnRef.classList.remove('active');
    resultBar.classList.add('hidden');
    refInput.classList.add('hidden');
    planeInput.classList.add('hidden');
    if (perspEnabled && planeCalibrated) measureModes.classList.remove('hidden');
    updateInstructions();
    draw();
  });

  btnModeSurf.addEventListener('click', () => {
    if (measureMode === 'surface') return;
    measureMode = 'surface';
    btnModeSurf.classList.add('active'); btnModeHeight.classList.remove('active');
    if (points.length === 2) saveMeasurement();
    points = []; resultBar.classList.add('hidden');
    updateInstructions(); draw();
  });

  btnModeHeight.addEventListener('click', () => {
    if (measureMode === 'height') return;
    measureMode = 'height';
    btnModeHeight.classList.add('active'); btnModeSurf.classList.remove('active');
    if (points.length === 2) saveMeasurement();
    points = []; resultBar.classList.add('hidden');
    updateInstructions(); draw();
  });

  // ================================================================
  //  RESULTS & HISTORY
  // ================================================================
  function showResult(realLen, unit, isHeight) {
    const converted = convert(realLen, unit, outUnit());
    resultValue.textContent = formatNum(converted);
    outputUnitSel.value = outUnit();
    resultBadge.innerHTML = isHeight
      ? '<span class="badge badge-height">height</span>'
      : (perspEnabled ? '<span class="badge badge-persp">perspective</span>' : '');
    resultBar.classList.remove('hidden', 'has-persp', 'has-height');
    if (isHeight) resultBar.classList.add('has-height');
    else if (perspEnabled) resultBar.classList.add('has-persp');
  }

  function saveMeasurement() {
    if (points.length !== 2) return;
    const isH = perspEnabled && planeCalibrated && measureMode === 'height';
    const unit = planeCalibrated ? planeUnit : (refReal ? refReal.unit : '');
    let realLen;
    if (isH) {
      realLen = solveHeight(points[0], points[1]);
      if (realLen === null) realLen = 0;
    } else {
      realLen = computeDistance(points[0], points[1]) / scale;
    }
    measurements.push({
      p1: {...points[0]}, p2: {...points[1]},
      type: isH ? 'height' : 'surface',
      realLen, unit
    });
    renderHistory();
  }

  function renderHistory() {
    if (!measurements.length) { historyPanel.classList.add('hidden'); return; }
    historyPanel.classList.remove('hidden');
    historyList.innerHTML = '';
    const ou = outUnit();
    measurements.forEach((m, i) => {
      const li = document.createElement('li');
      const typeLabel = m.type === 'height'
        ? '<span class="measurement-type type-height">height</span>'
        : (perspEnabled ? '<span class="measurement-type type-surface">surface</span>' : '');
      const valClass = m.type === 'height' ? 'measurement-val height-val' : 'measurement-val';
      const converted = convert(m.realLen, m.unit, ou);
      li.innerHTML = `
        <span>#${i+1} ${typeLabel}</span>
        <span class="${valClass}">${formatNum(converted)} ${unitLabel(ou)}</span>
      `;
      historyList.appendChild(li);
    });
  }

  btnClearHist.addEventListener('click', () => {
    measurements = [];
    renderHistory();
    draw();
  });

  // ================================================================
  //  HELPERS
  // ================================================================
  function pdist(a, b) { return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2); }
  function lerp2(a, b, t) { return { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t }; }

  function formatNum(n) {
    if (n >= 100)  return n.toFixed(1);
    if (n >= 10)   return n.toFixed(2);
    if (n >= 1)    return n.toFixed(3);
    return n.toPrecision(4);
  }

  function unitLabel(u) {
    return { in:'in', ft:'ft', yd:'yd', mi:'mi', mm:'mm', cm:'cm', m:'m', km:'km' }[u] || u;
  }

  function srcUnit() {
    return planeCalibrated ? planeUnit : (refReal ? refReal.unit : 'ft');
  }

  function outUnit() { return outputUnitSel.value; }

  function displayVal(rawValue, fromUnit) {
    return convert(rawValue, fromUnit || srcUnit(), outUnit());
  }

  function updateInstructions(html) {
    if (!html) {
      if (perspEnabled && !planeCalibrated && mode === 'reference') {
        html = 'Drag the <strong style="color:#fb923c">orange corners</strong> to match a rectangular surface. Enter its <strong>Width</strong> (TL→TR) and <strong>Depth</strong> (TL→BL).';
      } else if (!perspEnabled && mode === 'reference') {
        html = 'Click two points to set a <strong>reference line</strong> of known length.';
      } else if (mode === 'measure' && perspEnabled && planeCalibrated && measureMode === 'height') {
        html = 'Click the <strong>base</strong> of an object on the ground, then its <strong>top</strong>.';
      } else {
        html = 'Click two points to measure a distance.';
      }
    }
    if (perspEnabled && !html.includes('orange corner')) {
      const tag = planeCalibrated
        ? (measureMode === 'height'
            ? '<span style="color:#22d3ee;font-weight:600">Height Mode</span>'
            : '<span style="color:#fb923c;font-weight:600">Perspective ON</span>')
        : '<span style="color:#fb923c;font-weight:600">Perspective</span>';
      html = tag + ' &mdash; ' + html;
    }
    instructions.innerHTML = html;
  }

  // ================================================================
  //  OUTPUT UNIT
  // ================================================================
  outputUnitSel.addEventListener('change', () => {
    draw();
    renderHistory();
    // Refresh the live result if one is showing
    if (!resultBar.classList.contains('hidden') && mode === 'measure' && points.length === 2) {
      updateLiveResult();
    }
  });

  // ================================================================
  //  KEYBOARD & RESIZE
  // ================================================================
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      points = [];
      resultBar.classList.add('hidden');
      updateInstructions(); draw();
    }
    if (e.key === 'z' && (e.metaKey || e.ctrlKey) && points.length > 0) {
      points.pop(); draw();
    }
  });

  window.addEventListener('resize', () => {
    if (!img) return;
    const ow = canvas.width, oh = canvas.height;
    sizeCanvas();
    const sx = canvas.width/ow, sy = canvas.height/oh;
    const rs = p => ({ x:p.x*sx, y:p.y*sy });
    points = points.map(rs);
    if (refLine) { refLine.p1 = rs(refLine.p1); refLine.p2 = rs(refLine.p2); }
    if (perspCorners) perspCorners = perspCorners.map(rs);
    measurements = measurements.map(m => ({ ...m, p1:rs(m.p1), p2:rs(m.p2) }));
    updateHomography();
    recalibrateAll();
    draw();
  });
})();
