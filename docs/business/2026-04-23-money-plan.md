# SupaPara — Money Plan (Revised)

**Drafted:** 2026-04-23 (v2 — rewritten to focus on HOW to sell, not just what to charge)
**Context:** Fairview Middle (WA) pilot April–June 2026 → district → WA districts
**For:** Deandre (Mr. Dre) — special-ed paraprofessional, solo founder

---

## Read this first

Making money from education software is 80% selling and 20% product. This doc is now mostly about selling — the pitch, the people, the objections, the packaging, the contract. Pricing is one small section inside.

**Important correction from v1:** keep Fairview free through June as you promised. Then you propose paid starting the 2026-27 school year. See "Fairview Next Year" below.

---

## 1. Who actually buys this (so you know who to talk to)

This is the single most confused part of K-12 sales. Most first-time founders pitch the wrong person and wonder why nothing happens. Here's the real hierarchy for your product:

| Buyer | Budget authority | Usually cares about | How to reach them |
|---|---|---|---|
| **A paraprofessional** | $0 | "Will this make my day easier?" | They're your user, not your buyer. Useful as a CHAMPION inside a school. |
| **Special Ed Teacher / Case Manager** | $0–300 discretionary | Student outcomes, paperwork time saved | Same — they're champions, not signers. |
| **Principal** | $500–3,000 without board | Their staff's wellbeing, data for the school, no FERPA lawsuits | ← **This is you at Fairview.** Email intro, in-person meeting. |
| **District Special Ed Director** | $3,000–50,000 | Compliance, audit trails, equity across schools | Principal referral, cold email, state conferences. |
| **District CFO / Superintendent** | $50,000+ | ROI, contract terms, vendor risk | Usually only needed for big enterprise deals. |
| **School Board** | $250,000+ | Public optics, vendor diversity | You will never talk to these people at your scale. |

### Your specific playbook for 2026-2028

- **April–June 2026:** Sell to **paras** (user adoption, free). They're your data source.
- **September 2026:** Sell to your **principal** (Fairview paid conversion).
- **October 2026:** Sell to your **District Special Ed Director** (your district, first contract).
- **January–May 2027:** Sell to **other WA District Sped Directors** (replicate).

Don't skip levels. Trying to pitch a Superintendent in Year 1 is like asking for a meeting with the CEO of a 5,000-person company — you'll get declined, forgotten, or handed down to the right person after three months of delay.

---

## 2. What you are actually selling (say this, not "software")

The worst sales pitch is "it's an app for paras to log stuff." People can't picture what that means.

### The core pitch, in one sentence

> "SupaPara is the first tool built specifically for special-ed paraprofessionals — one-tap logging during class, automatic handoffs between periods, FERPA-safe by design."

### The three things you actually sell (in this order)

**1. Time back for your paras.** Currently they log on paper, sticky notes, or not at all. 5-10 minutes × 3 times a day × 180 days = 30-60 hours/year/para of paperwork. SupaPara cuts that to near-zero.

**2. Better student outcomes from continuity.** Kid has a rough 1st period — currently, the 2nd period para has to learn that the hard way. SupaPara's handoff feature means the 2nd para walks in prepared. This is the single most compelling anecdote in your pitch.

**3. Defensible records.** When an IEP meeting or legal issue comes up, the school needs timestamped notes. Most paras don't have them. SupaPara creates them automatically. This is the principal's favorite feature (even though paras never mention it).

### Your real competitive story

There is NO software built for paras. All existing IEP tools (Frontline, IEP Direct, SEAS, Goalbook) are built for teachers, case managers, or admins. Paras are an afterthought in those tools — "put in a note if you want."

You're not competing with them. You're filling a gap that they've never addressed.

**Script:**
> "Your district already uses [Frontline/IEP Direct/etc.] for the teachers and case managers. That's fine — SupaPara sits alongside it. We don't replace IEP authoring. We're the tool the paras actually use during class, and we export cleanly so the IEP meetings have real data. It's the missing layer."

---

## 3. The pitch — what to actually say (scripts)

### The 60-second elevator pitch (for hallway conversations)

