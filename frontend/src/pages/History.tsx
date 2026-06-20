import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Select, StatusBadge, Skeleton, EmptyState, ErrorState } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { formatCost, formatDurationSec, formatRelativeTime } from '../lib/format';
import type { RunListItem, RunStatus } from '../lib/types';
import styles from './History.module.css';

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All runs' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'generating', label: 'Generating' },
];

/** Completed runs open the output view; anything in flight reopens progress. */
function rowHref(run: RunListItem): string {
  const id = encodeURIComponent(run.ad_id);
  return run.status === 'completed' ? `/output/${id}` : `/progress/${id}`;
}

export function History() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setRuns(null);
    setError(null);
    try {
      const data = await api.listRuns(filter ? { status: filter as RunStatus } : {});
      setRuns(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load run history.');
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className="t-display-sm">History</h1>
        <div className={styles.filter}>
          <Select label="Filter by status" value={filter} options={FILTERS} onChange={setFilter} />
        </div>
      </div>

      {error ? (
        <ErrorState title="Couldn’t load history" message={error} action={<Button onClick={load}>Try again</Button>} />
      ) : runs === null ? (
        <div className={styles.tableWrap} style={{ padding: 'var(--space-16)' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={40} style={{ marginBottom: 'var(--space-8)' }} />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          message="Generate your first ad to see it here."
          action={<Link to="/"><Button>Create a new ad</Button></Link>}
        />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="t-cta-sm">Ad ID</th>
                <th className="t-cta-sm">Experience</th>
                <th className="t-cta-sm">Angle</th>
                <th className="t-cta-sm">Hook</th>
                <th className="t-cta-sm">Status</th>
                <th className="t-cta-sm">Cost</th>
                <th className="t-cta-sm">Duration</th>
                <th className="t-cta-sm">Created</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.ad_id} className={styles.row} onClick={() => navigate(rowHref(run))}>
                  <td>
                    <Link
                      className={styles.adLink}
                      to={rowHref(run)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {run.ad_id}
                    </Link>
                  </td>
                  <td className="t-para-md">{run.experience_id}</td>
                  <td className="t-para-md">{run.angle}</td>
                  <td className="t-para-md">{run.hook}</td>
                  <td>
                    <StatusBadge status={run.status} />
                  </td>
                  <td className={`${styles.numeric} t-para-md`}>{formatCost(run.total_cost_usd)}</td>
                  <td className={`${styles.numeric} t-para-md`}>{formatDurationSec(run.duration_sec)}</td>
                  <td className={`${styles.muted} t-para-md`}>{formatRelativeTime(run.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
