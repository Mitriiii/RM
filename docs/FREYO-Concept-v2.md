# Freyo v2 — Concept & Strategy

**The shared-capacity and verified-emissions layer for European road freight.**

Ryan Mitri · Madrid · v2, September 2026

---

## 1. What changed from v1, and why

The v1 document described a North American digital freight brokerage: match shippers to
carriers, take a percentage of each load. That model has been tried at enormous scale and
mostly lost. Convoy raised roughly $900M, automated the large majority of load matching,
and shut down in 2023. Freight brokers keep somewhere around 13–15% of what the shipper
spends, and every cost — engineering, sales, support, insurance — has to come out of that
sliver. When rates fell, the sliver vanished. Europe has already consolidated around
sennder, which absorbed Uber Freight Europe and C.H. Robinson's European surface business.

Competing there as a solo founder is not a plan. So v2 changes three things:

| | v1 | v2 |
|---|---|---|
| **What we sell** | A cut of each shipment | Annual software + verified data subscriptions |
| **Who pays** | Whoever books the load | Shipper sustainability & procurement teams; carrier groups |
| **What we own** | Transaction flow | The measurement record and the collaboration network |

Freyo v2 never buys capacity, never takes freight liability, never subsidises rates. It sells
software and audited data. That single decision moves the gross margin from ~14% to ~85%
and removes exposure to the freight cycle.

## 2. The idea in one paragraph

Across the EU, **21.6% of all truck kilometres in 2024 were driven with an empty vehicle** —
25.8% on domestic journeys. That is diesel burned for nothing, and from 2028 it is diesel
that carries a carbon price. Individual carriers cannot fix it, because the load that would
fill their empty return leg belongs to a different shipper who does not know they exist.
Freyo is the neutral layer where a group of companies pool their freight flows, find each
other's empty legs, and — crucially — receive an audit-grade emissions record for every
movement, calculated by the exact method the EU has just made mandatory for anyone who
publishes transport emissions. Companies get cheaper freight *and* the reporting artifact
they need. The saving and the proof arrive together.

## 3. Why Europe, why now — the four dated hooks

These are real, dated regulatory events. The product is designed around them.

**1. CountEmissionsEU — in force 2 June 2026, applies from 2 December 2030.**
This is the centrepiece. Disclosing transport emissions stays voluntary, but *if* a company
discloses — to a customer, in a tender, in a report — it must use the single EU methodology,
built on **EN ISO 14083:2023**, door-to-door, well-to-wheel. And third-party calculation
tools must be **independently certified** as aligned with the standard. Every large shipper's
freight emissions number is about to become a regulated, comparable, auditable figure. There
is a four-year build window and a certification moat. This is the single best reason to start
now.

**2. EU ETS2 — carbon price on road transport fuel from 1 January 2028** (delayed one year
from 2027; allowance auctions still begin January 2027). Pre-delay price projections ran
roughly €40–63 per tonne of CO₂. That cost lands on diesel and passes through to freight
rates. On that date, every empty kilometre stops being an efficiency talking point and
becomes a line item. Freyo's value proposition converts from ESG to P&L automatically.

**3. eFTI Regulation (EU) 2020/1056 — full application 9 July 2027.** From that date every
member state authority must accept freight documents submitted electronically through a
certified eFTI platform. Paper consignment notes are on a countdown. Any platform holding
shipment data should be built eFTI-shaped from day one, even if certification comes later.

**4. CSRD, post-Omnibus — the honest version.** Do not build the pitch on CSRD. The Omnibus
package in force from March 2026 cut scope to companies with **more than 1,000 employees
AND more than €450M turnover**, removing roughly 80–90% of previously in-scope companies,
and pushed Wave 2 reporting to FY2027. Far fewer companies are legally forced to report than
the 2024 pitch decks assumed. What survives is *contractual* pressure: the large companies
still in scope must report Scope 3, and they push data requests down to suppliers and
hauliers who are not in scope but must answer anyway. Sell to that pressure, not to the
directive.

## 4. The hard truth to design around

Companies say they will pay a green premium. They mostly don't. BCG's annual survey of cargo
owners found willingness to pay for low-carbon shipping **fell from 4.5% in 2024 to 3% in
2025**, and the share expecting to pay more within five years dropped from 65% to 45%.
Decarbonisation of that sector would need 10–15%.

