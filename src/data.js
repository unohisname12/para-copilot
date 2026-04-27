// ══════════════════════════════════════════════════════════════
// DATA LAYER — Single source of truth
// Every object here is MCP-ready: consistent IDs, tags, and structure
// ID prefixes: stu_ goal_ sc_ qa_ sit_ str_ tool_ gp_ log_
// ══════════════════════════════════════════════════════════════

// ── Periods & Students ───────────────────────────────────────
// DEMO_STUDENTS — the pre-baked student set used in demo/dev mode.
// Exported separately so demoMode logic can exclude them when live
// roster data is loaded. DB.students still points to the same object.
export const DEMO_STUDENTS = {
    stu_001:{id:"stu_001",pseudonym:"Red Student 1",color:"#ef4444",identity:{colorName:"Red",color:"#ef4444",emoji:"🔥",codename:"Ember",sequenceNumber:1},eligibility:"SLD + ELL",accs:["Glasses Check","Graphic Organizer","Word Bank","Preferential Seating","Extended Time"],caseManager:"Tina Milhomme",goalArea:"Reading Fluency, Writing",goals:[{id:"goal_001",text:"Increase oral reading fluency to 120 wpm with 95% accuracy",area:"Reading",subject:"ELA"},{id:"goal_002",text:"Write a 3-paragraph essay using a graphic organizer independently",area:"Writing",subject:"ELA"},{id:"goal_003",text:"Use context clues to determine meaning of 80% of unknown words",area:"Reading",subject:"ELA"}],behaviorNotes:"Generally compliant. Tends to shut down when reading is too hard. Check glasses are on.",strengths:"Strong verbal skills, creative, responds well to one-on-one support.",triggers:"Long reading passages without visual support. Being called on unexpectedly.",strategies:["Pre-teach vocabulary before the lesson","Allow verbal responses instead of written","Use bilingual word bank whenever possible"],tags:["ell","sld","reading","writing"]},
    stu_002:{id:"stu_002",pseudonym:"Blue Student 1",color:"#3b82f6",identity:{colorName:"Blue",color:"#3b82f6",emoji:"🌊",codename:"Wave",sequenceNumber:1},eligibility:"SLD + Low Vision",accs:["Double Time","Reading Strips","Large Print","Seat near board","No timed tests"],caseManager:"Heather Thomas",goalArea:"Reading Comprehension",goals:[{id:"goal_004",text:"Identify main idea and 3 supporting details in grade-level text with 80% accuracy",area:"Reading",subject:"ELA"},{id:"goal_005",text:"Use reading strips to track text independently during all reading tasks",area:"Reading",subject:"ELA"}],behaviorNotes:"Very motivated but fatigues visually. May need more breaks during extended reading.",strengths:"Strong memory, highly engaged, great attitude.",triggers:"Small print, cluttered worksheets, low lighting.",strategies:["Always large print or zoom 150%","Reading strips on desk at start of class","Seat closest to board"],tags:["sld","low-vision","reading"]},
    stu_003:{id:"stu_003",pseudonym:"Green Student 1",color:"#10b981",identity:{colorName:"Green",color:"#22c55e",emoji:"🌿",codename:"Fern",sequenceNumber:1},eligibility:"OHI — ADHD",accs:["Oral Alternative","Reduce Workload","Frequent Breaks","Fidget Allowed","Chunked Tasks"],caseManager:"Sarah White",goalArea:"Writing, Attention",goals:[{id:"goal_006",text:"Complete multi-step writing tasks broken into 3 chunks with 75% on-task rate",area:"Writing",subject:"ELA"},{id:"goal_007",text:"Use self-monitoring checklist to stay on task for 10-minute intervals",area:"Attention",subject:"ELA"}],behaviorNotes:"High energy. Needs movement breaks every 20-30 min. May refuse pen/paper — allow voice recording.",strengths:"Creative thinker, very verbal, good ideas when given the right outlet.",triggers:"Long written tasks, sitting still too long, unclear expectations.",strategies:["Break tasks into 3 max chunks","Allow standing desk if available","Offer choice in how to show work"],tags:["adhd","ohi","writing","attention"]},
    stu_004:{id:"stu_004",pseudonym:"Purple Student 1",color:"#a855f7",identity:{colorName:"Purple",color:"#a855f7",emoji:"🦋",codename:"Dusk",sequenceNumber:1},eligibility:"SLD — Math",accs:["Double Time","Calculator","Mult. Chart","100s Chart","Graph Paper for alignment"],caseManager:"Tina Milhomme",goalArea:"Math Computation, Fractions",goals:[{id:"goal_008",text:"Add and subtract fractions with unlike denominators with 80% accuracy using tools",area:"Math",subject:"Math"},{id:"goal_009",text:"Convert between fractions, decimals, and percents with calculator support",area:"Math",subject:"Math"},{id:"goal_010",text:"Complete multi-step word problems with graphic organizer scaffold",area:"Math",subject:"Math"}],behaviorNotes:"Works hard but gets frustrated quickly when not understanding. May erase excessively.",strengths:"Persistent, detail-oriented, likes patterns and visual math.",triggers:"Timed math tests, not having tools accessible, being asked to show steps without scaffold.",strategies:["Always have mult chart + calculator on desk","Use graph paper for column alignment","Praise effort not just answers"],tags:["sld","math"]},
    stu_005:{id:"stu_005",pseudonym:"Orange Student 1",color:"#f97316",identity:{colorName:"Orange",color:"#f97316",emoji:"🍊",codename:"Tangerine",sequenceNumber:1},eligibility:"Autism",accs:["Fidget Tools","Break Pass","Visual Schedule","Advance Warning for Transitions","Noise Sensitivity — headphones OK"],caseManager:"Heather Thomas",goalArea:"Communication, Self-Regulation",goals:[{id:"goal_011",text:"Use break pass independently when feeling overwhelmed (self-initiate 3x per week)",area:"Self-Regulation",subject:"All"},{id:"goal_012",text:"Engage in back-and-forth communication for 3+ exchanges",area:"Communication",subject:"All"},{id:"goal_013",text:"Follow 3-step directions with visual support in 4/5 trials",area:"Communication",subject:"All"}],behaviorNotes:"Needs predictability. Announce transitions 5 min early. Headphones are a regulation tool, not defiance.",strengths:"Excellent memory for facts, highly focused on areas of interest, kind to classmates.",triggers:"Sudden schedule changes, unexpected noise, being touched unexpectedly.",strategies:["Post agenda at start of class","Honor headphone use","Use first-then language for transitions"],tags:["autism","self-regulation","communication","sensory"]},
    stu_006:{id:"stu_006",pseudonym:"Teal Student 1",color:"#14b8a6",identity:{colorName:"Teal",color:"#14b8a6",emoji:"🐬",codename:"Reef",sequenceNumber:1},eligibility:"SLD + Speech",accs:["Reduce Choices to 2","Speech-to-Text","Extra Time","No cold calling","Written directions"],caseManager:"Sarah White",goalArea:"Written Expression",goals:[{id:"goal_014",text:"Use speech-to-text to compose a paragraph of 5+ sentences independently",area:"Writing",subject:"Science"},{id:"goal_015",text:"Select correct answer from 2 choices rather than open-ended responses",area:"Communication",subject:"Science"}],behaviorNotes:"Very shy. Do not cold call. Give processing time — at least 10 seconds before prompting again.",strengths:"Thoughtful, observant, kind. Strong science reasoning.",triggers:"Being called on unexpectedly, open-ended questions with many possible answers.",strategies:["Always offer 2 choices for answers","Allow speech-to-text on Chromebook","Give written instructions in addition to verbal"],tags:["sld","speech","writing"]},
    stu_007:{id:"stu_007",pseudonym:"Pink Student 1",color:"#ec4899",identity:{colorName:"Pink",color:"#ec4899",emoji:"🌸",codename:"Bloom",sequenceNumber:1},eligibility:"OHI (BIP Active)",accs:["BIP Plan","Break Pass","De-escalation Steps","No public correction","Check-in/Check-out"],caseManager:"Tina Milhomme",goalArea:"Behavior, Academic Engagement",goals:[{id:"goal_016",text:"Use break pass before reaching level 3 on personal scale in 4/5 opportunities",area:"Self-Regulation",subject:"All"},{id:"goal_017",text:"Complete 60% of assigned academic tasks per class period",area:"Academic",subject:"Science"},{id:"goal_018",text:"Respond to de-escalation prompts within 2 minutes",area:"Behavior",subject:"All"}],behaviorNotes:"⚠️ ACTIVE BIP. Do not correct publicly. Use quiet redirection only. If escalating: step back, give space, offer break card silently.",strengths:"Artistic, strong sense of fairness, loyal to friends.",triggers:"Public embarrassment, perceived unfairness, loud unexpected sounds, being told no without explanation.",strategies:["Slide break card on desk silently if escalating","Use 'I notice' language not 'you are'","Give choice between 2 acceptable options"],tags:["bip","ohi","behavior","self-regulation"]},
    stu_008:{id:"stu_008",pseudonym:"Yellow Student 1",color:"#ca8a04",identity:{colorName:"Yellow",color:"#eab308",emoji:"⭐",codename:"Nova",sequenceNumber:1},eligibility:"Autism + Low Vision",accs:["Verbal Descriptions","Identify Yourself","Tactile Materials","Large Print","Peer Buddy System"],caseManager:"Heather Thomas",goalArea:"Social Skills, Orientation",goals:[{id:"goal_019",text:"Navigate between 3 classroom areas independently using tactile cues",area:"Orientation",subject:"All"},{id:"goal_020",text:"Initiate greeting with familiar adult in 3/5 opportunities",area:"Social",subject:"All"},{id:"goal_021",text:"Participate in partner work with verbal turn-taking for 5+ minutes",area:"Social",subject:"Science"}],behaviorNotes:"Always identify yourself before speaking. Describe visual materials verbally. Do not move their belongings without warning.",strengths:"Excellent auditory processing, strong verbal memory, warm with familiar adults.",triggers:"Visual-only instructions, unfamiliar people approaching without introduction, sudden changes to physical layout.",strategies:["Narrate all visual content","Use tactile versions of worksheets when available","Introduce yourself each time: 'Hi, it's Mr. Dre'"],tags:["autism","low-vision","social","sensory"]},
    stu_009:{id:"stu_009",pseudonym:"Indigo Student 1",color:"#6366f1",identity:{colorName:"Violet",color:"#8b5cf6",emoji:"🔮",codename:"Prism",sequenceNumber:1},eligibility:"SLD — Math",accs:["100s Chart","Chunk Lessons","Double Time","Calculator","Anchor Charts"],caseManager:"Sarah White",goalArea:"Math Reasoning, Fractions",goals:[{id:"goal_022",text:"Apply fraction/decimal conversion using calculator with 80% accuracy",area:"Math",subject:"Math"},{id:"goal_023",text:"Solve 2-step word problems using graphic organizer scaffold",area:"Math",subject:"Math"},{id:"goal_024",text:"Use anchor charts to self-correct math errors before turning in",area:"Math",subject:"Math"}],behaviorNotes:"Tends to rush through work to appear done. Encourage checking work. Responds well to specific praise.",strengths:"Fast verbal processor, good at mental math estimates, motivated by being the helper.",triggers:"Tasks that feel too long, not understanding why a step is needed.",strategies:["Chunk tasks visibly: 'Just do #1-3 first'","Reference anchor chart before re-explaining","Ask 'does that make sense?' often — they will say yes even if not, so check the work"],tags:["sld","math"]},
};

