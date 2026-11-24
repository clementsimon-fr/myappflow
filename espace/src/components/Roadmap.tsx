import { frDate } from '../lib/money';
import { PHASE_STATUS } from '../lib/labels';
import type { RoadmapPhase } from '../lib/types';
import { Empty } from './ui';

export default function Roadmap({ phases }: { phases: RoadmapPhase[] }) {
  if (!phases.length) return <Empty>La feuille de route sera bientôt disponible.</Empty>;
  return (
    <ol className="timeline">
      {phases.map((ph, i) => (
        <li key={i} className={ph.status}>
          <div className="row" style={{ marginBottom: 4 }}>
            <strong>{ph.title}</strong>
            <span className={`badge${ph.status === 'en_cours' ? ' badge-warn' : ph.status === 'termine' ? ' badge-ok' : ''}`}>{PHASE_STATUS[ph.status]}</span>
          </div>
          {(ph.start || ph.end) && <div className="small muted">{frDate(ph.start)}{ph.end ? ` → ${frDate(ph.end)}` : ''}</div>}
          {ph.objective && <p className="muted" style={{ margin: '4px 0 0' }}>{ph.objective}</p>}
        </li>
      ))}
    </ol>
  );
}
