// ── Dad jokes & boring-grown-up-things decoy data ────────────
// Used by Stealth Mode 2.0 to make the screen so deeply uninteresting
// to a curious kid that they bounce off.
//
// Style notes:
//   - Pure groan-tier dad jokes. Puns, math jokes, dad-isms.
//   - No pop culture references (they age fast).
//   - Family-safe. No politics, religion, or anything age-inappropriate.
//   - Boring topics should sound like adult-tax-document territory.

export const DAD_JOKES = [
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "Why don't scientists trust atoms? Because they make up everything.",
  "I told my wife she was drawing her eyebrows too high. She looked surprised.",
  "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them.",
  "Why did the scarecrow win an award? Because he was outstanding in his field.",
  "I used to hate facial hair. But then it grew on me.",
  "What do you call a fake noodle? An impasta.",
  "Why did the bicycle fall over? It was two-tired.",
  "I'm on a seafood diet. I see food, and I eat it.",
  "Parallel lines have so much in common. It's a shame they'll never meet.",
  "What do you call a fish wearing a crown? Your royal haddock.",
  "I would tell you a joke about pizza, but it's a little cheesy.",
  "How do you organize a space party? You planet.",
  "Why don't eggs tell jokes? They'd crack each other up.",
  "I bought shoes from a drug dealer. I don't know what he laced them with, but I was tripping all day.",
  "What's the best thing about Switzerland? I don't know, but the flag is a big plus.",
  "I asked my dog what's two minus two. He said nothing.",
  "Did you hear about the kidnapping at the playground? They woke up.",
  "Why don't skeletons fight each other? They don't have the guts.",
  "I told a chemistry joke. There was no reaction.",
  "What did the grape say when it got stepped on? Nothing — it just let out a little wine.",
  "Why did the math book look sad? It had too many problems.",
  "I'm terrified of elevators. I'm going to start taking steps to avoid them.",
  "What do you call cheese that isn't yours? Nacho cheese.",
  "I'm reading a book on the history of glue. I just can't seem to put it down.",
];

export const BORING_ADULT_TOPICS = [
  'Quarterly mortgage refinance rate analysis',
  'Tax form 1099-MISC line-by-line walkthrough',
  'HOA meeting minutes from last Tuesday',
  'Lawn mower oil change interval recommendations',
  'Roth IRA contribution limit projections (2026 edition)',
  'Comparison of premium vs. regular gas at current pump prices',
  'Reading the new water-softener manual cover to cover',
  'Spreadsheet of garage shelf organization options',
  'Furnace filter replacement schedule (MERV ratings explained)',
  'Insurance deductible comparison for the next renewal',
  'Discussing crab grass prevention strategies',
  'Reviewing the 47-page car warranty for fine print',
  'Deciding whether to extend the dishwasher service plan',
  'Reading the slow cooker safety guidelines',
  'Comparing toilet flange brands at the hardware store',
];

// Returns a pseudo-random joke. Caller can pass an index to keep
// "next joke" deterministic during render cycles.
export function pickJoke(seed) {
  if (typeof seed === 'number' && seed >= 0) {
    return DAD_JOKES[seed % DAD_JOKES.length];
  }
  return DAD_JOKES[Math.floor(Math.random() * DAD_JOKES.length)];
}

// Returns N boring topics, randomized. Stable per `seed` if provided.
export function pickBoringTopics(n = 5, seed = null) {
  const list = [...BORING_ADULT_TOPICS];
  // Fisher-Yates with a deterministic-ish shuffle when seeded.
  let s = seed == null ? Math.random() * 1000000 : seed;
  for (let i = list.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, Math.min(n, list.length));
}