export const DB = {
  periods: {
    p1:{ label:"Period 1 — ELA 7",     teacher:"Ms. Lambard",  subject:"ELA 7",     students:["stu_001","stu_002"] },
    p2:{ label:"Period 2 — ELA 8",     teacher:"Mr. Koehler",  subject:"ELA 8",     students:["stu_003"] },
    p3:{ label:"Period 3 — Math 2",    teacher:"Junt",         subject:"Math 2",    students:["stu_004","stu_005"] },
    p4:{ label:"Period 4 — Science 8", teacher:"Mr. Bowser",   subject:"Science 8", students:["stu_006"] },
    p5:{ label:"Period 5 — Science 7", teacher:"Ms. Moore",    subject:"Science 7", students:["stu_007","stu_008"] },
    p6:{ label:"Period 6 — Math 2",    teacher:"Junt",         subject:"Math 2",    students:["stu_009"] },
  },
  students: DEMO_STUDENTS,
};

// ── Support Cards ────────────────────────────────────────────
export const SUPPORT_CARDS = [
  { id:"sc_trans", title:"Transition Support", category:"transition", tags:["autism","adhd","sensory","transition"],
    whenToUse:"Bell about to ring, switching activities, unexpected schedule change",
    studentTypes:["Autism","ADHD","Anxiety","Sensory"],
    steps:["Give 5-min verbal warning","Point to visual schedule","Use first/then language","Stay calm, predictable tone","Allow extra processing time"],
    whatToSay:["'In 5 minutes we're going to switch to...'","'First we finish this page, then we pack up'","'I know this change is unexpected — here's what's happening next'"],
    whatToAvoid:["Sudden announcements","'Hurry up'","Removing items without warning","Physical rushing"],
    accommodations:["Visual Schedule","Advance Warning","Timer","Transition Object"] },
  { id:"sc_escal", title:"De-escalation Support", category:"behavior", tags:["bip","behavior","escalation","self-regulation"],
    whenToUse:"Student showing signs of dysregulation — voice rising, body tense, refusing, crying",
    studentTypes:["BIP Active","Emotional Disturbance","ADHD","Autism"],
    steps:["Lower your voice","Move to proximity, not confrontation","Offer 2 choices","Slide break card silently","If level 3+: step back, give space","Document after student is regulated"],
    whatToSay:["'I notice you seem frustrated'","'Would you like a break or to keep going with help?'","'You're not in trouble — I'm here to help'"],
    whatToAvoid:["Public correction","'You need to calm down'","Standing over the student","Removing privileges in the moment","Touching without consent"],
    accommodations:["Break Pass","De-escalation Steps","Quiet Redirect","Check-in/Check-out"] },
  { id:"sc_write", title:"Writing Support", category:"academic", tags:["writing","sld","ell","adhd"],
    whenToUse:"Written assignment starting, student refusing to write, blank paper after 5 min",
    studentTypes:["SLD","ELL","ADHD","Speech"],
    steps:["Offer graphic organizer","Allow speech-to-text option","Break into 3 small chunks","Provide sentence starters","Accept verbal responses if IEP allows"],
    whatToSay:["'Let's start with just one sentence'","'Tell me your idea and I'll help you get it on paper'","'You can type, talk, or draw it first'"],
    whatToAvoid:["'Just start writing'","Red-penning errors during drafting","Requiring full handwritten responses if not in IEP"],
    accommodations:["Graphic Organizer","Speech-to-Text","Oral Alternative","Chunked Tasks","Sentence Starters"] },
  { id:"sc_math", title:"Math Support", category:"academic", tags:["math","sld","computation","fractions"],
    whenToUse:"Math lesson starting, student struggling with computation, word problems",
    studentTypes:["SLD-Math","ADHD","Low Vision"],
    steps:["Ensure calculator/chart on desk BEFORE lesson","Pre-read word problems aloud","Highlight key numbers","Use graph paper for alignment","Chunk: 'Just do #1-3 first'"],
    whatToSay:["'Let's read this problem together first'","'Which tool do you want to use?'","'Show me what you DO know'"],
    whatToAvoid:["Timed drills without IEP permission","Taking away calculator as consequence","'This is easy, just...'"],
    accommodations:["Calculator","Mult. Chart","100s Chart","Graph Paper","Anchor Charts","Extended Time"] },
  { id:"sc_sensory", title:"Sensory Support", category:"regulation", tags:["autism","sensory","self-regulation","low-vision"],
    whenToUse:"Student covering ears, fidgeting excessively, refusing to look at materials, shutting down",
    studentTypes:["Autism","Sensory Processing","Low Vision","ADHD"],
    steps:["Acknowledge the discomfort quietly","Offer headphones or fidget","Reduce visual clutter if possible","Narrate any changes verbally","Allow movement break if needed"],
    whatToSay:["'Would headphones help right now?'","'I see it's loud — let's find a quieter spot'","'Your fidget is on your desk whenever you need it'"],
    whatToAvoid:["Taking away headphones as punishment","Forcing eye contact","Ignoring signs of overload","Touching unexpectedly"],
    accommodations:["Noise-Canceling Headphones","Fidget Tools","Preferential Seating","Movement Breaks","Tactile Materials"] },
  { id:"sc_read", title:"Reading Support", category:"academic", tags:["reading","sld","ell","low-vision"],
    whenToUse:"Reading task starting, student avoiding text, comprehension check needed",
    studentTypes:["SLD-Reading","ELL","Low Vision"],
    steps:["Check glasses are on","Provide reading strip","Offer large print if needed","Pre-teach 3-5 key vocabulary words","Allow audio version if available"],
    whatToSay:["'Let's look at the vocabulary first'","'Follow along with me as I read the first paragraph'","'What do you think this section is about?'"],
    whatToAvoid:["Cold-calling to read aloud","Giving full page of text without scaffolding","Assuming student can see standard print"],
    accommodations:["Reading Strips","Large Print","Word Bank","Audio Text","Extended Time","Bilingual Dictionary"] },
  { id:"sc_refusal", title:"Work Refusal Support", category:"behavior", tags:["behavior","refusal","adhd","bip"],
    whenToUse:"Student says 'no', puts head down, pushes materials away, ignores instructions",
    studentTypes:["BIP Active","ADHD","Emotional Disturbance","Autism"],
    steps:["Don't engage in power struggle","Offer 2 acceptable choices","Check: is the task accessible?","Reduce the ask: 'Just do #1'","Walk away for 60 sec, return calmly","Document antecedent"],
    whatToSay:["'I see you're not ready. That's okay — which part can we start with?'","'Would you rather do this with me or try on your own first?'","'I'll come back in a minute to check in'"],
    whatToAvoid:["'You HAVE to do this'","Public ultimatums","Taking away recess/preferred time immediately","Escalating voice"],
    accommodations:["Reduce Workload","Chunked Tasks","Break Pass","Choice Board","Oral Alternative"] },
];

