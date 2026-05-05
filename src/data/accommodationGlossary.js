// Plain-English explanations for the most common IEP / 504 accommodations.
// Match is fuzzy: lower-cased substring against the accommodation row text.
// First match wins, so order entries from most-specific to most-general.

const GLOSSARY = [
  // ── ACADEMIC / TESTING ────────────────────────────────────
  {
    keys: ['extended time', 'extra time', 'time and a half', '1.5x', '1.5 x', '2x time', 'double time'],
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
    keys: ['preferential seating', 'seat near', 'front of the room', 'seat in front', 'assigned seat'],
    title: 'Preferential seating',
    plain: 'The student is seated where they can best focus and access instruction — usually near the teacher, away from doors/windows, or with a strong peer.',
    looksLike: [
      'Confirm with the teacher that the assigned seat matches the IEP.',
      'If the student moves themselves, gently redirect — the IEP placement is usually for a reason.',
    ],
    watchOut: '"Preferential seating" without a specified location is left to staff judgment. Document where you placed them and why.',
  },
  {
    keys: ['frequent breaks', 'scheduled breaks', 'break pass', 'sensory break', 'movement break', 'brain break'],
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
    keys: ['reduced workload', 'shortened assignment', 'fewer problems', 'reduced number', 'modified assignment'],
    title: 'Reduced workload',
    plain: 'The student does fewer problems / shorter writing / less reading than peers, but covers the same skill. Quality over quantity.',
    looksLike: [
      'The teacher should mark which problems count. If they didn\'t, ask before docking points.',
      'Pick problems that span the skill (easy + medium + hard), not just the first N.',
    ],
    watchOut: 'Reduced workload is NOT a free pass. The student still has to demonstrate the skill.',
  },
  {
    keys: ['chunked', 'chunking', 'broken into', 'smaller pieces', 'one step at a time', 'task analysis'],
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
    keys: ['visual support', 'visual schedule', 'visual aid', 'picture support', 'graphic organizer', 'visual cue'],
    title: 'Visual supports',
    plain: 'Pictures, schedules, charts, or graphic organizers that show the structure of the day or task. Reduces working-memory load.',
    looksLike: [
      'Point to the visual when giving directions — don\'t just say it out loud.',
      'Update the schedule in front of the student when something changes (assembly, sub, fire drill).',
    ],
    watchOut: 'A visual support that the student never looks at is not doing its job. Reposition or simplify it.',
  },
  {
    keys: ['repeat directions', 'directions repeated', 'paraphrase directions', 'check for understanding', 'restate directions'],
    title: 'Repeat / rephrase directions',
    plain: 'Directions are restated, broken down, or rephrased so the student is sure of what to do. Often paired with a 1:1 check-in.',
    looksLike: [
      'After whole-group instructions, quietly rephrase to the student in your own words.',
      'Ask "What\'s the first thing you\'re doing?" — listen for whether they actually got it.',
    ],
    watchOut: 'Repeating the EXACT same words a third time rarely helps. Rephrase, don\'t replay.',
  },
  {
    keys: ['calculator', 'multiplication chart', 'number line', 'math facts chart', 'hundreds chart'],
    title: 'Calculator / math reference tools',
    plain: 'The student can use a calculator, multiplication chart, or number line because the goal of the assignment is the math reasoning, not the basic facts.',
    looksLike: [
      'Make sure the tool is on the desk before the assignment starts — don\'t make them ask in front of peers.',
      'For tests, confirm with the teacher whether the tool is allowed on this specific test (some skills tests block calculators by design).',
    ],
    watchOut: 'Some assessments deliberately test fluency without tools. Read the IEP carefully.',
  },
  {
    keys: ['scribe', 'oral response', 'dictate', 'speech-to-text', 'voice typing', 'speech to text'],
    title: 'Scribe / speech-to-text',
    plain: 'The student can dictate answers (to a person or speech-to-text software) instead of writing by hand. The skill being assessed is the thinking, not the handwriting.',
    looksLike: [
      'Write down EXACTLY what they say, including grammar errors — don\'t fix as you go unless the IEP says to.',
      'Read back what you wrote so they can confirm or revise.',
    ],
    watchOut: 'On a writing-mechanics test (spelling, grammar), scribing may not be allowed. Check first.',
  },
  {
    keys: ['reader', 'read aloud', 'text read', 'oral reading', 'human reader', 'text-to-speech', 'text to speech'],
    title: 'Read-aloud / reader / TTS',
    plain: 'A staff member or app reads the test/text aloud to the student because reading is not what the test is measuring.',
    looksLike: [
      'Read at a steady pace, no inflection that hints at the right answer.',
      'Re-read sections on request without sighing or rushing.',
    ],
    watchOut: 'Reading-comprehension assessments usually disallow read-aloud. Check the IEP and the test instructions.',
  },
  {
    keys: ['quiet', 'separate setting', 'small group', 'distraction-reduced', 'distraction reduced', 'alternate setting'],
    title: 'Quiet / distraction-reduced setting',
    plain: 'The student takes tests or does focus work in a smaller, quieter space — the resource room, a small group, or a corner of the library.',
    looksLike: [
      'Plan ahead — book the space, walk the student over before peers see them go.',
      'Same rules and time limits as the main room, just less noise.',
    ],
    watchOut: 'A "quiet setting" with another loud kid in it isn\'t quiet. Advocate for a real space.',
  },
  {
    keys: ['fidget', 'sensory tool', 'stress ball', 'wobble cushion', 'noise-cancel', 'headphone', 'weighted lap', 'weighted blanket', 'chewy'],
    title: 'Fidget / sensory tool',
    plain: 'The student is allowed to use a fidget, wobble cushion, weighted lap pad, headphones, etc. to regulate their body so their brain can focus.',
    looksLike: [
      'Keep the tool boring (no light-up, no noise-making).',
      'If the tool becomes a distraction, swap to a different one — don\'t remove the accommodation.',
    ],
    watchOut: 'Saying "you\'re distracting others" and removing the tool can violate the IEP. Replace, don\'t revoke.',
  },
  {
    keys: ['behavior plan', 'bip', 'behavior intervention', 'behavior support plan', 'positive behavior'],
    title: 'Behavior Intervention Plan (BIP)',
    plain: 'A specific written plan for how to respond to this student\'s behavior — what triggers it, what to do in the moment, what to do after.',
    looksLike: [
      'Read the BIP at the start of the year and again any time the behavior changes.',
      'Follow the de-escalation sequence in order; don\'t skip steps because the kid is "fine right now."',
    ],
    watchOut: 'Going off-script is the #1 way BIPs stop working. If the script doesn\'t fit, document and bring it back to the team.',
  },
  {
    keys: ['check in check out', 'cico', 'check-in/check-out', 'morning check', 'check-in'],
    title: 'Check-in / check-out (CICO)',
    plain: 'A consistent adult connects with the student at the start of the day and at the end. Builds relationship and gives the student a soft entry/exit ramp.',
    looksLike: [
      'Same person, same place, same time. Predictability is the whole point.',
      'Use the morning check to preview anything unusual that day (sub, schedule change, fire drill).',
    ],
    watchOut: 'Skipping a check-in "just for one day" can break the trust. Find a backup if you have to be out.',
  },
  {
    keys: ['transition warning', 'warning before', 'transition support', 'first/then', 'first then', 'countdown'],
    title: 'Transition warnings / first-then',
    plain: 'The student is given advance notice (and often a visual) before the class shifts activities. Reduces meltdowns at the boundary between tasks.',
    looksLike: [
      'Give the warning at a consistent interval (e.g., 5 min, then 2 min, then "time").',
      'Pair "First we finish this, then we go to..." with a picture or written cue.',
    ],
    watchOut: 'A warning that\'s buried inside another instruction (e.g., "okay everyone, two more minutes, AND don\'t forget your homework") can be missed by the student. Make it stand alone.',
  },

  // ── MEDICAL / VISION / HEARING ────────────────────────────
  {
    keys: ['glasses', 'corrective lens', 'eyeglasses', 'wears glasses'],
    title: 'Glasses (vision correction)',
    plain: 'The student needs to be wearing their glasses to access print, the board, screens, or the room safely. If glasses are missing or broken, work the student does without them is not a fair measure of what they know.',
    looksLike: [
      'Quietly check at the start of class that glasses are on. If not, ask once — don\'t make a scene.',
      'If glasses are at home, alert the teacher and offer a printed/larger-text copy of the work.',
      'Watch for glasses sliding down, headaches, squinting — those are signs the prescription needs a check-up.',
    ],
    watchOut: 'Don\'t lecture in front of peers. A missing pair of glasses is rarely defiance — it\'s usually a household issue.',
  },
  {
    keys: ['hearing aid', 'cochlear', 'fm system', 'audiologist', 'hearing impaired'],
    title: 'Hearing aid / FM system',
    plain: 'The student uses a hearing aid, cochlear implant, or an FM/DM system (a microphone the teacher wears). Without it, they\'re missing chunks of every spoken instruction.',
    looksLike: [
      'Check the FM mic is paired and on at the start of class.',
      'Face the student when you talk — captioning their lipread.',
      'In group/loud activities, repeat what classmates said.',
    ],
    watchOut: 'A dead battery makes the device useless. If the student says "it\'s not working," believe them and notify the teacher / nurse.',
  },
  {
    keys: ['large print', 'enlarged text', 'magnification', 'magnifier'],
    title: 'Large print / magnification',
    plain: 'Worksheets and texts are printed in a larger font, or the student uses a magnifier. Required for low-vision students to access the same material as peers.',
    looksLike: [
      'Pre-print larger versions when you know what the assignment is.',
      'On screens, help them turn on zoom (Ctrl + scroll, or OS-level zoom).',
    ],
    watchOut: 'Photocopying a page bigger isn\'t always enough — bold and contrast matter too.',
  },
  {
    keys: ['braille', 'tactile', 'screen reader', 'jaws', 'nvda'],
    title: 'Braille / screen reader',
    plain: 'The student is blind or has very low vision. They access text through Braille (raised dots) or a screen reader (software that speaks the text aloud).',
    looksLike: [
      'Get materials to the TVI (teacher of the visually impaired) early so they can be brailled in time.',
      'Describe what\'s on the screen / board out loud — "There\'s a graph here with three bars..."',
      'Don\'t move objects on their desk without telling them.',
    ],
    watchOut: 'Late requests for braille mean the student does without. Plan a week ahead, not the morning of.',
  },
  {
    keys: ['diabetes', 'blood sugar', 'insulin', 'glucose', 'snack as needed'],
    title: 'Diabetes management',
    plain: 'The student has diabetes. They may need to check blood sugar, eat a snack, take insulin, or visit the nurse on a schedule that doesn\'t match the bell.',
    looksLike: [
      'Let them eat or check their sugar in class without making them ask.',
      'Know the signs of low blood sugar (shakiness, sweating, confusion) — that\'s a nurse trip, not a behavior issue.',
      'Know where their medical kit is.',
    ],
    watchOut: 'Don\'t restrict bathroom or water during a high — those are real medical needs, not avoidance.',
  },
  {
    keys: ['seizure', 'epilepsy', 'epileptic'],
    title: 'Seizure precautions',
    plain: 'The student has a seizure disorder. Specific staff should know the seizure plan: how to keep them safe during a seizure, when to call 911, and how to log it after.',
    looksLike: [
      'Read the seizure action plan at the start of the year.',
      'During: keep them safe (move objects, time it). After: stay calm, let them rest, log it.',
      'Avoid known triggers if listed (flashing lights, missed sleep, etc.).',
    ],
    watchOut: 'Never put anything in their mouth. Time the seizure — over 5 min usually means call 911.',
  },
  {
    keys: ['allergy', 'epipen', 'epinephrine', 'anaphylaxis', 'allergic'],
    title: 'Severe allergy / EpiPen',
    plain: 'The student has a life-threatening allergy. Exposure can cause anaphylaxis — a swelling/closing-airway emergency. They (or staff) carry an EpiPen.',
    looksLike: [
      'Know exactly where the EpiPen is and how to use it.',
      'Be aware of the trigger (peanuts, latex, bee stings, etc.) and keep it out of the room.',
      'Check labels on any classroom snacks/treats.',
    ],
    watchOut: 'Anaphylaxis can come on in minutes. Hives + trouble breathing → EpiPen first, 911 second, principal third.',
  },
  {
    keys: ['asthma', 'inhaler'],
    title: 'Asthma / inhaler',
    plain: 'The student has asthma. They may need to use an inhaler before exercise or during an attack. Cold air, smoke, exertion, and strong smells can all trigger.',
    looksLike: [
      'Know where the inhaler is and let them get to it without delay.',
      'Watch for wheezing, coughing, hunched shoulders during PE / recess.',
      'Don\'t push them to "tough out" exercise during a flare.',
    ],
    watchOut: 'If the inhaler doesn\'t bring quick relief, call the nurse — that\'s heading toward an emergency.',
  },
  {
    keys: ['nurse', 'medication', 'meds at school', 'health plan'],
    title: 'Medication / nurse visits',
    plain: 'The student takes medication at school or has a health plan that requires nurse visits at specific times.',
    looksLike: [
      'Get them to the nurse at the scheduled time, not when "it\'s convenient."',
      'Returning meds can take time — let them complete the task without docking participation.',
    ],
    watchOut: 'Missing a med dose is a real problem. If the student is reluctant to go, find out why — don\'t just give in.',
  },

  // ── COMMUNICATION / SPEECH ────────────────────────────────
  {
    keys: ['aac', 'augmentative', 'communication device', 'tobii', 'speech device', 'communication board'],
    title: 'AAC / communication device',
    plain: 'The student communicates through a tablet, board, or device that speaks for them (AAC = augmentative and alternative communication). It is their voice, not a toy.',
    looksLike: [
      'Wait for them to finish their message — don\'t finish their sentence.',
      'Treat the device the way you\'d treat a peer\'s mouth: it stays with them all day.',
      'Charge / model on it / don\'t take it away as a punishment.',
    ],
    watchOut: 'Removing or limiting their AAC is removing their voice. That can be a civil-rights violation, not just an IEP one.',
  },
  {
    keys: ['speech therapy', 'speech language', 'slp', 'articulation', 'pragmatic'],
    title: 'Speech / language therapy',
    plain: 'The student works with a speech-language pathologist (SLP) on talking, listening, social communication, or articulation.',
    looksLike: [
      'Allow them to be pulled at the scheduled time without making it dramatic.',
      'Generalize: when the SLP teaches "ask before borrowing," reinforce it in your room too.',
    ],
    watchOut: 'Don\'t correct articulation in front of peers. Repeat the word the right way once and move on.',
  },
  {
    keys: ['interpreter', 'asl', 'sign language'],
    title: 'Sign language / interpreter',
    plain: 'A deaf or hard-of-hearing student uses American Sign Language (or other sign system). An interpreter signs what\'s said and voices what they sign.',
    looksLike: [
      'Talk to the student, not the interpreter.',
      'Wait for the interpreter to finish before calling on the student.',
      'In group activities, slow the conversation pace — interpreters lag the speaker by a few seconds.',
    ],
    watchOut: 'The interpreter is not the student\'s tutor or aide. They translate; they don\'t teach.',
  },

  // ── OT / PT / MOTOR ───────────────────────────────────────
  {
    keys: ['occupational therapy', 'ot ', 'fine motor', 'pencil grip', 'slant board'],
    title: 'Occupational therapy / fine motor',
    plain: 'The student works with an OT on fine motor (handwriting, scissors), self-care, sensory regulation, or executive function. They may use special tools like a slant board or pencil grip.',
    looksLike: [
      'Make the tool available without making them ask.',
      'Allow short hand breaks during long writing tasks.',
      'Accept typed work when handwriting is the bottleneck, not the goal.',
    ],
    watchOut: 'A child who is stalling on writing isn\'t always defiant — sometimes their hand really hurts.',
  },
  {
    keys: ['physical therapy', 'pt ', 'gross motor', 'mobility', 'wheelchair', 'walker'],
    title: 'Physical therapy / mobility',
    plain: 'The student works with a PT on gross motor, walking, balance, or mobility. May use a wheelchair, walker, or other equipment.',
    looksLike: [
      'Plan transitions with extra time. Take the elevator or accessible route together.',
      'Don\'t push or move equipment without asking.',
      'In PE, follow the modified plan from the PT.',
    ],
    watchOut: 'Spaces have to actually be accessible. If a classroom is blocked by a desk, fix it — don\'t leave the student waiting.',
  },
  {
    keys: ['typed', 'typing instead', 'word processor', 'keyboard'],
    title: 'Type instead of write',
    plain: 'The student uses a keyboard / Chromebook / iPad instead of writing by hand. Their thinking gets to the page faster than handwriting allows.',
    looksLike: [
      'Make the device available at the start of class. Charged.',
      'Save and print on time so the work joins the class\'s.',
      'Allow extra time when tech misbehaves — that\'s on the tool, not the kid.',
    ],
    watchOut: 'On handwriting-skill assessments, the typed accommodation may not apply. Read the IEP.',
  },

  // ── BEHAVIOR / EMOTIONAL ──────────────────────────────────
  {
    keys: ['cool down', 'cool-down', 'calm down spot', 'safe space', 'regulation corner', 'reset zone'],
    title: 'Cool-down / safe space',
    plain: 'A specific spot (in the room or down the hall) where the student can go to reset when they feel themselves losing it. The point is to leave BEFORE the meltdown, not after.',
    looksLike: [
      'Practice using the spot when the student is calm so they remember it when they\'re not.',
      'Set a soft time limit (a song, a sand timer) so the spot doesn\'t become an all-period exit.',
      'Don\'t talk through the feeling while they\'re still hot. Wait it out.',
    ],
    watchOut: 'Forcing them out of the spot too early can re-trigger them. Wait for shoulders to drop.',
  },
  {
    keys: ['point sheet', 'token chart', 'reinforcement', 'sticker chart', 'daily report card'],
    title: 'Behavior point sheet / token system',
    plain: 'A small chart that tracks specific behaviors through the day (focus, calm hands, kind words). Earned points go toward a reward at home or school.',
    looksLike: [
      'Mark the sheet honestly and frequently — not just at the end.',
      'Show the kid how they\'re doing midday — they need feedback to course-correct.',
      'Send the sheet home / to the teacher in charge of the chart at the end of the day.',
    ],
    watchOut: 'A chart that\'s only filled out when the kid is bad teaches them to give up. Catch them being good.',
  },
  {
    keys: ['social story', 'social-emotional', 'sel ', 'priming'],
    title: 'Social stories / priming',
    plain: 'Before a tough situation (assembly, sub, fire drill), the student is shown a short story or sequence of pictures explaining what will happen. Reduces anxiety from surprise.',
    looksLike: [
      'Read the story together a few minutes before the event.',
      'Keep a few "blank" social stories on hand for unplanned changes.',
    ],
    watchOut: 'A social story 3 minutes before a fire drill can\'t happen — that\'s why a generic "what to do during a drill" story should already exist.',
  },
  {
    keys: ['take a walk', 'walk pass', 'errand', 'helper job'],
    title: 'Walk pass / helper job',
    plain: 'A scheduled chance to leave the room productively — bring something to the office, stack chairs, deliver attendance. Movement that resets the nervous system.',
    looksLike: [
      'Make it real, not babysitting. Kids can tell when an "errand" is fake.',
      'Set a return time so the walk doesn\'t become avoidance.',
    ],
    watchOut: 'Don\'t use the walk pass as a punishment ("go take a walk because you\'re being annoying"). It\'s a tool, not a banishment.',
  },

  // ── ENVIRONMENTAL ─────────────────────────────────────────
  {
    keys: ['lighting', 'fluorescent', 'natural light', 'reduced lighting', 'dim'],
    title: 'Lighting accommodation',
    plain: 'The student is sensitive to bright fluorescent lights — they can cause headaches, sensory overload, or migraines. Solutions: a desk lamp, sit near a window, or a hat/visor.',
    looksLike: [
      'Position the student away from buzzing/flickering bulbs.',
      'Allow a hat or hood inside if the IEP says so, even if school policy says no hats.',
    ],
    watchOut: 'Don\'t override the accommodation just because it conflicts with the dress code. The IEP wins.',
  },
  {
    keys: ['noise', 'auditory', 'loud environment', 'over-stimulating'],
    title: 'Noise / auditory sensitivity',
    plain: 'Loud or unpredictable sound (cafeteria, fire drills, gym) is painful or overwhelming for this student. Noise-cancelling headphones, ear defenders, or a quieter alternate space help.',
    looksLike: [
      'Allow ear protection in noisy settings without making it a discussion.',
      'Give a heads-up before drills when possible.',
      'Have a quieter alternate spot for cafeteria/assembly if the student needs it.',
    ],
    watchOut: 'A meltdown after a fire drill isn\'t "drama" — it can be a real sensory injury.',
  },

  // ── ATTENDANCE / SCHEDULE ─────────────────────────────────
  {
    keys: ['flexible attendance', 'late start', 'partial day', 'modified schedule'],
    title: 'Flexible attendance / modified schedule',
    plain: 'The student is allowed to come late, leave early, or skip certain classes for documented reasons (medical, mental health, anxiety re-entry).',
    looksLike: [
      'Don\'t comment on lateness or early dismissal in front of peers.',
      'Email/share missed work efficiently — they\'re not skipping for fun.',
      'Welcome them back warmly; don\'t lecture.',
    ],
    watchOut: 'Marking them absent or "tardy" against their IEP can affect grades and discipline records. Use the right code.',
  },
  {
    keys: ['homework reduction', 'no homework', 'homework modified', 'reduced homework'],
    title: 'Reduced / modified homework',
    plain: 'Homework is shortened, removed, or replaced with in-class completion. Often given when home situations make extra work impossible.',
    looksLike: [
      'Don\'t lower the grade for "missing" homework that the IEP excused.',
      'If you assign in-class time as the homework substitute, follow through and protect it.',
    ],
    watchOut: 'A homework reduction is not a homework forfeit. The student still has to learn the skill in class.',
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
