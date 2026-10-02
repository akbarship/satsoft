/*
 * QUESTION BANK — lives on the server only (answers are stripped before
 * anything is sent to the browser). Edits apply on the next test start,
 * no server restart needed.
 *
 * Reading & Writing question:
 *   { passage: 'HTML', prompt: 'HTML', choices: ['A text', 'B text', 'C text', 'D text'], answer: 'B' }
 *
 * Math multiple choice:
 *   { prompt: String.raw`Which expression is equivalent to \(x^2 + 3x - 40\)?`,
 *     choices: [String.raw`\((x-4)(x+10)\)`, ...], answer: 'B' }
 *   Optional: passage: 'HTML' (table / figure shown above the question), image: '/img/fig1.png'
 *
 * Math student-produced response (grid-in):
 *   { type: 'spr', prompt: '...', answer: ['3.5', '7/2'] }   // any listed value (or numeric equivalent) is correct
 *
 * Math uses KaTeX: write inline math as \( ... \) and display math as \[ ... \].
 * Use String.raw`...` so backslashes don't need doubling. Plain "$" is safe for money.
 * The blank in RW passages: use <span class="blank"></span>.
 *
 * Expected size: RW 27 + 27, Math 22 + 22. The counts shown in the UI come
 * from the actual list lengths.
 */

/* ======================= PLACEHOLDER FILLER =========================
 * Pads each module to full length so the whole flow can be tested.
 * Remove `fill(...)` calls once the real questions are added.        */
function fill(list, n, make) {
  const out = list.slice();
  while (out.length < n) out.push(make(out.length + 1));
  return out;
}
const rwPlaceholder = (n) => ({
  passage: `Placeholder passage for question ${n}. Replace this text with the real passage when the question bank is ready.`,
  prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
  choices: ['first option', 'second option', 'third option', 'fourth option'],
  answer: 'A',
});
const mathPlaceholder = (n) => ({
  prompt: String.raw`Placeholder question ${n}. What is the value of \(2 + ${n}\)?`,
  choices: [String.raw`\(${n + 2}\)`, String.raw`\(${n + 3}\)`, String.raw`\(${n + 1}\)`, String.raw`\(${2 * n}\)`],
  answer: 'A',
});
/* =================================================================== */

module.exports = {
  english: {
    module1: fill([
      {
        passage: 'In recommending Bao Phi’s collection <i>Sông I Sing</i>, a librarian noted that pieces by the spoken-word poet don’t lose their <span class="blank"></span> nature when printed: the language has the same pleasant musical quality on the page as it does when performed by Phi.',
        prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
        choices: ['scholarly', 'melodic', 'jarring', 'personal'],
        answer: 'B',
      },
      {
        passage: 'The following text is adapted from Edith Wharton’s 1911 novel <i>Ethan Frome</i>.<br><br>The village lay under two feet of snow, with drifts at the windy corners. In a sky of iron the points of the Dipper hung like icicles and Orion flashed his cold fires.',
        prompt: 'As used in the text, what does the word “flashed” most nearly mean?',
        choices: ['displayed', 'hurried', 'exposed', 'signaled'],
        answer: 'A',
      },
    ], 27, rwPlaceholder),
    module2: fill([], 27, rwPlaceholder),
  },

  math: {
    module1: fill([
      {
        prompt: 'A veterinarian recommends that each day a certain rabbit should eat 25 calories per pound of the rabbit’s weight, plus an additional 11 calories. Which equation represents this situation, where \\(c\\) is the total number of calories the veterinarian recommends the rabbit should eat each day if the rabbit’s weight is \\(x\\) pounds?',
        choices: [String.raw`\(c = 25x\)`, String.raw`\(c = 36x\)`, String.raw`\(c = 11x + 25\)`, String.raw`\(c = 25x + 11\)`],
        answer: 'D',
      },
      {
        prompt: String.raw`Which expression is equivalent to \(x^2 + 3x - 40\)?`,
        choices: [String.raw`\((x - 4)(x + 10)\)`, String.raw`\((x - 5)(x + 8)\)`, String.raw`\((x - 8)(x + 5)\)`, String.raw`\((x - 10)(x + 4)\)`],
        answer: 'B',
      },
      {
        type: 'spr',
        prompt: String.raw`If \(2x + 3 = 10\), what is the value of \(x\)?`,
        answer: ['3.5', '7/2'],
      },
    ], 22, mathPlaceholder),
    module2: fill([], 22, mathPlaceholder),
  },
};