// ── Quick Actions ────────────────────────────────────────────
export const QUICK_ACTIONS = [
  { id:"qa_break", label:"Used Break Pass", icon:"🚶", category:"regulation", logType:"Accommodation Used", defaultNote:"Student used break pass.", tags:["break","regulation","bip"], suggestedSituations:["sit_escalating","sit_offtask"] },
  { id:"qa_trans_warn", label:"Gave Transition Warning", icon:"⏰", category:"transition", logType:"Accommodation Used", defaultNote:"5-minute transition warning given per IEP.", tags:["transition","warning"], suggestedSituations:["sit_transition"] },
  { id:"qa_chunk", label:"Chunked Task", icon:"✂️", category:"academic", logType:"Academic Support", defaultNote:"Task chunked into smaller sections for student.", tags:["chunk","academic","scaffolding"], suggestedSituations:["sit_writing","sit_math","sit_refusal"] },
  { id:"qa_redirect", label:"Redirected Behavior", icon:"🔄", category:"behavior", logType:"Behavior Note", defaultNote:"Quietly redirected off-task behavior.", tags:["redirect","behavior"], suggestedSituations:["sit_offtask","sit_escalating"] },
  { id:"qa_positive", label:"Positive Participation", icon:"⭐", category:"positive", logType:"Positive Note", defaultNote:"Positive engagement and participation observed.", tags:["positive","praise"], suggestedSituations:[] },
  { id:"qa_tool", label:"Provided IEP Tool", icon:"🔧", category:"academic", logType:"Accommodation Used", defaultNote:"IEP tool/accommodation provided at start of task.", tags:["tool","accommodation"], suggestedSituations:["sit_math","sit_writing","sit_reading","sit_science"] },
  { id:"qa_checkin", label:"Check-in Completed", icon:"💬", category:"regulation", logType:"General Observation", defaultNote:"Check-in/check-out completed with student.", tags:["checkin","regulation","bip"], suggestedSituations:[] },
  { id:"qa_deescal", label:"De-escalation Used", icon:"🌊", category:"behavior", logType:"Behavior Note", defaultNote:"De-escalation strategies used per BIP.", tags:["deescalation","bip","behavior"], suggestedSituations:["sit_escalating"] },
  { id:"qa_verbal", label:"Verbal Narration", icon:"🗣️", category:"academic", logType:"Accommodation Used", defaultNote:"Verbally narrated visual content for student.", tags:["narration","low-vision","autism"], suggestedSituations:["sit_science","sit_reading"] },
  { id:"qa_headphones", label:"Headphones Allowed", icon:"🎧", category:"regulation", logType:"Accommodation Used", defaultNote:"Student using headphones as regulation tool per IEP.", tags:["sensory","headphones","regulation"], suggestedSituations:[] },
  { id:"qa_break_requested", label:"Student Asked for a Break", icon:"🙋", category:"regulation", logType:"Positive Note", defaultNote:"Student asked for the break using their break card or signal.", tags:["break","fct","replacement_skill","regulation","positive"], suggestedSituations:["sit_escalating","sit_offtask"] },
  { id:"qa_skill_taught", label:"Showed a Better Way", icon:"🌱", category:"academic", logType:"Skill Teaching", defaultNote:"Showed or practiced a better way to handle the situation with the student.", tags:["skill_teaching","replacement","positive"], suggestedSituations:[] },
];

