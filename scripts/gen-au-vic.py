#!/usr/bin/env python3
"""Generate src/data/au-vic.ts: Victorian 2022 district results (VEC) + 2026 nominations (VEC spreadsheet).

Sources (both Victorian Electoral Commission, https://www.vec.vic.gov.au):
  * 2022 results: https://www.vec.vic.gov.au/results/state-election-results/2022-state-election-results/results-by-district/<slug>-district-results
    (first preferences + final preference distribution)
  * 2026 nominations: the "spreadsheet of all the candidates who have nominated so far" linked from
    https://www.vec.vic.gov.au/voting/2026-state-election  (only names, district/region and party are kept —
    contact details in the report are deliberately dropped).
Run: python3 -I scripts/gen-au-vic.py <cacheDir>   (needs `pip install xlrd`)
"""
import html, json, os, re, sys, urllib.request

CACHE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/poltok-vec'
os.makedirs(CACHE, exist_ok=True)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
UA = {'User-Agent': 'Mozilla/5.0 (PolTok data script)'}
BASE = 'https://www.vec.vic.gov.au/results/state-election-results/2022-state-election-results/results-by-district/'
CAND_PAGE = 'https://www.vec.vic.gov.au/voting/2026-state-election'

def fetch(url, name):
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
            open(p, 'wb').write(r.read())
    return open(p, 'rb').read()

def text(raw):
    t = raw.decode('utf8', 'replace')
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', t, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', t)
    return html.unescape(re.sub(r'\s+', ' ', t))

PARTY = [
    (r'Labor', 'ALP'), (r'^Liberal', 'LIB'), (r'National', 'NAT'), (r'Greens', 'GRN'), (r'One Nation', 'ONP'),
    (r'Victorian Socialists', 'VS'), (r'Animal Justice', 'AJP'), (r'Family First', 'FF'), (r'Freedom Party', 'FPV'),
    (r'Democratic Labour', 'DLP'), (r'Legalise Cannabis', 'LCV'), (r'Shooters', 'SFF'), (r'Liberal Democrats|Libertarian', 'LDP'),
    (r'Reason', 'RP'), (r'Sustainable Australia', 'SAP'), (r'Health Australia', 'HAP'), (r'Angry Victorians', 'AVP'),
    (r'New Democrats', 'ND'), (r'Companions', 'CAP'), (r'Transport Matters', 'TMP'), (r'United Australia', 'UAP'),
]
def pcode(name):
    name = (name or '').strip()
    if not name: return 'IND'
    for rx, c in PARTY:
        if re.search(rx, name): return c
    return 'OTH'

ROW = re.compile(r"([A-Z][A-Z'’\- ]+), ([A-Z][^0-9]*?) ([\d,]+) ([\d.]+)%")

# Narracan's 2022 poll failed (a candidate died); it was decided at a supplementary election on 28 Jan 2023.
SPECIAL = {'narracan': ('https://www.vec.vic.gov.au/results/state-election-results/state-by-elections-timeline/narracan-district-supplementary-election-results',
                        'Supplementary election, 28 January 2023 (the 2022 poll failed after a candidate died).')}

def parse_district(slug, name):
    url, note = SPECIAL.get(slug, (BASE + slug + '-district-results', None))
    t = text(fetch(url, slug + '.html'))
    m = re.search(r'Total enrolment as at close of rolls: ([\d,]+) Formal votes: ([\d,]+) Informal votes: ([\d,]+).*?Total votes: ([\d,]+)', t)
    num = lambda s: int(s.replace(',', ''))
    def rows(seg):
        out = []
        for g in ROW.finditer(seg):
            rest = g.group(2).strip()
            pm = re.search(r' (Liberal|Australian|National|Victorian|Animal|Family|Freedom|Democratic|Legalise|Shooters|Libertarian|Reason|Sustainable|Health|Angry|New Democrats|Companions|Transport|United|Pauline|Labour|The Greens).*$', ' ' + rest)
            given, party = (rest[:pm.start() - 1].strip(), pm.group(0).strip()) if pm else (rest, '')
            out.append({'n': f"{given} {g.group(1).title()}".strip(), 'p': pcode(party), 'pn': party or 'Independent', 'v': num(g.group(3)), 'pct': float(g.group(4))})
        return out
    i = t.find('First preference votes')
    i2 = t.find('Recheck results by voting centre', i)
    fp = rows(t[i:i2 if i2 > 0 else None]) if i >= 0 else []
    # Final count: a two-candidate-preferred table when published, else the last count of the preference
    # distribution (which may stop with >2 candidates once someone has an absolute majority).
    c = t.find('Two candidate preferred results Candidate')
    if c >= 0:
        tcp, kind = rows(t[c:t.find('Two candidate preferred results by', c)]), '2cp'
    else:
        j = t.find('Preference distribution results')
        tcp, kind = (rows(t[j:t.find('Distributions', j)]), 'pd') if j >= 0 else ([], None)
    return {
        'enrol': num(m.group(1)) if m else None, 'formal': num(m.group(2)) if m else None,
        'informal': num(m.group(3)) if m else None, 'turnout': num(m.group(4)) if m else None,
        'fp': sorted(fp, key=lambda c: -c['v']), 'final': tcp, 'finalKind': kind,
        'url': url, **({'note': note} if note else {}),
    }