**Conclusion: never price Freyo as a green premium.** Price it as cost recovery and
compliance, with the carbon benefit as the free by-product. Every sentence of the sales
pitch leads with euros saved and audit hours avoided. The CO₂ number is the receipt, not the
product. A platform that only sells virtue dies in the first bad quarter; a platform that
sells lower diesel spend and a clean audit file survives.

## 5. The three components

### A. The Ledger — measurement people can put in an annual report

An emissions engine implementing ISO 14083 properly, not a spreadsheet with average factors.

- **Door-to-door, well-to-wheel.** Each movement decomposes into transport chain elements;
  each element belongs to a transport operation category with its own emission intensity;
  emissions allocate to a shipment by mass × distance share.
- **Real road distance.** Great-circle distance is wrong for road and inflates or deflates
  every number downstream. Routed road distance, from a real routing engine.
- **Primary data where it exists.** Fuel card litres and telematics beat modelled figures,
  which beat EU defaults. Every result carries a data-quality grade, so an auditor can see
  what is measured and what is estimated.
- **Reproducible forever.** Every calculation stores its inputs, the factor set version, and
  the engine version. Re-running a 2027 shipment in 2031 must return the 2027 answer. This is
  what makes the record auditable and it is the hardest thing to retrofit.
- **Certification path.** Build to be assessed against EN ISO 14083:2023 and to seek Smart
  Freight Centre accreditation. That badge is the entry ticket to enterprise procurement.

### B. The Exchange — reduction that companies do together

Not a load board. A closed, invitation-based pool where a set of companies on the same
corridors share forward visibility of their flows so empty legs can be paired.

- Members are **companies**: shippers, carrier groups, 3PLs. Never freelance drivers.
- Members keep their existing carrier contracts and rates. Freyo does not disintermediate
  anyone; it finds the pairing and hands it to the parties' own operations teams.
- The matcher is **deterministic and explainable** first: hard constraints (equipment type,
  ADR, temperature, weight, volume, time window, driver hours, cabotage limits) generate
  candidates, then a transparent score ranks them on deadhead km avoided, CO₂e avoided,
  and time-window slack. Every match shows its reasoning. Learned ranking comes later, once
  there is real accepted/rejected data to learn from.
- **A neutral data trustee, with real legal care.** Shippers sharing flow data may be
  competitors. That means: no price or rate information ever visible between members, strict
  need-to-know disclosure, documented competition-law protocol reviewed by an EU competition
  lawyer before the first pilot. Getting this right is a moat; getting it wrong is fatal.

### C. The Register — turning a saved kilometre into a reportable claim

When the Exchange pairs two legs, the avoided emissions are booked into an append-only
registry: a unique claim ID, a hash-chained event log, an explicit owner, and a hard rule
against double counting. Structure it in the language of Smart Freight Centre's voluntary
market-based measures and book-and-claim framework, so claims survive contact with an
assurance provider.

Be conservative here. Accounting rules for market-based claims are still contested and
"reductions" that don't stand up are a reputational landmine. Publish the methodology,
publish the uncertainty, and never let marketing outrun the accounting.

## 6. Beachhead: the Iberian corridor pool

Start in one place and dominate it.

- Spanish operators carry **14.5% of EU road freight tonne-kilometres** — third largest in
  the EU behind Poland and Germany.
- The sector is extraordinarily fragmented: **over 94% of Spanish road haulage and forwarding
  firms have fewer than 10 employees**, and roughly 64% are one-person operations. The five
  largest players hold a combined share in the low single digits. Fragmentation is exactly
  the condition where a coordination layer creates value.
- Domestic hauls are long — Madrid–Barcelona–Valencia routinely exceeds 650 km — and
  domestic journeys are where empty running is worst.
- You are in Madrid, at IE, with access to that corporate network. Founder-market fit is
  geographic before it is anything else.

**First cohort: 6–10 mid-size manufacturers and distributors** on Madrid–Zaragoza–Barcelona
and Madrid–Valencia, plus 3–5 regional carrier groups. Target companies whose customers are
CSRD-in-scope, so they already receive emissions questionnaires they cannot answer well.

**The pitch to a first member, in one line:** *"Give us six months of your shipment history.
We'll show you, for free, exactly how many empty kilometres you paid for on your top ten
lanes, and what they'd cost you under ETS2. Then we'll show you who's driving the other
direction."*

That free diagnostic is the wedge. It requires no integration, no commitment, and produces a
number the recipient cannot get anywhere else.

## 7. Revenue

Four lines, none of them cyclical:

