import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import {
  Button,
  Card,
  Icon,
  Spinner,
  StatusBadge,
  Skeleton,
  ErrorState,
} from '../components/ui';
import { usePolling } from '../hooks/usePolling';
import { api, ApiError } from '../lib/api';
import { buildTracker, type TrackerChild, type TrackerItem } from '../lib/tracker';
import { formatCost, formatDurationMs } from '../lib/format';
import type { GenerateInput, StageLog, StageStatus, StatusResponse } from '../lib/types';
import styles from './Progress.module.css';

const ICON_CLASS: Record<StageStatus, string> = {
  completed: styles.iconCompleted,
  in_progress: styles.iconProgress,
  failed: styles.iconFailed,
  pending: styles.iconPending,
};

function StageStatusIcon({ status }: { status: StageStatus }) {
  const className = `${styles.icon} ${ICON_CLASS[status]}`;
  if (status === 'in_progress') {
    return (
      <span className={className}>
        <Spinner size={16} />
      </span>
    );
  }
  const name = status === 'completed' ? 'check' : status === 'failed' ? 'cross' : 'clock';
  return (
    <span className={className}>
      <Icon name={name} size={18} label={status} />
    </span>
  );
}

function StageMeta({ stage }: { stage: StageLog }) {
  return (
    <span className={`${styles.meta} t-para-sm`}>
      <span>{formatDurationMs(stage.duration_ms)}</span>
      <span className={styles.cost}>{stage.cost_usd > 0 ? formatCost(stage.cost_usd) : '—'}</span>
    </span>
  );
}

function groupStatus(children: TrackerChild[]): StageStatus {
  if (children.length === 0) return 'pending';
  const statuses = children.map((c) => c.stage.status);
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('in_progress')) return 'in_progress';
  if (statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.some((s) => s === 'completed')) return 'in_progress';
  return 'pending';
}

function SingleRow({ item }: { item: Extract<TrackerItem, { kind: 'single' }> }) {
  const status = item.stage?.status ?? 'pending';
  return (
    <div className={styles.row}>
      <StageStatusIcon status={status} />
      <span className={`${styles.label} t-cta-rg ${item.stage ? '' : styles.labelPending}`}>
        {item.label}
      </span>
      {item.stage && <StageMeta stage={item.stage} />}
    </div>
  );
}

function GroupRows({ item }: { item: Extract<TrackerItem, { kind: 'group' }> }) {
  return (
    <>
      <div className={styles.row}>
        <StageStatusIcon status={groupStatus(item.children)} />
        <span className={`${styles.label} ${styles.groupHeader} t-cta-rg`}>{item.label}</span>
      </div>
      {item.children.length === 0 ? (
        <div className={`${styles.row} ${styles.child}`}>
          <StageStatusIcon status="pending" />
          <span className={`${styles.label} ${styles.labelPending} t-cta-rg`}>Waiting to start</span>
        </div>
      ) : (
        item.children.map((child) => (
          <div className={`${styles.row} ${styles.child}`} key={child.stage.stage}>
            <StageStatusIcon status={child.stage.status} />
            <span className={`${styles.label} t-cta-rg`}>{child.label}</span>
            <StageMeta stage={child.stage} />
          </div>
        ))
      )}
    </>
  );
}

function Tracker({ status }: { status: StatusResponse }) {
  const items = buildTracker(status.stages);
  return (
    <div className={styles.rows}>
      <div className={styles.colHeaders}>
        <span className={styles.colHeaderSpacer} />
        <span style={{ flex: 1 }} className="t-para-sm">Stage</span>
        <span className={styles.colHeaderMeta}>
          <span>Duration</span>
          <span className={styles.colHeaderCost}>Cost</span>
        </span>
      </div>
      {items.map((item) =>
        item.kind === 'single' ? (
          <SingleRow key={item.key} item={item} />
        ) : (
          <GroupRows key={item.key} item={item} />
        ),
      )}
    </div>
  );
}

export function Progress() {
  const { adId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const retryPayload = (location.state as { payload?: GenerateInput } | null)?.payload;
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!retryPayload) return;
    setRetrying(true);
    try {
      const { ad_id } = await api.generate(retryPayload);
      navigate(`/progress/${encodeURIComponent(ad_id)}`, { state: { payload: retryPayload } });
    } catch {
      setRetrying(false);
    }
  };

  const fetcher = useCallback(() => api.getStatus(adId as string), [adId]);
  const { data, error } = usePolling(fetcher, {
    intervalMs: 2000,
    enabled: Boolean(adId),
    restartKey: adId,
    stopWhen: (s: StatusResponse) => s.status === 'completed' || s.status === 'failed',
  });

  useEffect(() => {
    if (data?.status === 'completed' && adId) {
      navigate(`/output/${encodeURIComponent(adId)}`, { replace: true });
    }
  }, [data?.status, adId, navigate]);

  // Hard failure to even fetch (e.g. unknown ad id) with nothing to show yet.
  if (error && !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className={styles.page} data-testid="progress-page">
        <ErrorState
          title={notFound ? 'Run not found' : 'Couldn’t load progress'}
          message={notFound ? `No run matches “${adId}”.` : error.message}
          action={
            <Link to="/">
              <Button>Start a new ad</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page} data-testid="progress-page">
        <h1 className="t-display-sm">Generating</h1>
        <div className={styles.rows} style={{ marginTop: 'var(--space-24)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div className={styles.row} key={i}>
              <Skeleton width={22} height={22} radius={11} />
              <Skeleton height={16} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.status === 'failed') {
    return (
      <div className={styles.page} data-testid="progress-page">
        <ErrorState
          title="Generation failed"
          message={data.error_message ?? 'The pipeline stopped before finishing.'}
          action={
            <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
              {retryPayload && (
                <Button variant="tertiary" size="sm" onClick={handleRetry} disabled={retrying}>
                  {retrying ? 'Retrying…' : 'Retry'}
                </Button>
              )}
              <Link to="/"><Button>Start over</Button></Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.page} data-testid="progress-page">
      <div className={styles.header}>
        <h1 className="t-display-sm">Generating</h1>
        <StatusBadge status={data.status} />
      </div>
      <p className={`${styles.adId} t-para-sm`}>{data.ad_id}</p>

      <Card>
        <Tracker status={data} />
        <div className={styles.totalBar}>
          <span className="t-cta-rg">Running cost</span>
          <span className={`${styles.totalCost} t-heading-md`}>
            {formatCost(data.total_cost_usd)}
          </span>
        </div>
      </Card>

      <p className={`${styles.footnote} t-para-sm`}>
        <Spinner size={14} />
        Updating live — this usually takes a couple of minutes.
      </p>
    </div>
  );
}
