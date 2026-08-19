import type { Category } from '../types'

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
 * These get read aloud to the whole company, so clues have to be fine to say out
 * loud about a colleague. A question is not acceptable just because the fact is
 * true or the person submitted it: framing matters. One earlier clue asked which
 * player "whipped off her shirt" after a World Cup winner — a true and famous
 * moment, but it reduced a landmark achievement to a woman's body and had no place
 * here. When in doubt, ask what it sounds like read out to the room.
 *
 * Nothing here leaks: no fact used as a plain clue also appears as a statement
 * on a spot-the-lie card. The tests check that too.
 */
export const CATEGORIES: Category[] = [
  {
    name: 'Origin Stories',
    clues: [
      { kind: 'standard', points: 100, question: `Which teammate’s very first job was delivering newspapers?`, answer: `Greg` },
      { kind: 'standard', points: 200, question: `Which teammate’s first “real” job was in the men’s sportswear department at Nordstrom?`, answer: `Lucy` },
      { kind: 'standard', points: 300, question: `Which teammate used to brew their own beer?`, answer: `Hannah` },
      { kind: 'standard', points: 400, question: `When this teammate was ten, their grandfather gave them a deer. Who?`, answer: `Jonattan` },
      { kind: 'standard', points: 500, question: `Which teammate worked on “Popstars,” the TV show that came before American Idol?`, answer: `Daniel` },
      {
        kind: 'lie', points: 600, person: 'Ivan', lieIndex: 2,
        statements: [
          `Worked for a cat litter box company.`,
          `Worked for a wine delivery company.`,
          `Worked at a bike repair shop.`,
        ],
      },
    ],
  },
  {
    name: 'Game On',
    clues: [
      { kind: 'standard', points: 100, question: `Which teammate used to be a competitive figure skater?`, answer: `Hattie` },
      { kind: 'standard', points: 200, question: `Only one nation has appeared at every FIFA World Cup since 1930. Which country?`, answer: `Brazil`, credit: `Shakir’s specialty — sports` },
      { kind: 'standard', points: 300, question: `Which teammate did fifteen years of kung fu?`, answer: `Ivan` },
      { kind: 'standard', points: 400, question: `The NFL’s championship trophy carries the name of which legendary Green Bay Packers coach?`, answer: `Vince Lombardi`, credit: `Joe’s specialty — American football` },
      { kind: 'standard', points: 500, question: `Where did the US men’s team finish at the very first World Cup?`, answer: `Third — still their best ever`, credit: `Greg’s specialty — US soccer` },
      {
        kind: 'lie', points: 600, person: 'Ask', lieIndex: 2,
        statements: [
          `Biked 120 km on a drunken bet.`,
          `Ran a marathon on a drunken bet.`,
          `Joined a rowing team on a drunken bet.`,
        ],
      },
    ],
  },
  {
    name: 'Around the World',
    clues: [
      { kind: 'standard', points: 100, question: `Which teammate was born in the Philippines?`, answer: `Shakir` },
      {
        kind: 'lie', points: 200, person: 'Joe', lieIndex: 2,
        statements: [
          `Has travelled through 48 of the 50 US states.`,
          `Could throw an 80 mph fastball at sixty.`,
          `Challenged President Obama to a basketball game.`,
        ],
      },
      { kind: 'standard', points: 300, question: `Which teammate lived in Madagascar for a year, then backpacked four months across India and four more through China and Japan?`, answer: `Juan` },
      { kind: 'standard', points: 400, question: `Which teammate says they intend never to go to South Dakota?`, answer: `Matt` },
      {
        kind: 'lie', points: 500, person: 'Daniel',
        prompt: `Daniel has an unusual list of former addresses. Which one is he inventing?`,
        lieIndex: 2,
        statements: [
          `A bed and breakfast.`,
          `A commune.`,
          `A capsule hotel.`,
        ],
      },
      {
        kind: 'lie', points: 600, person: 'Greg', lieIndex: 2,
        statements: [
          `Once worked at Outback Steakhouse.`,
          `Has travelled north of the Arctic Circle.`,
          `Once worked as a ski instructor.`,
        ],
      },
    ],
  },
  {
    name: 'Stage & Screen',
    clues: [
      { kind: 'standard', points: 100, question: `Premiering in 1989, this animated sitcom is the longest-running scripted prime-time show in US TV history.`, answer: `The Simpsons`, credit: `Ana & Juan’s specialty — cartoons` },
      { kind: 'standard', points: 200, question: `In 1991 this became the first animated film ever nominated for the Best Picture Oscar.`, answer: `Beauty and the Beast`, credit: `Hannah’s specialty — Disney` },
      { kind: 'standard', points: 300, question: `In the US the first Harry Potter book is “Harry Potter and the Sorcerer’s Stone.” What is it called in the rest of the world?`, answer: `“Harry Potter and the Philosopher’s Stone”`, credit: `Lucy’s specialty — Harry Potter` },
      { kind: 'standard', points: 400, question: `Which teammate was the lead singer of a rock band, with a song they wrote still floating around on YouTube?`, answer: `Ana` },
      { kind: 'standard', points: 500, question: `Which teammate has watched all three Lord of the Rings films more than twenty times?`, answer: `Antonela` },
      { kind: 'standard', points: 600, question: `This HBO drama became the network’s most-watched series ever before it ended in 2019.`, answer: `Game of Thrones`, credit: `Hattie’s specialty — TV shows` },
    ],
  },
  {
    name: 'Odds & Ends',
    clues: [
      {
        kind: 'lie', points: 100, person: 'Hannah', lieIndex: 2,
        statements: [
          `Believes in ghosts.`,
          `Was on the ski team in high school.`,
          `Won her first bike race.`,
        ],
      },
      { kind: 'standard', points: 200, question: `On Windows, which keyboard shortcut reopens the browser tab you just closed?`, answer: `Ctrl + Shift + T`, credit: `Antonela’s specialty — keyboard shortcuts` },
      { kind: 'standard', points: 300, question: `Which teammate was once a rabbit at the White House Easter Egg Roll?`, answer: `Lucy` },
      { kind: 'standard', points: 400, question: `A turbocharger forces extra air into an engine. What spins it?`, answer: `The engine’s own exhaust gases`, credit: `Ivan’s specialty — car mechanics` },
      { kind: 'standard', points: 500, question: `Crude oil is separated into petrol, kerosene and diesel by which refining process, which relies on their different boiling points?`, answer: `Fractional distillation`, credit: `Ask’s specialty — oil & petroleum products` },
      { kind: 'standard', points: 600, question: `Match each to the right teammate: is a twin · is ambidextrous · has never had a cup of coffee.`, answer: `Matt (twin) · Ask (ambidextrous) · Antonela (coffee)` },
    ],
  },
  {
    name: 'Words & History',
    clues: [
      { kind: 'standard', points: 100, question: `This children’s author drew wartime political cartoons, wrote under a pen name, and was really named Theodor Geisel.`, answer: `Dr. Seuss`, credit: `Matt’s specialty — children’s books` },
      { kind: 'standard', points: 200, question: `The wave of uprisings that swept the Middle East and North Africa in 2010–2011 is commonly known as what?`, answer: `The Arab Spring`, credit: `Hattie’s specialty — recent Middle East, Europe & US history` },
      { kind: 'standard', points: 300, question: `Name three foods that start with the letter Q.`, answer: `e.g. quiche, quinoa, quince, quail, quesadilla`, credit: `Daniel’s specialty — foods starting with Q` },
      { kind: 'standard', points: 400, question: `AI companies now pay a fortune for “.ai” web addresses. The domain actually belongs to which Caribbean island?`, answer: `Anguilla`, credit: `Antonela’s specialty — countries by internet domain` },
      { kind: 'standard', points: 500, question: `English borrowed the word “tycoon,” meaning a powerful businessman, in the 1800s — from the language of which country?`, answer: `Japan (from “taikun”)`, credit: `Ask’s specialty — English loanwords` },
      { kind: 'standard', points: 600, question: `The War of the Triple Alliance pitted Paraguay against Brazil, Argentina and which third country?`, answer: `Uruguay`, credit: `Jonattan’s specialty — Paraguayan history` },
    ],
  },
]

/** Everyone who filled in the sign-up form, for the coverage check in the tests. */
export const TEAMMATES = [
  'Matt', 'Hannah', 'Ivan', 'Daniel', 'Shakir', 'Lucy', 'Ask',
  'Juan', 'Antonela', 'Hattie', 'Ana', 'Greg', 'Joe', 'Jonattan',
]

/** Played in 2–3 teams rather than as fourteen individuals. */
export const DEFAULT_TEAMS = ['Team 1', 'Team 2', 'Team 3']