// ── Situations ───────────────────────────────────────────────
export const SITUATIONS = [
  { id:"sit_escalating", title:"Student Escalating", icon:"🔴", tags:["behavior","escalation","bip"],
    triggers:["escalat","angry","yell","throw","crying","meltdown","tantrum","hit","upset","dysregulat"],
    recommendedCards:["sc_escal","sc_sensory"], recommendedActions:["qa_deescal","qa_break","qa_redirect"],
    recommendedTools:["tool_breathing","tool_calm","tool_timer"],
    followUp:"Document after student is regulated. Check BIP if active." },
  { id:"sit_transition", title:"Transition Coming", icon:"🔔", tags:["transition"],
    triggers:["bell","pack up","switch","transition","hallway","wrapping up"],
    recommendedCards:["sc_trans","sc_sensory"], recommendedActions:["qa_trans_warn","qa_tool"],
    recommendedTools:["tool_countdown","tool_firstthen"],
    followUp:"Watch for students who need extra processing time." },
  { id:"sit_writing", title:"Writing Task Starting", icon:"✏️", tags:["writing","academic"],
    triggers:["essay","write","paragraph","writing","draft","compose"],
    recommendedCards:["sc_write"], recommendedActions:["qa_chunk","qa_tool","qa_verbal"],
    recommendedTools:[],
    followUp:"Check after 5 min — who has a blank page?" },
  { id:"sit_math", title:"Math Activity", icon:"🔢", tags:["math","academic"],
    triggers:["fraction","decimal","percent","divide","multiply","equation","math","algebra"],
    recommendedCards:["sc_math"], recommendedActions:["qa_tool","qa_chunk"],
    recommendedTools:["tool_timer"],
    followUp:"Verify all IEP tools are on desks before instruction starts." },
  { id:"sit_reading", title:"Reading Activity", icon:"📖", tags:["reading","academic"],
    triggers:["read","annotate","book","text","passage","comprehension","vocabulary"],
    recommendedCards:["sc_read"], recommendedActions:["qa_tool","qa_verbal"],
    recommendedTools:[],
    followUp:"Pre-teach vocabulary. Check glasses and large print." },
  { id:"sit_science", title:"Science Lab Starting", icon:"🔬", tags:["science","academic"],
    triggers:["lab","hypothesis","experiment","observe","data","science"],
    recommendedCards:["sc_sensory","sc_read"], recommendedActions:["qa_verbal","qa_tool","qa_chunk"],
    recommendedTools:["tool_timer"],
    followUp:"Narrate all visual content. Check safety accommodations." },
  { id:"sit_refusal", title:"Student Refusing Work", icon:"✋", tags:["behavior","refusal"],
    triggers:["refus","refusing","won't","wont","no","head down","not doing","shut down","shutdown"],
    recommendedCards:["sc_refusal","sc_escal"], recommendedActions:["qa_redirect","qa_break","qa_chunk"],
    recommendedTools:["tool_firstthen","tool_timer"],
    followUp:"Document antecedent. Was the task accessible?" },
  { id:"sit_offtask", title:"Off-Task Behavior", icon:"👀", tags:["behavior","attention"],
    triggers:["distract","off.task","offtask","talking","phone","not paying","wandering","fidget"],
    recommendedCards:["sc_sensory"], recommendedActions:["qa_redirect","qa_checkin","qa_positive"],
    recommendedTools:["tool_timer"],
    followUp:"Positive reinforcement when back on task." },
  { id:"sit_fatigue", title:"Reading Fatigue", icon:"😴", tags:["reading","fatigue","sensory"],
    triggers:["tired","fatigue","squinting","rubbing eyes","can't see","headache"],
    recommendedCards:["sc_read","sc_sensory"], recommendedActions:["qa_break","qa_verbal"],
    recommendedTools:["tool_breathing","tool_timer"],
    followUp:"Consider larger print or audio option." },
  { id:"sit_praise", title:"Great Moment", icon:"🌟", tags:["positive"],
    triggers:["great","awesome","good job","nailed it","perfect","excellent","well done","crushed it"],
    recommendedCards:[], recommendedActions:["qa_positive","qa_checkin"],
    recommendedTools:[],
    followUp:"Log the specifics — what did they do well?" },
];

