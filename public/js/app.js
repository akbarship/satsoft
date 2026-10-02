/* =====================================================================
   Bluebook replica — application logic
   Flow: Start Code → RW M1 → RW M2 → 10-min break → Math M1 → Math M2 → Done
   All progress is persisted to localStorage so a refresh never loses the test.
   ===================================================================== */
(() => {
  'use strict';

  const CFG = window.SAT_CONFIG;
  const MODS = CFG.modules;
  const LETTERS = ['A', 'B', 'C', 'D'];
  // Personal test page: /2222 → student 2222 (registered on the operator page).
  const STUDENT_ID = (location.pathname.match(/^\/(\d{3,8})\/?$/) || [])[1] || null;

  // Remember the last personal page opened on this device, so the bare site address
  // (or an app installed from it) goes straight back to it.
  // "/?forget" clears it. The server's invalid-link page clears it too.
  const LS_REMEMBERED = 'bb.student';
  const bootParams = new URLSearchParams(location.search);
  try {
    if (STUDENT_ID) {
      localStorage.setItem(LS_REMEMBERED, STUDENT_ID);
    } else if (bootParams.has('forget')) {
      localStorage.removeItem(LS_REMEMBERED);
      history.replaceState(null, '', '/');
    } else {
      const remembered = localStorage.getItem(LS_REMEMBERED);
      if (remembered && /^\d{3,8}$/.test(remembered)) {
        location.replace(`/${remembered}${location.search}`);
        return;
      }
    }
  } catch { /* storage blocked: behave like a normal page */ }
  // Progress is stored per student so a shared computer never mixes two students' tests.
  const LS_SUFFIX = STUDENT_ID ? `.${STUDENT_ID}` : '';
  const LS_STATE = 'bb.state.v1' + LS_SUFFIX;
  const LS_QUESTIONS = 'bb.questions.v1' + LS_SUFFIX;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ------------------------------------------------------------------ */
  /* State                                                              */
  /* ------------------------------------------------------------------ */

  const freshState = () => ({
    phase: 'code',          // code | exam | transition | break | resume | done
    view: 'question',       // question | review   (inside exam)
    token: null,
    code: '',
    name: '',
    mi: 0,                  // module index into MODS
    qi: 0,                  // question index
    endAt: 0,
    breakEndAt: 0,
    transitionUntil: 0,
    answers: {},            // answers[mi][qi] = 'A' | '3.5'
    marked: {},             // marked[mi][qi] = true
    crossed: {},            // crossed[mi][qi] = ['A', 'C']
    hl: {},                 // hl[mi][qi][key] = html (highlights)
    notes: {},              // notes[mi][qi][highlightId] = text
    warned: {},             // warned[mi] = true once the 5-min warning fired
    elim: false,
    timerHidden: false,
    calcState: null,
    submitted: false,
  });

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage full / blocked */ } },
    clear() { try { localStorage.removeItem(LS_STATE); localStorage.removeItem(LS_QUESTIONS); } catch { /* ignore */ } },
  };

  const params = new URLSearchParams(location.search);
  if (params.has('reset')) {
    store.clear();
    params.delete('reset');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : ''));
  }

  let S = Object.assign(freshState(), store.get(LS_STATE) || {});
  let Q = store.get(LS_QUESTIONS);
  if (S.phase !== 'code' && !Q) S = freshState();
  if (!STUDENT_ID && params.get('name')) S.name = params.get('name').slice(0, 80);
  if (!S.name && !STUDENT_ID) S.name = CFG.studentName || '';

  /* The operator may rename a student at any time, so always ask the server. */
  if (STUDENT_ID) {
    fetch(`/api/student/${STUDENT_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.name) return;
        S.name = data.name;
        save();
        setName();
      })
      .catch(() => { /* offline: keep the cached name */ });
  }

  const save = () => store.set(LS_STATE, S);
  const bucket = (obj, mi) => (obj[mi] ||= {});

  const mod = () => MODS[S.mi];
  const isMath = () => mod().key === 'math';
  const list = () => (Q && Q[mod().key] && Q[mod().key][mod().part]) || [];
  const question = () => list()[S.qi];
  const answerOf = (qi = S.qi) => (S.answers[S.mi] || {})[qi];
  const isAnswered = (qi) => answerOf(qi) != null && answerOf(qi) !== '';
  const isMarked = (qi = S.qi) => !!(S.marked[S.mi] || {})[qi];
  const crossedOf = (qi = S.qi) => (S.crossed[S.mi] || {})[qi] || [];
  const sectionTitle = (m = mod()) => `Section ${m.section}, Module ${m.module}: ${m.title}`;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  const fmt = (sec) => {
    sec = Math.max(0, sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
  };
  const secondsLeft = (t) => Math.max(0, Math.ceil((t - Date.now()) / 1000));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function renderMath(el) {
    if (!el || typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(el, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });
  }

  let toastTimer;
  function toast(msg, ms = 3200) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  /* Confetti on the finish screen: bursts from the left and right edges, like confetti cannons,
     then flutters down. Pieces pass behind the card. Reduced motion shows a still scatter. */
  const confetti = (() => {
    const host = $('#confetti');
    const COLORS = ['#fedb00', '#fedb00', '#f28fad', '#f28fad', '#8fe3f2', '#b7a8f5', '#ffffff'];
    const POOL = 180, PER_BURST = 70, GRAVITY = 520, DRAG = 1.9;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pieces = [];
    let raf = 0, last = 0, nextBurst = 0, volley = 0;

    if (host) {
      for (let n = 0; n < POOL; n++) {
        const el = document.createElement('i');
        const kind = Math.random();
        if (kind < 0.18) el.className = 'dot';
        else if (kind < 0.26) el.className = 'line';
        el.style.setProperty('--s', rnd(6, 10).toFixed(1) + 'px');
        el.style.setProperty('--c', el.className === 'line' ? '#8a93c9' : COLORS[Math.floor(Math.random() * COLORS.length)]);
        host.appendChild(el);
        pieces.push({ el, live: false });
      }
    }

    function burst(fromLeft) {
      const w = innerWidth, h = innerHeight;
      let fired = 0;
      for (const p of pieces) {
        if (p.live) continue;
        if (fired++ >= PER_BURST) break;
        // Shoot up and inward from low on the side edge.
        const angle = rnd(20, 70) * Math.PI / 180;
        const speed = rnd(0.55, 1.25) * Math.max(h, 500) * 1.6;
        p.x = fromLeft ? -10 : w + 10;
        p.y = h * rnd(0.55, 0.8);
        p.vx = Math.cos(angle) * speed * (fromLeft ? 1 : -1);
        p.vy = -Math.sin(angle) * speed;
        p.rot = rnd(0, 360); p.vrot = rnd(-540, 540);
        p.flip = rnd(0, 360); p.vflip = rnd(360, 900);
        p.sway = rnd(0, Math.PI * 2); p.swayAmp = rnd(15, 45);
        p.live = true;
      }
    }

    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - (last || t)) / 1000);
      last = t;
      if (t >= nextBurst) {
        // First volley fires from both sides at once, then the sides take turns.
        if (volley === 0) { burst(true); burst(false); } else burst(volley % 2 === 1);
        volley++;
        nextBurst = t + 2600;
      }
      const h = innerHeight;
      for (const p of pieces) {
        if (!p.live) continue;
        const k = Math.exp(-DRAG * dt);
        p.vx *= k; p.vy = p.vy * k + GRAVITY * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vrot * dt; p.flip += p.vflip * dt; p.sway += dt * 3;
        if (p.y > h + 30) { p.live = false; p.el.style.transform = 'translate3d(-100px,-100px,0)'; continue; }
        const x = p.x + Math.sin(p.sway) * p.swayAmp * Math.min(1, Math.max(0, p.vy) / 200);
        p.el.style.transform = `translate3d(${x.toFixed(1)}px,${p.y.toFixed(1)}px,0) rotate(${p.rot.toFixed(0)}deg) rotateX(${p.flip.toFixed(0)}deg)`;
      }
    }

    function scatter() {
      for (const p of pieces) {
        p.el.style.transform = `translate3d(${rnd(0, innerWidth).toFixed(0)}px,${rnd(0, innerHeight).toFixed(0)}px,0) rotate(${rnd(0, 360).toFixed(0)}deg)`;
      }
    }

    return {
      start() {
        if (!host || raf) return;
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { scatter(); return; }
        last = 0; nextBurst = 0; volley = 0;
        raf = requestAnimationFrame(frame);
      },
      stop() {
        if (!raf) return;
        cancelAnimationFrame(raf); raf = 0;
        for (const p of pieces) { p.live = false; p.el.style.transform = 'translate3d(-100px,-100px,0)'; }
      },
    };
  })();

  function show(id) {
    $$('.screen').forEach((s) => { s.hidden = s.id !== id; });
    if (id === 'screen-done') confetti.start(); else confetti.stop();
  }

  function setName() {
    $('#student-name').textContent = S.name;
    $$('[data-name]').forEach((el) => { el.textContent = S.name; });
  }

  /* ------------------------------------------------------------------ */
  /* Router                                                             */
  /* ------------------------------------------------------------------ */

  let transitionTimer;

  function route() {
    clearTimeout(transitionTimer);
    setName();
    switch (S.phase) {
      case 'code':
        show('screen-code');
        setTimeout(() => $('.code-box').focus(), 30);
        break;
      case 'exam':
        show('screen-exam');
        renderExam();
        break;
      case 'transition':
        show('screen-transition');
        transitionTimer = setTimeout(() => startModule(S.mi + 1), Math.max(0, S.transitionUntil - Date.now()));
        break;
      case 'break':
        show('screen-break');
        $('#break-time').textContent = fmt(secondsLeft(S.breakEndAt));
        break;
      case 'resume':
        show('screen-resume');
        setTimeout(() => $('#resume-btn').focus(), 30);
        break;
      case 'done':
        show('screen-done');
        submitResults();
        break;
    }
    onTick();
  }

  function startModule(mi) {
    closeAllOverlays();
    S.mi = mi;
    S.qi = 0;
    S.view = 'question';
    S.phase = 'exam';
    S.endAt = Date.now() + mod().minutes * 60 * 1000;
    save();
    route();
    if (mod().module === 1) openDirections();
  }

  function endModule() {
    closeAllOverlays();
    if (S.mi === 1) {
      S.phase = 'break';
      S.breakEndAt = Date.now() + CFG.breakMinutes * 60 * 1000;
    } else if (S.mi >= MODS.length - 1) {
      S.phase = 'done';
    } else {
      S.phase = 'transition';
      S.transitionUntil = Date.now() + CFG.transitionSeconds * 1000;
    }
    save();
    route();
  }

  /* ------------------------------------------------------------------ */
  /* Clock                                                              */
  /* ------------------------------------------------------------------ */

  function onTick() {
    if (S.phase === 'exam') {
      const left = secondsLeft(S.endAt);
      $('#timer-text').textContent = fmt(left);
      const warn = left <= CFG.warnAtSeconds;
      $('#timer').classList.toggle('is-warning', warn);
      if (warn && !S.warned[S.mi]) {
        S.warned[S.mi] = true;
        if (S.timerHidden) setTimerHidden(false);
        save();
        if (left > 0) toast(`${Math.ceil(left / 60)} minutes remaining in this module.`);
      }
      if (left <= 0) endModule();
    } else if (S.phase === 'break') {
      const left = secondsLeft(S.breakEndAt);
      $('#break-time').textContent = fmt(left);
      if (left <= 0) { S.phase = 'resume'; save(); route(); }
    }
  }
  setInterval(onTick, 250);

  /* Testing aid: a "Skip" button that ends the current module / break right away.
     Enabled with ?skiptimer on localhost, or everywhere with allowSkipTimer: true in config.js. */
  const SKIP_TIMER = CFG.allowSkipTimer === true
    || (['localhost', '127.0.0.1', '::1'].includes(location.hostname) && params.has('skiptimer'));
  if (SKIP_TIMER) {
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = 'Skip ⏭';
    skip.title = 'Testing only: end this module / break now';
    skip.style.cssText = 'position:fixed;right:12px;bottom:72px;z-index:9999;padding:8px 14px;border-radius:20px;border:1px solid #b00;background:#fff3f3;color:#b00;font:600 13px system-ui;cursor:pointer;display:none';
    skip.addEventListener('click', () => {
      if (S.phase === 'exam') S.endAt = Date.now();
      else if (S.phase === 'break') S.breakEndAt = Date.now();
      onTick();
    });
    document.body.appendChild(skip);
    setInterval(() => { skip.style.display = ['exam', 'break'].includes(S.phase) ? 'block' : 'none'; }, 250);
  }

  function setTimerHidden(hidden) {
    S.timerHidden = hidden;
    $('#timer').classList.toggle('is-hidden', hidden);
    $('#timer-hide').textContent = hidden ? 'Show' : 'Hide';
    save();
  }

  /* ------------------------------------------------------------------ */
  /* Start code screen                                                  */
  /* ------------------------------------------------------------------ */

  const boxes = $$('.code-box');
  const codeValue = () => boxes.map((b) => b.value).join('');
  const updateReady = () => $('#code-start').classList.toggle('is-ready', /^\d{6}$/.test(codeValue()));

  function setCodeError(msg) {
    $('#code-error').textContent = msg || '';
    boxes.forEach((b) => b.classList.toggle('is-error', !!msg));
    updateReady();
  }

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      const digits = box.value.replace(/\D/g, '');
      if (digits.length > 1) {                     // paste / autofill into one box
        spreadDigits(digits, i);
        return;
      }
      box.value = digits;
      setCodeError('');
      if (digits && i < boxes.length - 1) boxes[i + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('#code-form').requestSubmit();
      } else if (e.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].value = '';
        updateReady();
        boxes[i - 1].focus();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && i > 0) {
        boxes[i - 1].focus(); e.preventDefault();
      } else if (e.key === 'ArrowRight' && i < boxes.length - 1) {
        boxes[i + 1].focus(); e.preventDefault();
      } else if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    });
    box.addEventListener('focus', () => box.select());
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      spreadDigits((e.clipboardData.getData('text') || '').replace(/\D/g, ''), i);
    });
  });

  function spreadDigits(digits, from) {
    let i = from;
    for (const d of digits) {
      if (i >= boxes.length) break;
      boxes[i++].value = d;
    }
    setCodeError('');
    boxes[Math.min(i, boxes.length - 1)].focus();
  }

  $('#code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeValue();
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Enter all 6 digits of your start code.');
      boxes[Math.max(0, boxes.findIndex((b) => !b.value))].focus();
      return;
    }
    const btn = $('#code-start');
    btn.disabled = true;
    setCodeError('');
    document.documentElement.requestFullscreen?.().catch(() => {});
    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, studentId: STUDENT_ID, name: S.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to verify start code. Please try again.');
      Q = data.questions;
      store.set(LS_QUESTIONS, Q);
      const name = data.name || S.name;
      S = freshState();
      S.name = name;
      S.token = data.token;
      S.code = code;
      startModule(0);
    } catch (err) {
      setCodeError(err.message === 'Failed to fetch' ? 'No connection. Check your network and try again.' : err.message);
    } finally {
      btn.disabled = false;
    }
  });

  /* ------------------------------------------------------------------ */
  /* Exam rendering                                                     */
  /* ------------------------------------------------------------------ */

  const DIRECTIONS = {
    english: `
      <p>The questions in this section address a number of important reading and writing skills. Each question includes one or more passages, which may include a table or graph. Read each passage and question carefully, and then choose the best answer to the question based on the passage(s).</p>
      <p>All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.</p>`,
    math: `
      <p>The questions in this section address a number of important math skills.</p>
      <p>Use of a calculator is permitted for all questions. A reference sheet, calculator, and these directions can be accessed throughout the test.</p>
      <p>Unless otherwise indicated:</p>
      <ul>
        <li>All variables and expressions represent real numbers.</li>
        <li>Figures provided are drawn to scale.</li>
        <li>All figures lie in a plane.</li>
        <li>The domain of a given function \\(f\\) is the set of all real numbers \\(x\\) for which \\(f(x)\\) is a real number.</li>
      </ul>
      <p>For <b>multiple-choice questions</b>, solve each problem and choose the correct answer from the choices provided. Each multiple-choice question has a single correct answer.</p>
      <p>For <b>student-produced response questions</b>, solve each problem and enter your answer as described below.</p>
      <ul>
        <li>If you find <b>more than one correct answer</b>, enter only one answer.</li>
        <li>You can enter up to 5 characters for a <b>positive</b> answer and up to 6 characters (including the negative sign) for a <b>negative</b> answer.</li>
        <li>If your answer is a <b>fraction</b> that doesn’t fit in the provided space, enter the decimal equivalent.</li>
        <li>If your answer is a <b>decimal</b> that doesn’t fit in the provided space, enter it by truncating or rounding at the fourth digit.</li>
        <li>If your answer is a <b>mixed number</b> (such as \\(3\\tfrac{1}{2}\\)), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).</li>
        <li>Don’t enter <b>symbols</b> such as a percent sign, comma, or dollar sign.</li>
      </ul>
      ${sprExamplesTable()}`,
  };

  function sprExamplesTable() {
    return `
      <table>
        <caption>Examples</caption>
        <thead><tr><th>Answer</th><th>Acceptable ways to enter answer</th><th>Unacceptable: will NOT receive credit</th></tr></thead>
        <tbody>
          <tr><td>3.5</td><td>3.5<br>3.50<br>7/2</td><td>31/2<br>3 1/2</td></tr>
          <tr><td>\\(\\frac{2}{3}\\)</td><td>2/3<br>.6666<br>.6667<br>0.666<br>0.667</td><td>0.66<br>.66<br>0.67<br>.67</td></tr>
          <tr><td>\\(-\\frac{1}{3}\\)</td><td>-1/3<br>-.3333<br>-0.333</td><td>-.33<br>-0.33</td></tr>
        </tbody>
      </table>`;
  }

  function sprDirectionsHTML() {
    return `
      <div class="spr-dir">
        <h2>Student-produced response directions</h2>
        <ul>
          <li>If you find <b>more than one correct answer</b>, enter only one answer.</li>
          <li>You can enter up to 5 characters for a <b>positive</b> answer and up to 6 characters (including the negative sign) for a <b>negative</b> answer.</li>
          <li>If your answer is a <b>fraction</b> that doesn’t fit in the provided space, enter the decimal equivalent.</li>
          <li>If your answer is a <b>decimal</b> that doesn’t fit in the provided space, enter it by truncating or rounding at the fourth digit.</li>
          <li>If your answer is a <b>mixed number</b> (such as \\(3\\tfrac{1}{2}\\)), enter it as an improper fraction (7/2) or its decimal equivalent (3.5).</li>
          <li>Don’t enter <b>symbols</b> such as a percent sign, comma, or dollar sign.</li>
        </ul>
        ${sprExamplesTable()}
      </div>`;
  }

  let splitLeft = 50;   // percentage width of the left pane, kept across questions

  function renderExam() {
    const m = mod();
    $('#hdr-title').textContent = sectionTitle(m);
    $$('.tool[data-section]').forEach((t) => { t.hidden = t.dataset.section !== m.key; });
    $('#timer').classList.toggle('is-hidden', S.timerHidden);
    $('#timer-hide').textContent = S.timerHidden ? 'Show' : 'Hide';
    if (m.key !== 'math') { $('#calc-win').hidden = true; $('#ref-win').hidden = true; }
    syncToolState();
    if (S.view === 'review') renderReview();
    else renderQuestion();
  }

  function renderQuestion() {
    const q = question();
    const total = list().length;
    const body = $('#exam-body');
    if (!q) { body.innerHTML = ''; return; }

    $('#navpill').hidden = false;
    $('#navpill-text').textContent = `Question ${S.qi + 1} of ${total}`;
    $('#btn-back').hidden = S.qi === 0;
    $('#btn-next').hidden = false;

    const qHTML = questionHTML(q);
    if (!isMath()) {
      body.innerHTML = splitHTML(
        `<div class="passage" data-hl-key="p">${hlOr('p', q.passage || '')}</div>`, qHTML);
    } else if (q.type === 'spr') {
      body.innerHTML = splitHTML(sprDirectionsHTML(), qHTML);
    } else {
      body.innerHTML = `<div class="single"><div class="single__inner">${qHTML}</div></div>`;
    }
    window.fillIcons(body);
    renderMath(body);
    if (q.type === 'spr') updateSprPreview();
  }

  function hlOr(key, html) {
    const saved = ((S.hl[S.mi] || {})[S.qi] || {})[key];
    return saved != null ? saved : html;
  }

  function splitHTML(left, right) {
    return `
      <div class="split" style="--left:${splitLeft}%">
        <div class="pane pane--left">
          <div class="pane__inner">${left}</div>
        </div>
        <div class="divider" data-act="divider"><span class="divider__grip">${window.icon('grip')}</span></div>
        <div class="pane pane--right">
          <div class="pane__inner">${right}</div>
        </div>
      </div>`;
  }

  function questionHTML(q) {
    const marked = isMarked();
    const isSpr = q.type === 'spr';
    const bar = `
      <div class="qbar">
        <span class="qbar__num">${S.qi + 1}</span>
        <button class="qbar__mark ${marked ? 'is-on' : ''}" type="button" data-act="mark" aria-pressed="${marked}">
          <span class="ico" data-icon="${marked ? 'bookmarkFill' : 'bookmark'}"></span><span>Mark for Review</span>
        </button>
        ${isSpr ? '' : `<button class="qbar__elim ${S.elim ? 'is-on' : ''}" type="button" data-act="elim" aria-pressed="${S.elim}" title="Cross out answer choices"><span class="ico" data-icon="abc"></span></button>`}
      </div>`;

    const figure = isMath() && (q.passage || q.image)
      ? `<div class="qfigure">${q.passage || ''}${q.image ? `<img src="${esc(q.image)}" alt="">` : ''}</div>` : '';
    const prompt = `<div class="qprompt" ${isMath() ? '' : 'data-hl-key="q"'}>${isMath() ? q.prompt : hlOr('q', q.prompt || '')}</div>`;

    if (isSpr) {
      const val = answerOf() || '';
      return `${bar}${figure}${prompt}
        <input class="spr-input" id="spr-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${esc(val)}" aria-label="Your answer">
        <div class="spr-preview">Answer Preview: <span id="spr-preview"></span></div>`;
    }

    const selected = answerOf();
    const crossed = crossedOf();
    const rows = (q.choices || []).map((text, i) => {
      const L = LETTERS[i];
      const isX = crossed.includes(L);
      const ctl = !S.elim ? '' : isX
        ? `<button class="cross-undo" type="button" data-act="uncross" data-letter="${L}">Undo</button>`
        : `<button class="cross" type="button" data-act="cross" data-letter="${L}" aria-label="Cross out choice ${L}">${L}</button>`;
      return `
        <div class="choice-row">
          <button class="choice ${selected === L ? 'is-selected' : ''} ${isX ? 'is-crossed' : ''}" type="button" data-act="choose" data-letter="${L}" aria-pressed="${selected === L}">
            <span class="choice__letter">${L}</span><span class="choice__text">${text}</span>
          </button>${ctl}
        </div>`;
    }).join('');
    return `${bar}${figure}${prompt}<div class="choices">${rows}</div>`;
  }

  function renderReview() {
    const m = mod();
    $('#navpill').hidden = true;
    $('#btn-back').hidden = false;
    $('#btn-next').hidden = true;
    $('#exam-body').innerHTML = `
      <div class="review"><div class="review__inner">
        <h1>Check Your Work</h1>
        <p>You’ll move on to the next module automatically when time runs out.</p>
        <div class="review__card">
          <div class="review__head">
            <h2>${esc(sectionTitle(m))} Questions</h2>
            ${legendHTML()}
          </div>
          <div class="qgrid">${gridHTML(false)}</div>
        </div>
      </div></div>`;
    window.fillIcons($('#exam-body'));
  }

  function legendHTML() {
    return `<div class="legend">
      <span><span class="ico legend__pin" data-icon="pin"></span>Current</span>
      <span><span class="legend__box"></span>Unanswered</span>
      <span><span class="ico legend__flag" data-icon="bookmarkFill"></span>For Review</span>
    </div>`;
  }

  function gridHTML(showCurrent) {
    return list().map((_, i) => {
      const cur = showCurrent && i === S.qi;
      return `<button class="qcell ${isAnswered(i) ? 'is-answered' : ''} ${cur ? 'is-current' : ''}" type="button" data-goto="${i}" aria-label="Question ${i + 1}">
        ${cur ? '<span class="ico qcell__pin" data-icon="pin"></span>' : ''}
        ${isMarked(i) ? '<span class="ico qcell__flag" data-icon="bookmarkFill"></span>' : ''}
        ${i + 1}
      </button>`;
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Exam interactions                                                  */
  /* ------------------------------------------------------------------ */

  function goTo(qi) {
    closeNavpop();
    closeNote();
    S.view = 'question';
    S.qi = Math.max(0, Math.min(list().length - 1, qi));
    save();
    renderExam();
  }

  function next() {
    if (S.view === 'review') return;   // modules only end when the clock runs out
    if (S.qi < list().length - 1) goTo(S.qi + 1);
    else { closeNavpop(); S.view = 'review'; save(); renderExam(); }
  }

  function back() {
    if (S.view === 'review') { goTo(list().length - 1); return; }
    if (S.qi > 0) goTo(S.qi - 1);
  }

  function choose(L) {
    const ans = bucket(S.answers, S.mi);
    const crossed = bucket(S.crossed, S.mi);
    if ((crossed[S.qi] || []).includes(L)) crossed[S.qi] = crossed[S.qi].filter((x) => x !== L);
    ans[S.qi] = L;
    save();
    renderQuestion();
  }

  function cross(L, on) {
    const crossed = bucket(S.crossed, S.mi);
    const cur = new Set(crossed[S.qi] || []);
    if (on) {
      cur.add(L);
      const ans = bucket(S.answers, S.mi);
      if (ans[S.qi] === L) delete ans[S.qi];
    } else {
      cur.delete(L);
    }
    crossed[S.qi] = [...cur];
    save();
    renderQuestion();
  }

  function toggleMark() {
    const m = bucket(S.marked, S.mi);
    if (m[S.qi]) delete m[S.qi]; else m[S.qi] = true;
    save();
    renderQuestion();
  }

  $('#exam-body').addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) { goTo(Number(goto.dataset.goto)); return; }

    const mark = e.target.closest('mark.hl');
    if (mark && window.getSelection().isCollapsed) { openNote(mark); return; }

    const el = e.target.closest('[data-act]');
    if (!el) return;
    const L = el.dataset.letter;
    switch (el.dataset.act) {
      case 'choose': choose(L); break;
      case 'cross': cross(L, true); break;
      case 'uncross': cross(L, false); break;
      case 'mark': toggleMark(); break;
      case 'elim': S.elim = !S.elim; save(); renderQuestion(); break;
    }
  });

  /* student-produced response input */
  $('#exam-body').addEventListener('input', (e) => {
    if (e.target.id !== 'spr-input') return;
    const inp = e.target;
    let v = inp.value.replace(/[^0-9./-]/g, '');
    v = v.replace(/(?!^)-/g, '');                         // minus only as first char
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    const firstSlash = v.indexOf('/');
    if (firstSlash !== -1) v = v.slice(0, firstSlash + 1) + v.slice(firstSlash + 1).replace(/\//g, '');
    v = v.slice(0, v.startsWith('-') ? 6 : 5);
    if (inp.value !== v) inp.value = v;
    const ans = bucket(S.answers, S.mi);
    if (v) ans[S.qi] = v; else delete ans[S.qi];
    save();
    updateSprPreview();
  });

  function updateSprPreview() {
    const inp = $('#spr-input'), out = $('#spr-preview');
    if (!inp || !out) return;
    const v = inp.value;
    let tex = '';
    if (v) {
      const neg = v.startsWith('-');
      const body = neg ? v.slice(1) : v;
      const [a, b] = body.split('/');
      tex = (neg ? '-' : '') + (body.includes('/') ? `\\frac{${a || '\\square'}}{${b || '\\square'}}` : body);
    }
    if (window.katex && tex) window.katex.render(tex, out, { throwOnError: false });
    else out.textContent = v;
  }

  /* split pane resizing */
  function setSplit(pct) {
    splitLeft = Math.max(25, Math.min(75, pct));
    const split = $('.split');
    if (split) split.style.setProperty('--left', splitLeft + '%');
  }

  $('#exam-body').addEventListener('pointerdown', (e) => {
    const div = e.target.closest('.divider');
    if (!div) return;
    e.preventDefault();
    const split = div.parentElement;
    const rect = split.getBoundingClientRect();
    split.classList.add('is-dragging');
    div.classList.add('is-drag');
    const move = (ev) => setSplit(((ev.clientX - rect.left) / rect.width) * 100);
    const up = () => {
      split.classList.remove('is-dragging');
      div.classList.remove('is-drag');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  /* ------------------------------------------------------------------ */
  /* Highlights & Notes                                                 */
  /* ------------------------------------------------------------------ */

  let noteId = null;   // id of the highlight whose note editor is open

  const notesOf = () => (S.notes[S.mi] || {})[S.qi] || {};
  const newId = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function saveHighlight(container) {
    const byQ = bucket(S.hl, S.mi);
    (byQ[S.qi] ||= {})[container.dataset.hlKey] = container.innerHTML;
    save();
  }

  function openNote(markEl) {
    if (!markEl.dataset.id) {                       // highlights saved before notes existed
      markEl.dataset.id = newId();
      saveHighlight(markEl.closest('[data-hl-key]'));
    }
    noteId = markEl.dataset.id;
    $$('mark.hl.is-active').forEach((m) => m.classList.remove('is-active'));
    markEl.classList.add('is-active');
    const text = markEl.textContent.trim().replace(/\s+/g, ' ');
    $('#note-quote').textContent = `“${text.length > 90 ? text.slice(0, 90) + '…' : text}”`;
    $('#note-text').value = notesOf()[noteId] || '';
    $('#note-panel').hidden = false;
    $('#note-text').focus();
  }

  function closeNote() {
    $('#note-panel').hidden = true;
    $$('mark.hl.is-active').forEach((m) => m.classList.remove('is-active'));
    noteId = null;
  }

  const activeMark = () => (noteId ? $(`mark.hl[data-id="${noteId}"]`) : null);

  $('#note-save').addEventListener('click', () => {
    const markEl = activeMark();
    if (!markEl) { closeNote(); return; }
    const text = $('#note-text').value.trim();
    const byQ = bucket(S.notes, S.mi);
    const notes = (byQ[S.qi] ||= {});
    if (text) notes[noteId] = text; else delete notes[noteId];
    markEl.classList.toggle('has-note', !!text);
    markEl.classList.remove('is-active');
    saveHighlight(markEl.closest('[data-hl-key]'));
    closeNote();
  });

  $('#note-delete').addEventListener('click', () => {
    const markEl = activeMark();
    if (markEl) removeHighlight(markEl);
    closeNote();
  });

  $('#note-close').addEventListener('click', closeNote);

  function annotate() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      toast('Select text in the passage or question to highlight it or add a note.');
      return;
    }
    const range = sel.getRangeAt(0);
    const start = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement).closest('[data-hl-key]');
    const end = (range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement).closest('[data-hl-key]');
    if (!start || start !== end) {
      toast('Select text within a single passage or question to highlight it.');
      return;
    }
    const markEl = document.createElement('mark');
    markEl.className = 'hl';
    markEl.dataset.id = newId();
    markEl.appendChild(range.extractContents());
    range.insertNode(markEl);
    sel.removeAllRanges();
    start.normalize();
    saveHighlight(start);
    openNote(markEl);
  }

  function removeHighlight(markEl) {
    const container = markEl.closest('[data-hl-key]');
    const notes = (S.notes[S.mi] || {})[S.qi];
    if (notes && markEl.dataset.id) delete notes[markEl.dataset.id];
    markEl.replaceWith(...markEl.childNodes);
    container.normalize();
    saveHighlight(container);
  }

  const annotateBtn = $('#tool-annotate');
  annotateBtn.addEventListener('mousedown', (e) => e.preventDefault()); // keep the text selection
  annotateBtn.addEventListener('click', annotate);

  /* ------------------------------------------------------------------ */
  /* Header / footer controls                                           */
  /* ------------------------------------------------------------------ */

  $('#timer-hide').addEventListener('click', () => setTimerHidden(!S.timerHidden));
  $('#btn-next').addEventListener('click', next);
  $('#btn-back').addEventListener('click', back);

  /* directions */
  function openDirections() {
    closeNavpop();
    closeMenu();
    const body = $('#dir-body');
    body.innerHTML = DIRECTIONS[mod().key];
    renderMath(body);
    $('#dir-panel').hidden = false;
    $('#dir-scrim').hidden = false;
    $('#dir-toggle').setAttribute('aria-expanded', 'true');
    $('#dir-close').focus();
  }
  function closeDirections() {
    $('#dir-panel').hidden = true;
    $('#dir-scrim').hidden = true;
    $('#dir-toggle').setAttribute('aria-expanded', 'false');
  }
  $('#dir-toggle').addEventListener('click', () => ($('#dir-panel').hidden ? openDirections() : closeDirections()));
  $('#dir-close').addEventListener('click', closeDirections);
  $('#dir-scrim').addEventListener('click', closeDirections);

  /* question navigator */
  function openNavpop() {
    closeMenu();
    $('#navpop-title').textContent = `${sectionTitle()} Questions`;
    const grid = $('#navpop-grid');
    grid.innerHTML = gridHTML(true);
    window.fillIcons(grid);
    $('#navpop').hidden = false;
    $('#navpill').setAttribute('aria-expanded', 'true');
  }
  function closeNavpop() {
    $('#navpop').hidden = true;
    $('#navpill').setAttribute('aria-expanded', 'false');
  }
  $('#navpill').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#navpop').hidden ? openNavpop() : closeNavpop();
  });
  $('#navpop-close').addEventListener('click', closeNavpop);
  $('#navpop-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]');
    if (b) goTo(Number(b.dataset.goto));
  });
  $('#navpop-review').addEventListener('click', () => {
    closeNavpop();
    S.view = 'review';
    save();
    renderExam();
  });

  /* more menu */
  function closeMenu() {
    $('#more-menu').hidden = true;
    $('#tool-more').setAttribute('aria-expanded', 'false');
  }
  $('#tool-more').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('#more-menu');
    menu.hidden = !menu.hidden;
    $('#tool-more').setAttribute('aria-expanded', String(!menu.hidden));
  });
  $('#more-menu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    closeMenu();
    if (b.dataset.action === 'help') openDirections();
    if (b.dataset.action === 'shortcuts') openModal('shortcuts-modal');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#more-menu, #tool-more')) closeMenu();
    if (!$('#navpop').hidden && !e.target.closest('#navpop, #navpill')) closeNavpop();
  });

  function closeAllOverlays() {
    closeNote();
    closeDirections();
    closeNavpop();
    closeMenu();
    $('#calc-win').hidden = true;
    $('#ref-win').hidden = true;
    syncToolState();
  }

  /* ------------------------------------------------------------------ */
  /* Floating windows (calculator, reference sheet)                     */
  /* ------------------------------------------------------------------ */

  function clampWin(win) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = win.getBoundingClientRect();
    const left = Math.min(Math.max(0, r.left), Math.max(0, vw - 80));
    const top = Math.min(Math.max(0, r.top), Math.max(0, vh - 40));
    win.style.left = left + 'px';
    win.style.top = top + 'px';
  }

  $$('.floatwin').forEach((win) => {
    const bar = $('[data-drag]', win);
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      const r = win.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      win.classList.add('is-moving');
      bar.setPointerCapture(e.pointerId);
      const move = (ev) => {
        win.style.left = Math.min(Math.max(0, ev.clientX - dx), window.innerWidth - 80) + 'px';
        win.style.top = Math.min(Math.max(0, ev.clientY - dy), window.innerHeight - 40) + 'px';
      };
      const up = () => {
        win.classList.remove('is-moving');
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
    });

    const grip = $('[data-resize]', win);
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = win.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY;
      win.classList.add('is-moving');
      grip.setPointerCapture(e.pointerId);
      const move = (ev) => {
        win.style.width = Math.min(window.innerWidth - r.left, Math.max(300, r.width + ev.clientX - sx)) + 'px';
        win.style.height = Math.min(window.innerHeight - r.top, Math.max(220, r.height + ev.clientY - sy)) + 'px';
      };
      const up = () => {
        win.classList.remove('is-moving');
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        if (win.id === 'calc-win') resizeCalc();
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  });

  $$('[data-close]').forEach((b) => b.addEventListener('click', () => {
    $('#' + b.dataset.close).hidden = true;
    syncToolState();
  }));

  window.addEventListener('resize', () => $$('.floatwin').forEach((w) => { if (!w.hidden) clampWin(w); }));

  function syncToolState() {
    $('#tool-calc').classList.toggle('is-active', !$('#calc-win').hidden);
    $('#tool-ref').classList.toggle('is-active', !$('#ref-win').hidden);
  }

  /* ---------------------------- Desmos ------------------------------ */

  let calculator = null;
  let desmosLoading = null;

  function loadDesmos() {
    if (window.Desmos) return Promise.resolve();
    if (desmosLoading) return desmosLoading;
    desmosLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.desmos.com/api/v1.9/calculator.js?apiKey=${encodeURIComponent(CFG.desmosApiKey)}`;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { desmosLoading = null; reject(new Error('Desmos failed to load')); };
      document.head.appendChild(s);
    });
    return desmosLoading;
  }

  function resizeCalc() { if (calculator && calculator.resize) calculator.resize(); }

  let calcSaveTimer;
  async function openCalculator() {
    const win = $('#calc-win');
    if (!win.style.width) {
      const top = $('.hdr').getBoundingClientRect().bottom + 10;
      win.style.left = '16px';
      win.style.top = top + 'px';
      win.style.width = Math.min(460, window.innerWidth - 32) + 'px';
      win.style.height = Math.max(320, window.innerHeight - top - 90) + 'px';
    }
    win.hidden = false;
    clampWin(win);
    syncToolState();
    if (calculator) { resizeCalc(); return; }
    const host = $('#calc-host');
    try {
      await loadDesmos();
      host.innerHTML = '';
      calculator = window.Desmos.GraphingCalculator(host, {
        keypad: true,
        expressions: true,
        settingsMenu: true,
        zoomButtons: true,
        expressionsTopbar: true,
        pointsOfInterest: true,
        trace: true,
        border: false,
        images: false,
        folders: false,
        notes: false,
        links: false,
        distributions: true,
      });
      if (S.calcState) { try { calculator.setState(S.calcState); } catch { /* stale state */ } }
      calculator.observeEvent('change', () => {
        clearTimeout(calcSaveTimer);
        calcSaveTimer = setTimeout(() => { S.calcState = calculator.getState(); save(); }, 600);
      });
    } catch {
      host.innerHTML = '<p class="calc__loading">The calculator could not load. Check your internet connection and try again.</p>';
    }
  }

  $('#tool-calc').addEventListener('click', () => {
    const win = $('#calc-win');
    if (win.hidden) openCalculator();
    else { win.hidden = true; syncToolState(); }
  });

  $('#calc-expand').addEventListener('click', () => {
    const win = $('#calc-win');
    const expanded = win.classList.toggle('is-expanded');
    const r = win.getBoundingClientRect();
    const w = expanded ? Math.min(window.innerWidth - r.left - 16, Math.max(760, window.innerWidth * 0.62)) : Math.min(460, window.innerWidth - 32);
    win.style.width = w + 'px';
    const ico = $('#calc-expand .ico');
    ico.dataset.icon = expanded ? 'collapse' : 'expand';
    ico.innerHTML = window.icon(ico.dataset.icon);
    $('#calc-expand').setAttribute('aria-label', expanded ? 'Collapse' : 'Expand');
    clampWin(win);
    resizeCalc();
  });

  /* ------------------------- Reference sheet ------------------------ */

  const REF_ITEMS = [
    ['circle', String.raw`\(A = \pi r^2\)<br>\(C = 2\pi r\)`],
    ['rect', String.raw`\(A = \ell w\)`],
    ['tri', String.raw`\(A = \tfrac{1}{2} bh\)`],
    ['right', String.raw`\(c^2 = a^2 + b^2\)`],
    ['t3060', 'Special Right Triangles'],
    ['t45', ''],
    ['box', String.raw`\(V = \ell wh\)`],
    ['cyl', String.raw`\(V = \pi r^2 h\)`],
    ['sphere', String.raw`\(V = \tfrac{4}{3}\pi r^3\)`],
    ['cone', String.raw`\(V = \tfrac{1}{3}\pi r^2 h\)`],
    ['pyr', String.raw`\(V = \tfrac{1}{3}\ell wh\)`],
  ];

  const T = (x, y, t, extra = '') => `<text x="${x}" y="${y}" font-family="'Noto Serif',Georgia,serif" font-style="italic" font-size="12" fill="#1e1e1e" ${extra}>${t}</text>`;
  const SVG = (body) => `<svg viewBox="0 0 120 86" fill="none" stroke="#1e1e1e" stroke-width="1.3">${body}</svg>`;
  const FIG = {
    circle: SVG(`<circle cx="60" cy="43" r="34"/><circle cx="60" cy="43" r="1.8" fill="#1e1e1e"/><path d="M60 43h34"/>${T(74, 39, 'r', 'stroke="none"')}`),
    rect: SVG(`<rect x="18" y="20" width="84" height="46"/>${T(56, 80, 'ℓ', 'stroke="none"')}${T(106, 47, 'w', 'stroke="none"')}`),
    tri: SVG(`<path d="M12 70h96L44 14z"/><path d="M44 14v56" stroke-dasharray="3 2"/><path d="M44 64h6v6"/>${T(56, 83, 'b', 'stroke="none"')}${T(34, 48, 'h', 'stroke="none"')}`),
    right: SVG(`<path d="M22 70h78L22 16z"/><path d="M22 62h8v8"/>${T(56, 83, 'a', 'stroke="none"')}${T(10, 47, 'b', 'stroke="none"')}${T(64, 38, 'c', 'stroke="none"')}`),
    t3060: SVG(`<path d="M20 70h46L20 12z"/><path d="M20 62h8v8"/><text x="37" y="82" font-family="'Noto Serif',Georgia,serif" font-style="italic" font-size="11" fill="#1e1e1e" stroke="none">x</text><text x="46" y="38" font-family="'Noto Serif',Georgia,serif" font-style="italic" font-size="11" fill="#1e1e1e" stroke="none">2x</text><text x="0" y="44" font-family="'Noto Serif',Georgia,serif" font-style="italic" font-size="10" fill="#1e1e1e" stroke="none">x√3</text><text x="23" y="26" font-family="Roboto,Arial" font-size="9" fill="#1e1e1e" stroke="none">30°</text><text x="48" y="67" font-family="Roboto,Arial" font-size="9" fill="#1e1e1e" stroke="none">60°</text>`),
    t45: SVG(`<path d="M30 70h52L30 18z"/><path d="M30 62h8v8"/><text x="52" y="82" font-family="'Noto Serif',Georgia,serif" font-style="italic" font-size="11" fill="#1e1e1e" stroke="none">s</text><text x="20" y="48" font-family="'Noto Serif',Georgia,serif" font-style="italic" font-size="11" fill="#1e1e1e" stroke="none">s</text><text x="60" y="40" font-family="'Noto Serif',Georgia,serif" font-style="italic" font-size="10" fill="#1e1e1e" stroke="none">s√2</text><text x="33" y="34" font-family="Roboto,Arial" font-size="9" fill="#1e1e1e" stroke="none">45°</text><text x="60" y="67" font-family="Roboto,Arial" font-size="9" fill="#1e1e1e" stroke="none">45°</text>`),
    box: SVG(`<path d="M16 34h66v40H16zM16 34l20-18h66L82 34M102 16v40L82 74"/><path d="M16 74l20-18h66M36 16v40" stroke-dasharray="3 2"/>${T(46, 85, 'ℓ', 'stroke="none"')}${T(93, 72, 'w', 'stroke="none"')}${T(5, 58, 'h', 'stroke="none"')}`),
    cyl: SVG(`<ellipse cx="60" cy="16" rx="30" ry="8"/><path d="M30 16v54M90 16v54"/><path d="M30 70a30 8 0 0 0 60 0"/><path d="M30 70a30 8 0 0 1 60 0" stroke-dasharray="3 2"/><path d="M60 16h30"/><circle cx="60" cy="16" r="1.6" fill="#1e1e1e"/>${T(72, 13, 'r', 'stroke="none"')}${T(94, 47, 'h', 'stroke="none"')}`),
    sphere: SVG(`<circle cx="60" cy="43" r="34"/><path d="M26 43a34 9 0 0 0 68 0"/><path d="M26 43a34 9 0 0 1 68 0" stroke-dasharray="3 2"/><path d="M60 43h34"/><circle cx="60" cy="43" r="1.6" fill="#1e1e1e"/>${T(74, 39, 'r', 'stroke="none"')}`),
    cone: SVG(`<path d="M28 68L60 8l32 60"/><path d="M28 68a32 8 0 0 0 64 0"/><path d="M28 68a32 8 0 0 1 64 0" stroke-dasharray="3 2"/><path d="M60 8v60M60 68h32" stroke-dasharray="3 2"/><circle cx="60" cy="68" r="1.6" fill="#1e1e1e"/>${T(74, 64, 'r', 'stroke="none"')}${T(50, 46, 'h', 'stroke="none"')}`),
    pyr: SVG(`<path d="M18 70h60l24-16M18 70l42-62 18 62M60 8l42 46"/><path d="M18 70l24-16h60M60 8l-18 46" stroke-dasharray="3 2"/><path d="M60 8v54" stroke-dasharray="3 2"/>${T(44, 83, 'ℓ', 'stroke="none"')}${T(94, 70, 'w', 'stroke="none"')}${T(63, 44, 'h', 'stroke="none"')}`),
  };

  function buildReference() {
    const body = $('#ref-body');
    if (body.childElementCount) return;
    body.innerHTML = `
      <div class="ref-grid">${REF_ITEMS.map(([k, cap]) => `<div class="ref-item">${FIG[k]}<div>${cap}</div></div>`).join('')}</div>
      <p>The number of degrees of arc in a circle is 360.</p>
      <p>The number of radians of arc in a circle is \\(2\\pi\\).</p>
      <p>The sum of the measures in degrees of the angles of a triangle is 180.</p>`;
    renderMath(body);
  }

  $('#tool-ref').addEventListener('click', () => {
    const win = $('#ref-win');
    if (!win.hidden) { win.hidden = true; syncToolState(); return; }
    buildReference();
    if (!win.style.width) {
      const top = $('.hdr').getBoundingClientRect().bottom + 10;
      const w = Math.min(560, window.innerWidth - 32);
      win.style.width = w + 'px';
      win.style.height = Math.min(620, window.innerHeight - top - 90) + 'px';
      win.style.left = (window.innerWidth - w - 16) + 'px';
      win.style.top = top + 'px';
    }
    win.hidden = false;
    clampWin(win);
    syncToolState();
  });

  $('#ref-collapse').addEventListener('click', () => {
    const win = $('#ref-win');
    const collapsed = win.classList.toggle('is-collapsed');
    const ico = $('#ref-collapse .ico');
    ico.dataset.icon = collapsed ? 'expand' : 'minimize';
    ico.innerHTML = window.icon(ico.dataset.icon);
    $('#ref-collapse').setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
  });

  /* ------------------------------------------------------------------ */
  /* Break                                                              */
  /* ------------------------------------------------------------------ */

  // The break is mandatory: when it ends the Resume Testing screen appears.
  $('#resume-btn').addEventListener('click', () => startModule(2));

  /* ------------------------------------------------------------------ */
  /* Results                                                            */
  /* ------------------------------------------------------------------ */

  let submitting = false;
  let retryTimer;
  async function submitResults() {
    if (S.submitted || submitting) return;
    submitting = true;
    clearTimeout(retryTimer);
    $('#done-status').textContent = '';
    try {
      const res = await fetch('/api/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: S.token, studentId: STUDENT_ID, code: S.code, name: S.name, answers: S.answers }),
      });
      if (!res.ok) throw new Error('submit failed');
      S.submitted = true;
      save();
    } catch {
      $('#done-status').textContent = 'Saving your results… please keep this screen open.';
      retryTimer = setTimeout(submitResults, 10000);
    } finally {
      submitting = false;
    }
  }

  /* Back to the start-code screen, but never before the results reached the server. */
  $('#done-home').addEventListener('click', () => {
    if (!S.submitted) {
      $('#done-status').textContent = 'Saving your results… please wait a moment and try again.';
      submitResults();
      return;
    }
    store.clear();
    location.reload();
  });

  /* ------------------------------------------------------------------ */
  /* Modals                                                             */
  /* ------------------------------------------------------------------ */

  function openModal(id) { $('#' + id).hidden = false; $('#' + id + ' [data-close-modal]').focus(); }
  $$('[data-open]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); openModal(el.dataset.open); }));
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close-modal]')) m.hidden = true; });
  });

  /* ------------------------------------------------------------------ */
  /* Keyboard, lockdown, battery                                        */
  /* ------------------------------------------------------------------ */

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal').forEach((m) => { m.hidden = true; });
      if (S.phase === 'exam') { closeNote(); closeDirections(); closeNavpop(); closeMenu(); }
      return;
    }
    if (S.phase !== 'exam' || !e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    else if (S.view === 'question' && k === 'r') { e.preventDefault(); toggleMark(); }
    else if (S.view === 'question' && ['a', 'b', 'c', 'd'].includes(k) && question() && question().type !== 'spr') {
      e.preventDefault();
      choose(k.toUpperCase());
    }
  });

  // Exam lockdown: no copying of test content, no context menu.
  const inExam = () => S.phase !== 'code';
  ['copy', 'cut'].forEach((ev) => document.addEventListener(ev, (e) => {
    if (inExam() && !e.target.closest?.('.calc__host, input')) e.preventDefault();
  }));
  document.addEventListener('contextmenu', (e) => { if (inExam()) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => { if (inExam() && !e.target.closest?.('.calc__host')) e.preventDefault(); });

  window.addEventListener('beforeunload', (e) => {
    if (['exam', 'break', 'resume', 'transition'].includes(S.phase)) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      const update = () => {
        const pct = Math.round(b.level * 100) + '%';
        $$('#battery, [data-battery]').forEach((el) => {
          el.hidden = false;
          const txt = el.querySelector('#battery-pct, [data-battery-pct]');
          if (txt) txt.textContent = pct;
          const lvl = el.querySelector('.bat-lvl');
          if (lvl) lvl.setAttribute('width', String(17 * b.level));
        });
      };
      update();
      b.addEventListener('levelchange', update);
    }).catch(() => {});
  }

  /* ------------------------------------------------------------------ */
  route();
})();
