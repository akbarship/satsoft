# SAT Bluebook Runner

A pixel-matched replica of the College Board Bluebook testing app.

**Flow:** Start Code → Reading & Writing M1 (27 q / 32 min) → R&W M2 (27 q / 32 min) → 10-min mandatory break → Resume Testing → Math M1 (22 q / 35 min) → Math M2 (22 q / 35 min) → Congratulations screen.

- **Personal pages:** each student gets a link like `satsoft.com/2222`, created on the operator panel. That page shows the student's name on the test.
- **The teachers** get a private Telegram message with only the **student name and start code**, once when the test starts and once when it finishes. No answers are sent. The test won’t open if the start message reaches no teacher.
- **Scores** (Reading & Writing, Math, total) are saved in `data/db.json` and shown on the operator panel.
- The answer key, the bot token and operator passwords stay on the server.
- Nothing is stored in the browser. Leaving or reloading the page starts over from the start-code screen (the page warns before leaving mid-test).

## Run

Requires Node.js 18+. There are no npm dependencies.

```bash
cp .env.example .env      # then fill in TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS
npm start                 # http://localhost:3000
```

For local testing without posting to Telegram, run `npm run dev`. Messages are printed to the console instead.

**Telegram setup:** create a bot with @BotFather and put the teachers' numeric Telegram user ids in `TELEGRAM_CHAT_IDS`, separated by commas. Each teacher must open the bot and press **Start** once, or the bot cannot message them. Every message goes to all teachers; a test opens if at least one of them receives it.

## Operator panel

Open **`/operator`** (e.g. `satsoft.com/operator`) and sign in.

- **First start:** if `data/db.json` has no operator yet, the server creates one. The login is `OPERATOR_LOGIN` (default `admin`). The password is `OPERATOR_PASSWORD` from `.env`, or a random one **printed in the server console**.
- **Change or add an operator:** `npm run operator -- <login> <password>` (at least 6 characters).
- **Create a student page:** type the full name. Optionally choose the page number (3–8 digits); otherwise a free 4-digit number is picked. The link is copied automatically.
- **Student list:** shows each link (Copy button), the status (*Not started*, *In progress* with the code, or *Finished*) and the latest score. It refreshes every 15 seconds. You can **rename** or **delete** any student.
- **Security:** passwords are hashed with scrypt. Sessions use HttpOnly SameSite=Strict cookies and expire after 12 h. Login is locked for 15 minutes after 8 wrong attempts.

**Database:** `data/db.json` holds operators, students and results. It's written atomically, so a crash can't corrupt it. Back it up by copying the file. It's in `.gitignore`.

## Install as an app (PWA)

The app is an installable Progressive Web App.

- **Chrome / Edge (Windows, macOS, Linux, ChromeOS):** open the site and click **Install App** at the top of the Start Code screen. You can also use the install icon in the address bar. It then opens in its own window from the Start menu or desktop, without browser toolbars, and goes fullscreen when the test starts.
- **Android:** Chrome menu → *Install app*.
- **iPad / iPhone:** Safari → Share → *Add to Home Screen*.

**Offline:** after the first visit, the app, fonts, KaTeX and the Desmos calculator are cached. If the network drops mid-test, the test keeps running (but do not reload the page). Only two steps need the server: entering the start code (it must reach Telegram) and sending results. The finish screen retries results automatically until they go through.

**HTTPS required:** browsers only allow installing from `https://` or `http://localhost`. On a school network, serve it over HTTPS, for example behind Caddy/nginx or with a tunnel such as Cloudflare Tunnel. Otherwise each student laptop has to run it on localhost.

**Updating:** installed copies load the newest files whenever the server is reachable. Bump `VERSION` in `public/sw.js` after a change so the offline copy is refreshed as well.

## Operating on test day

| Action | How |
|---|---|
| Give a student their test | create their page on `/operator` and open `host/2222` on their laptop |
| Let a student retake the test | reload `host/2222` and enter a start code again |
| Change timings / break length | `public/js/config.js` |
| Desmos production key | `desmosApiKey` in `public/js/config.js` (the bundled key is the Desmos demo key) |

## Adding questions

Edit `data/questions.js`. The format is documented at the top of the file, and changes apply on the next test start without a restart.
**Remove the `fill(...)` placeholder padding** once the real questions are in.

- R&W: `{ passage, prompt, choices: [4], answer: 'B' }`. Use `<span class="blank"></span>` for the blank.
- Math multiple choice: `{ prompt, choices: [4], answer: 'D' }`. Write math as `\( … \)` inside `String.raw` templates.
- Math grid-in: `{ type: 'spr', prompt, answer: ['3.5', '7/2'] }`. Numeric equivalents are also accepted.

## Features replicated

Directions drop-down (opens automatically at the start of each section) · countdown with Hide/Show and a 5-minute warning · Mark for Review · answer eliminator (ABC) with Undo · Highlights & Notes (select text → highlight + note editor; click a highlight to edit or delete) · resizable split pane with a drag handle · question navigator pop-up · Check Your Work review page · module transition screen · mandatory break screen, then a Resume Testing screen that starts Math · Desmos graphing calculator (draggable, resizable, expandable, state kept) · math reference sheet · grid-in answer preview · keyboard shortcuts · copy and context menu blocked · leave-page warning.
