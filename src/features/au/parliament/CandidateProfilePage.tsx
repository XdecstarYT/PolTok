/** /au/victoria/candidate/:seat/:name — shareable standalone candidate profile. */
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../../components';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import { AuNav } from '../AuNav';
import { ProfileBody, ProfileHost, openProfile, slugName } from './Profile';
import { candidates } from './people';
import { Dossier } from './Dossier';
import '../au.css';

export default function CandidateProfilePage() {
  const { seat = '', name = '' } = useParams();
  const p = useMemo(() => candidates('vic-' + seat).find((c) => slugName(c.name) === name) ?? null, [seat, name]);
  useSeo({ title: p ? `${p.name} · ${p.partyName} · ${p.seatName}` : 'Candidate', description: p ? `${p.name}, ${p.partyName} candidate for ${p.seatName} at the 2026 Victorian election: model chances, the seat, and every rival.` : undefined });
  return (
    <div className="page au-page">
      <PageHeader className="au-pagehead" kicker="Victorian state election · candidate" title={p ? p.name : 'Candidate not found'} crumbLabel={p?.name ?? 'Candidate'}><AuNav /></PageHeader>
      {p ? (
        <div className="pfp"><div className="pfp__card lg"><ProfileBody p={p} onSwitch={(q) => openProfile(q, `rival:${q.seatId}:${q.name}`)} /></div><Dossier p={p} rivals={candidates(p.seatId).filter((c) => c.name !== p.name)} /></div>
      ) : <p>We couldn't find that candidate. <Link to="/au/victoria/candidates">See every candidate →</Link></p>}
      <ProfileHost />
    </div>
  );
}