def main():
    au = open(os.path.join(ROOT, 'src/data/au.ts'), encoding='utf8').read()
    vic = re.findall(r'"id": "vic-([a-z0-9-]+)", "name": "([^"]+)"', au)
    assert len(vic) == 88, len(vic)
    results, bad = {}, []
    for slug, name in vic:
        try:
            r = parse_district(slug, name)
        except Exception as e:  # noqa
            bad.append(f'{slug}: {e}'); continue
        tot = sum(c['v'] for c in r['fp'])
        if not r['fp'] or (r['formal'] and abs(tot - r['formal']) > 2): bad.append(f'{slug}: fp sum {tot} vs formal {r["formal"]}')
        if len(r['final']) < 2: bad.append(f'{slug}: final rows {len(r["final"])}')
        results['vic-' + slug] = r
    print('districts', len(results), 'issues:', bad)

    # 2026 nominations
    page = fetch(CAND_PAGE, 'vec2026.html').decode('utf8', 'replace')
    href = re.search(r'href="(/-/media/[0-9a-f]+\.xls)"', page).group(1)
    raw = fetch('https://www.vec.vic.gov.au' + href, 'cands-' + href.split('/')[-1])
    import xlrd
    sh = xlrd.open_workbook(file_contents=raw, logfile=open(os.devnull, 'w')).sheet_by_index(0)
    as_at = next((sh.cell_value(r, 0) for r in range(10) if str(sh.cell_value(r, 0)).startswith('As at')), '').replace('As at ', '')
    dist, reg, cur, kind = {}, {}, None, None
    for r in range(sh.nrows):
        a = str(sh.cell_value(r, 0)).strip()
        if a.endswith(' District'):
            cur, kind = 'vic-' + re.sub(r'[^a-z0-9]+', '-', a[:-9].lower()).strip('-'), dist
            dist.setdefault(cur, [])
        elif a.endswith(' Region'):
            cur, kind = a[:-7], reg
            reg.setdefault(cur, [])
        elif cur and ', ' in a and a not in ('Candidates',):
            sur, given = a.split(', ', 1)
            kind[cur].append([f"{given} {sur.upper()}", pcode(str(sh.cell_value(r, 4)))])
    ids = {'vic-' + s for s, _ in vic}
    stray = [k for k in dist if k not in ids]
    print('nominations as at', as_at, 'districts with candidates', len(dist), 'regions', len(reg), 'total', sum(map(len, dist.values())) + sum(map(len, reg.values())), 'stray ids', stray)

    out = {
        'results2022': results,
        'nominations': {'asAt': as_at, 'source': CAND_PAGE, 'file': 'https://www.vec.vic.gov.au' + href, 'districts': dist, 'regions': reg},
    }
    hdr = ('// GENERATED by scripts/gen-au-vic.py — do not hand-edit. Source: Victorian Electoral Commission (vec.vic.gov.au).\n'
           '// results2022: 2022 state election, first preferences + final two-candidate (preference distribution) per district.\n'
           '// nominations: VEC nominations spreadsheet (names, district/region and registered party only).\n'
           "export interface VicCand { n: string; p: string; pn: string; v: number; pct: number }\n"
           "export interface VicResult2022 { enrol: number | null; formal: number | null; informal: number | null; turnout: number | null; fp: VicCand[]; final: VicCand[]; finalKind: '2cp' | 'pd' | null; url: string; note?: string }\n")
    body = (f"export const VIC_RESULTS_2022: Record<string, VicResult2022> = {json.dumps(results, ensure_ascii=False)};\n"
            f"export const VIC_NOMINATIONS: {{ asAt: string; source: string; file: string; districts: Record<string, [string, string][]>; regions: Record<string, [string, string][]> }} = {json.dumps(out['nominations'], ensure_ascii=False)};\n")
    open(os.path.join(ROOT, 'src/data/au-vic.ts'), 'w', encoding='utf8').write(hdr + body)
    print('wrote src/data/au-vic.ts')

main()
