# SupaPara — Business, Pricing, and Sales

## Who built it

**Deandre ("Dre") Sample** — paraprofessional at Fairview Middle School, Washington State. Solo founder. Built SupaPara on nights and weekends while working as a para. Not a full-time engineer; learned to build by building this.

## What problem it solves

Existing options for paras logging IEP-related observations:

| Option | Problem |
|---|---|
| Paper | Can't share, easy to lose, no search |
| Google Docs | Real names everywhere, no structure, no privacy boundary |
| District-purchased software (e.g. Frontline, IEPPro) | Built for IEP teachers and admins, not for paras during a real classroom moment. Slow. Names everywhere. Schools pay $2K–$10K+/year for these |
| Whiteboards / sticky notes | Disappears at end of day. Not auditable |

**The gap SupaPara fills:** a fast, FERPA-safe tool built specifically for **paras** to use during the day, with the **sped teacher** as a stakeholder, NOT for a procurement officer to evaluate.

Recent product positioning point: SupaPara now supports **assigned rosters**. A sped teacher can assign students to specific paras/subs, while paras can still add students they work with. This makes the app easier to defend in schools because it avoids unnecessary student-data exposure without blocking real para workflow.

**Newer positioning point — the Training-Gap Agenda:** the app surfaces specific patterns from team logs (e.g. "3+ break-passes for the same student in a week with no break-card requests" → topic "When breaks help vs. when they backfire") on both the para's own toolbox panel **🔖 Topics for Next Check-in** and the sped teacher's **🔖 Coaching** tab. The sped teacher's only action is "share a tip with the para" — pre-filled friendly coaching message, copy/paste into their normal email or chat. Structurally cannot become a per-para performance scoreboard or "flag for follow-up" record. This turns the sped-teacher's check-in from "what should I bring up?" into "here's a tip your para can try this week" — which is the kind of value prop that turns sped teachers into champions.

## Target customer

### Primary
**The Special Education Teacher** at a single school. They run a sped team of 1–8 paras. They have:
- A small discretionary budget (typically $200–$2,000/year for "classroom tools")
- Authority to recommend tools to the principal
- Skin in the game: better para notes = fewer escalations + better IEP compliance

### Secondary
**The principal** — signs off on anything over the sped teacher's discretionary limit.

### Tertiary (later)
**The district SPED Director** — for selling to multiple schools at once. Different sales motion (longer cycle, more procurement). Probably year 2.

## Pricing

| Tier | Price | What you get |
|---|---|---|
| **Free pilot** (active through June 2026) | $0 | Full features. Used to seed Fairview + first design partners. |
| **Founding School** | **$300/year per school**, locked for 3 years | All features, all paras, unlimited students. Lifetime priority support. Available to first 10 schools that sign before Sept 2026. |
| **Standard** (Sept 2026+) | $600–$900/year per school | Same product, normal pricing |
| **District** | Custom (~$3K–$8K/year) | Multi-school, central admin, support. Year 2 motion. |