1. **Ledger subscription** — annual, tiered by shipment volume. The core recurring line.
2. **Exchange membership** — annual seat/corridor fee for pool access.
3. **Verification and assurance support** — a per-report fee for audit-ready packs and
   assurance-provider liaison. Grows as external assurance requirements tighten.
4. **Data and integration** — API access, ERP/TMS connectors, carrier-network onboarding.

Explicitly excluded: percentage-of-load fees, freight margin, carbon credit resale. These
either reintroduce the Convoy problem or the greenwashing problem.

## 8. Honest risk register

| Risk | Why it's real | Mitigation |
|---|---|---|
| Crowded measurement market | shipzero, Pledge, Lune, TK'Blue, Dcycle (Spanish), Transporeon Carbon Visibility all do ISO 14083 accounting | They measure. Only Freyo also *reduces* via the pool. Measurement alone is a feature; measurement plus a matched backhaul is a product. |
| Cold start | A capacity pool with two members is worthless | Ledger works standalone from day one and is sold alone. The pool is upsell, not prerequisite. |
| Data reluctance | Flow data is commercially sensitive | Data trust structure, competition-law protocol, aggregate-only disclosure, member-controlled visibility rules |
| Regulatory slippage | ETS2 already slipped a year; it could slip again | Cost case must stand on diesel alone, with carbon price as upside. Test the model at €0/tonne. |
| Solo founder, part-time, mid-masters | The most likely killer | Ruthless scope. Ledger only for the first six months. No mobile app, no tracking, no chat, no payments. |
| Certification cost and time | ISO/SFC assessment is slow and expensive | Build to the standard from commit one so assessment is a review, not a rewrite. Budget for it in the first raise. |

## 9. What to build, in order

**Months 1–3 — the Ledger core.** Versioned emissions engine with full test coverage. CSV/Excel
shipment import. Routed distance. Data-quality grading. Reproducible audit records. One
dashboard: emissions by lane, by carrier, by period, with empty-km exposure highlighted.

**Months 4–6 — the diagnostic.** Turn the Ledger into the free wedge: upload history, get a
report showing empty-km cost today and under ETS2 scenarios. This is the sales tool.

**Months 7–12 — the Exchange.** Capacity postings, constraint matcher, match explanations,
member visibility controls, the claims register.

**Year 2 — the connective tissue.** TMS/ERP connectors, iLEAP-shaped emissions data exchange,
eFTI/e-CMR alignment, formal certification, second market (Portugal or southern France).

**Deliberately not in v1:** live GPS tracking, in-app chat, payments, driver mobile app,
customs services, carrier ratings and badges. Every one of these was in the original document
and every one is a distraction from the two things that actually differentiate: an auditable
number and a matched empty leg.

## 10. Two practical notes

- **Trademark first.** Run an EUIPO search on "Freyo" across classes 39 (transport) and 42
  (SaaS) before spending anything on brand assets. A conflict found after launch is a costly
  rename.
- **Use the degree.** This is a strong IE venture-lab or capstone project, and the structure —
  a multi-company collaboration consortium reducing freight emissions — maps well onto EU
  innovation funding, which is non-dilutive and does not care that you are a first-time
  founder.

---

### Sources anchoring the claims above

- Eurostat, *Road freight transport by journey characteristics* (2024 data): 21.6% of EU
  vehicle-km empty; 25.8% national, 12.6% international. Spain 14.5% of EU tkm.
- European Commission DG MOVE: CountEmissionsEU entered into force 1–2 June 2026; applies
  from 2 December 2030; based on EN ISO 14083:2023; third-party tools require independent
  certification.
- ICAP / EEA / Transport & Environment: ETS2 postponed to 1 January 2028; auctions from
  January 2027; pre-delay price projections ~€40–63/tCO₂.
- Regulation (EU) 2020/1056 (eFTI): full application 9 July 2027; implementing acts (EU)
  2024/1942 and (EU) 2025/2243.
- Omnibus I, in force March 2026: CSRD scope narrowed to >1,000 employees AND >€450M
  turnover; ~80–90% of companies removed; Wave 2 delayed two years.
- BCG Shipping Decarbonization Survey 2026: willingness to pay fell 4.5% → 3%; five-year
  expectation 65% → 45%.
- FreightWaves and others on Convoy: ~$900M raised, shutdown 2023, broker margins ~13–15%.
- Continental Roadshow / IBISWorld on Spain: >94% of firms under 10 employees; ~64%
  single-person; top five under ~6% combined share.

*Verify every figure before it goes into an investor deck. Regulation in this area has moved
repeatedly and will move again.*
