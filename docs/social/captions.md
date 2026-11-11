# PolTok explainer reels: post copy and alt text

All four reels are 1080×1920 (9:16), 30 fps, H.264 + AAC. They were rendered by `tools/reels/` (three.js, an original procedural soundtrack and an offline Piper voiceover). Captions are burned in, so every reel also works with the sound off. Text stays out of the top 220 px and the bottom 380 px.

Sources sit in each reel's end card. Check the facts again on the day you post, especially for the live-data and countdown reels.

---

## 1. Trust tax v2: `poltok-trust-tax-v2.mp4`

Cover: `poltok-trust-tax-v2-cover.jpg`

**Instagram**
> Family trusts just got a tax floor. 🧾
> A new bill sets a 30% minimum tax on discretionary trusts' taxable income from 1 July 2028, the same rate as workers earning $45k–$135k.
> It passed the House 90–45. Labor and some independents voted Aye; the Coalition, One Nation and Katter's voted No. A Senate Economics committee is reviewing it now.
> Exempt: fixed, charitable and special disability trusts, super funds, deceased estates and primary production income. There are 3 years of roll-over relief from 1 July 2027.
> Follow for live results and explainers → link in bio (poltok.netlify.app)
> #auspol #tax #trusts #budget #explained

**TikTok**
> The 30% trust tax in 40 seconds ⏱️ Who pays, who's exempt, and what the Senate does next. #auspol #tax #trusts #learnontiktok #politics

**X**
> A 30% minimum tax on discretionary trusts passed the House 90–45.
> • Starts 1 July 2028
> • Same rate as workers on $45k–$135k
> • Fixed, charitable and disability trusts, super funds and more are exempt
> • Senate committee reviewing now
> Explained in 40s 👇 poltok.netlify.app

**Alt text**
> Animated explainer. A glowing 30% sign slams in over gold coins, with the text "Family trusts just got a tax floor". An extruded map of Australia introduces the Minimum Tax on Discretionary Trusts Bill 2026. A trustee's vault sends coins to four family pawns. Bars of different heights get pushed up to a lime "30% floor" plane, with the text "From 1 July 2028, same rate as workers earning $45k–$135k". A list shows the exemptions: fixed trusts, charitable trusts, special disability trusts, super funds, deceased estates and primary production income. A 3D chamber shows the House vote, 90 Aye and 45 No, with the parties on each side named. A red Senate chamber is scanned by a lime arc ("A Senate Economics committee is reviewing the bill"). A timeline shows 3 years of roll-over relief from 1 July 2027. The video ends on the PolTok logo and poltok.netlify.app.

---

## 2. NZ election 2026, preliminary result: `poltok-nz-election-2026.mp4`

Cover: `poltok-nz-election-2026-cover.jpg`

Every frame is labelled "PRELIMINARY · UNOFFICIAL". The figures are Wikipedia's election-night preliminary count, and the official result may differ.

