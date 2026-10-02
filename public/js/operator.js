/* Operator panel: sign in, create / rename / delete student pages, watch status and scores. */
(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const ORIGIN = location.origin;
  const REFRESH_MS = 15000;

  let students = [];
  let refreshTimer = null;
  let justCreated = null;

  /* ------------------------------ helpers ----------------------------- */

  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/api/op/login') { showLogin(); throw new Error('Your session has ended. Please sign in again.'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  const linkOf = (id) => `${ORIGIN}/${id}`;

  const fmtDate = (iso) => iso
    ? new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'icon') { node.innerHTML = window.icon(v); }
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  const iconSpan = (name) => el('span', { class: 'ico', icon: name });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = el('textarea', { style: 'position:fixed;opacity:0' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  /* ------------------------------- views ------------------------------ */

  function showLogin() {
    clearInterval(refreshTimer);
    $('#view-app').hidden = true;
    $('#view-login').hidden = false;
    $('#login-pass').value = '';
    $('#login-name').focus();
  }

  function showApp(login) {
    $('#me').textContent = login;
    $('#example-link').textContent = linkOf('2222');
    $('#view-login').hidden = true;
    $('#view-app').hidden = false;
    loadStudents();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => { if (!document.hidden) loadStudents(); }, REFRESH_MS);
    $('#add-name').focus();
  }

  /* ------------------------------- login ------------------------------ */

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = $('#login-name').value.trim();
    const password = $('#login-pass').value;
    $('#login-error').textContent = '';
    if (!login || !password) { $('#login-error').textContent = 'Enter your login and password.'; return; }
    const btn = $('#login-btn');
    btn.disabled = true;
    try {
      const data = await api('/api/op/login', { method: 'POST', body: { login, password } });
      showApp(data.login);
    } catch (err) {
      $('#login-error').textContent = err.message;
      $('#login-pass').select();
    } finally {
      btn.disabled = false;
    }
  });

  $('#logout').addEventListener('click', async () => {
    await api('/api/op/logout', { method: 'POST', body: {} }).catch(() => {});
    showLogin();
  });

  /* ------------------------------ students ---------------------------- */

  async function loadStudents() {
    try {
      const data = await api('/api/op/students');
      students = data.students;
      render();
    } catch (err) {
      if (!$('#view-app').hidden) toast(err.message);
    }
  }

  function statusCell(s) {
    const r = s.lastResult;
    const started = s.lastStart && s.lastStart.at;
    if (r && (!started || r.finishedAt >= started)) {
      return el('td', {}, el('span', { class: 'status status--done', text: 'Finished' }),
        el('span', { class: 'sub', text: `${fmtDate(r.finishedAt)} · code ${r.code}` }));
    }
    if (started) {
      return el('td', {}, el('span', { class: 'status status--live', text: 'In progress' }),
        el('span', { class: 'sub', text: `${fmtDate(started)} · code ${s.lastStart.code}` }));
    }
    return el('td', {}, el('span', { class: 'status status--idle', text: 'Not started' }));
  }

  function resultCell(s) {
    const r = s.lastResult;
    if (!r) return el('td', { class: 'muted', text: '—' });
    const total = r.rw.correct + r.math.correct;
    const max = r.rw.total + r.math.total;
    return el('td', {},
      el('span', { class: 'score', text: `${total} / ${max}` }),
      el('span', { class: 'sub', text: `R&W ${r.rw.correct}/${r.rw.total} · Math ${r.math.correct}/${r.math.total}${s.attempts > 1 ? ` · ${s.attempts} attempts` : ''}` }));
  }

  function row(s) {
    const link = linkOf(s.id);
    const copyBtn = el('button', { class: 'icon-btn', type: 'button', title: 'Copy link' }, iconSpan('copy'), 'Copy');
    copyBtn.addEventListener('click', async () => { await copyText(link); toast(`Link for ${s.name} copied`); });

    const editBtn = el('button', { class: 'icon-btn', type: 'button' }, iconSpan('edit'), 'Rename');
    editBtn.addEventListener('click', () => openEdit(s));
    const delBtn = el('button', { class: 'icon-btn icon-btn--danger', type: 'button' }, iconSpan('trash'), 'Delete');
    delBtn.addEventListener('click', () => openDelete(s));

    const tr = el('tr', {},
      el('td', {}, el('span', { class: 'pid', text: s.id })),
      el('td', {}, el('span', { class: 'sname', text: s.name })),
      el('td', {}, el('div', { class: 'link-cell' },
        el('a', { href: link, target: '_blank', rel: 'noopener', text: link.replace(/^https?:\/\//, '') }),
        copyBtn)),
      statusCell(s),
      resultCell(s),
      el('td', {}, el('div', { class: 'actions' }, editBtn, delBtn)),
    );
    if (s.id === justCreated) tr.classList.add('is-new');
    return tr;
  }

  function render() {
    const q = $('#search').value.trim().toLowerCase();
    const shown = students.filter((s) => !q || s.name.toLowerCase().includes(q) || s.id.includes(q));
    $('#rows').replaceChildren(...shown.map(row));
    $('#count').textContent = students.length ? `(${students.length})` : '';
    $('#empty').hidden = students.length > 0;
    if (students.length && !shown.length) {
      $('#rows').append(el('tr', {}, el('td', { colspan: '6', class: 'muted', text: 'No students match your search.' })));
    }
    justCreated = null;
  }

  $('#search').addEventListener('input', render);

  $('#add-id').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8); });

  $('#add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#add-name').value.trim();
    const id = $('#add-id').value.trim();
    $('#add-error').textContent = '';
    if (!name) { $('#add-error').textContent = 'Enter the student’s full name.'; $('#add-name').focus(); return; }
    if (id && id.length < 3) { $('#add-error').textContent = 'The page number must be 3–8 digits.'; $('#add-id').focus(); return; }
    const btn = $('#add-btn');
    btn.disabled = true;
    try {
      const { student } = await api('/api/op/students', { method: 'POST', body: { name, id: id || undefined } });
      justCreated = student.id;
      $('#add-name').value = '';
      $('#add-id').value = '';
      await copyText(linkOf(student.id));
      toast(`Page /${student.id} created for ${student.name} — link copied`);
      await loadStudents();
      $('#add-name').focus();
    } catch (err) {
      $('#add-error').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  /* ------------------------------- modals ----------------------------- */

  let editing = null;
  let deleting = null;

  function openModal(id) { $(id).hidden = false; }
  function closeModals() { document.querySelectorAll('.modal').forEach((m) => { m.hidden = true; }); editing = deleting = null; }

  document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-close]')) closeModals();
  }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

  function openEdit(s) {
    editing = s;
    $('#edit-id').textContent = `/${s.id}`;
    $('#edit-name').value = s.name;
    $('#edit-error').textContent = '';
    openModal('#edit-modal');
    $('#edit-name').select();
  }

  $('#edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editing) return;
    const name = $('#edit-name').value.trim();
    if (!name) { $('#edit-error').textContent = 'Enter the student’s full name.'; return; }
    try {
      await api(`/api/op/students/${editing.id}`, { method: 'PUT', body: { name } });
      closeModals();
      toast('Name updated');
      loadStudents();
    } catch (err) {
      $('#edit-error').textContent = err.message;
    }
  });

  function openDelete(s) {
    deleting = s;
    $('#delete-link').textContent = `/${s.id}`;
    $('#delete-name').textContent = s.name;
    openModal('#delete-modal');
    $('#delete-confirm').focus();
  }

  $('#delete-confirm').addEventListener('click', async () => {
    if (!deleting) return;
    const s = deleting;
    try {
      await api(`/api/op/students/${s.id}`, { method: 'DELETE', body: {} });
      closeModals();
      toast(`Page /${s.id} deleted`);
      loadStudents();
    } catch (err) {
      closeModals();
      toast(err.message);
    }
  });

  /* -------------------------------- boot ------------------------------ */

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const me = await api('/api/op/me');
      showApp(me.login);
    } catch {
      showLogin();
    }
  });
})();
