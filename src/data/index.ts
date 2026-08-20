import type { Category, Clue } from '../types'

/**
 * One 6x6 Jeopardy board — 36 clues, sized so a one-hour meeting with 2-3 teams
 * is a real set of choices rather than an overwhelming wall of tiles.
 *
 * Organising principle: every column is a real subject, and teammate facts live
 * inside whichever subject they belong to — Ivan's kung fu sits in Party Tricks,
 * Greg's Arctic Circle in Around the World, Matt's golf story in Game On. There
 * is no generic "guess the teammate" column.
 *
 * Every one of the fourteen sign-ups gets both a personal clue and a clue built
 * from a niche topic they said they'd crush. `npm test` asserts it.
 *
 * `credit` names whose specialist subject a question came from. It is left off
 * personal clues, where it would give the answer away.

 *
 * Nothing here leaks: no fact used as a plain clue also appears as a statement
 * on a spot-the-lie card. The tests check that too.
 */
export const CATEGORIES: Category[] = [
  {
    name: 'Past Lives',
    clues: [
      {
        kind: 'lie', points: 100, person: 'Ivan', lieIndex: 2,
        statements: [
          `Worked for a cat litter box company.`,
          `Worked for a wine delivery company.`,
          `Worked at a bike repair shop.`,
        ],
      },
      {
        kind: 'lie', points: 200, person: 'Greg', lieIndex: 2,
        statements: [
          `Once worked at Outback Steakhouse.`,
          `Has travelled north of the Arctic Circle.`,
          `Once worked as a ski instructor.`,
        ],
      },
      { kind: 'standard', points: 300, question: `Which teammate was the lead singer of a rock band, with a song they wrote still floating around on YouTube?`, answer: `Ana` },
      { kind: 'standard', points: 400, question: `Which teammate worked on “Popstars,” the TV show that came before American Idol?`, answer: `Daniel` },
      { kind: 'standard', points: 500, question: `Which teammate’s first “real” job was in the men’s sportswear department at Nordstrom?`, answer: `Lucy` },
      { kind: 'standard', points: 600, question: `Which team member used to be a pediatric doctor?`, answer: `Juan` },
    ],
  },
  {
    name: 'Game On',
    clues: [
      { kind: 'standard', points: 100, question: `Only one nation has appeared at every FIFA World Cup since 1930. Which country?`, answer: `Brazil`, credit: `Shakir’s specialty` },
      { kind: 'standard', points: 200, question: `The NFL’s championship trophy carries the name of which legendary Green Bay Packers coach?`, answer: `Vince Lombardi`, credit: `Joe’s specialty` },
      {
        kind: 'lie', points: 300, person: 'Ask', lieIndex: 0,
        statements: [
          `Joined a rowing team on a drunken bet.`,
          `Biked 120 km on a drunken bet.`,
          `Ran a marathon on a drunken bet.`,
        ],
      },
      { kind: 'standard', points: 400, question: `Which teammate did fifteen years of kung fu?`, answer: `Ivan` },
      { kind: 'standard', points: 500, question: `Which teammate used to be a competitive figure skater?`, answer: `Hattie` },
      { kind: 'standard', points: 600, question: `Where did the US men’s team finish at the very first World Cup?`, answer: `Third — still their best ever`, credit: `Greg’s specialty` },
    ],
  },
  {
    name: 'Around the World',
    clues: [
      {
        kind: 'lie', points: 100, person: 'Daniel',
        prompt: `Daniel has an unusual list of former addresses. Which one is he inventing?`,
        lieIndex: 0,
        statements: [
          `A capsule hotel.`,
          `A bed and breakfast.`,
          `A commune.`,
        ],
      },
      { kind: 'standard', points: 200, question: `Which teammate lived in Madagascar for a year, then backpacked four months across India and four more through China and Japan?`, answer: `Juan` },
      { kind: 'standard', points: 300, question: `Which teammate was born in the Philippines?`, answer: `Shakir` },
      { kind: 'standard', points: 400, question: `AI companies now pay a fortune for “.ai” web addresses. The domain actually belongs to which Caribbean island?`, answer: `Anguilla`, credit: `Antonela’s specialty` },
      { kind: 'standard', points: 500, question: `The War of the Triple Alliance pitted Paraguay against Brazil, Argentina and which third country?`, answer: `Uruguay`, credit: `Jonattan’s specialty` },
      { kind: 'standard', points: 600, question: `Which state does Matt intend to never visit?`, answer: `South Dakota` },
    ],
  },
  {
    name: 'Pop Culture',
    clues: [
      { kind: 'standard', points: 100, question: `Premiering in 1989, this animated sitcom is the longest-running scripted prime-time show in US TV history.`, answer: `The Simpsons`, credit: `Ana & Juan’s specialty` },
      { kind: 'standard', points: 200, question: `This HBO drama became the network’s most-watched series ever before it ended in 2019.`, answer: `Game of Thrones`, credit: `Hattie’s specialty` },
      { kind: 'standard', points: 300, question: `Launched by Bandai in 1996, which egg-shaped handheld pet had to be fed and cleaned or it would die?`, answer: `The Tamagotchi`, credit: `Juan’s specialty` },
      { kind: 'standard', points: 400, question: `In the US the first Harry Potter book is “Harry Potter and the Sorcerer’s Stone.” What is it called in the rest of the world?`, answer: `“Harry Potter and the Philosopher’s Stone”`, credit: `Lucy’s specialty` },
      { kind: 'standard', points: 500, question: `Which teammate has watched all three Lord of the Rings films more than twenty times?`, answer: `Antonela` },
      { kind: 'standard', points: 600, question: `In 1991 this became the first animated film ever nominated for the Best Picture Oscar.`, answer: `Beauty and the Beast`, credit: `Hannah’s specialty` },
    ],
  },
  {
    name: 'Hard to Believe',
    clues: [
      {
        kind: 'lie', points: 100, person: 'Hattie', lieIndex: 1,
        statements: [
          `Fell down a waterfall.`,
          `Won a lifetime supply of brownies.`,
          `Was recruited for a reality dating show.`,
        ],
      },
      {
        kind: 'lie', points: 200, person: 'Alexis', lieIndex: 1,
        statements: [
          `Started a podcast in 2012.`,
          `Is pretty good at playing the electric guitar.`,
          `Collects frog-themed things, but doesn’t like real frogs.`,
        ],
      },
      {
        kind: 'lie', points: 300, person: 'Hannah', lieIndex: 0,
        statements: [
          `Won her first bike race.`,
          `Believes in ghosts.`,
          `Was on the ski team in high school.`,
        ],
      },
      {
        kind: 'lie', points: 400, person: 'Joe', lieIndex: 1,
        statements: [
          `Likes to sunbathe in the nude.`,
          `Challenged President Obama to a basketball game.`,
          `Could throw an 80 mph fastball at sixty.`,
        ],
      },
      { kind: 'standard', points: 500, question: `When this teammate was ten, their grandfather gave them a deer. Who?`, answer: `Jonattan` },
      { kind: 'standard', points: 600, question: `Which teammate was once a rabbit at the White House Easter Egg Roll?`, answer: `Lucy` },
    ],
  },
  {
    name: 'Odds & Ends',
    clues: [
      { kind: 'standard', points: 100, question: `This children’s author drew wartime political cartoons, wrote under a pen name, and was really named Theodor Geisel.`, answer: `Dr. Seuss`, credit: `Matt’s specialty` },
      { kind: 'standard', points: 200, question: `The wave of uprisings that swept the Middle East and North Africa in 2010–2011 is commonly known as what?`, answer: `The Arab Spring`, credit: `Hattie’s specialty` },
      { kind: 'standard', points: 300, question: `On Windows, which keyboard shortcut reopens the browser tab you just closed?`, answer: `Ctrl + Shift + T`, credit: `Antonela’s specialty` },
      {
        kind: 'lie', points: 400, person: 'Jonattan', lieIndex: 2,
        statements: [
          `Almost switched his college major to film.`,
          `Broke his leg playing soccer.`,
          `Won a 25K race.`,
        ],
      },
      { kind: 'standard', points: 500, question: `English borrowed the word “tycoon,” meaning a powerful businessman, in the 1800s — from the language of which country?`, answer: `Japan (from “taikun”)`, credit: `Ask’s specialty` },
      { kind: 'standard', points: 600, question: `Crude oil is separated into petrol, kerosene and diesel by which refining process, which relies on their different boiling points?`, answer: `Fractional distillation`, credit: `Ask’s specialty` },
    ],
  },
]