**Instagram**
> Most votes. Fewer seats. 🇳🇿
> Preliminary, unofficial NZ results: Labour edged the party vote (29.31% to National's 29.26%), but National has more seats, 42 to 36, because Parliament grows to 131 with 11 overhang seats.
> National, ACT and NZ First hold 67 of 131: a narrow majority. Opportunity (7 seats) is the first new party in Parliament since 2011.
> ⚠️ Preliminary and unofficial. The official count may change these numbers.
> #nzpol #nzelection #election2026 #MMP #explained

**TikTok**
> How Labour won the vote but National won more seats 🤯 (preliminary, unofficial count) #nzpol #nzelection #MMP #politics #learnontiktok

**X**
> NZ preliminary result (unofficial):
> Party vote: Labour 29.31%, National 29.26%
> Seats: National 42, Labour 36 (11 overhang seats → 131)
> National + ACT + NZ First = 67/131
> Opportunity: first new party in Parliament since 2011
> Explainer 👇 poltok.netlify.app

**Alt text**
> Animated explainer labelled "Preliminary · Unofficial" throughout. An extruded 3D map of New Zealand flickers red and blue under the headline "Most votes. Fewer seats." Two bars, red for Labour at 29.31% and blue for National at 29.26%, rise almost level ("a gap of just 0.05 points"). A 131-seat 3D hemicycle fills in by party colour, with counters for National 42 and Labour 36 and a legend: National 42, Labour 36, Green 16, ACT 13, NZ First 12, Opportunity 7, Te Pāti Māori 5. Eleven lime "overhang" seats pop up on the outer row ("+11 overhang seats: 131 in total"). The National, ACT and NZ First seats light up against a majority marker: 67, with 66 needed of 131, "A narrow majority". Seven teal Opportunity seats rise under a spotlight in front of an extruded "2011". The video ends on the PolTok logo and a note that the figures are preliminary and unofficial.

---

## 3. US midterms 2026, live seat counts: `poltok-us-midterms-2026.mp4`

STATUS: NOT RENDERED (10 Nov 2026). This reel only renders when `https://poltok.netlify.app/api/snapshot` returns balance data for both the Senate and the House. At render time the feed returned an empty `balance` (and once, Senate-only data), so the render stopped by design. No numbers are hard-coded. Re-run with `node tools/reels/render.mjs us-midterms --sheet <dir>` once the feed is live, then fill in the numbers below from `tools/reels/.cache/us-midterms/data.json`.

**Instagram (template)**
> Who controls Congress? 🇺🇸 As of {asOfLabel}:
> Senate: Democrats {senate.dem}{+ind}, Republicans {senate.rep}, {senate.undecided} undecided (51 for control).
> House: Democrats {house.dem}, Republicans {house.rep}, {house.undecided} undecided (218 for control).
> {called} of {tracked} key races PolTok tracks have been called. Live results → link in bio.
> #midterms2026 #election2026 #uspolitics #congress

**TikTok (template)**
> Where the 2026 midterm count stands right now 🗳️ #midterms2026 #election2026 #uspolitics #politics

**X (template)**
> Midterms, as of {asOfLabel}:
> Senate D {senate.dem} · R {senate.rep} · undecided {senate.undecided}
> House D {house.dem} · R {house.rep} · undecided {house.undecided}
> {called}/{tracked} key races called
> Live 👇 poltok.netlify.app

**Alt text (template)**
> Animated explainer. A 3D map of the US states flickers red and blue under "Who controls Congress?". A 3D Senate hemicycle fills with blue Democratic, purple independent, grey undecided and red Republican seats, with counters and a lime majority marker ("51 for control"). The House hemicycle follows ("218 for control"). A lime ring fills to show {called} of {tracked} key races called. The video ends on "Follow it live" and poltok.netlify.app, with the data timestamp.

---

## 4. Victorian election countdown: `poltok-vic-election-countdown.mp4`

Cover: `poltok-vic-election-countdown-cover.jpg`

The countdown number is computed on the render date (Melbourne time). The render on 10 Nov 2026 says **18 days**. If you post on a later day, re-render with `node tools/reels/render.mjs vic-countdown`.

**Instagram**
> 18 days until Victoria votes 🗳️ Saturday 28 November.
> • 88 Legislative Assembly seats, 45 for a majority
> • Preferential voting: number the boxes in order of preference; if no one has over half, the last-placed candidate drops out and their votes flow on
> • Upper house: 40 MPs, 5 from each of 8 regions
> • Early voting 18–27 Nov, polls close 6pm AEDT
> Find your electorate on the PolTok map, then follow election night live at poltok.netlify.app/au/victoria
> #vicpol #springst #vicvotes #auspol #explained

**TikTok**
> How the Victorian election actually works, in under 40 seconds 🗳️ #vicpol #vicvotes #auspol #preferentialvoting #learnontiktok

**X**
> Victoria votes Sat 28 Nov.
> 88 seats · 45 for a majority
> Number the boxes in order of preference; preferences flow until someone passes 50%
> Upper house: 40 MPs, 8 regions × 5
> Electorate maps + live election-night page 👇 poltok.netlify.app/au/victoria

**Alt text**
> Animated explainer. A glowing 3D "18" with a lime ring and the text "18 days to go". An extruded map of Victoria rises district by district under "Saturday 28 November", with "Early voting 18–27 Nov, polls close 6pm AEDT". All 88 districts pop up ("88 seats in the Legislative Assembly"). In an 88-seat hemicycle, 45 seats turn lime ("45 seats for a majority"). A sample ballot for Candidates A to D gets the handwritten numbers 1 to 4. An illustrative count follows: candidate D, then C, drops out and their votes flow on until candidate A passes a lime 50% line. A grid of 40 blue seats in 8 columns of 5 shows the Legislative Council. The Victorian map returns with one district highlighted ("Every electorate, mapped"). The video ends on "Watch it live" and poltok.netlify.app/au/victoria.
