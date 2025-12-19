(() => {
  const stage = document.getElementById('stage');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const slideSel = document.getElementById('slideSel');
  const resetBtn = document.getElementById('resetBtn');

  const STORAGE_KEY = "bolme_interaktif_v4";
  const slides = [];
  const slideCount = window.__SLIDE_COUNT__;

  // Inject slide SVGs
  for (let i = 1; i <= slideCount; i++) {
    const div = document.createElement('div');
    div.className = 'slide';
    div.dataset.index = String(i);
    div.innerHTML = window.__SLIDES__[i-1];
    stage.appendChild(div);
    slides.push(div);

    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    slideSel.appendChild(opt);
  }

  // Only allow specific object images to be draggable (background and other elements stay fixed)
  const ALLOWED_IMG = new Set([
    "assets/img_53333020a2a1ef9d.png", // domates
    "assets/img_a77009837b387304.png", // çay bardağı
    "assets/img_5eb1fa520e64589f.png", // meyve suyu kutusu
    "assets/img_9e93314a18620270.jpg", // başarı kartı
    "assets/img_3dda82c92eff83e7.png", // çiçek (gül)
    "assets/img_3570cc34f507fb1f.png", // oyuncak araba
    "assets/img_03a4aa8ba383b71c.png", // kitap
    "assets/img_0472034875b14435.png", // kitap
    "assets/img_08d21f3b4eb981b6.png", // kitap
    "assets/img_4bbb478a45c8ff3b.png", // kitap
    "assets/img_4fad987a7d891617.png", // kitap
    "assets/img_85921a4198646d09.png", // kitap
    "assets/img_9e8973eabf79c164.png", // kitap
    "assets/img_ac83f0aece6e0b78.png", // kitap
    "assets/img_e0d040ab9892073f.png", // kitap
  ]);

  function markDraggables() {
    slides.forEach(slideDiv => {
      const svg = slideDiv.querySelector('svg');
      if (!svg) return;
      svg.querySelectorAll('g.shape.draggable').forEach(g => {
        // Default: not draggable
        g.classList.remove('draggable');

        // Allow if this group contains an <image> that matches allowed assets
        const imgs = g.querySelectorAll('image');
        for (const img of imgs) {
          const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
          if (ALLOWED_IMG.has(href)) {
            g.classList.add('draggable');
            break;
          }
        }
      });
    });
  }


  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  }
  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  let state = loadState(); // { slideIndex: { sid: {dx,dy} } }
  let current = 1;

  function clampSlide(n) { return Math.max(1, Math.min(slideCount, n)); }

  function applySavedPositions(slideIndex) {
    const slideDiv = slides[slideIndex-1];
    const svg = slideDiv.querySelector('svg');
    const map = state[String(slideIndex)] || {};
    svg.querySelectorAll('g.shape.draggable').forEach(g => {
      const sid = g.dataset.sid;
      const dxdy = map[sid];
      const baseX = parseFloat(g.dataset.x);
      const baseY = parseFloat(g.dataset.y);
      const w = parseFloat(g.dataset.w);
      const h = parseFloat(g.dataset.h);
      const rot = parseFloat(g.dataset.rot || "0");

      const dx = dxdy ? dxdy.dx : 0;
      const dy = dxdy ? dxdy.dy : 0;

      const parts = [`translate(${baseX + dx} ${baseY + dy})`];
      if (rot) parts.push(`rotate(${rot} ${w/2} ${h/2})`);
      g.setAttribute('transform', parts.join(' '));
    });
  }

  function showSlide(n) {
    current = clampSlide(n);
    slides.forEach(s => s.classList.remove('active'));
    slides[current-1].classList.add('active');
    slideSel.value = String(current);

    prevBtn.disabled = current === 1;
    nextBtn.disabled = current === slideCount;

    applySavedPositions(current);
  }

  prevBtn.addEventListener('click', () => showSlide(current - 1));
  nextBtn.addEventListener('click', () => showSlide(current + 1));
  slideSel.addEventListener('change', () => showSlide(parseInt(slideSel.value, 10)));

  resetBtn.addEventListener('click', () => {
    // Reset only current slide
    delete state[String(current)];
    saveState(state);
    applySavedPositions(current);
  });

  function clientToSvg(svg, clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return {x:0,y:0};
    const inv = ctm.inverse();
    const p = pt.matrixTransform(inv);
    return { x: p.x, y: p.y };
  }

  let dragging = null;
  function onPointerDown(e) {
    const g = e.target.closest('g.shape');
    if (!g) return;
    const slideDiv = e.target.closest('.slide');
    if (!slideDiv || !slideDiv.classList.contains('active')) return;

    const isDraggable = g.classList.contains('draggable');
    if (!isDraggable) return;

    const svg = slideDiv.querySelector('svg');
    const sid = g.dataset.sid;
    const slideIndex = slideDiv.dataset.index;

    // Bring to front
    g.parentNode.appendChild(g);

    const baseX = parseFloat(g.dataset.x);
    const baseY = parseFloat(g.dataset.y);

    const map = state[slideIndex] || (state[slideIndex] = {});
    const dxdy = map[sid] || (map[sid] = { dx: 0, dy: 0 });

    const p = clientToSvg(svg, e.clientX, e.clientY);
    dragging = {
      g, svg, sid, slideIndex,
      startPx: p.x, startPy: p.y,
      startDx: dxdy.dx, startDy: dxdy.dy,
      baseX, baseY
    };

    g.classList.add('dragging');
    g.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const { g, svg, startPx, startPy, startDx, startDy, baseX, baseY } = dragging;

    const p = clientToSvg(svg, e.clientX, e.clientY);
    const dx = startDx + (p.x - startPx);
    const dy = startDy + (p.y - startPy);

    // Update transform
    const w = parseFloat(g.dataset.w);
    const h = parseFloat(g.dataset.h);
    const rot = parseFloat(g.dataset.rot || "0");

    const parts = [`translate(${baseX + dx} ${baseY + dy})`];
    if (rot) parts.push(`rotate(${rot} ${w/2} ${h/2})`);
    g.setAttribute('transform', parts.join(' '));

    // Persist
    const map = state[dragging.slideIndex] || (state[dragging.slideIndex] = {});
    map[dragging.sid] = { dx, dy };
    saveState(state);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging.g.classList.remove('dragging');
    dragging = null;
  }

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') showSlide(current - 1);
    if (e.key === 'ArrowRight') showSlide(current + 1);
  });

  markDraggables();
  showSlide(1);
})();
