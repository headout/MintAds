import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardHeader, Icon, Skeleton, StatusBadge, ErrorState } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { rollupCost } from '../lib/cost';
import { formatCost } from '../lib/format';
import type { ClaimReport, OutputResponse } from '../lib/types';
import styles from './Output.module.css';

function MetaStrip({ data }: { data: OutputResponse }) {
  const meta = data.script?.metadata;
  const rows: [string, string | undefined][] = [
    ['Experience', data.experience_id],
    ['Angle', meta?.angle],
    ['Hook', meta?.hook],
  ];
  return (
    <div className={styles.metaGrid}>
      {rows.map(([k, v]) => (
        <div style={{ display: 'contents' }} key={k}>
          <span className={`${styles.metaKey} t-para-sm`}>{k}</span>
          <span className={`${styles.metaVal} t-cta-sm`}>{v ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}

function CostCard({ data }: { data: OutputResponse }) {
  const { rows, total } = rollupCost(data.cost_breakdown.by_stage);
  const grand = data.cost_breakdown.total || total;
  return (
    <Card>
      <CardHeader title="Cost breakdown" />
      {rows.map((r) => (
        <div className={styles.costRow} key={r.label}>
          <span className="t-para-md">{r.label}</span>
          <span className="t-cta-rg">{formatCost(r.cost)}</span>
        </div>
      ))}
      <div className={styles.costTotal}>
        <span className="t-heading-rg">Total</span>
        <span className="t-heading-rg">{formatCost(grand)}</span>
      </div>
    </Card>
  );
}

function ClaimCard({ report }: { report: ClaimReport | null }) {
  if (!report || report.claims.length === 0) {
    return (
      <Card>
        <CardHeader title="Claim report" />
        <p className="t-para-md" style={{ color: 'var(--text-grey-3)', margin: 0 }}>
          No claims were recorded for this ad.
        </p>
      </Card>
    );
  }
  const verified = report.verified_claims ?? report.claims.filter((c) => c.verified).length;
  return (
    <Card>
      <CardHeader title="Claim report" />
      <ul className={styles.claimList}>
        {report.claims.map((c, i) => (
          <li className={styles.claim} key={`${c.claim_text}-${i}`}>
            <span className={`${styles.claimIcon} ${c.verified ? styles.claimOk : styles.claimNo}`}>
              <Icon name={c.verified ? 'check' : 'cross'} size={18} label={c.verified ? 'verified' : 'unverified'} />
            </span>
            <span>
              <span className={`${styles.claimText} t-cta-sm`}>“{c.claim_text}”</span>{' '}
              {c.source_field && <span className={`${styles.claimSrc} t-para-sm`}>→ {c.source_field}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className={`${styles.claimSummary} t-cta-rg`}>
        {verified}/{report.claims.length} claims verified
      </p>
    </Card>
  );
}

export function Output() {
  const { adId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<OutputResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeFormat, setActiveFormat] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!adId) return;
    setError(null);
    setNotFound(false);
    try {
      const res = await api.getOutput(adId);
      setData(res);
      setActiveFormat(res.videos[0]?.format ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        navigate(`/progress/${encodeURIComponent(adId)}`, { replace: true });
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not load this ad.');
    }
  }, [adId, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return (
      <div className={styles.page}>
        <ErrorState
          title="Ad not found"
          message={`No finished ad matches “${adId}”.`}
          action={<Link to="/history"><Button>Back to history</Button></Link>}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <ErrorState title="Couldn’t load the ad" message={error} action={<Button onClick={load}>Try again</Button>} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <Skeleton height={32} width={200} />
        <div style={{ marginTop: 'var(--space-24)' }} className={styles.layout}>
          <Skeleton height={420} radius={16} />
          <Skeleton height={420} radius={16} />
        </div>
      </div>
    );
  }

  const activeVideo = data.videos.find((v) => v.format === activeFormat) ?? data.videos[0];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className="t-display-sm">Your ad</h1>
        <StatusBadge status="completed" />
      </div>
      <p className={`${styles.adId} t-para-sm`}>{data.ad_id}</p>

      <div className={styles.layout}>
        <div className={styles.playerCol}>
          <div className={styles.stage}>
            {activeVideo ? (
              <video className={styles.video} src={activeVideo.url} controls playsInline preload="metadata" />
            ) : (
              <p className="t-para-md" style={{ color: 'var(--text-white)' }}>
                No video rendered.
              </p>
            )}
          </div>

          {data.videos.length > 1 && (
            <div className={styles.tabs} role="tablist" aria-label="Video format">
              {data.videos.map((v) => (
                <Button
                  key={v.format}
                  role="tab"
                  aria-selected={v.format === activeVideo?.format}
                  variant={v.format === activeVideo?.format ? 'primary' : 'white'}
                  size="sm"
                  onClick={() => setActiveFormat(v.format)}
                >
                  {v.format}
                </Button>
              ))}
            </div>
          )}

          <div className={styles.downloads}>
            {data.videos.map((v) => (
              <a key={v.format} href={v.url} download>
                <Button variant="tertiary" size="sm" fullWidth leftIcon={<Icon name="download" size={18} />}>
                  Download {v.format}
                </Button>
              </a>
            ))}
          </div>
        </div>

        <div className={styles.sideCol}>
          <Card pad={16}>
            <MetaStrip data={data} />
          </Card>
          <CostCard data={data} />
          <ClaimCard report={data.claim_report} />
        </div>
      </div>
    </div>
  );
}
