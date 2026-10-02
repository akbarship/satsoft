/*
 * QUESTION BANK — lives on the server only (answers are stripped before
 * anything is sent to the browser). Edits apply on the next test start,
 * no server restart needed.
 *
 * Source: "SAT_SPACE March 26 ver 3" (test.pdf) — answers from the key on its last page.
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

/* ------------------------------ helpers ------------------------------ */

const BLANK = '<span class="blank"></span>';

/** Small bordered HTML table. rows[0] is the header row when `head` is true. */
function table(rows, head = true) {
  const cell = (t, tag) => `<${tag} style="border:1px solid currentColor;padding:4px 14px;text-align:center">${t}</${tag}>`;
  const body = rows
    .map((r, i) => `<tr>${r.map((c) => cell(c, head && i === 0 ? 'th' : 'td')).join('')}</tr>`)
    .join('');
  return `<table style="border-collapse:collapse;margin:8px auto">${body}</table>`;
}

/** x / y value table used as an answer choice. */
const xy = (rows) => table([['<i>x</i>', '<i>y</i>'], ...rows.map((r) => r.map(String))]);

/** Inline SVG coordinate plane with optional curves (arrays of [x, y]) and points. */
let plotId = 0;
function plot({ x: [x0, x1], y: [y0, y1], w = 320, h = 320, tx = 2, ty = 2, curves = [], points = [], xName = 'x', yName = 'y' }) {
  const pad = 28;
  const X = (v) => pad + ((v - x0) / (x1 - x0)) * (w - 2 * pad);
  const Y = (v) => pad + ((y1 - v) / (y1 - y0)) * (h - 2 * pad);
  const id = `plot${++plotId}`;
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="max-width:100%;height:auto;display:block;margin:0 auto" font-size="10" font-family="serif" role="img">`;
  s += `<clipPath id="${id}"><rect x="${pad}" y="${pad}" width="${w - 2 * pad}" height="${h - 2 * pad}"/></clipPath>`;
  const grid = (a, b, step, vert) => {
    for (let v = Math.ceil(a / step) * step; v <= b; v += step) {
      s += vert
        ? `<line x1="${X(v)}" y1="${pad}" x2="${X(v)}" y2="${h - pad}" stroke="#888" stroke-opacity=".35"/>`
        : `<line x1="${pad}" y1="${Y(v)}" x2="${w - pad}" y2="${Y(v)}" stroke="#888" stroke-opacity=".35"/>`;
    }
  };
  grid(x0, x1, tx / 2, true);
  grid(y0, y1, ty / 2, false);
  const ax = Math.min(Math.max(0, y0), y1);
  const ay = Math.min(Math.max(0, x0), x1);
  s += `<line x1="${pad}" y1="${Y(ax)}" x2="${w - pad}" y2="${Y(ax)}" stroke="currentColor" stroke-width="1.5"/>`;
  s += `<line x1="${X(ay)}" y1="${pad}" x2="${X(ay)}" y2="${h - pad}" stroke="currentColor" stroke-width="1.5"/>`;
  for (let v = Math.ceil(x0 / tx) * tx; v <= x1; v += tx) {
    if (v !== 0) s += `<text x="${X(v)}" y="${Y(ax) + 12}" text-anchor="middle" fill="currentColor">${v}</text>`;
  }
  for (let v = Math.ceil(y0 / ty) * ty; v <= y1; v += ty) {
    if (v !== 0) s += `<text x="${X(ay) - 4}" y="${Y(v) + 3}" text-anchor="end" fill="currentColor">${v}</text>`;
  }
  s += `<text x="${w - pad + 4}" y="${Y(ax) - 4}" fill="currentColor" font-style="italic">${xName}</text>`;
  s += `<text x="${X(ay) + 6}" y="${pad - 8}" fill="currentColor" font-style="italic">${yName}</text>`;
  for (const pts of curves) {
    const d = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${X(px).toFixed(1)},${Y(py).toFixed(1)}`).join('');
    s += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" clip-path="url(#${id})"/>`;
  }
  for (const [px, py] of points) s += `<circle cx="${X(px)}" cy="${Y(py)}" r="3.5" fill="currentColor"/>`;
  return s + '</svg>';
}

/** Sample f over [a, b]. */
function sample(f, a, b, n = 240) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const v = a + ((b - a) * i) / n;
    out.push([v, f(v)]);
  }
  return out;
}

/* ------------------------------ figures ------------------------------ */

const similarTriangles = `<svg viewBox="0 0 420 190" width="420" height="190" style="max-width:100%;height:auto;display:block;margin:0 auto" font-size="13" font-family="serif" fill="currentColor" role="img">
  <g fill="none" stroke="currentColor" stroke-width="1.6">
    <polygon points="30,150 90,150 100,70"/>
    <polygon points="170,150 290,150 310,20"/>
  </g>
  <text x="18" y="164" font-style="italic">D</text><text x="86" y="164" font-style="italic">F</text><text x="98" y="62" font-style="italic">E</text>
  <text x="158" y="164" font-style="italic">Q</text><text x="288" y="164" font-style="italic">S</text><text x="306" y="14" font-style="italic">R</text>
  <text x="56" y="165" font-style="italic">e</text><text x="48" y="106" font-style="italic">f</text><text x="102" y="112" font-style="italic">d</text>
  <text x="222" y="165" font-style="italic">ke</text><text x="224" y="84" font-style="italic">kf</text><text x="312" y="92" font-style="italic">kd</text>
  <text x="130" y="186">Note: Figure not drawn to scale.</text>
</svg>`;

/* ----------------------------- question bank ----------------------------- */

