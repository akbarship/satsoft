/* Inline SVG icon set. Any element with data-icon="name" is filled on load; icon(name) returns markup. */
(function () {
  const s = (vb, body, extra = '') =>
    `<svg viewBox="${vb}" width="100%" height="100%" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;
  const stroke = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

  const ICONS = {
    help: s('0 0 24 24', `<circle cx="12" cy="12" r="10" ${stroke} stroke-width="1.8"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.5-2.8 4.2" ${stroke} stroke-width="1.8"/><circle cx="12" cy="17.6" r="1.1" fill="currentColor"/>`),
    copy: s('0 0 24 24', `<rect x="8.5" y="8.5" width="11" height="12" rx="1.6" ${stroke} stroke-width="1.8"/><path d="M15.5 8.5V5.2c0-.9-.7-1.7-1.6-1.7H6.2c-.9 0-1.7.8-1.7 1.7v9.6c0 .9.8 1.7 1.7 1.7h2.3" ${stroke} stroke-width="1.8"/>`),
    open: s('0 0 24 24', `<path d="M14 4h6v6M20 4l-9 9M18 14v4.5c0 .8-.7 1.5-1.5 1.5h-11c-.8 0-1.5-.7-1.5-1.5v-11C4 6.7 4.7 6 5.5 6H10" ${stroke} stroke-width="1.8"/>`),
    edit: s('0 0 24 24', `<path d="M15 4.5l4.5 4.5L9 19.5H4.5V15z" ${stroke} stroke-width="1.8"/>`),
    trash: s('0 0 24 24', `<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" ${stroke} stroke-width="1.8"/>`),
    grip: s('0 0 10 10', `<path d="M4 2 1 5l3 3zM6 2l3 3-3 3z" fill="currentColor"/>`),
    install: s('0 0 24 24', `<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M4.5 16.5v3h15v-3" ${stroke} stroke-width="1.8"/>`),
    home: s('0 0 24 24', `<path d="M3.5 11 12 3.8l8.5 7.2M5.8 9.2V20.3h12.4V9.2" ${stroke} stroke-width="1.7"/><path d="M10 20.3v-5.6h4v5.6" ${stroke} stroke-width="1.7"/>`),
    clipboard: s('0 0 48 56', `
      <rect x="6" y="8" width="36" height="44" rx="3" fill="#fff" stroke="#1e1e1e" stroke-width="2.4"/>
      <rect x="11" y="13" width="26" height="34" rx="1" fill="#fff" stroke="#1e1e1e" stroke-width="1.6"/>
      <path d="M17 4h14v8H17z" fill="#3b7de3" stroke="#1e1e1e" stroke-width="2"/>
      <path d="M20 21h12M20 27h12M20 33h12M20 39h12" stroke="#1e1e1e" stroke-width="1.6"/>
      <circle cx="16.5" cy="21" r="1.1" fill="#1e1e1e"/><circle cx="16.5" cy="27" r="1.1" fill="#1e1e1e"/>
      <circle cx="16.5" cy="33" r="1.1" fill="#1e1e1e"/><circle cx="16.5" cy="39" r="1.1" fill="#1e1e1e"/>`),
    chevronDown: s('0 0 24 24', `<path d="m5 8.5 7 7 7-7" ${stroke} stroke-width="2.6"/>`),
    chevronUp: s('0 0 24 24', `<path d="m5 15.5 7-7 7 7" ${stroke} stroke-width="2.6"/>`),
    clock: s('0 0 24 24', `<circle cx="12" cy="12" r="9" ${stroke} stroke-width="2"/><path d="M12 7v5.2l3.4 2" ${stroke} stroke-width="2"/>`),
    /* Material Symbols (Apache 2.0) sticky_note_2, weight 300 */
    notes: s('0 -960 960 960', `<path d="M197.69-185.39h376.92v-200h200v-376.92q0-5.38-3.46-8.84t-8.84-3.46H197.69q-5.38 0-8.84 3.46t-3.46 8.84v564.62q0 5.38 3.46 8.84t8.84 3.46Zm0 45.39q-23.59 0-40.64-17.05T140-197.69v-564.62q0-23.59 17.05-40.64T197.69-820h564.62q23.59 0 40.64 17.05T820-762.31v388.08L585.77-140H197.69Zm114.62-285.39v-45.38h160.38v45.38H312.31Zm0-159.23V-630h335.38v45.38H312.31ZM185.39-185.39v-589.22 589.22Z" fill="currentColor"/>`),
    /* Material Symbols (Apache 2.0) ink_highlighter, weight 300 */
    annotate: s('0 -960 960 960', `<path d="M551.31-411.23 439.38-523.15 225.46-309.62q-3.46 3.47-3.46 8.47t3.46 8.46l95 95q3.46 3.84 8.46 3.84 5 0 8.47-3.84l213.92-213.54ZM472-555.77l111.92 111.92 208.39-208.38q3.46-3.46 3.46-8.85 0-5.38-3.46-8.84l-94.23-94.23q-3.46-3.46-8.85-3.46-5.38 0-8.85 3.46L472-555.77Zm-48.61-16 176.53 176.54L376.69-172q-17.84 17.84-47.88 17.84-30.04 0-48.27-17.84l-11.39-11.77-48.38 48.38H98.08l109.23-109.23-5.54-5.92q-20.46-20.08-20.15-50.11.3-30.04 20.77-50.5l221-220.62Zm0 0 226.99-227q16.62-16.61 41.08-16.61 24.46 0 41.08 16.61L825.31-706q16.61 16.62 16.3 43-.3 26.38-16.92 43L599.92-395.23 423.39-571.77Z" fill="currentColor"/>`),
    calculator: s('0 0 24 24', `<rect x="5" y="2.5" width="14" height="19" rx="1.6" ${stroke} stroke-width="1.5"/><rect x="7.4" y="5" width="9.2" height="3.6" ${stroke} stroke-width="1.3"/>
      <g fill="currentColor"><rect x="7.4" y="10.6" width="2" height="1.8"/><rect x="11" y="10.6" width="2" height="1.8"/><rect x="14.6" y="10.6" width="2" height="1.8"/>
      <rect x="7.4" y="14" width="2" height="1.8"/><rect x="11" y="14" width="2" height="1.8"/><rect x="14.6" y="14" width="2" height="1.8"/>
      <rect x="7.4" y="17.4" width="2" height="1.8"/><rect x="11" y="17.4" width="2" height="1.8"/><rect x="14.6" y="17.4" width="2" height="1.8"/></g>`),
    reference: s('0 0 26 24', `<text x="1" y="20" font-family="'Noto Serif', Georgia, serif" font-style="italic" font-weight="700" font-size="21" fill="currentColor">x</text><text x="15.5" y="9" font-family="Roboto, Arial, sans-serif" font-weight="700" font-size="8" fill="currentColor">2</text>`),
    more: s('0 0 24 24', `<circle cx="12" cy="5" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="19" r="1.9" fill="currentColor"/>`),
    bookmark: s('0 0 24 24', `<path d="M6 2.8h12v18.6l-6-4.8-6 4.8z" ${stroke} stroke-width="1.6"/>`),
    bookmarkFill: s('0 0 24 24', `<path d="M6 2.8h12v18.6l-6-4.8-6 4.8z" fill="#c13145" stroke="#c13145" stroke-width="1.6" stroke-linejoin="round"/>`),
    abc: s('0 0 30 24', `<rect x="1" y="1" width="28" height="22" rx="4" ${stroke} stroke-width="1.5"/>
      <text x="15" y="16.3" text-anchor="middle" font-family="Roboto, Arial, sans-serif" font-weight="700" font-size="10" letter-spacing="-.3" fill="currentColor">ABC</text>
      <path d="M6.5 19.5 23.5 4.5" ${stroke} stroke-width="1.6"/>`),
    pin: s('0 0 24 24', `<path d="M12 22s7-7.1 7-12.3A7 7 0 0 0 5 9.7C5 14.9 12 22 12 22z" fill="currentColor"/><circle cx="12" cy="9.6" r="2.6" fill="#fff"/>`),
    close: s('0 0 24 24', `<path d="M5.5 5.5l13 13M18.5 5.5l-13 13" ${stroke} stroke-width="2.2"/>`),
    expand: s('0 0 24 24', `<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5" ${stroke} stroke-width="2"/>`),
    collapse: s('0 0 24 24', `<path d="M20 10h-6V4M4 14h6v6M14 10l6.5-6.5M10 14l-6.5 6.5" ${stroke} stroke-width="2"/>`),
    minimize: s('0 0 24 24', `<path d="M5 12h14" ${stroke} stroke-width="2.2"/>`),
    expandPaneR: s('0 0 24 24', `<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" ${stroke} stroke-width="1.5"/><path d="M12 3.5v17" ${stroke} stroke-width="1.5"/><path d="M6 12h4M8 10l2 2-2 2" ${stroke} stroke-width="1.5"/>`),
    expandPaneL: s('0 0 24 24', `<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" ${stroke} stroke-width="1.5"/><path d="M12 3.5v17" ${stroke} stroke-width="1.5"/><path d="M18 12h-4M16 10l-2 2 2 2" ${stroke} stroke-width="1.5"/>`),
    hourglass: s('0 0 48 64', `<path d="M8 4h32M8 60h32" stroke="#1e1e1e" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M12 4v8c0 8 12 14 12 20s-12 12-12 20v8M36 4v8c0 8-12 14-12 20s12 12 12 20v8" fill="none" stroke="#1e1e1e" stroke-width="3"/>
      <path class="hg-top" d="M15 12h18c-1 5-9 10-9 13-0-3-8-8-9-13z" fill="#fedb00"/>
      <path class="hg-bot" d="M14.5 56c1-6 9.5-11 9.5-11s8.5 5 9.5 11z" fill="#4565a8"/>`),
    battery: s('0 0 26 14', `<rect x="1" y="1.5" width="21" height="11" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="22.8" y="4.8" width="2.2" height="4.4" rx=".8" fill="currentColor"/><rect class="bat-lvl" x="3" y="3.5" width="17" height="7" rx="1" fill="currentColor"/>`),
  };

  window.icon = (name) => ICONS[name] || '';
  window.fillIcons = (root = document) => {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      if (!el.firstElementChild) el.innerHTML = ICONS[el.dataset.icon] || '';
    });
  };
  document.addEventListener('DOMContentLoaded', () => window.fillIcons());
})();