// ── Regulation Tools ─────────────────────────────────────────
export const REG_TOOLS = [
  { id:"tool_breathing", name:"Breathing Exercise", type:"activity", icon:"🫁", tags:["calming","regulation","sensory"], useCase:"Student dysregulated or anxious", duration:"2-3 min", targetNeed:"calming" },
  { id:"tool_calm", name:"Calming Screen", type:"visual", icon:"🌊", tags:["calming","sensory","visual"], useCase:"Student needs visual focus point", duration:"1-5 min", targetNeed:"sensory" },
  { id:"tool_timer", name:"Visual Timer", type:"timer", icon:"⏱️", tags:["timer","structure","transition"], useCase:"Timed work period or break", duration:"variable", targetNeed:"structure" },
  { id:"tool_firstthen", name:"First/Then Board", type:"visual", icon:"➡️", tags:["structure","transition","autism"], useCase:"Student needs clear sequence", duration:"ongoing", targetNeed:"structure" },
  { id:"tool_countdown", name:"Visual Countdown", type:"visual", icon:"5️⃣", tags:["transition","countdown","autism"], useCase:"Transition approaching", duration:"5 min", targetNeed:"transition" },
  { id:"tool_grounding", name:"5-4-3-2-1 Grounding", type:"activity", icon:"🖐️", tags:["calming","grounding","anxiety"], useCase:"Student dissociating or highly anxious", duration:"3-5 min", targetNeed:"calming" },
  { id:"tool_choices", name:"Break Choices", type:"menu", icon:"🔀", tags:["break","regulation","choice"], useCase:"Student needs break but can't decide", duration:"5-10 min", targetNeed:"regulation" },
];