/**
 * The closing question. Deliberately NOT on the board: the host opens it from the
 * toolbar once the tiles are done, and it is worth more than any of them.
 *
 * A three-way match is the hardest shape available — there is no narrowing it down
 * from one clue to the next.
 */
export const FINAL_CLUE: Clue = {
  kind: 'match',
  points: 1000,
  prompt: `Match each fact to the right teammate.`,
  items: [
    { fact: `Delivered newspapers as a first job.`, person: `Greg` },
    { fact: `Is ambidextrous.`, person: `Ask` },
    { fact: `Has never had a cup of coffee.`, person: `Antonela` },
  ],
}

export const FINAL_CATEGORY = 'Final question'
/**
 * Near-white rather than a hue. It has to read as distinct from all six category
 * colours, and the previous blush pink read as an error state on a dark screen.
 */
export const FINAL_ACCENT = '#EEF1F8'

/**
 * Everyone playing. This seeds the roster and gets drawn into teams, so it is
 * players only.
 */
export const TEAMMATES = [
  'Matt', 'Hannah', 'Ivan', 'Daniel', 'Shakir', 'Lucy', 'Ask',
  'Juan', 'Antonela', 'Hattie', 'Ana', 'Greg', 'Joe', 'Jonattan',
]

/** Hosting rather than playing, so not in the draw — but still on the board. */
export const HOST = 'Alexis'

/**
 * Everyone who can be named in a clue. Wider than the roster, because the host has
 * facts on the board without being drafted onto a team.
 */
export const PEOPLE = [...TEAMMATES, HOST]

/** Played in 2–3 teams rather than as fourteen individuals. */
export const DEFAULT_TEAMS = ['Team 1', 'Team 2', 'Team 3']
