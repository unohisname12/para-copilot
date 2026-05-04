// Plain-English explanations for the most common IEP / 504 accommodations.
// Match is fuzzy: lower-cased substring against the accommodation row text.
// First match wins, so order entries from most-specific to most-general.

const GLOSSARY = [
  {
    keys: ['extended time', 'extra time', 'time and a half', '1.5x', '1.5 x'],
    title: 'Extended time',
    plain: 'The student gets more time than the regular class to finish work or tests — usually 1.5x or 2x. Slow processing or anxiety should not lower their score.',
    looksLike: [
      'Don\'t mark missing/late while they are still inside the extended window.',
      'For tests, coordinate with the gen-ed teacher so the student is not pulled before they finish.',
      'For class work, give them a clear "stopping point" in case the period ends.',
    ],
    watchOut: 'Extended time is not unlimited time. The accommodation usually has a cap — check the IEP if unsure.',
  },
  {
    keys: ['preferential seating', 'seat near', 'front of the room', 'seat in front'],
    title: 'Preferential seating',
    plain: 'The student is seated where they can best focus and access instruction — usually near the teacher, away from doors/windows, or with a strong peer.',
    looksLike: [
      'Confirm with the teacher that the assigned seat matches the IEP.',
      'If the student moves themselves, gently redirect — the IEP placement is usually for a reason.',
    ],
    watchOut: '"Preferential seating" without a specified location is left to staff judgment. Document where you placed them and why.',
  },
  {
    keys: ['frequent breaks', 'scheduled breaks', 'break pass', 'sensory break', 'movement break'],
    title: 'Frequent / scheduled breaks',
    plain: 'The student is allowed to leave the work for a short reset before they hit overload. Breaks are a regulation tool, not a reward.',
    looksLike: [
      'Honor the break request even if the timing is "bad" — the alternative is usually escalation.',
      'Keep breaks short (2–5 min) and predictable. Walk to a water fountain, breathe, reset.',
      'If they are using breaks to avoid all work, log it and bring it up at the next IEP team meeting — do not unilaterally revoke the accommodation.',
    ],
    watchOut: 'Pulling the break pass to "make a point" can be an IEP violation. Address overuse through the team, not in the moment.',
  },
  {
    keys: ['reduced workload', 'shortened assignment', 'fewer problems', 'reduced number'],
    title: 'Reduced workload',
    plain: 'The student does fewer problems / shorter writing / less reading than peers, but covers the same skill. Quality over quantity.',
    looksLike: [
      'The teacher should mark which problems count. If they didn\'t, ask before docking points.',
      'Pick problems that span the skill (easy + medium + hard), not just the first N.',
    ],
    watchOut: 'Reduced workload is NOT a free pass. The student still has to demonstrate the skill.',
  },
  {
    keys: ['chunked', 'chunking', 'broken into', 'smaller pieces', 'one step at a time'],
    title: 'Chunked tasks',
    plain: 'Big assignments are broken into smaller, ordered pieces. The student tackles one chunk at a time so the work doesn\'t feel overwhelming.',
    looksLike: [
      'Cover the rest of the page with a sticky note or fold the worksheet.',
      'Confirm completion of one chunk before showing the next.',
      'Praise progress per chunk, not just at the end.',
    ],
    watchOut: 'If the chunks themselves are too big, the student will still shut down. Adjust size based on what you see.',
  },
  {
    keys: ['visual support', 'visual schedule', 'visual aid', 'picture support', 'graphic organizer'],
    title: 'Visual supports',
    plain: 'Pictures, schedules, charts, or graphic organizers that show the structure of the day or task. Reduces working-memory load.',
    looksLike: [
      'Point to the visual when giving directions — don\'t just say it out loud.',
      'Update the schedule in front of the student when something changes (assembly, sub, fire drill).',
    ],
    watchOut: 'A visual support that the student never looks at is not doing its job. Reposition or simplify it.',
  },
  {
    keys: ['repeat directions', 'directions repeated', 'paraphrase directions', 'check for understanding'],
    title: 'Repeat / rephrase directions',
    plain: 'Directions are restated, broken down, or rephrased so the student is sure of what to do. Often paired with a 1:1 check-in.',
    looksLike: [
      'After whole-group instructions, quietly rephrase to the student in your own words.',
      'Ask "What\'s the first thing you\'re doing?" — listen for whether they actually got it.',
    ],
    watchOut: 'Repeating the EXACT same words a third time rarely helps. Rephrase, don\'t replay.',
  },
  {
    keys: ['calculator', 'multiplication chart', 'number line'],
    title: 'Calculator / math reference tools',
    plain: 'The student can use a calculator, multiplication chart, or number line because the goal of the assignment is the math reasoning, not the basic facts.',
    looksLike: [
      'Make sure the tool is on the desk before the assignment starts — don\'t make them ask in front of peers.',
      'For tests, confirm with the teacher whether the tool is allowed on this specific test (some skills tests block calculators by design).',
    ],
    watchOut: 'Some assessments deliberately test fluency without tools. Read the IEP carefully.',
  },
  {
    keys: ['scribe', 'oral response', 'dictate', 'speech-to-text', 'voice typing'],
    title: 'Scribe / oral response',
    plain: 'The student can dictate answers (to a person or speech-to-text software) instead of writing by hand. The skill being assessed is the thinking, not the handwriting.',
    looksLike: [
      'Write down EXACTLY what they say, including grammar errors — don\'t fix as you go unless the IEP says to.',
      'Read back what you wrote so they can confirm or revise.',
    ],
    watchOut: 'On a writing-mechanics test (spelling, grammar), scribing may not be allowed. Check first.',
  },
  {
    keys: ['reader', 'read aloud', 'text read', 'oral reading'],
    title: 'Read-aloud / reader',
    plain: 'A staff member or app reads the test/text aloud to the student because reading is not what the test is measuring.',
    looksLike: [
      'Read at a steady pace, no inflection that hints at the right answer.',
      'Re-read sections on request without sighing or rushing.',
    ],
    watchOut: 'Reading-comprehension assessments usually disallow read-aloud. Check the IEP and the test instructions.',
  },
  {
    keys: ['quiet', 'separate setting', 'small group', 'distraction-reduced'],
    title: 'Quiet / distraction-reduced setting',
    plain: 'The student takes tests or does focus work in a smaller, quieter space — the resource room, a small group, or a corner of the library.',
    looksLike: [
      'Plan ahead — book the space, walk the student over before peers see them go.',
      'Same rules and time limits as the main room, just less noise.',
    ],
    watchOut: 'A "quiet setting" with another loud kid in it isn\'t quiet. Advocate for a real space.',
  },
  {
    keys: ['fidget', 'sensory tool', 'stress ball', 'wobble cushion', 'noise-cancel', 'headphone'],
    title: 'Fidget / sensory tool',
    plain: 'The student is allowed to use a fidget, wobble cushion, weighted lap pad, headphones, etc. to regulate their body so their brain can focus.',
    looksLike: [
      'Keep the tool boring (no light-up, no noise-making).',
      'If the tool becomes a distraction, swap to a different one — don\'t remove the accommodation.',
    ],
    watchOut: 'Saying "you\'re distracting others" and removing the tool can violate the IEP. Replace, don\'t revoke.',
  },
  {
    keys: ['behavior plan', 'bip', 'behavior intervention'],
    title: 'Behavior Intervention Plan (BIP)',
    plain: 'A specific written plan for how to respond to this student\'s behavior — what triggers it, what to do in the moment, what to do after.',
    looksLike: [
      'Read the BIP at the start of the year and again any time the behavior changes.',
      'Follow the de-escalation sequence in order; don\'t skip steps because the kid is "fine right now."',
    ],
    watchOut: 'Going off-script is the #1 way BIPs stop working. If the script doesn\'t fit, document and bring it back to the team.',
  },
  {
    keys: ['check in check out', 'cico', 'check-in/check-out', 'morning check'],
    title: 'Check-in / check-out',
    plain: 'A consistent adult connects with the student at the start of the day and at the end. Builds relationship and gives the student a soft entry/exit ramp.',
    looksLike: [
      'Same person, same place, same time. Predictability is the whole point.',
      'Use the morning check to preview anything unusual that day (sub, schedule change, fire drill).',
    ],
    watchOut: 'Skipping a check-in "just for one day" can break the trust. Find a backup if you have to be out.',
  },
  {
    keys: ['transition warning', 'warning before', 'transition support', 'first/then'],
    title: 'Transition warnings / first-then',
    plain: 'The student is given advance notice (and often a visual) before the class shifts activities. Reduces meltdowns at the boundary between tasks.',
    looksLike: [
      'Give the warning at a consistent interval (e.g., 5 min, then 2 min, then "time").',
      'Pair "First we finish this, then we go to..." with a picture or written cue.',
    ],
    watchOut: 'A warning that\'s buried inside another instruction (e.g., "okay everyone, two more minutes, AND don\'t forget your homework") can be missed by the student. Make it stand alone.',
  },
];

// Returns the matched glossary entry or null. Pure.
export function lookupAccommodation(text) {
  if (!text) return null;
  const haystack = String(text).toLowerCase();
  for (const entry of GLOSSARY) {
    for (const key of entry.keys) {
      if (haystack.includes(key)) return entry;
    }
  }
  return null;
}

export const ACCOMMODATION_GLOSSARY = GLOSSARY;