**Pricing principles:**
- One sentence per tier — paras and admins shouldn't need a calculator.
- Per-school, not per-seat. Removes friction (don't have to ask "how many paras?").
- First year locked-in price. Removes "what if you raise prices?" objection.
- Free pilot = 0 procurement risk.

## Why $300 is the right opening number

- Far below the principal's discretionary spend threshold (usually $500–$1000) — avoids procurement.
- Sped teachers often have $300–$500 to spend without paperwork.
- Compares favorably to anything Frontline / IEPPro / Boardmaker charges (those start at $1500+).
- Cheap enough that "let's just try it for a year" is a low-stakes decision.
- High enough to pay for a domain, Vercel, Supabase, and Gemini API costs at modest scale.

## Sales motion

The user is **not a salesperson**. He is a para selling to other paras and their sped teachers.

His unfair advantages:
1. **"I'm a para. I built this for us."** — disarms 90% of vendor skepticism in 5 seconds. No outside salesperson can say this.
2. **He uses the app every day.** Demos are real. Screenshots are real. He's the credibility, not the slide deck.
3. **He's local** (WA). Schools in education networks tend to know each other. Word of mouth is real.
4. **The app demos in 90 seconds.** Sign in → Simple Mode → tap → done. Faster than describing it.

His weaknesses:
1. No follow-up discipline. The single biggest risk to closing deals.
2. No CRM, no pipeline.
3. Will lose deals to summer-budget timing if he doesn't pace himself.

## Realistic sales math (for 20 schools visited)

If he visits 20 schools authentically between **April–July 2026**, with proper follow-up:

- ~70% will accept a **free pilot** = ~14 pilots
- ~25–35% of pilots convert to **paid in Sept 2026** = 3–4 paying schools
- Expected ARR by Sept 2026 from this campaign: **$900–$1,500** + multi-year tail

**Probability of hitting at least 1 paid school:** 70–80% if executed properly.

The biggest risks (each cuts the number ~10–20 points):
- Pitching to the wrong person (paras instead of sped teachers/admins)
- Wrong time (trying to close in October when fall budget is locked)
- No follow-up (one visit, one email, then ghosted)
- Demoing with real student names visible (instant FERPA fail)
- Leading with Ollama / "local AI" — IT will freak

## Best money to spend

Ranked by ROI (lowest cost first):

1. **$200–$500 one-time sales coach** — 2 sessions with a former edtech rep to tighten the 90-second pitch and rehearse objection handling. Massive single-shot return.
2. **$50/mo Fiverr designer** for a polished one-pager — looks 10x more credible than DIY slides. Leave it behind at every visit.
3. **$300/year domain + matching email** — `dre@supapara.com` beats a gmail in formal outreach.
4. **$500/mo VA** — handles follow-up emails, scheduling, simple CRM (Notion fine). Fixes the biggest weakness. Single biggest pipeline lever.
5. **Hire a full salesperson ONLY after closing 3–5 schools personally.** Then there's a script that works and the AE just runs it.

A generalist B2B SaaS salesperson (no school experience) is likely WORSE than the user himself for this market. Schools buy from people who feel like them.

## Competitive landscape

| Competitor | Strength | Weakness |
|---|---|---|
| Frontline IEPPro | Comprehensive, district-approved | $1500+/year, IEP-team-focused, not built for paras |
| Boardmaker / N2Y | Symbol-based comms, deep features | Expensive, complex setup, not log-focused |
| Google Forms + Sheets | Free, familiar | No privacy boundary, no structure, no realtime |
| Paper / printable trackers | Free, no learning curve | Can't search, can't share, lost easily |
| **SupaPara** | Built FOR paras BY a para. FERPA-safe by design. Fast. Real-time team handoffs. Local AI optional. | Solo dev, no track record, no district approvals yet |

The differentiator: SupaPara is the only tool where the **product surface and the privacy architecture are both built around paras**, not around IEP team meetings or compliance officers.

## Pitch script (90 seconds)

> "Hi, I'm Dre. I'm a paraprofessional at Fairview. I built an app called SupaPara because we needed something we could actually use during the day to log notes about our IEP students.
>
> The thing that makes it different — student names never leave the computer. Everything that syncs with the team uses a 6-digit number, so the cloud never sees real names. That's how we stay FERPA-safe without a six-month review.
>
> It works on Chromebooks, no install. Paras can log a note in 5 seconds with one tap, or they can write detail when they have time. Goals from each kid's IEP show up next to their name. The team sees handoffs in real time.
>
> Sped teachers can assign students to each para, so people only see the students they need — but paras can still add a student when real life changes during the day.
>
> I'm offering it free to your school through June. If you like it, it's $300 for the year starting in September — locked for 3 years if you sign as a Founding School. I'd love to come in for 30 minutes and show your sped team. When works for you?"

That's the whole thing. No deck, no demo URL, no signup form needed for the first conversation.

## Common objections + responses

| Objection | Response |
|---|---|
| "We already have [Frontline/IEPPro]." | "That's an IEP team tool. SupaPara is for paras during the day. Different use case. Want me to show you side-by-side?" |
| "What about FERPA?" | "Real names never leave the computer. Only a 6-digit number syncs. I can show you the data flow on one screen." |
| "Can paras see every student?" | "Admins see the full roster. Paras see assigned students and students they personally add. That keeps access practical but limited." |
| "Our IT won't approve new software." | "Nothing to install — it's a website. Same level of approval as Google Docs. Happy to send the privacy doc to IT." |
| "How do we know it'll still exist in a year?" | "Locked-in 3-year price for Founding Schools. And if it goes away, your data exports as a CSV — you own it." |
| "We don't have budget right now." | "Free through June. You can decide in September after you've used it." |
| "Can we customize it?" | "I'm the only person building it. If something is broken or missing for your team, you tell me and I fix it that week. That's the founding-school benefit." |
| "Is it AI? We're not allowed to use AI on student data." | "AI is optional and can be turned off. When it's on, real names are stripped before any AI sees the text — your IT can verify by watching network traffic." |

## Long-term roadmap (next 12 months)

| Quarter | Goal |
|---|---|
| **Apr–Jun 2026** (now) | Polish + Fairview pilot validation. Visit 20 WA schools. Sign 3–5 Founding Schools. |
| **Jul–Sep 2026** | First paid contracts begin. Onboard 3–5 schools. Build expense and accounting basics. File LLC + E&O insurance. |
| **Oct–Dec 2026** | Districts start asking. Build a multi-school admin view. Consider hiring a part-time onboarding lead. |
| **Jan–Mar 2027** | Target: 15–20 paid schools, $5–10K MRR. Decide: stay solo + lifestyle business, OR raise / scale. |

## Risks

1. **Single point of failure:** the user is the only developer. If he gets hit by a bus, the app stops getting updates. Mitigation: open the source eventually OR document handoff.
2. **District procurement creep:** as the app scales, large districts will demand SOC 2, DPA, MSAs. The cost of compliance can sink a solo founder. Mitigation: stay small-school-focused for year 1.
3. **Free pilot fatigue:** if too many schools take the free pilot but don't convert, the user runs out of runway. Mitigation: cap free pilots, require signed letter of intent.
4. **AI provider risk:** Ollama is great but most schools won't run local AI. Gemini works but Google could change pricing. Mitigation: keep both options, offer "AI off" mode.

## What "good" looks like in 12 months

- 10–15 paying schools at $300–$600/year each = $3K–$9K ARR
- Solo founder still owns 100%
- LLC filed, E&O insurance in place, basic Data Processing Agreement template ready
- Word-of-mouth pipeline from existing customers
- Decision point: stay lifestyle or raise / scale

## What "great" looks like in 12 months

- 30+ paying schools or 1 small district at $5K+/year
- Considering a part-time hire
- Featured in a state ed-tech newsletter or two
- ~$20K–$40K ARR
- Still no investors needed
