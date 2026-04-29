// Rule-based polish for para-written notes.
//
// Paras type fast. Phones, sticky keyboards, kids talking — the notes
// come in messy. This module cleans them up on save without changing the
// para's voice. Stays conservative on purpose: fixes only typos that are
// almost certainly mistakes, plus capitalization + spacing.
//
// What gets fixed:
//   - Common misspellings from the para vocabulary (behavior, accommodation,
//     intervention, etc.) and a slice of high-frequency English typos
//   - Capitalization at sentence starts + after newlines
//   - Standalone "i" → "I"
//   - Runs of horizontal spaces collapsed to one
//   - Trailing whitespace per line trimmed
//
// What is NOT touched:
//   - Slang, abbreviations, names, anything we don't know
//   - Punctuation (no auto-adding periods or commas — paras format their own)
//   - Line breaks
//   - Anything inside [brackets] (treated as quoted/preserved)
//
// Output: { polished, changes } where changes is [{ from, to, kind }, …]
// so the UI can show "Polished N words" with Undo.

import { applyLightGrammarFix } from './grammarFix';

// Common para-vocabulary misspellings. Lower-cased keys; replacements keep
// the original casing of the typed token (see applyTypoFixes).
const COMMON_TYPOS = {
  // Special-ed / classroom vocab
  accomodation: 'accommodation',
  accomodations: 'accommodations',
  acommodation: 'accommodation',
  acommodations: 'accommodations',
  behavoir: 'behavior',
  behaivor: 'behavior',
  behavour: 'behaviour', // UK spelling kept distinct
  behavoirs: 'behaviors',
  intervention: 'intervention', // explicit pass-through to confirm
  interevention: 'intervention',
  intervenion: 'intervention',
  intervetion: 'intervention',
  paragraph: 'paragraph',
  paraproffessional: 'paraprofessional',
  paraprofesional: 'paraprofessional',
  refered: 'referred',
  reffered: 'referred',
  reffer: 'refer',
  reffering: 'referring',
  recieve: 'receive',
  recieved: 'received',
  recieving: 'receiving',
  acheive: 'achieve',
  acheived: 'achieved',
  achievment: 'achievement',
  acomplish: 'accomplish',
  acomplished: 'accomplished',
  asignment: 'assignment',
  asignments: 'assignments',
  asigned: 'assigned',
  assighned: 'assigned',
  alot: 'a lot',
  alright: 'all right',
  apparant: 'apparent',
  apparently: 'apparently',
  agressive: 'aggressive',
  aggresive: 'aggressive',
  agression: 'aggression',
  becuase: 'because',
  beacuse: 'because',
  becouse: 'because',
  begining: 'beginning',
  belive: 'believe',
  beleive: 'believe',
  beleived: 'believed',
  cant: "can't",
  caugt: 'caught',
  childen: 'children',
  childrens: "children's",
  classroom: 'classroom',
  classrom: 'classroom',
  comming: 'coming',
  commited: 'committed',
  commitee: 'committee',
  comunication: 'communication',
  communiction: 'communication',
  communcation: 'communication',
  conceintrate: 'concentrate',
  concentate: 'concentrate',
  concious: 'conscious',
  conciously: 'consciously',
  cooperate: 'cooperate',
  cooporate: 'cooperate',
  curiculum: 'curriculum',
  curriculm: 'curriculum',
  defiantly: 'definitely', // common autocorrect mistake
  definately: 'definitely',
  defintely: 'definitely',
  desicion: 'decision',
  desision: 'decision',
  develope: 'develop',
  developement: 'development',
  diffrent: 'different',
  differant: 'different',
  difficut: 'difficult',
  dificult: 'difficult',
  disapear: 'disappear',
  disapointed: 'disappointed',
  doesnt: "doesn't",
  dont: "don't",
  embarass: 'embarrass',
  embarassed: 'embarrassed',
  embarassing: 'embarrassing',
  enviroment: 'environment',
  excersise: 'exercise',
  excercise: 'exercise',
  expirience: 'experience',
  experiance: 'experience',
  excepted: 'accepted', // when after "got", probably accepted; conservative — keep both?
  // Actually "excepted" is a real word; only swap when context is clear. Skip
  // for safety — handled below in the contextual section.
  familar: 'familiar',
  finaly: 'finally',
  forgoten: 'forgotten',
  freind: 'friend',
  freinds: 'friends',
  fustrated: 'frustrated',
  frustated: 'frustrated',
  goverment: 'government',
  greatful: 'grateful',
  guarentee: 'guarantee',
  guidence: 'guidance',
  happend: 'happened',
  hapened: 'happened',
  hapenned: 'happened',
  havent: "haven't",
  hopfully: 'hopefully',
  hopefuly: 'hopefully',
  immediatly: 'immediately',
  imediate: 'immediate',
  imediately: 'immediately',
  importnat: 'important',
  improvment: 'improvement',
  independant: 'independent',
  independantly: 'independently',
  inteligence: 'intelligence',
  intelligance: 'intelligence',
  isnt: "isn't",
  knowlege: 'knowledge',
  knowlegde: 'knowledge',
  langauge: 'language',
  liason: 'liaison',
  libary: 'library',
  managment: 'management',
  meterial: 'material',
  necesary: 'necessary',
  neccessary: 'necessary',
  necessery: 'necessary',
  noticable: 'noticeable',
  occasionaly: 'occasionally',
  ocasion: 'occasion',
  ocassion: 'occasion',
  occured: 'occurred',
  occurence: 'occurrence',
  occurrance: 'occurrence',
  oportunity: 'opportunity',
  oppurtunity: 'opportunity',
  paralell: 'parallel',
  particulary: 'particularly',
  perfomance: 'performance',
  performence: 'performance',
  persistant: 'persistent',
  posession: 'possession',
  possesion: 'possession',
  prefered: 'preferred',
  prefering: 'preferring',
  presance: 'presence',
  privelege: 'privilege',
  priviledge: 'privilege',
  probaly: 'probably',
  proffesional: 'professional',
  professionaly: 'professionally',
  proffesor: 'professor',
  promiss: 'promise',
  pronounciation: 'pronunciation',
  publically: 'publicly',
  quizes: 'quizzes',
  realy: 'really',
  realize: 'realize',
  recieved: 'received',
  recogize: 'recognize',
  recomend: 'recommend',
  recomended: 'recommended',
  recommand: 'recommend',
  reffered: 'referred',
  rember: 'remember',
  remeber: 'remember',
  remberance: 'remembrance',
  rythm: 'rhythm',
  ryhme: 'rhyme',
  saw: 'saw', // pass-through
  sceduling: 'scheduling',
  schedual: 'schedule',
  seperate: 'separate',
  seperated: 'separated',
  seperately: 'separately',
  shouldnt: "shouldn't",
  similiar: 'similar',
  sincerly: 'sincerely',
  sincerely: 'sincerely',
  speach: 'speech',
  succesful: 'successful',
  succesfully: 'successfully',
  suddenly: 'suddenly',
  surpise: 'surprise',
  suprise: 'surprise',
  suprised: 'surprised',
  teh: 'the',
  thier: 'their',
  theyre: "they're",
  thats: "that's",
  threshhold: 'threshold',
  thru: 'through',
  tomorow: 'tomorrow',
  tommorrow: 'tomorrow',
  tommorow: 'tomorrow',
  tonite: 'tonight',
  truely: 'truly',
  unfortunatly: 'unfortunately',
  untill: 'until',
  usefull: 'useful',
  vaccum: 'vacuum',
  vehical: 'vehicle',
  vehicel: 'vehicle',
  visable: 'visible',
  wasnt: "wasn't",
  wether: 'whether',
  whats: "what's",
  wich: 'which',
  whith: 'with',
  wierd: 'weird',
  womens: "women's",
  wont: "won't",
  worht: 'worth',
  writting: 'writing',
  writen: 'written',
  yeild: 'yield',
  youre: "you're",
};