// ── Checklists ───────────────────────────────────────────────
export const CHECKLIST_TEMPLATES = {
  before:[
    {label:"Check today's lesson/agenda",priority:"high"},
    {label:"Ensure IEP tools on desks (calculators, charts, strips)",priority:"high"},
    {label:"Review any student BIPs or alerts",priority:"high"},
    {label:"Check seating arrangement",priority:"medium"},
    {label:"Prep graphic organizers or modified materials",priority:"medium"},
    {label:"Check-in with teacher on today's plan",priority:"medium"},
  ],
  during:[
    {label:"Monitor on-task behavior — scan every 5 min",priority:"high"},
    {label:"Provide accommodations proactively",priority:"high"},
    {label:"Log any significant observations",priority:"medium"},
    {label:"Give transition warnings 5 min before changes",priority:"high"},
    {label:"Use positive reinforcement — catch them being good",priority:"medium"},
    {label:"Check: any student with blank page after 5 min?",priority:"medium"},
  ],
  after:[
    {label:"Log observations in Data Vault",priority:"high"},
    {label:"Write handoff note if needed",priority:"high"},
    {label:"Flag any IEP concerns",priority:"medium"},
    {label:"Collect/store IEP tools",priority:"low"},
    {label:"Note any parent contact needed",priority:"medium"},
    {label:"Update goal progress if applicable",priority:"medium"},
  ],
};

