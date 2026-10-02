/* Client configuration. Secrets (Telegram token, answer key) live on the server — never here. */
window.SAT_CONFIG = {
  /* Shown bottom-left on every exam screen. Can also be set per launch with ?name=First%20Last */
  studentName: '',

  /* Section order and timing. English always runs first. */
  modules: [
    { key: 'english', part: 'module1', section: 1, module: 1, title: 'Reading and Writing', minutes: 32 },
    { key: 'english', part: 'module2', section: 1, module: 2, title: 'Reading and Writing', minutes: 32 },
    { key: 'math', part: 'module1', section: 2, module: 1, title: 'Math', minutes: 35 },
    { key: 'math', part: 'module2', section: 2, module: 2, title: 'Math', minutes: 35 },
  ],
  breakMinutes: 10,
  /* Seconds the "This Module Is Over" screen stays up between modules. */
  transitionSeconds: 3,
  /* Timer is forced visible (and a warning shown) at this many seconds left. */
  warnAtSeconds: 5 * 60,

  /* Testing only: show a "Skip" button that ends the current module / break immediately.
     On localhost you can instead open the page with ?skiptimer. Keep false for real tests. */
  allowSkipTimer: false,

  /* Desmos API key. The demo key works for development; request a production key at desmos.com/api. */
  desmosApiKey: 'dcb31709b452b1cf9dc26972add0fda6',
};