module.exports = {
  english: {
    module1: [
      {
        passage: `Lima beans were domesticated in South America. Their physical structure is no longer identical to the structure of the wild plant they are descended from. Summer squash also ${BLANK} its wild ancestor. That ancestor plant had a hard rind and bitter flesh. Indigenous people in eastern North America carefully bred the crop until it had a soft rind and mild-tasting flesh.`,
        prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
        choices: ['reacts to', 'helps with', 'varies from', 'argues with'],
        answer: 'C',
      },
      {
        passage: `“Eyes of Zapata” is an English-language short story by Sandra Cisneros. It occasionally includes Spanish words and phrases. The English text surrounding these words and phrases ${BLANK} their meaning, so readers who aren’t familiar with Spanish can easily read the story. Ana Castillo takes the same approach in her novel <i>So Far from God</i>.`,
        prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
        choices: ['loses', 'purchases', 'suspects', 'suggests'],
        answer: 'D',
      },
      {
        passage: `The following text is from Billie Jean King’s 2021 autobiography <i>All In</i>.<br><br>[P]eople on both sides of my family had repeatedly <u>demonstrated</u> an independent streak. In the end, that was the temperament I gravitated toward, too. Both the Moffitts and the members of my mother’s clan, the Jermans, came from mining and oil-geyser towns on the western frontier. They kept their heads down and worked, worked, worked. But they also bucked convention.<br><br><div style="text-align:right">©2021 by Billie Jean King Enterprises, Inc.</div>`,
        prompt: 'As used in the text, what does the word “demonstrated” most nearly mean?',
        choices: ['Defined', 'Exhibited', 'Confirmed', 'Protested'],
        answer: 'B',
      },
      {
        passage: `Scientists studying marine ecosystems were surprised by the extent of internal carbon recycling by red coralline algae. While some ${BLANK} of carbon was expected, the scientists found that the algae reabsorb nearly 40% of the carbon dioxide they produce during calcification processes and harness it for photosynthesis.`,
        prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
        choices: ['reuse', 'supply', 'imitation', 'examination'],
        answer: 'A',
      },
      {
        passage: `The dinosaur displays at museums such as the American Museum of Natural History in New York (which has a mounted <i>Allosaurus fragilis</i> skeleton among its holdings) are notable for the ${BLANK} of the research behind them—the museum staff consulted numerous sources to ensure the accuracy of the displays.`,
        prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
        choices: ['novelty', 'obscurity', 'rigor', 'shallowness'],
        answer: 'C',
      },
      {
        passage: `The Nazca lines in Peru are designs marked in the earth by ancient peoples. Monuments like these were an inspiration for the land art movement that began in the 1960s. Land art artists create works set in the outdoors. For example, in his 1968 work Annual rings, Dennis Oppenheim fashioned concentric lines that look like tree rings into the ice that covered a waterway.`,
        prompt: 'Which choice best states the main purpose of the text?',
        choices: [
          'The text describes the benefits of being an artist.',
          'The text argues against placing works of art outside.',
          'The text describes the popularity of art galleries in the 1960s.',
          'The text provides information about the land art movement.',
        ],
        answer: 'D',
      },
      {
        passage: `Though Chloé Zhao’s films are fictional, she incorporates real events into them in a documentary-like style and casts nonprofessional actors who reside in the places that she aims to portray. She also encourages these actors, whether they are teenagers living on the Pine Ridge Indian Reservation or adults who travel the country for work, to put as much of themselves into their roles as possible. Her approach adds powerful resonance to films that explore the highly personal experiences of place and home, and often the difficult decision to stay or leave.`,
        prompt: 'Which choice best states the main purpose of the text?',
        choices: [
          'To summarize how Chloé Zhao’s style of filmmaking changed over the course of her career',
          'To discuss how Chloé Zhao’s background in documentary filmmaking has influenced her storytelling style in films',
          'To argue that Chloé Zhao’s films are best understood as documentaries',
          'To emphasize that Chloé Zhao’s decisions during the filmmaking process reinforce the themes of her films',
        ],
        answer: 'D',
      },
      {
        passage: `While many initiatives aimed at limiting atmospheric warming focus on curbing emissions of methane (CH4), a greenhouse gas that is typically generated by microbially mediated processes, Lisa Y. Stein and Mary E. Lidstrom caution that under certain circumstances, such efforts cause microbial communities to accelerate production of nitrous oxide (N2O), another potent greenhouse gas, thus offsetting the impact of CH4 reduction. Researchers, therefore, need to take such biological interactions into account to ensure that any CH4 mitigation strategy has an overall positive climate effect.`,
        prompt: 'Which choice best describes the overall structure of the text?',
        choices: [
          'It presents an ongoing environmental challenge, demonstrates why the impact of that challenge may intensify over time, and then criticizes a misguidedly narrow attempt to address that impact.',
          'It describes a widely accepted approach to addressing an environmental issue caused by a type of chemical emissions, indicates a potential disadvantage of that approach, and then discusses an implication of that disadvantage.',
          'It reports on a predicament resulting from emissions of a particular greenhouse gas, outlines a strategy aimed at solving that predicament, and then admonishes those who utilize that strategy without fully comprehending its ramifications.',
          'It introduces a common strategy for mitigating emissions of one greenhouse gas, explains how that strategy could inadvertently increase emissions of another greenhouse gas, and then calls for a more comprehensive approach that accounts for such interactions.',
        ],
        answer: 'B',
      },
      {
        passage: `A debut novel is the first book that an author has published. An example of a debut novel is <i>Freak the Mighty</i> by Rodman Philbrick. It was published in 1993. Debut novels are especially interesting to literary critics and readers because these books offer a look at new voices in the literary world.`,
        prompt: 'Which choice best states the main topic of the text?',
        choices: ['Debut novels', 'Famous literary critics', 'The benefits of reading', 'Careers in the publishing industry'],
        answer: 'A',
      },
      {
        passage: `Seventeenth-century Flemish artist Clara Peeters played a crucial role in the history of still-life painting. At a time when historical paintings were the preferred genre—indeed, at a time when there wasn’t even a term for still-life painting in Peeters’s language—Peeters painted food, flowers, fish, and game. Her influence spread throughout Western Europe and she became so strongly associated with the genre that painters who took up similar subjects were sometimes described as belonging to the “circle of Peeters.”`,
        prompt: 'Which choice best states the main idea of the text?',
        choices: [
          'Clara Peeters was an important figure in the development of still-life painting.',
          'Clara Peeters made significant contributions to multiple genres of painting.',
          'Clara Peeters introduced the term “still-life painting” to Western Europe.',
          'Some paintings attributed to Clara Peeters may have been painted by other artists in her circle.',
        ],
        answer: 'A',
      },
      {
        passage: `<i>Great Expectations</i> is an 1861 novel by Charles Dickens. The narrator describes his uncle, Joe Gargery, as being both powerful and tender: ${BLANK}`,
        prompt: 'Which quotation from <i>Great Expectations</i> most effectively illustrates the claim?',
        choices: [
          '“In his working-clothes, Joe was a well-knit characteristic-looking blacksmith; in his holiday clothes, he was more like a scarecrow in good circumstances, than anything else.”',
          '“When I looked back at Joe in the long passage, he was still weighing his hat with the greatest care, and was coming after us in long strides on the tips of his toes.”',
          '“There I stood, for minutes, looking at Joe, already at work with a glow of health and strength upon his face that made it show as if the bright sun of the life in store for him were shining on it.”',
          '“Joe laid his hand upon my shoulder with the touch of a woman. I have often thought him since, like the steam-hammer that can crush a man or pat an egg-shell, in his combination of strength with gentleness.”',
        ],
        answer: 'D',
      },
      {
        // Graph in the PDF is a line chart; its values are given as a table here (read off the chart).
        passage: `<div style="text-align:center"><b>Fish Population in a Taiwanese Tide Pool, January 2001 to October 2001</b></div>${table([
          ['Month', 'combtooth blenny', 'barred flagtail', 'striated rockskipper'],
          ['January 2001', '62', '14', '0'],
          ['April 2001', '3', '9', '0'],
          ['July 2001', '3', '7', '5'],
          ['October 2001', '1', '16', '4'],
        ])}<div style="text-align:center"><i>Number of individual fish observed</i></div><br>Lin-Tai Ho and colleagues monitored fish populations in a tide pool in Taiwan. They found that some species were entirely absent from the tide pool at particular times of the year; for example, they did not observe even one ${BLANK}`,
        prompt: 'Which choice most effectively uses data from the graph to complete the example?',
        choices: [
          'barred flagtail in January of 2001.',
          'striated rockskipper in January and April of 2001.',
          'barred flagtail in October of 2001.',
          'combtooth blenny in January of 2001.',
        ],
        answer: 'B',
      },
      {
        passage: `Researchers have identified over eighty gestures made by nonhuman great apes, such as raising an arm and rocking from side to side, that appear to convey information and that seem to be biologically inherited. Kirsty E. Graham and Catherine Hobaiter hypothesized that humans may be able to interpret great ape gestures, either through an evolutionary inheritance or as part of more general human cognitive abilities. The researchers tested this hypothesis by enlisting participants in an online game in which they had to correctly identify the meanings of ape gestures seen in videos. <u>Though participants achieved some success, it is unclear whether they sometimes did so by making use of additional context provided by the images or sounds in the video recordings.</u>`,
        prompt: 'Which statement, if true, would most strongly support the underlined claim?',
        choices: [
          'When apes made mouth-touching gestures, which participants tended to correctly interpret as requests for food, the food was visible in the videos.',
          'Participants correctly identified gestures at the same rate for videos in which the apes made sounds in addition to gestures and videos in which the apes were silent.',
          'Participants correctly interpreted ape gestures more than 50 percent of the time, whereas they would have only identified gestures correctly 25 percent of the time if they had been guessing.',
          'Participants correctly interpreted gestures even when the videos were muted and the ape’s surroundings were blurred, leaving only the gesture itself visible.',
        ],
        answer: 'A',
      },
      {
        passage: `Biochemists I. Sam Saguy and Eli J. Pinthus studied the mass and heat transfer processes that occur when foods, such as the Indian snacks batata vada and sabudana vada, are fried in oil. During frying, water in the crust evaporates, leaving voids that oil can fill, thereby increasing the food’s fat content. As the process continues, water from the food’s center moves to the crust as long as the crust remains permeable. Therefore, the more moisture a food loses during frying, ${BLANK}`,
        prompt: 'Which choice most logically completes the text?',
        choices: [
          'the lower the temperature must be to fry the food.',
          'the softer the crust will be when frying is completed.',
          'the higher the fat content will be when frying is completed.',
          'the quicker the crust will lose its permeability.',
        ],
        answer: 'C',
      },
      {
        passage: `The kawau tree is one of many forest plant species native to Oahu (a Hawaiian island) that are at risk of extinction in the wild. Ecologists say that fruit-eating birds help support these species’ population numbers by dropping seeds from the plants’ fruits to different spots where new plants can grow. The birds native to Oahu that used to do this have all gone extinct over time. However, the common waxbill and other fruit-eating bird species brought to the island in the last 150 years have been found to spread plant seeds. Based on this finding, some ecologists suggest that kawau trees and other forest plants native to Oahu ${BLANK}`,
        prompt: 'Which choice most logically completes the text?',
        choices: [
          'were likely already close to extinction long before non-native birds arrived on the island.',
          'probably established themselves on the island at about the same time as common waxbills and other fruit-eating birds did.',
          'seem to produce fewer fruits per plant now than they did when fruit-eating birds native to the island were still present.',
          'may now depend on non-native birds, such as the common waxbill, to help maintain and increase their populations on the island.',
        ],
        answer: 'D',
      },
      {
        passage: `Though they are in different countries, the towns of Entebbe, Uganda, and Booue, Gabon,${BLANK} They are among the rare places that sit almost directly on the equator.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['do have something in common?', 'do they have something in common.', 'do they have something in common?', 'do have something in common.'],
        answer: 'D',
      },
      {
        passage: `Pumpkins were among the many plant species from the Western Hemisphere introduced into the Eastern Hemisphere in the years following Christopher Columbus’s first transatlantic voyage in 1492. This ongoing transfer of species between hemispheres ${BLANK} now known as the Columbian Exchange.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['being', 'are', 'is', 'were'],
        answer: 'C',
      },
      {
        passage: `Among several noun cases used in Sanskrit and other Indo-Aryan languages ${BLANK} the locative case, used to indicate that an action is occurring in, at, on, or near a particular noun.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['have been', 'are', 'is', 'were'],
        answer: 'C',
      },
      {
        passage: `It was long thought that maize was domesticated solely from <i>parviflumis</i>—a subspecies of teosinte, a wild grass—in Mexico’s lowlands about 9,000 years ago. However, a 2024 analysis has revealed that between 15 and 25 percent of maize’s genes can be traced to a second ${BLANK} highland subspecies of teosinte that was hybridized with maize around 4,000 years after the initial domestication.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['ancestor; <i>mexicana,</i> a', 'ancestor: <i>mexicana,</i> a', 'ancestor <i>mexicana</i> a', 'ancestor, <i>mexicana.</i> A'],
        answer: 'B',
      },
      {
        passage: `Hummingbird flower mites use electroreception to detect electric fields created by flapping hummingbird wings, allowing mites to travel from flower to flower in hummingbird beaks. Both host detection and transportation are electrically ${BLANK} when mites move their legs toward the arriving hummingbird, they are pulled by electrostatic force to the bird’s modulated electric fields—a process that occurs in milliseconds.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['mediated,', 'mediated', 'mediated:', 'mediated and'],
        answer: 'C',
      },
      {
        passage: `The World Cup of men’s soccer, one of the biggest sporting events on the planet, brought 32 national teams from six continents to the host country, Germany, in 2006. The event, which is held every four years, used to be much smaller and more limited geographically. ${BLANK} the 1930 World Cup in Uruguay included only 13 teams, all from Europe and the Americas.`,
        prompt: 'Which choice completes the text with the most logical transition?',
        choices: ['In addition,', 'At last,', 'For example,', 'However,'],
        answer: 'C',
      },
      {
        passage: `Karel Čapek’s 1920 play <i>R.U.R. (Rossum’s Universal Robots)</i>, in which artificial workers overthrow their masters, left an indelible mark on the science fiction genre, and the English language, by introducing the term “robot” (derived from the Czech word <i>robota</i>, meaning “indentured labor” or “drudgery”). ${BLANK} Čapek’s play also contributed to a venerable literary and mythological tradition: using artificial beings as mirrors and foils for humanity.`,
        prompt: 'Which choice completes the text with the most logical transition?',
        choices: [
          'By achieving such a lofty goal,',
          'Beyond the simple coining of a term,',
          'Despite its creation of such an iconic trope,',
          'Ultimately limited in its lasting influence,',
        ],
        answer: 'B',
      },
      {
        passage: `While researching a topic, a student has taken the following notes:<ul><li><i>Letters from a Peruvian Woman</i> (1747) is an epistolary novel by French author Françoise de Graffigny.</li><li>Epistolary novels are novels written primarily as a series of fictional documents.</li><li>These documents can be letters, journal entries, newspaper clippings, and more.</li><li><i>Letters from a Peruvian Woman</i> consists primarily of letters.</li><li>The letters are sent between a captured Incan princess and her fiancé.</li></ul>`,
        prompt: 'The student wants to define the term “epistolary novel.” Which choice most effectively uses relevant information from the notes to accomplish this goal?',
        choices: [
          'Published in 1747, <i>Letters from a Peruvian Woman</i> is an epistolary novel by French author Françoise de Graffigny.',
          'Françoise de Graffigny’s novel <i>Letters from a Peruvian Woman</i> was published in 1747 and consists primarily of letters sent between a captured Incan princess and her fiancé.',
          'Consisting primarily of letters sent between a captured Incan princess and her fiancé, Françoise de Graffigny’s <i>Letters from a Peruvian Woman</i> is an epistolary novel.',
          'An epistolary novel is a novel written primarily as a series of fictional documents, such as letters, journal entries, or newspaper clippings.',
        ],
        answer: 'D',
      },
      {
        passage: `While researching a topic, a student has taken the following notes:<ul><li>The human tongue contains taste receptors for a rich, savory flavor called umami.</li><li>Umami is triggered by the compounds in a variety of foods, including sardines and mushrooms.</li><li>Participants in a study tasted a sample of wakame, a type of brown seaweed.</li><li>They rated its umami intensity as moderate.</li><li>The participants tasted a sample of ma-konbu, another type of brown seaweed.</li><li>They rated its umami intensity as high.</li></ul>`,
        prompt: 'The student wants to emphasize a difference between the two seaweeds. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
        choices: [
          'While wakame and ma-konbu contain umami flavor, umami can also be found in sardines and mushrooms.',
          'After tasting two types of brown seaweed, wakame and ma-konbu, participants in a study found ma-konbu’s umami flavor to be the more intense of the two.',
          'Wakame is a type of brown seaweed, but so is ma-konbu.',
          'Some types of brown seaweed, like wakame and ma-konbu, trigger umami flavor in human taste buds.',
        ],
        answer: 'B',
      },
      {
        passage: `While researching a topic, a student has taken the following notes:<ul><li>An isthmus is a strip of land that connects two larger pieces of land across an expanse of water.</li><li>It is also known as a land bridge.</li><li>The Isthmus of Tehuantepec is located in Mexico.</li><li>It connects the southern tip of Mexico to the northern part of Mexico.</li></ul>`,
        prompt: 'The student wants to provide a specific example of an isthmus. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
        choices: [
          'There is a land bridge in Mexico.',
          'One example of an isthmus is the Isthmus of Tehuantepec in Mexico.',
          'An isthmus, also known as a land bridge, is a strip of land that connects two larger pieces of land across an expanse of water.',
          'In Mexico, the southern tip of Mexico is connected to the northern part of Mexico.',
        ],
        answer: 'B',
      },
      {
        passage: `While researching a topic, a student has taken the following notes:<ul><li>Albert Einstein’s theory of general relativity allows for potential shortcuts through spacetime.</li><li>These hypothetical spacetime tunnels are known as wormholes.</li><li>For matter to travel through a wormhole, it would need to have negative energy density.</li><li>Negative energy density means that the matter would have less energy than empty space.</li><li>Such matter has not been shown to exist.</li></ul>`,
        prompt: 'The student wants to acknowledge a complication affecting travel through wormholes. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
        choices: [
          'The hypothetical tunnels known as wormholes would be potential shortcuts through spacetime were it not for one complication: they have less energy than empty space.',
          'Einstein’s theory of general relativity allows for potential spacetime shortcuts called wormholes but does not explain how matter with negative energy density could travel through them.',
          'For matter to travel through a wormhole, the matter would need to have less energy than empty space; such matter has not been shown to exist.',
          'Wormholes are hypothetical tunnels in spacetime that could allow for shortcuts, but no matter has yet been found that can travel through them without being destroyed.',
        ],
        answer: 'C',
      },
      {
        passage: `While researching a topic, a student has taken the following notes:<ul><li>Shanawdithit (1801–1829) was a Beothuk cartographer (mapmaker).</li><li>Her maps of Newfoundland’s Beothuk Lake outline both the lake and various points around the lake where encounters between the Indigenous Beothuk people and British colonists occurred.</li><li>Her maps are notable for depicting the experiences the Beothuk had within the landscape.</li><li>Contemporary Potawatomi cartographer Margaret Pearce: Indigenous cartography emphasizes “experienced space, or place, as opposed to the Western convention of depicting space as universal, homogenized, and devoid of human experience.”</li><li>Pearce: “Indigenous cartographies are as diverse as Indigenous cultures, from Hawaiian performative cartographies to Navajo verbal maps and sand paintings.”</li></ul>`,
        prompt: 'The student wants to describe Shanawdithit’s approach and explain its significance. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
        choices: [
          'Shanawdithit’s maps are part of a broader tradition of Indigenous cartography that, according to Pearce, ranges from “Hawaiian performative cartographies to Navajo verbal maps and sand paintings.”',
          'Shanawdithit mapped Beothuk Lake through significant encounters that occurred there, an approach that Pearce describes as “depicting space as universal [and] homogenized.”',
          'By depicting experiences of the Beothuk that occurred around Beothuk Lake, Shanawdithit’s maps reflect Indigenous cartography’s emphasis on “experienced space, or place” rather than the landscape alone.',
          'Shanawdithit’s maps of Beothuk Lake were created in the early nineteenth century, making them among the earliest known examples of Indigenous cartography in Newfoundland.',
        ],
        answer: 'C',
      },
    ],

    module2: [
      {
        passage: `Although more documentaries are being made than ever before, too many seem ${BLANK}, offering stories without any depth. In a refreshing contrast, Ahmir “Questlove” Thompson’s 2021 documentary <i>Summer of Soul (…or, When the Revolution Could Not Be Televised)</i> draws from present-day interviews to supply compelling historical and social context for footage of the 1969 Harlem Cultural Festival.`,
        prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
        choices: ['cryptic', 'inaccessible', 'haughty', 'perfunctory'],
        answer: 'D',
      },
      {
        passage: `Among saltwater fish species, there is a clear association between habitat latitude and morphological variety. While tropical species are ${BLANK} deep-bodied physical forms (body shapes that are laterally compressed but vertically extended), polar and temperate species are highly dispersed across the morphological spectrum.`,
        prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
        choices: ['authenticated by', 'concentrated among', 'habituated to', 'contemporary with'],
        answer: 'B',
      },
      {
        passage: `The following text is adapted from Edith Wharton’s 1911 novella <i>Ethan Frome</i>. The narrator has asked the woman he rents a room from about Ethan Frome, a town resident he encountered recently.<br><br>Her mind was a store-house of innocuous anecdote and any question about her acquaintances brought forth a volume of detail; but on the subject of Ethan Frome I found her unexpectedly reticent. There was no hint of disapproval in her <u>reserve</u>; I merely felt in her an insurmountable reluctance to speak of him.`,
        prompt: 'As used in the text, what does the word “reserve” most nearly mean?',
        choices: ['Misgiving', 'Constraint', 'Composure', 'Modesty'],
        answer: 'B',
      },
      {
        passage: `The work of Tobias Gerstenberg et al. on tracking eye movements supports a theory that people envision ${BLANK} scenarios when making causal judgments: when subjects were asked to look at two colliding billiard balls and judge whether one caused or prevented the other’s movement through a gate, their eyes looked at where the target ball would have gone if the ball that altered its path did not exist.`,
        prompt: 'Which choice completes the text with the most logical and precise word or phrase?',
        choices: ['ambivalent', 'retrospective', 'counterfactual', 'analogical'],
        answer: 'C',
      },
      {
        passage: `Paul Linebarger is often recognized as an influential science fiction writer (under the pen name Cordwainer Smith), but his most significant work was a 1940s classified US Army guide exploring the role of propaganda in times of war. Citing the uniquely absorbing nature of motion pictures, he contended that US propaganda should equal popular films in its appeal, entertaining audiences while engendering views of the nation as an ally. Linebarger’s work shaped the distinctive US approach to promoting national interests, one that continues to draw inspiration from elements of pop culture.`,
        prompt: 'Which choice best describes the overall structure of the text?',
        choices: [
          'It distinguishes a work from others in its genre, outlines the central objective of that work, and then addresses a recent resurgence of interest in that work.',
          'It sketches the development of a prominent work, familiarizes readers with an argument in that work, and then suggests that the work has had repercussions in other fields.',
          'It characterizes a work as having been underappreciated, describes a core concept in that work, and then argues that the influence of that concept is recognizable in other works.',
          'It introduces a significant work, summarizes a noteworthy idea in that work, and then places that idea into a context that demonstrates its broader implications.',
        ],
        answer: 'D',
      },
      {
        passage: `<b>Text 1</b><br>In separate studies, Lingbo Meng and colleagues and Xinhua He and colleagues examined whether plants transfer nutrients to one another using a common mycorrhizal network (CMN)—a lattice of fungal strands in the soil. Meng and colleagues excluded all pathways other than the CMN by using barriers to keep the plants’ root systems separate while allowing mycorrhizal strands through—a crucial step He and colleagues’ study did not take.<br><br><b>Text 2</b><br>Meng and colleagues took the necessary precaution of separating the plants’ root systems (thereby excluding root-to-root transmission). However, any barrier used must allow the thread-like hyphae of a CMN to pass through, and this permeability would also allow liquids through. Thus, the researchers’ experimental design cannot ensure that any nutrient transfer observed can be attributed to a CMN and not to some other pathway.`,
        prompt: 'Based on the texts, how would the author of Text 2 most likely respond to the characterization of Meng and colleagues’ study in Text 1?',
        choices: [
          'By asserting that the author of Text 1 has overstated the effectiveness of the method that Meng and colleagues used',
          'By pointing out that the author of Text 1 has overlooked studies that reported results that contradict those reported by Meng and colleagues',
          'By claiming that the author of Text 1 has misrepresented what Meng and colleagues were trying to achieve with their experimental design',
          'By arguing that the author of Text 1 has conflated the method used by Meng and colleagues with that used by He and colleagues',
        ],
        answer: 'A',
      },
      {
        passage: `The fifteenth-century English Heege Manuscript is unusual among collections of its kind and time given its focus on fantasy tales over more acclaimed works by celebrated medieval authors like Hoccleve. But according to professor James Wade, even more unusually, the three texts in the manuscript’s first booklet were likely copied by Richard Heege from a traveling minstrel’s repertoire book. The evidence includes performative elements such as the narrator politely addressing the audience, joking about peasants and royalty, and making jokes that could be modified to refer to the town of Radford when in nearby Brackonwet to avoid giving offense.`,
        prompt: 'As presented in the text, Wade would most likely agree with which statement about the first booklet of the Heege Manuscript?',
        choices: [
          'It was likely a copy Heege intended to give to a traveling minstrel working in the area around Radford and Brackonwet.',
          'The texts it includes were based on stories about the area around Radford and Brackonwet, but these names were later removed.',
          'It was copied from a text that originated from a traveling minstrel who worked in the area around Radford and Brackonwet.',
          'It was written down by Heege from memory based on a performance by a traveling minstrel who worked in the area around Radford and Brackonwet.',
        ],
        answer: 'C',
      },
      {
        passage: `Within higher education, studying philosophy requires that students be conversant with the field’s foundational texts and historical figures. By contrast, <i>doing</i> philosophy within or beyond the academy demands the creative, self-directed application of acquired expertise to enduring questions about the nature of existence and knowledge. While both approaches engage with influential figures, those who do philosophy treat such figures as vital interlocutors who facilitate new insights rather than as ossified authorities who, though relevant to the present, primarily represent the discipline’s past.`,
        prompt: 'Based on the text, which choice best describes the relationship between doing philosophy and studying philosophy?',
        choices: [
          'Doing philosophy involves developing novel ideas through imagined dialogue with past philosophers based on knowledge of those philosophers’ views acquired by studying philosophy.',
          'Doing philosophy helps students formulate concrete solutions to practical issues, whereas studying philosophy prioritizes engagement with historical arguments in the field.',
          'Doing philosophy represents a departure from the norms that govern scholarly inquiry, whereas studying philosophy requires conformation to these norms.',
          'Doing philosophy requires students to challenge the ideas articulated by past philosophers, especially when these ideas are broadly accepted by other people studying philosophy.',
        ],
        answer: 'A',
      },
      {
        passage: `Archaeologist Weiwei Wang and her colleagues analyzed footed grinding slabs and other food-preparation tools excavated from OC Eo, a Southeast Asian port city that flourished between the first and sixth centuries CE. Wang and colleagues recovered microscopic remnants of turmeric and other spices from the surfaces of the tools. Turmeric is native to South Asia, more than a thousand miles west of OC Eo, and the researchers showed that the footed grinding slabs at OC Eo are very similar to footed grinding slabs common throughout South Asia from around 500 BCE to 300 CE. Wang and colleagues’ findings therefore indicate that there must have been a trade link, whether direct or indirect, between the two regions.`,
        prompt: 'Which finding, if true, would directly weaken the conclusion about Wang and her colleagues’ findings that is presented in the text?',
        choices: [
          'Other types of artifacts originating in South Asia and dating to the first through sixth centuries CE have been found throughout Southeast Asia.',
          'In the first through third centuries CE, there was a significant migration of people from South Asia to Southeast Asia.',
          'The people of OC Eo and several communities in South Asia regularly traded with people in the region that is now the Southeast Asian country of Malaysia no later than the first century CE.',
          'Some of the spices recovered from OC Eo are native to the Maluku Islands, which are located approximately 2,000 miles southeast of OC Eo.',
        ],
        answer: 'B',
      },
      {
        passage: `<div style="text-align:center"><b>Strontium Isotope Ratios and Corresponding Numerical Ages in the Global Seawater Curve</b></div>${table(
          [['0.708980', '6.20'], ['0.709000', '5.86'], ['0.709020', '5.40'], ['0.709040', '4.75'], ['0.709060', '3.00']],
          false,
        )}The late Hemphillian (Hh) North American Land Mammal Age includes the subdivisions Hh3, 6.8 million years ago (Ma) to 6 Ma, and Hh4, 6 Ma to 4.75 Ma. While mammalian fossils have indicated that Florida’s Montbrook Fossil Site (MFS) and Palmetto Fauna of the Bone Valley Region (PFBV) date to Hh4, a more precise determination of the sites’ ages has proved challenging. Stephanie R. Killingsworth et al. compared average ratios of strontium-87 to strontium-86 (<sup>87</sup>Sr/<sup>86</sup>Sr) in fossil shark teeth from MFS and PFBV—0.709000 and 0.709028, respectively—to <sup>87</sup>Sr/<sup>86</sup>Sr ratios in the global strontium seawater curve, a record that shows how <sup>87</sup>Sr/<sup>86</sup>Sr ratios in seawater correspond to numerical ages and that is used to date fossils and, by extension, fossil sites. The researchers concluded that ${BLANK}`,
        prompt: 'Which choice most effectively uses data from the table to complete the statement?',
        choices: [
          'mammalian fossil evidence offers less dating precision than do <sup>87</sup>Sr/<sup>86</sup>Sr ratios in fossil shark teeth and that PFBV likely was deposited closer to the Hh3-Hh4 boundary than was MFS.',
          'the average <sup>87</sup>Sr/<sup>86</sup>Sr ratios in the fossil shark teeth from MFS and PFBV resolve previous uncertainty about the sites’ relative ages by indicating that both sites were deposited contemporaneously during the late Hh.',
          'the average <sup>87</sup>Sr/<sup>86</sup>Sr ratios in the fossil shark teeth from MFS and PFBV only partially support the site age estimates previously established through mammalian fossil evidence.',
          'the average <sup>87</sup>Sr/<sup>86</sup>Sr ratios in the fossil shark teeth from MFS and PFBV corroborate that both MFS and PFBV fall within Hh4 but suggest that PFBV was likely deposited more recently than MFS.',
        ],
        answer: 'D',
      },
      {
        /*
         * NOTE: this item is damaged in the source PDF — the passage is cut off mid-sentence, the
         * bar-chart values below are read off the (also clipped) chart, choice C is truncated and
         * choice D is empty. The key says B. Replace from the original exam if available.
         */
        passage: `<div style="text-align:center"><b>Mobility pattern by country</b> (proportion; values read off the bar chart)</div>${table([
          ['', 'US 2', 'US 3', 'US 4', 'CI 2', 'CI 3', 'CI 4'],
          ['measured', '0.76', '0.12', '0.03', '0.79', '0.12', '0.02'],
          ['model: emphasis density', '0.68', '0.19', '0.05', '&gt;0.8', '0.06', '0.01'],
          ['model: emphasis preferences', '0.47', '0.18', '0.09', '0.33', '0.21', '0.11'],
        ])}Researchers used anonymized location data from the US and Côte d’Ivoire to document people’s daily patterns of mobility, using these results to test the efficacy of the researchers’ predictive computer model. In each country, unidirectional cycles among two, three, or four locations were empirically the most common pattern types; the graph shows each of these pattern types as a proportion of all pattern instances found for that country (e.g., the measured value for CI 3 in the graph, …`,
        prompt: 'Which choice most effectively uses data from the graph to illustrate the researchers’ conclusion?',
        choices: [
          'Under the assumption that preferences are more salient than density, the US 2 and CI 2 proportions were predicted to be approximately 0.45 and 0.35, respectively, both below the measured values, whereas under the other assumption, the model overestimated the proportion for US 2 and overestimated that for CI 2.',
          'Under the assumption that preferences are more salient than density, the US 2 and CI 2 proportions were predicted to be in the range of 0.3 to 0.5, placing them farther from the measured values than were those predicted under the other assumption.',
          'Under the assumption that density is more salient than',
          '(choice text missing in the source PDF)',
        ],
        answer: 'B',
      },
      {
        passage: `Last-mile delivery refers to the final step in delivering packages to customers—and this final step can be very difficult. Delivery companies are contending with the increasing popularity of next-day delivery and with the increasing volume of parcels to be delivered, resulting in a growing bottleneck of packages in the last-mile delivery stage. These companies have been experimenting with innovative solutions in last-mile delivery, including self-service lockers (containers where consumers can pick up their parcels using a unique code). Unfortunately, many of these innovations create new obstacles (e.g., convenient placement of self-service lockers is challenging) and are not ready for full-scale implementation. As a result, delivery companies will likely ${BLANK}`,
        prompt: 'Which choice most logically completes the text?',
        choices: [
          'encourage consumers to expect next-day delivery only for products that are widely available.',
          'continue to struggle with last-mile delivery operations until viable solutions become available.',
          'be able to meet consumer’s expectations for next-day delivery in many areas but not in all regions.',
          'have little incentive to find a solution to last-mile delivery challenges.',
        ],
        answer: 'B',
      },
      {
        passage: `Across brown bears—omnivores with high dietary plasticity—there is wide variety in dietary mix, which may reflect genetics, local resource availability, or social learning (cubs stay with their mothers for two years or more). Evaluating these possibilities, Anne Hertel et al. analyzed 30 years of data on trophic position (indicative of dietary mix) for female brown bears. After separation, daughters, who tended to settle near their mothers, occupied the same trophic positions as their mothers for two years, but the correlation disappeared by year five. Trophic correlation with unrelated individuals in similar habitats was modest, while habitat-independent correlation with nonmaternal relatives (e.g., cousins) was no different than with unrelated individuals. These findings suggest that ${BLANK}`,
        prompt: 'Which choice most logically completes the text?',
        choices: [
          'social learning and resource fluctuations may both play a role in dietary mix among females, at least temporarily, though genetic factors appear to make a significant contribution as well.',
          'female dietary mix is best understood as changeable and contingent on fluctuating environmental conditions rather than as the result of social learning or genetic factors.',
          'dietary mix among females may reflect a social learning effect that eventually diminishes, though environmental constraints cannot be ruled out as a contributing factor.',
          'dietary similarity among female brown bears is likely driven primarily by social learning during early independence but fades quickly as individual foraging habits develop.',
        ],
        answer: 'C',
      },
      {
        passage: `The parks of Los Angeles, California, seem to be making people happier. In a 2022 study, researchers studying connections between the physical location in which a social media post was created and ${BLANK} contents analyzed geotagged social media posts from Los Angeles. They found that posts from the city’s parks contained more words associated with happiness than other posts did.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['they’re', 'it’s', 'their', 'its'],
        answer: 'D',
      },
      {
        passage: `On April 12, 1985, the space shuttle <i>Discovery</i> blasted off into space, commencing Mission ${BLANK} six days and twenty-three hours, the mission ended when the shuttle landed at Kennedy Space Center in Florida.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['STS-51-D, it lasted', 'STS-51-D, lasting', 'STS-51-D lasting', 'STS-51-D. Lasting'],
        answer: 'D',
      },
      {
        passage: `Now seen as a mechanical precursor to the e-reader, Spanish educator and inventor Ángela Ruiz Robles’s Enciclopedia Mecánica eschewed pages in favor of three horizontal paper scrolls that could be easily swapped out to accommodate a range of subjects. Though Ruiz Robles’s prototype had limited functionality, interactive features described in her 1949 patent—such as a button labeled “verb” that would illuminate relevant text when pressed—${BLANK} an impressive early vision of hypertext.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['revealing', 'reveal', 'reveals', 'has revealed'],
        answer: 'B',
      },
      {
        passage: `Jane Austen’s <i>Northanger Abbey</i> (1818) is considered a satire of another novel popular at the time: Ann Radcliffe’s <i>The Mysteries of Udolpho</i> (1794), which Austen’s heroine, Catherine Morland, is depicted reading. However, the similarity of the ${BLANK} experiences—the predicaments of both Catherine and Radcliffe’s Emily St. Aubert result from men’s greed—suggests that underlying the satire is a social critique.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['novel’s protagonists’', 'novels’ protagonists', 'novels’ protagonists’', 'novel’s protagonist’s'],
        answer: 'C',
      },
      {
        passage: `Roger Angell’s reputation as one of the greatest baseball writers of all${BLANK} bolstered by dozens of <i>New Yorker</i> essays in which he demonstrated a deep affection for and knowledge of the game, has perhaps overshadowed his remarkable career as a fiction editor: during his decades-long tenure at the <i>New Yorker</i>, Angell helped shape the work of John Updike, Ann Beattie, and other contributors of note.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['time was', 'time,', 'time had been', 'time, was'],
        answer: 'B',
      },
      {
        passage: `Before the ratification of the 19th Amendment in 1920, many US territories extended voting rights to women, in part to spur westward migration that would help these territories meet population thresholds for statehood. The Territory of Wyoming approved women’s suffrage in 1869 before attaining statehood in ${BLANK} while eastern states, lacking the same incentive, did not follow suit until after the turn of the century.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['1890, for example;', '1890, for example,', '1890; for example,', '1890, for example:'],
        answer: 'B',
      },
      {
        passage: `The legacy of the Spanish Empire, which once controlled portions of five continents, is evident in Spanish-speaking Panama, one of many places that reveal their imperial history in their language. Contrast Panama with the Netherlands, which ceased to be part of the empire in ${BLANK} the latter’s connection to the empire is so attenuated that Spanish is seldom spoken there today.`,
        prompt: 'Which choice completes the text so that it conforms to the conventions of Standard English?',
        choices: ['1648 and', '1648:', '1648,', '1,648'],
        answer: 'B',
      },
      {
        passage: `To determine the approximate age of stone tools excavated from ancient lake beds in Saudi Arabia, archaeologist Eleanor Scerri and colleagues collected samples of sediments surrounding the tools; these samples were then analyzed using a method known as optically stimulated luminescence (OSL) dating. ${BLANK} OSL dating indicated that the tools were around 400,000 years old.`,
        prompt: 'Which choice completes the text with the most logical transition?',
        choices: ['In addition,', 'By comparison,', 'Similarly,', 'Ultimately,'],
        answer: 'D',
      },
      {
        passage: `The moon Lysithea orbits Jupiter in the same direction that the planet rotates. ${BLANK} Lysithea’s orbit is described as prograde. Mneme, another of Jupiter’s moons, orbits in the opposite direction, so its orbit is described with the opposite term: retrograde.`,
        prompt: 'Which choice completes the text with the most logical transition?',
        choices: ['Likewise,', 'Next,', 'Thus,', 'However,'],
        answer: 'C',
      },
      {
        passage: `Macarena Garcia Marin is a space scientist who works on the James Webb Space Telescope, or JWST. Thanks in part to Garcia Marin’s contributions, the telescope is now positioned near the Sun-Earth L<sub>2</sub> Lagrange point, almost one million miles beyond Earth’s orbit. ${BLANK} the JWST’s predecessor, the Hubble Telescope, is only about 340 miles above Earth’s surface.`,
        prompt: 'Which choice completes the text with the most logical transition?',
        choices: ['Similarly,', 'Secondly,', 'By contrast,', 'Therefore,'],
        answer: 'C',
      },
      {
        passage: `The Austronesian language of Nauruan has only about 10,300 living speakers. Although most Nauruan speakers live in Nauru, where the language originated, Nauruan is also spoken in New York City. ${BLANK} the New York-based Endangered Language Alliance has identified a group of Nauruan speakers in the city’s Murray Hill neighborhood, in the borough of Manhattan.`,
        prompt: 'Which choice completes the text with the most logical transition?',
        choices: ['Nonetheless,', 'In addition,', 'Meanwhile,', 'Specifically,'],
        answer: 'D',
      },
      {
        passage: `Nineteenth-century Modernista architects championed nature in their designs. Granted, the wavy stone façade and ornate floral tilework of Casa Batlló, a Modernista private home designed by Antoni Gaudí, couldn’t exactly grow in a forest. ${BLANK} one sees natural influences in Gaudí’s penchant for curves (rather than right angles) and plant- and animal-inspired flourishes.`,
        prompt: 'Which choice completes the text with the most logical transition?',
        choices: ['Furthermore,', 'Similarly,', 'Still,', 'In other words,'],
        answer: 'C',
      },
      {
        passage: `While researching a topic, a student has taken the following notes:<ul><li>The A.M. Turing Award is a prestigious award given by the Association for Computing Machinery (ACM).</li><li>The ACM gives the award for “major contributions of lasting importance to computing.”</li><li>It is named after groundbreaking British mathematician Alan Turing.</li><li>Barbara Liskov won the award in 2008.</li></ul>`,
        prompt: 'The student wants to explain whom the award is named for and identify one recipient of it. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
        choices: [
          'In 2008, Barbara Liskov won the A.M. Turing Award, which is given for “major contributions of lasting importance to computing.”',
          'The A.M. Turing Award, which is named for British mathematician Alan Turing, was given to Barbara Liskov in 2008.',
          'The A.M. Turing Award is given for “major contributions of lasting importance to computing.”',
          'It was in 2008 that Barbara Liskov won the A.M. Turing Award.',
        ],
        answer: 'B',
      },
      {
        passage: `While researching a topic, a student has taken the following notes:<ul><li>When the electrons of a chemical element change energy states, certain wavelengths of light are released.</li><li>This unique collection of wavelengths is known as the emission spectrum of the element.</li><li>Titanium’s emission spectrum includes the 430.5 nanometer (nm) wavelength.</li><li>Krypton’s emission spectrum includes the 583.2 nm wavelength.</li><li>The violet portion of the visible spectrum is made up of light with wavelengths of 380–450 nm.</li></ul>`,
        prompt: 'The student wants to identify an emission spectrum that includes a wavelength in the violet portion of the visible spectrum. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
        choices: [
          'The 583.2 nm wavelength, which is in the violet portion of the visible spectrum, is one wavelength in the emission spectrum of krypton.',
          'Since the 430.5 nm wavelength of light is within the 380–450 nm range, it is part of the violet portion of the visible spectrum.',
          'Containing the 430.5 nm and 583.2 nm wavelengths, respectively, both titanium’s and krypton’s emission spectra include wavelengths in the violet portion of the visible spectrum.',
          'Titanium’s emission spectrum includes the 430.5 nm wavelength, which is in the violet portion of the visible spectrum.',
        ],
        answer: 'D',
      },
    ],
  },

  math: {
    module1: [
      {
        prompt: String.raw`A cube has an edge length of \(7\) inches. What is the volume, in cubic inches, of the cube?`,
        choices: [String.raw`\(28\)`, String.raw`\(49\)`, String.raw`\(294\)`, String.raw`\(343\)`],
        answer: 'D',
      },
      {
        prompt: String.raw`\[y < x\]\[x < 31\]For which of the following tables are all the values of \(x\) and their corresponding values of \(y\) solutions to the given system of inequalities?`,
        choices: [
          xy([[28, 27], [29, 28], [30, 29]]),
          xy([[28, 29], [29, 30], [30, 31]]),
          xy([[32, 31], [33, 32], [34, 33]]),
          xy([[32, 33], [29, 30], [30, 31]]),
        ],
        answer: 'A',
      },
      {
        prompt: String.raw`For the linear function \(f\), \(f(4) = 17\) and \(f(8) = 1\). Which equation defines \(f\)?`,
        choices: [
          String.raw`\(f(x) = -\dfrac{1}{4}x + 18\)`,
          String.raw`\(f(x) = \dfrac{1}{4}x - 1\)`,
          String.raw`\(f(x) = -4x + 21\)`,
          String.raw`\(f(x) = -4x + 33\)`,
        ],
        answer: 'D',
      },
      {
        passage: `<div style="text-align:center">Data set X: 13, 15, 17, 20, 23, 24, 24, 25, 37<br>Data set Y: 13, 15, 17, 20, 23, 24, 24, 25, 32</div>`,
        prompt: 'Data set Y is created by replacing the number 37 in data set X with the number 32. Which of the following statements is true about the means and medians of data set X and data set Y?',
        choices: [
          'The mean of data set X is greater than the mean of data set Y, and the median of data set X equals the median of data set Y.',
          'The mean of data set X is greater than the mean of data set Y, and the median of data set X is greater than the median of data set Y.',
          'The mean of data set X equals the mean of data set Y, and the median of data set X equals the median of data set Y.',
          'The mean of data set X is less than the mean of data set Y, and the median of data set X is greater than the median of data set Y.',
        ],
        answer: 'A',
      },
      {
        type: 'spr',
        prompt: String.raw`If \(x + 4y = 34\) and \(9x - 20y = -86\), what is the value of \(y\)?`,
        answer: ['7'],
      },
      {
        // PDF rendering lost the exponents/parentheses; reconstructed so that the keyed answer (12, 81) checks out.
        prompt: String.raw`\[y = 9x - 3^3\]\[y = (x - 3)^2\]Which ordered pair \((x, y)\) is a solution to the given system of equations?`,
        choices: [String.raw`\((6, -9)\)`, String.raw`\((3, 12)\)`, String.raw`\((12, 81)\)`, String.raw`\((12, -9)\)`],
        answer: 'C',
      },
      {
        type: 'spr',
        prompt: String.raw`An entomologist placed an initial population of \(20\) <i>Tenebrio molitor</i>, a type of beetle, into a habitat and monitored the population over time. When the number of <i>Tenebrio molitor</i> in the habitat reached \(180\%\) of the initial population, the entomologist moved \(75\%\) of the <i>Tenebrio molitor</i> to a second habitat. How many <i>Tenebrio molitor</i> did the entomologist move to the second habitat at this time?`,
        answer: ['27'],
      },
      {
        prompt: String.raw`For the polynomial function \(f\), the graph of \(y = f(x)\) in the \(xy\)-plane passes through the points \((-3, 0)\), \((1, 0)\), and \((7, 0)\). Which of the following must be a factor of \(f(x)\)?`,
        choices: [String.raw`\(x + 1\)`, String.raw`\(x + 7\)`, String.raw`\(x - 1\)`, String.raw`\(x - 3\)`],
        answer: 'C',
      },
      {
        prompt: String.raw`The expression \(\dfrac{6x^{22}}{18x^{5}}\) is equivalent to \(\dfrac{1}{3}x^{b}\), where \(b\) is a constant and \(x > 0\). What is the value of \(b\)?`,
        choices: [String.raw`\(\dfrac{5}{22}\)`, String.raw`\(\dfrac{22}{5}\)`, String.raw`\(17\)`, String.raw`\(27\)`],
        answer: 'C',
      },
      {
        type: 'spr',
        // Function reconstructed from the PDF (exponent is t - 12); the keyed answer 12 checks out.
        prompt: String.raw`\[C(t) = 220\left(\dfrac{52}{51}\right)^{t-12} + 8\]The function \(C\) gives the estimated number of cephalopods, a class of marine animal, in a certain area, where \(t\) is the number of months since a study began. How many months after the study began was the number of cephalopods in the area estimated to be \(228\)?`,
        answer: ['12'],
      },
      {
        type: 'spr',
        passage: similarTriangles,
        prompt: String.raw`In the figure shown, \(d\), \(e\), and \(f\) are constants and the value of \(k\) is \(3\). If the measures of angles \(D\), \(E\), and \(F\) are \(30^\circ\), \(x^\circ\), and \((2x + 6)^\circ\), respectively, what is the measure, in degrees, of angle \(S\)?`,
        answer: ['102'],
      },
      {
        type: 'spr',
        prompt: String.raw`During a physics experiment, the speed of an object was determined to be \(145.0\) inches per second. What is this speed in <b>feet</b> per second? (\(12\) inches \(= 1\) foot)`,
        answer: ['12.08', '12.083', '12.0833', '145/12'],
      },
      {
        passage: plot({ x: [-10, 10], y: [-10, 10], curves: [sample((x) => -1.25 * x - 0.5, -8, 8, 2)], points: [[-2, 2], [2, -3]] }),
        prompt: String.raw`Line \(k\) is shown in the \(xy\)-plane. Line \(j\) (not shown) is perpendicular to line \(k\) and passes through the point \((16, 22)\). What is the \(y\)-coordinate of the \(y\)-intercept of line \(j\)?`,
        choices: [String.raw`\(-\dfrac{13}{2}\)`, String.raw`\(-\dfrac{1}{2}\)`, String.raw`\(\dfrac{4}{5}\)`, String.raw`\(\dfrac{46}{5}\)`],
        answer: 'D',
      },
      {
        passage: plot({ x: [-6, 6], y: [-10, 4], tx: 1, ty: 2, curves: [sample((x) => -6 * Math.pow(2, x) + 2, -6, 1.3)] }),
        prompt: String.raw`The graph of \(y = f(x) + 2\) is shown, where \(f\) is defined by an equation of the form \(f(x) = ab^x + c\). If \(a\), \(b\), and \(c\) are integer constants and \(c \le 0\), which equation could define \(f\)?`,
        choices: [
          String.raw`\(f(x) = -6(2)^x\)`,
          String.raw`\(f(x) = -6(2)^x - 2\)`,
          String.raw`\(f(x) = -6(2)^x - 4\)`,
          String.raw`\(f(x) = -6(2)^x - 6\)`,
        ],
        answer: 'A',
      },
      {
        prompt: String.raw`One gallon of sealant costs $17 and will cover \(450\) square feet of a surface. A deck has a total surface area of \(d\) square feet. Which equation represents the cost \(c\), in dollars, of the sealant needed to cover the deck twice?`,
        choices: [
          String.raw`\(c = \dfrac{450d}{17}\)`,
          String.raw`\(c = \dfrac{900d}{17}\)`,
          String.raw`\(c = 17\left(\dfrac{d}{225}\right)\)`,
          String.raw`\(c = 17\left(\dfrac{d}{450}\right)\)`,
        ],
        answer: 'C',
      },
      {
        type: 'spr',
        prompt: String.raw`A bag contains only yellow marbles and red marbles. The probability of selecting a yellow marble from the bag at random is \(\dfrac{5}{19}\). What is the probability of selecting a red marble from the bag at random?`,
        answer: ['0.737', '.737', '.7368', '0.7368', '14/19'],
      },
      {
        prompt: String.raw`What is \(5\%\) of \(580\)?`,
        choices: [String.raw`\(575\)`, String.raw`\(290\)`, String.raw`\(116\)`, String.raw`\(29\)`],
        answer: 'D',
      },
      {
        // PDF rendering shows "64^x"; reconstructed as 6(4)^x so that the keyed answer 384 checks out.
        prompt: String.raw`The function \(f\) is defined by \(f(x) = 6(4)^x\). What is the value of \(f(x)\) when \(x = 3\)?`,
        choices: [String.raw`\(64\)`, String.raw`\(81\)`, String.raw`\(258\)`, String.raw`\(384\)`],
        answer: 'D',
      },
      {
        type: 'spr',
        prompt: String.raw`A manager is responsible for ordering supplies for a coffee shop. The shop’s inventory starts with \(6{,}600\) disposable cups, and the manager estimates that \(110\) of these cups are used each day. Based on this estimate, in how many days will the inventory of disposable cups reach \(1{,}100\)?`,
        answer: ['50'],
      },
      {
        passage: plot({ x: [-6, 10], y: [-6, 10], curves: [sample((x) => -2 * x + 4, -3, 5.2, 2)] }),
        prompt: String.raw`The graph of the linear function \(f\) is shown, where \(y = f(x)\). Which equation defines function \(f\)?`,
        choices: [
          String.raw`\(f(x) = -2x + 4\)`,
          String.raw`\(f(x) = -2x - 4\)`,
          String.raw`\(f(x) = 2x + 4\)`,
          String.raw`\(f(x) = 2x - 4\)`,
        ],
        answer: 'A',
      },
      {
        prompt: String.raw`\[x^2 - 40x = 0\]Which of the following is a solution to the given equation?`,
        choices: [String.raw`\(80\)`, String.raw`\(40\)`, String.raw`\(20\)`, String.raw`\(\sqrt{40}\)`],
        answer: 'B',
      },
      {
        // PDF rendering lost the parentheses; reconstructed so that the keyed answer (-8/3) checks out.
        prompt: String.raw`If \(4(x - 9) - 4 = 7(x - 9) + 4\), what is the value of \(x - 9\)?`,
        choices: [String.raw`\(-\dfrac{8}{3}\)`, String.raw`\(-\dfrac{3}{8}\)`, String.raw`\(\dfrac{4}{7}\)`, String.raw`\(\dfrac{8}{11}\)`],
        answer: 'A',
      },
    ],

    module2: [
      {
        prompt: String.raw`The product of a positive number \(x\) and the number that is \(5\) less than \(x\) is equal to \(104\). What is the value of \(x\)?`,
        choices: [String.raw`\(2.5\)`, String.raw`\(13\)`, String.raw`\(99\)`, String.raw`\(109\)`],
        answer: 'B',
      },
      {
        passage: plot({ x: [-8, 8], y: [0, 15], tx: 2, ty: 2, curves: [sample((x) => Math.pow(3, x) + 10, -8, 1.6)] }),
        prompt: 'What is an equation of the graph shown?',
        choices: [String.raw`\(y = 3^{-x} + 11\)`, String.raw`\(y = 3^{x} + 11\)`, String.raw`\(y = 3^{-x} + 10\)`, String.raw`\(y = 3^{x} + 10\)`],
        answer: 'D',
      },
      {
        prompt: String.raw`Triangle \(ABC\) is similar to triangle \(XYZ\), such that \(A\), \(B\), and \(C\) correspond to \(X\), \(Y\), and \(Z\), respectively. The length of each side of triangle \(XYZ\) is \(2\) times the length of its corresponding side in triangle \(ABC\). The measure of angle \(B\) is \(17^\circ\). What is the measure of angle \(Y\), in degrees?`,
        choices: [String.raw`\(15\)`, String.raw`\(17\)`, String.raw`\(19\)`, String.raw`\(34\)`],
        answer: 'B',
      },
      {
        prompt: String.raw`The measure of angle \(R\) is \(\dfrac{2\pi}{3}\) radians. The measure of angle \(T\) is \(\dfrac{23\pi}{18}\) radians greater than the measure of angle \(R\). What is the measure of angle \(T\), in <u>degrees</u>?`,
        choices: [String.raw`\(120\)`, String.raw`\(230\)`, String.raw`\(350\)`, String.raw`\(700\)`],
        answer: 'C',
      },
      {
        prompt: String.raw`A total of \(255\) people registered for a city’s annual race as either a runner or a walker. \(210\) people registered as a runner. How many people registered as a walker?`,
        choices: [String.raw`\(510\)`, String.raw`\(255\)`, String.raw`\(210\)`, String.raw`\(45\)`],
        answer: 'D',
      },
      {
        passage: plot({
          x: [0, 8200], y: [0, 80], tx: 2000, ty: 10,
          curves: [[[0, 54], [8200, 6]]],
          points: [[1000, 51], [2000, 39], [3000, 36], [5000, 27], [6000, 15], [7000, 12]],
        }) + '<div style="text-align:center">Elevation (feet) vs. Temperature (°F)</div>',
        prompt: String.raw`The scatterplot shows the temperature, in degrees Fahrenheit (°F), and the elevation, in feet, measured at \(6\) locations on a mountain. A line of best fit is also shown. At an elevation of \(4{,}000\) feet, what is the temperature, in °F, predicted by the line of best fit?`,
        choices: [String.raw`\(54\)`, String.raw`\(30\)`, String.raw`\(15\)`, String.raw`\(0\)`],
        answer: 'B',
      },
      {
        passage: plot({
          x: [-10, 4], y: [-4, 8], tx: 2, ty: 2,
          curves: [sample((x) => -2 * (x + 3) * (x + 3) + 2, -6, 0), [[-10, 2], [4, 2]]],
        }),
        prompt: String.raw`The graph of a system of a linear equation and a quadratic equation is shown. What is the solution \((x, y)\) to this system?`,
        choices: [String.raw`\((0, 2)\)`, String.raw`\((0, 3)\)`, String.raw`\((-3, 2)\)`, String.raw`\((3, -2)\)`],
        answer: 'C',
      },
      {
        // The PDF shows "5x = 35"; "positive solution" hints the original may have a squared term. Keyed answer: 7.
        type: 'spr',
        prompt: String.raw`\[5x = 35\]What is the positive solution to the given equation?`,
        answer: ['7'],
      },
      {
        prompt: String.raw`During an experiment, a particle’s speed was \(41\) feet per second. What is this speed in feet per <b>minute</b>?`,
        choices: [String.raw`\(71\)`, String.raw`\(101\)`, String.raw`\(1{,}230\)`, String.raw`\(2{,}460\)`],
        answer: 'D',
      },
      {
        prompt: String.raw`A rectangle has a length of \(100\) centimeters and a width of \(400\) centimeters. What is the area, in square centimeters, of the rectangle?`,
        choices: [String.raw`\(100\)`, String.raw`\(500\)`, String.raw`\(40{,}000\)`, String.raw`\(40{,}400\)`],
        answer: 'C',
      },
      {
        prompt: String.raw`The function \(f\) is defined by \(f(x) = x^2 + 79\). What is the value of \(f(x)\) when \(x = 10\)?`,
        choices: [String.raw`\(-179\)`, String.raw`\(-21\)`, String.raw`\(21\)`, String.raw`\(179\)`],
        answer: 'D',
      },
      {
        prompt: String.raw`What is the \(x\)-intercept of the graph of \(y = \dfrac{45 - x}{ax + b}\) in the \(xy\)-plane, where \(a\) and \(b\) are positive constants?`,
        choices: [String.raw`\(\left(-\dfrac{b}{a}, 0\right)\)`, String.raw`\(\left(0, \dfrac{45}{b}\right)\)`, String.raw`\((0, -45)\)`, String.raw`\((45, 0)\)`],
        answer: 'D',
      },
      {
        prompt: String.raw`Kayra spent $74 at a book sale and bought a total of \(22\) books. She bought \(h\) hardcover books for $4 each and \(p\) paperback books for $3 each. Which system of equations represents this situation?`,
        choices: [
          String.raw`\(h + p = 22\)<br>\(3h + 4p = 74\)`,
          String.raw`\(h + p = 22\)<br>\(4h + 3p = 74\)`,
          String.raw`\(h + p = 74\)<br>\(3h + 4p = 22\)`,
          String.raw`\(h + p = 74\)<br>\(4h + 3p = 22\)`,
        ],
        answer: 'B',
      },
      {
        type: 'spr',
        prompt: String.raw`\[2x + 7y = 58\]\[y = 6\]The solution to the given system of equations is \((x, y)\). What is the value of \(x\)?`,
        answer: ['8'],
      },
      {
        passage: table([
          ['Average pitching speed', 'Number of pitchers'],
          ['At least 30 mph but less than 35 mph', '12'],
          ['At least 35 mph but less than 40 mph', '7'],
          ['At least 40 mph but less than 45 mph', '4'],
          ['At least 45 mph but less than 50 mph', '1'],
        ]),
        prompt: 'The table summarizes the distribution of average pitching speed, in miles per hour (mph), for a sample of 24 pitchers in a youth softball league. According to the table, how many pitchers in the sample have an average pitching speed of at least 30 mph but less than 35 mph?',
        choices: ['12', '7', '4', '1'],
        answer: 'A',
      },
      {
        // PDF rendering lost the parentheses in the choices; reconstructed (C is the keyed factorization 9(2x² + x + 1)).
        prompt: String.raw`Which expression is equivalent to \(18x^2 + 9x + 9\)?`,
        choices: [
          String.raw`\(2x^2(9x + 9)\)`,
          String.raw`\(18x(x + 1)\)`,
          String.raw`\(9(2x^2 + x + 1)\)`,
          String.raw`\(3(6x^2 + x + 1)\)`,
        ],
        answer: 'C',
      },
      {
        type: 'spr',
        prompt: String.raw`The price of an item increased by \(p\%\) from $90 to $93. What is the value of \(p\)?`,
        answer: ['10/3', '3.33', '3.333', '3.3333'],
      },
      {
        prompt: String.raw`If \(6x = 9\), what is the value of \(48x\)?`,
        choices: [String.raw`\(1\)`, String.raw`\(17\)`, String.raw`\(62\)`, String.raw`\(72\)`],
        answer: 'D',
      },
      {
        prompt: String.raw`The number of cells of the bacteria <i>Bacillus megaterium</i> doubles every \(25\) minutes during its growth period when placed in a medium of sucrose-salts in a controlled laboratory environment. If a sample of \(530\) cells of <i>Bacillus megaterium</i> is placed in sucrose-salts in a controlled laboratory environment, which function \(f\) best represents the number of cells of the bacteria \(x\) minutes after the growth period begins, where \(x\) is less than the number of minutes in the growth period?`,
        choices: [
          String.raw`\(f(x) = 530\left(\dfrac{1}{3}\right)^{x/25}\)`,
          String.raw`\(f(x) = 530\left(\dfrac{1}{2}\right)^{x/25}\)`,
          String.raw`\(f(x) = 530(2)^{x/25}\)`,
          String.raw`\(f(x) = 530(3)^{x/25}\)`,
        ],
        answer: 'C',
      },
      {
        type: 'spr',
        prompt: String.raw`\[p(x) = x^3 + 4x^2 + 9x + 12\]When the given function \(p\) is graphed in the \(xy\)-plane, where \(y = p(x)\), the \(y\)-intercept of the graph is \((0, y)\). What is the value of \(y\)?`,
        answer: ['12'],
      },
      {
        passage: table([['<i>x</i>', '<i>h</i>(<i>x</i>)'], ['0', '15'], ['1', '16'], ['2', '18']]),
        prompt: String.raw`For the function \(h\), the table gives three values of \(x\) and their corresponding values of \(h(x)\). Which equation could define \(h\)?`,
        choices: [String.raw`\(h(x) = 2^x + 14\)`, String.raw`\(h(x) = 2^x + 13\)`, String.raw`\(h(x) = 2^x + 2\)`, String.raw`\(h(x) = 2^x\)`],
        answer: 'A',
      },
      {
        prompt: String.raw`For the linear function \(f\), the graph of \(y = f(x)\) in the \(xy\)-plane has a slope of \(-5\) and passes through the point \((2, -4)\). Which equation defines \(f\)?`,
        choices: [
          String.raw`\(f(x) = 2x - 4\)`,
          String.raw`\(f(x) = -5x - 4\)`,
          String.raw`\(f(x) = -5x - 5\)`,
          String.raw`\(f(x) = -5x + 6\)`,
        ],
        answer: 'D',
      },
    ],
  },
};