// ── Strategies ───────────────────────────────────────────────
export const STRATEGIES = [
  { id:"str_chunk", title:"Task Chunking", category:"academic", tags:["chunking","adhd","sld","math","writing"],
    steps:["Break assignment into 3 visible sections","Direct student to first section only","Check in after each chunk","Praise completion of each chunk"],
    whenToUse:"Student overwhelmed by full assignment, ADHD, or SLD students",
    avoidWhen:"Student is working well independently",
    accommodations:["Chunked Tasks","Reduce Workload"], gradeRange:"All", subjects:["Math","ELA","Science"], disabilityTags:["ADHD","SLD"] },
  { id:"str_firstthen", title:"First/Then Language", category:"transition", tags:["first-then","autism","adhd","transition"],
    steps:["State the current expectation: 'First...'","State the reward/next activity: 'Then...'","Keep it simple and visual","Follow through consistently"],
    whenToUse:"Transitions, starting non-preferred tasks, building compliance",
    avoidWhen:"Student is already engaged and working",
    accommodations:["Visual Schedule","Advance Warning"], gradeRange:"All", subjects:["All"], disabilityTags:["Autism","ADHD"] },
  { id:"str_vocab", title:"Pre-teach Vocabulary", category:"academic", tags:["vocabulary","ell","sld","reading"],
    steps:["Select 3-5 key terms from lesson","Define in student-friendly language","Use visuals or bilingual supports","Review briefly before lesson starts"],
    whenToUse:"Before reading or content-heavy lessons, ELL or SLD-Reading students",
    avoidWhen:"Vocabulary already mastered or lesson is hands-on only",
    accommodations:["Word Bank","Bilingual Dictionary","Graphic Organizer"], gradeRange:"All", subjects:["ELA","Science"], disabilityTags:["ELL","SLD"] },
  { id:"str_2choice", title:"Two-Choice Redirect", category:"behavior", tags:["behavior","redirect","bip","choice"],
    steps:["Approach calmly and privately","Offer exactly 2 acceptable options","Use neutral tone: 'You can X or Y'","Accept either choice","Walk away briefly to allow processing"],
    whenToUse:"Work refusal, mild escalation, need for student agency",
    avoidWhen:"Full escalation (use de-escalation instead), student already compliant",
    accommodations:["Break Pass","Reduce Workload","Oral Alternative"], gradeRange:"All", subjects:["All"], disabilityTags:["BIP","ADHD","Autism","ED"] },
  { id:"str_narrate", title:"Verbal Narration", category:"academic", tags:["narration","low-vision","autism","science"],
    steps:["Describe all visual content aloud","Name colors, shapes, positions","Read text on screen/board","Pause for processing time","Ask if they need anything repeated"],
    whenToUse:"Any visual content with Low Vision or Blind students",
    avoidWhen:"Never avoid — always do this for students with visual impairments",
    accommodations:["Verbal Descriptions","Tactile Materials","Large Print"], gradeRange:"All", subjects:["All"], disabilityTags:["Low Vision","Blind","Autism"] },
  { id:"str_praise", title:"Specific Praise", category:"positive", tags:["positive","praise","behavior","motivation"],
    steps:["Name the exact behavior you saw","Be immediate — within 3 seconds","Keep it genuine and specific","'I noticed you...' not just 'good job'"],
    whenToUse:"Always. Every class period. Every student.",
    avoidWhen:"Never. But avoid hollow/generic praise.",
    accommodations:[], gradeRange:"All", subjects:["All"], disabilityTags:["All"] },
];