> "I built a classroom app for paraprofessionals. Think one-tap logging for behavior, academics, breaks, handoffs between periods. Real names stay on the device — all cloud data is pseudonymous. Fairview's been piloting it with five paras this spring. If you want, I can show you in 3 minutes."

### The 3-minute demo script

> **0:00 — Problem.** "A para supporting 8 IEP students across 4 periods might write 20 notes a day. Most of it ends up on sticky notes. When Monday's behavior spike shows up Thursday, nobody connects the dots."

> **0:30 — Show Simple Mode.** Open https://supapara.vercel.app, flip into Simple Mode. Click ⭐ Positive on a kid. Click ☕ Break on another. Point at the counts. "Two taps, logged. No typing. Nothing left undocumented."

> **1:15 — Show handoff.** "1st period para sees a chair get thrown. Taps Behavior, adds 'triggered by loud transition.' Posts to the team. 2nd period para refreshes and sees it. They walk in prepared instead of surprised."

> **2:00 — Show privacy.** Point at the sidebar. "Real student names never leave this computer. Cloud only sees 6-digit Para App Numbers. Your district's IT director should love this."

> **2:30 — Ask.** "Would you want to try this at [their school] this fall? Five paras, one semester, free."

**Practice this out loud at least 20 times before your first meeting.** Time it with a phone. If it's over 3:30, cut something.

### The 10-minute meeting agenda (for scheduled district meetings)