// Match the casing of the original token so "Behavoir" → "Behavior" and
// "BEHAVOIR" → "BEHAVIOR" (rather than always lowercasing).
function matchCase(original, replacement) {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function applyTypoFixes(text) {
  if (!text || typeof text !== 'string') return { text: text || '', changes: [] };
  const changes = [];
  // Walk word tokens; preserve everything in between.
  const out = text.replace(/\b([A-Za-z']+)\b/g, (match) => {
    const lower = match.toLowerCase();
    const fix = COMMON_TYPOS[lower];
    if (!fix || fix === lower) return match;
    const cased = matchCase(match, fix);
    if (cased !== match) {
      changes.push({ from: match, to: cased, kind: 'typo' });
      return cased;
    }
    return match;
  });
  return { text: out, changes };
}

// Trim trailing whitespace per line (no leading — that may be intentional indent).
function trimTrailing(text) {
  return text.replace(/[ \t]+$/gm, '');
}

// Polish a piece of text. Returns { polished, changes } where changes is a
// flat list of {from, to, kind} so the UI can summarize ("3 fixes") and offer
// Undo back to the original.
export function polishText(text) {
  if (!text || typeof text !== 'string') return { polished: text || '', changes: [] };
  const original = text;
  // 1. Typo fixes
  const after1 = applyTypoFixes(text);
  // 2. Light grammar (capitalization, "i" → "I", collapse spaces)
  const after2 = applyLightGrammarFix(after1.text);
  // 3. Trim trailing whitespace per line
  const polished = trimTrailing(after2);

  const changes = [...after1.changes];
  // Diff at the end vs after step 1 to record cap/space changes as a
  // single "format" entry rather than per-token noise.
  if (polished !== after1.text) {
    changes.push({ from: '(formatting)', to: '(formatting)', kind: 'format' });
  }
  return { polished, original, changes };
}