// ── Goal Progress Options ────────────────────────────────────
export const GOAL_PROGRESS_OPTIONS = [
  { id:"gp_progress", label:"Progress Made", icon:"📈", color:"#4ade80" },
  { id:"gp_support", label:"Completed w/ Support", icon:"🤝", color:"#60a5fa" },
  { id:"gp_prompt", label:"Needed Prompting", icon:"💬", color:"#fbbf24" },
  { id:"gp_notattempt", label:"Not Attempted", icon:"⏸️", color:"#94a3b8" },
  { id:"gp_concern", label:"Concern", icon:"⚠️", color:"#f87171" },
  { id:"gp_mastery", label:"Mastery Moment!", icon:"🏆", color:"#a78bfa" },
];

// ── Keyword Map (fallback for engine) ────────────────────────
export const KW = {
  behavior:["restless","mad","angry","threw","throw","chair","yell","escalat","crying","frustrated","distract","meltdown","hit","refusing","refus","tantrum","upset","dysregulat"],
  math:["fraction","decimal","percent","divide","multiply","equation","math","number","ratio","integer","algebra","numerator","denominator"],
  reading:["read","essay","write","paragraph","spell","vocabulary","grammar","ela","annotate","book","text","passage","comprehension"],
  science:["lab","hypothesis","data","experiment","observe","biology","cell","atom","element","energy","force","science"],
  transition:["bell","pack up","switch","transition","hallway","done early","finished","wrapping up"],
  praise:["great","awesome","good job","nailed it","perfect","excellent","well done","crushed it"],
};

// ── Lookup helpers (MCP-ready) ───────────────────────────────
export function getStudent(id) { return DB.students[id] || null; }
export function getPeriod(id) { return DB.periods[id] || null; }
export function getStudentsForPeriod(periodId) {
  const p = DB.periods[periodId];
  return p ? p.students.map(id => ({ id, ...DB.students[id] })) : [];
}
export function searchStrategies(tags) {
  return STRATEGIES.filter(s => tags.some(t => s.tags.includes(t)));
}
export function getSupportCard(id) { return SUPPORT_CARDS.find(c => c.id === id) || null; }
export function getQuickAction(id) { return QUICK_ACTIONS.find(a => a.id === id) || null; }