1. **Minute 0-2:** Who you are, why you built it (you're a para, you know the pain).
2. **Minute 2-5:** Live demo (same as 3-min above, but expanded).
3. **Minute 5-7:** Fairview pilot results (screenshot a graph of logs/week, show principal's quote).
4. **Minute 7-8:** FERPA/privacy architecture ("real names stay local, we sign your DPA").
5. **Minute 8-9:** Price and packaging ("Fairview pays $300, which is our founding-school rate. For [their district size], we'd propose $X.").
6. **Minute 9-10:** Ask for the next step ("Would you want a 30-day demo for three schools?").

**Leave 5 minutes for questions.** If you fill the full hour with your deck, you're doing it wrong.

### The one-pager (printed + PDF)

A physical one-pager is still the most effective artifact at a district meeting. Structure:

```
┌─────────────────────────────────────────────────┐
│  SUPAPARA — classroom app for paraprofessionals │
├─────────────────────────────────────────────────┤
│  The problem:                                   │
│  Paras support IEP students all day and         │
│  document on paper, if at all. IEP meetings     │
│  miss the best data in the building.            │
│                                                 │
│  What we do:                                    │
│  • One-tap classroom logging                    │
│  • Live handoffs between periods                │
│  • Pseudonymous cloud, real names stay local    │
│                                                 │
│  Fairview Middle Pilot (Apr–Jun 2026):          │
│  • 5 paras, 28 students, 10 weeks               │
│  • [X] incidents captured that would have been  │
│    lost to memory alone                         │
│  • Principal quote: "..."                       │
│                                                 │
│  Pricing:                                       │
│  • $600/year per school (unlimited paras)       │
│  • District discount for 5+ schools             │
│                                                 │
│  Contact: deandre@supapara.app                  │
└─────────────────────────────────────────────────┘
```

Fits on half a letter-size sheet. Print 100 for $10 at Office Depot. Carry them everywhere.

---

## 4. How to find buyers (lead generation for Washington state)

### Tier 1 — warm intros (do these first, highest conversion)

1. **Your Fairview principal → your District Special Ed Director.** Single most valuable intro in your whole journey. Ask your principal in May. Specific ask: *"If the pilot goes well, would you introduce me to [name] at the district office?"*
2. **Your district Sped Director → peers at other WA districts.** Sped directors talk to each other. They have a listserv. Ask for two intros after you close your first contract.
3. **Your friends who are teachers / admins at other schools.** Every special ed teacher in WA knows 5-10 paras. Ask for coffee with their admin.

### Tier 2 — professional associations (WA-specific)

| Organization | What they do | How to use |
|---|---|---|
| **WSASP** (Washington State Assoc of School Psychologists) | Annual conference, newsletter | Attend the conference. ~$300 registration. Booth rental $800. Worth it in Year 2. |
| **WASA** (WA Assoc of School Administrators) | Superintendent conference | Too senior for Year 1. Year 2+. |
| **WEA** (Washington Education Association) | Paras are members | Write an article for their publication. Free marketing. |
| **AOESD** (Educational Service Districts) | 9 regional ESDs that serve multiple districts | ESDs sometimes buy software for all their districts. HUGE leverage point. Contact them after 2nd district signs. |
| **OSPI** (Office of Superintendent of Public Instruction) | State-level | Way too early. Year 3+. |

### Tier 3 — cold outreach (do in batches, expect 5-10% reply rate)

- **LinkedIn:** Search "Special Education Director" + Washington state. ~295 districts. DM script below.
- **Email:** Most district websites list Sped directors. Cold email script below.
- **Facebook groups:** "Washington State Paraeducators," "Pacific NW Special Ed Teachers." Don't spam. Occasionally answer questions and mention you built a tool.
- **Reddit:** r/specialed, r/teachers. Same rule — answer questions, don't spam.

**Cold email template (Sped Director, post-pilot):**
> Subject: 3-min demo — app built for paraprofessionals
>
> Hi [Name],
>
> I'm a paraprofessional at Fairview Middle in [district]. I built a classroom app specifically for paras — one-tap logging, live handoffs between periods, FERPA-safe by design. Fairview piloted it this spring and [principal's name] said it changed how the paras work.
>
> Would you be open to a 15-minute demo in September? Happy to come to your office or Zoom, whichever's easier.
>
> Deandre
> https://supapara.app

**LinkedIn DM template:**
> Hey [Name] — I'm a para at Fairview Middle. Built a tool for paraprofessionals that's being piloted at my school this spring. Short demo I recorded: [Loom link]. If it's interesting, 15 min in September?

Send 10-20 of these per week after the pilot ends. **Tracking: make a simple spreadsheet — Name, District, Role, Date Sent, Reply, Meeting.** Lead gen is a numbers game.

### Tier 4 — content / SEO (long game, Year 2+)

- Blog post: "Why I built an app for paraprofessionals (after 5 years as one)"
- Medium / LinkedIn article: "The paraprofessional documentation gap"
- Demo video on YouTube: optimizes for searches like "para IEP tracking app"
- Monthly newsletter to anyone who demos (Mailchimp free tier)

---

## 5. Objections — the 10 things buyers will ask, with answers

These will come up every single meeting. Memorize them.

**Q: "Is it FERPA compliant?"**
> A: "FERPA-aligned by architecture. Real student names never leave the device — the cloud only sees pseudonymous 6-digit IDs that your admin controls. We sign your Data Processing Agreement. Happy to share the architecture doc if your IT team wants to review."

**Q: "Who's behind this? Are you a company?"**
> A: "I'm a paraprofessional myself — built this to solve my own problem, then Fairview's principal saw it and asked if the team could use it. SupaPara LLC is registered in Washington. I'm the sole engineer today."
*Don't hide that you're solo. Education buyers actually like that the builder is also a practitioner. It's authentic.*

**Q: "What if you stop developing it?"**
> A: "Built-in one-click data export — every log, every incident, your whole dataset as JSON and CSV. You never get locked in. I can also hand over the codebase to your district in an escrow arrangement for district-level contracts."

**Q: "Does it work on Chromebooks?"**
> A: "Yes — designed for Chromebook viewport and touchscreens from day one. Tested on 1280×720 and 1366×768. Most paraprofessionals I know use Chromebooks exclusively."

**Q: "Will our teachers have to use it too?"**
> A: "No. It's para-only. Teachers keep using whatever IEP platform you already have — Frontline, Goalbook, whatever. SupaPara is the layer under that."

**Q: "What about kids who have BIPs? Can it handle sensitive content?"**
> A: "Yes — we have alert flagging for BIP students right on the student card. All cloud data is pseudonymous, so even in a breach the content isn't tied to a real student without the local roster file."

**Q: "What does it cost?"**
> A: [Lead with per-school, pivot to district if they're big.] "For a single school, $600/year with unlimited paras. For a district like yours with [N] schools, typically $X — I can send you a quote sheet."

**Q: "We have no budget."**
> A: "Understood. The return is measurable — time paras currently spend on paperwork. At even $15/hour para rate, one para saving 30 minutes a day is $1,350/year in recovered time. Site license is $600. If budget's truly locked, let's start with the Free Starter tier: one school, three paras, no cloud sync. Free forever."

**Q: "We already use [competitor]. Why SupaPara?"**
> A: "What you have is great for [teachers / case managers / admins]. SupaPara is specifically for paras — one-tap logging, handoffs, classroom-first. We don't replace [competitor], we sit alongside. Let me show you the difference." [Demo Simple Mode.]

**Q: "What's your uptime / reliability?"**
> A: "Cloud runs on Supabase (enterprise Postgres). 99.9% uptime SLA. App works fully offline if cloud is unreachable — paras can log locally and sync when they're back online. No class ever stops because the internet is bad."

**Q: "Can we try before we buy?"**
> A: **"Yes — 30-day free pilot at up to 3 schools. If it works, you convert to paid. If it doesn't, we part as friends, you keep your data."** This is your single most powerful response. Use it as often as you can.

---

## 6. Product tiers & packaging — multiple ideas to pick from

Don't offer all of these. Pick 3-4 that feel right and put them on the pricing sheet. The rest are optionality.

### A. Free tier (give-away, loss leader)

**Name:** SupaPara Solo
**Price:** $0 forever
**Limits:** 1 school, 3 paras max, no cloud sync (localStorage only), no handoffs
**Why it exists:** Gets the product in front of skeptical individuals without a purchase decision. Converts maybe 5% to paid over time.

### B. School tiers

**School Starter** — $400/year
- 1 school, up to 5 paras
- All core features (logs, case memory, Simple Mode, Export Today)
- No parent notes, no handoffs
- Email support only

**School Standard** — $600/year ← **this is your default sell**
- 1 school, unlimited paras
- Everything in Starter
- Handoffs + real-time team sync
- Parent notes (Sped-only)
- Phone/video support once a month

**School Pro** — $900/year
- Everything in Standard
- Dedicated onboarding session (1 hour)
- Priority support (24 hr response)
- Analytics dashboard with exports

### C. District tiers (volume discounts baked in)

**District Small** — $3,500/year (up to 10 schools)
- Effective rate: $350/school — 42% off list
- Admin console for district-wide reporting
- DPA + FERPA attestation letter included

**District Standard** — $10,000/year (up to 30 schools) ← **sweet spot**
- Effective rate: $333/school
- Everything above + on-site training (one day)
- Dedicated account manager (you, until you hire)

**District Enterprise** — $25,000+/year (30+ schools)
- Custom pricing based on size
- Custom subdomain (e.g. `seattle.supapara.app`)
- SSO / SAML login (costs you, charge extra)
- Annual audit / review meeting

### D. Add-ons (pure profit once the base is sold)

- **On-site training day:** $800 flat
- **Parent portal (Year 2 build):** $200/year/school
- **District branded theme / logo:** $500 one-time
- **Custom data export format:** $300 one-time
- **Priority support upgrade:** $500/year
- **White-glove onboarding:** $1,500 one-time (3 hours of your time × 5 schools)

### E. Experimental pricing ideas

- **Pay-per-incident-logged:** $0.10/log. Probably don't do this. Too variable, paras will avoid logging.
- **Free for Title I schools:** Get PR, support equity. Cost you 10-15% of possible revenue but worth it for story. Announce in Year 2.
- **"Founder Lifetime" — $2,000 one-time:** For the first 5 schools ever. Good PR, gets cash now. Means those 5 never pay again. Only do if you really need cash.
- **Revenue share with the district:** Crazy idea — 50% of paid seats goes to the district's para hardship fund. Great pitch, complicated paperwork. Probably not Year 1.

---

## 7. Pricing — what to actually put on the sheet (2026-27 school year)

Pick one set and ship it. You can always change prices for Year 2.

### Recommended Year 1 pricing sheet

| Tier | Price | Includes |
|---|---|---|
| **Solo (free)** | $0 | 1 school · 3 paras · local only |
| **School Standard** | **$600/year** | 1 school · unlimited paras · handoffs · parent notes · email support |
| **District Small** | **$3,500/year** | Up to 10 schools · admin console · DPA · FERPA attestation |
| **District Standard** | **$10,000/year** | Up to 30 schools · on-site training · dedicated AM |

**One-liner:** "Most schools are on Standard at $600. Most districts are on District Standard at $10,000. Solo is free if you just want to try it yourself."

### Fairview next year (specific)

Fairview is your "Founding School" — give them a permanent 50% discount:
- **$300/year, locked forever as long as they renew annually.**
- Do a small in-person renewal conversation in July 2026 with your principal.
- Get a 3-year signed contract if they'll do it ($900 total).

### Your district's first paid deal (target: Oct 2026)

- Propose **District Small at $3,500/year for 10 schools** including Fairview.
- If they push back: $2,800/year as "Launch Partner" for Year 1 only, rising to $3,500 in Year 2.
- Multi-year: 10% discount for 2-year contract.

---

## 8. The close — what you actually send them to sign

You need three documents. None are complicated. Templates at the end of this file.

### Document 1 — Master Services Agreement (MSA)

- 1 year, auto-renewing
- Payment: annual, Net-30 invoice
- Termination: 30 days written notice
- Data export: within 30 days of termination
- Governing law: Washington State
- Limitation of liability: $X (usually contract amount or 2x)
- Indemnification: mutual, standard

### Document 2 — Data Processing Agreement (DPA)

- What data you collect
- Where it's stored (Supabase, US region)
- Subprocessors (Supabase, Vercel)
- Security measures
- Breach notification (72 hours)
- Data return/deletion on termination

**Shortcut:** adapt Google's or Microsoft's DPA template. Those are the gold standard in K-12. Schools expect their language. Changing it signals "vendor is new."

### Document 3 — Order Form

One page per customer:
- Their name, address, contact person
- Tier + price
- Effective date + term
- Signature lines

Most districts have their OWN contract templates they want you to sign. Read every line. Push back on:
- Unlimited liability (change to $X or contract amount)
- Unlimited indemnification (change to mutual, limited)
- Source code escrow for small contracts (only for $50k+)
- "We own the data" (you don't, they do, but also pushback if they claim ownership of your software)

### Payment mechanics

- **Invoice via Stripe Invoicing** (free, looks professional). Accept ACH and credit card.
- **Never take personal Venmo/Zelle for business.**
- **For districts:** They'll want to pay via PO + paper check. That's fine, just factor 30-60 days from invoice to check.

---

## 9. Revenue projections — honest three scenarios

Updated from v1 to reflect "Fairview free through June, $300 starting Fall 2026."

### Conservative (this-is-a-side-project scenario)

| Year | What happened | Revenue | Costs | Net |
|---|---|---|---|---|
| 2026-27 | Fairview $300. No district deal. | $300 | $1,200 | **–$900** |
| 2027-28 | 3 schools in your district at $500 avg. | $1,800 | $1,500 | **+$300** |
| 2028-29 | 8 schools, 1 district small deal. | $6,500 | $2,500 | **+$4,000** |
| 2029-30 | 20 schools, 2 district small deals. | $14,000 | $4,000 | **+$10,000** |

### Moderate (you push hard summers + evenings)

| Year | What happened | Revenue | Costs | Net |
|---|---|---|---|---|
| 2026-27 | Fairview $300 + 3 pilot-to-paid schools at $400. | $1,500 | $1,500 | **$0** |
| 2027-28 | 1 district small deal ($3,500) + 8 individual schools. | $8,300 | $3,000 | **+$5,300** |
| 2028-29 | 3 district deals, 30 schools total. | $30,000 | $6,000 | **+$24,000** |
| 2029-30 | 6 districts, ~80 schools. | $70,000 | $12,000 | **+$58,000** |

### Ambitious (full-time by end of 2027)

| Year | What happened | Revenue | Costs | Net |
|---|---|---|---|---|
| 2026-27 | Fairview + 5 schools + 1 district deal late spring. | $7,500 | $2,500 | **+$5,000** |
| 2027-28 | 5 districts signed. Go full-time mid-year. | $45,000 | $15,000 | **+$30,000** |
| 2028-29 | 15 districts, ~150 schools. Hire 1 person. | $130,000 | $50,000 | **+$80,000** |
| 2029-30 | 40 districts, ~400 schools. WA-dominant. | $300,000+ | $120,000 | **+$180,000+** |

**Honest bet:** you'll land in Moderate if you commit. The gap between Moderate and Ambitious is "do you quit teaching to sell full-time." Most people don't, and that's fine.

---

## 10. Costs — what to actually spend (condensed from v1)

### Year 1 (through Apr 2027), tight budget: **~$600**
- LLC + WA annual report: $260
- Domain: $20
- Supabase + Vercel free tier where possible: $0–100
- E&O insurance: $250 (if you find a cheap one)
- Privacy policy template (Termly): $0-180

### Year 1, "do it right": **~$1,600**
Everything above plus:
- Lawyer review of first contract: $500
- Better insurance: $750
- Supabase Pro for full year: $300

### Year 2+ (when second paid district comes in)

- Lawyer on retainer: $500–2,000/deal
- D&O + cyber insurance: $2,000–5,000/year
- SOC 2 Type 1 (only when asked): $8,000–15,000 one-time
- Accountant: $500–1,500/year
- Possibly a contractor to help with support: $500–2,000/month

Don't spend any of Year 2+ money until the revenue is landing.

---

## 11. Timeline — the critical 18 months

| Month | Action | Outcome |
|---|---|---|
| Apr 2026 | Launch pilot at Fairview | 5 paras using it daily |
| May 2026 | Collect real usage data. Write down every quote. | Pilot data for pitch |
| Jun 2026 | Pilot retrospective. Principal's written testimonial. | Case study in hand |
| **Jul 2026** | **File WA LLC ($260). Buy domain. Adapt DPA. Get E&O quote. Draft one-pager.** | Legally operational |
| Aug 2026 | Write pilot report PDF. Record 3-min demo. Landing page. | Marketing assets ready |
| Sep 2026 | Fairview renewal conversation. $300/year "Founding School." | First revenue |
| Sep 2026 | Email district Sped Director. Ask for October meeting. | Meeting booked |
| Oct 2026 | District pitch. Ask for 3-school trial. | Contract draft going back and forth |
| Nov 2026 | Close or don't. Either way, you learn a ton. | First district or first rejection |
| Dec 2026 | If yes: roll out. If no: 5 cold emails to other districts. | Either way, momentum |
| Jan 2027 | WSASP conference if in range. $300 + travel. | 2-3 warm leads |
| Feb–Apr 2027 | Cold outreach + demos to other WA districts. | 2nd district closing Q2 |
| May 2027 | Year 1 review. Decide 2027-28 strategy. | Moderate or Ambitious path choice |

---

## 12. First 30 days — what to do, this week, this month

### This week (Apr 23–30, 2026)
- [ ] Buy domain (`supapara.app` ~$15). Point Vercel at it.
- [ ] Write a one-sentence pitch for Fairview paras to see when they open the app: "Piloting April–June with your team. Free to use."
- [ ] Draft a simple Fairview Pilot Agreement (two paragraphs) and get it signed by principal next week.
- [ ] Start a spreadsheet: "Pilot Feedback Tracker" — para name, date, quote, bug, feature request.

### Weeks 2-4 (May)
- [ ] 15-minute in-person check-in with each para using it. Bring donuts.
- [ ] Write a privacy policy + terms of service (use Termly for $15, or adapt a template). Link from the app footer.
- [ ] Record a 2-minute Loom demo video. Use it in every future conversation.
- [ ] Ask your principal: "If this pilot goes well, would you introduce me to Sped leadership at the district?"

### June (the critical month)
- [ ] Run a 30-minute pilot retrospective meeting with the paras + principal.
- [ ] Get the principal's testimonial in writing (a 3-sentence email works).
- [ ] Decide: do you commit to pitching the district? If yes, block 20 hours in July for prep.

---

## 13. Risks — what actually kills this

1. **You burn out during the school year.** You're still a para. 10 hrs/week max on this during school. Hold the line.
2. **Your principal leaves.** Principals turn over. Get your agreement in writing, not just verbal.
3. **A district IT director rejects on FERPA grounds** even though you're aligned. Have your architecture doc ready. If they still reject, move on — it's not worth arguing.
4. **Someone copies your feature set.** Unlikely at your stage but possible. Move fast and own the relationships. The features aren't the moat; the paras' trust is.
5. **You hire too early.** Don't hire before you have 3 paying districts. You'll stress cash flow and manage someone who has no playbook.
6. **You quit teaching too early.** Don't quit your day job until you have 6 months of runway AND monthly revenue > 1.5x your para salary for 3 months straight.

---

## 14. Appendix — document templates (drop-in)

### Fairview Pilot Agreement (1 page)

> **SupaPara Pilot Agreement — Fairview Middle School**
>
> SupaPara ("the App") will be made available at no charge to Fairview Middle School's paraprofessional team between April 1, 2026 and June 15, 2026.
>
> During this pilot:
> - Paraprofessionals will use the App to log classroom observations, share handoffs, and track IEP student support.
> - Real student names will not be stored in the cloud. Only pseudonymous 6-digit identifiers and working notes (as described in the SupaPara Privacy Architecture) will sync.
> - Fairview may terminate the pilot at any time by notifying the developer.
> - At pilot end, all data from the pilot may be exported and retained by Fairview.
>
> This agreement carries no financial obligation.
>
> Signed:
> ______________________________  [Principal]
> ______________________________  [Deandre — SupaPara LLC]
> Date: _________

### District cold email (post-pilot)

> Subject: Fairview's paras using a new classroom app — 15-min demo?
>
> Hi [Dr. X / Mx. Y],
>
> I'm Deandre, a paraprofessional at Fairview Middle. This spring our five paras piloted an app I built specifically for paraprofessionals — one-tap classroom logging, live handoffs between periods, FERPA-aligned by design (real student names never leave the device).
>
> [Principal name] sent me this note at the end of the pilot: *"[3-sentence quote]"*.
>
> I'd love 15 minutes in September to show you where our paras landed and see if it's interesting for [their district]. Happy to come to your office, or Zoom if that's easier.
>
> Two-minute demo if you want to preview: https://supapara.app/demo
>
> Thanks,
> Deandre
> SupaPara LLC
> deandre@supapara.app
> [phone]

### Price sheet (one page, PDF)

```
SUPAPARA · 2026-27 PRICING

School Standard — $600/year/school
  Unlimited paras · handoffs · parent notes
  Cloud sync · email support
  This is the right fit for 95% of schools.

District Small — $3,500/year (up to 10 schools)
  Everything in School Standard for every covered school
  Admin console · DPA · FERPA attestation letter

District Standard — $10,000/year (up to 30 schools)
  Everything in District Small
  On-site training · dedicated account manager

Founding School rate (Fairview and first 2 customers):
  $300/year, locked as long as you renew

Solo (individual para, free):
  1 school, 3 paras, local-only, no cloud

Pilots are always free for 30 days at up to 3 schools.

Questions: deandre@supapara.app · supapara.app
```

---

## TL;DR

- **Don't charge Fairview through June.** Stay free as promised.
- **Starting Sep 2026:** Fairview pays $300/year as Founding School.
- **Target district Sped Director Oct 2026** for first real contract (~$3,500/year, 10 schools).
- **Expect $0–$5,000 net in Year 1** and $5k–$30k in Year 2 if you push.
- **Your single biggest sales asset** is the Fairview principal's written testimonial. Every district pitch leans on it.
- **Your single biggest time risk** is burning out during the school year. Cap at 10 hrs/week in-term, 20 hrs/week out-of-term.
- **Charge $600/school/year standard, $3,500/district/year for small volume, $10k/district for medium volume.**
- **Spend ~$600 in Year 1** (LLC, domain, insurance, basic legal). Don't spend more until revenue shows up.
- **Do NOT spend on SOC 2 until your third paid district asks for it.**

The whole game right now: run the pilot like your career depends on it, because this story is what you're selling in October.
