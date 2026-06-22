import fs from 'fs/promises';
import path from 'path';
import { db } from '../db';
import { DATA_RUNS_DIR } from '../paths';
import type { FactsJson } from '../types';

const HEADOUT_BASE = 'https://www.headout.com';
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 3_000;

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', AED: 'AED ',
  AUD: 'A$', CAD: 'C$', SGD: 'S$', INR: '₹',
  JPY: '¥', CHF: 'CHF ', MXN: 'MX$', BRL: 'R$',
};

// --- Raw API shape (only fields we consume) ---

interface HeadoutTourGroup {
  id: number;
  name: string;
  shortSummary: string | null;
  summary: string | null;
  city: { displayName: string; country: { displayName: string } };
  primaryCategory: { displayName: string };
  listingPrice: { finalPrice: number; currencyCode: string };
  minDuration: number | null;
  maxDuration: number | null;
  averageRating: number;
  reviewCount: number;
  highlights: string | null;
  inclusions: string | null;
  descriptors: Array<{ code: string; displayName: string }> | null;
  imageUploads: Array<{ url: string; alt: string; keyword: string }>;
  topReviews: Array<{
    rating: number;
    content: string;
    nonCustomerName: string;
    sourceLanguage: string;
    useTranslatedContent: boolean;
    translatedContent: string | null;
  }> | null;
  hasFreeCancellation: boolean;
  hasSkipTheLine: boolean;
}

// --- HTML helpers ---

function parseHtmlList(html: string | null | undefined): string[] {
  if (!html) return [];
  return [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// --- Duration helpers ---

function msToMinutes(ms: number | null): number | null {
  return ms == null ? null : Math.round(ms / 60_000);
}

function formatDuration(minMs: number | null, maxMs: number | null): FactsJson['duration'] {
  const minM = msToMinutes(minMs);
  const maxM = msToMinutes(maxMs);

  if (minM === null && maxM === null) {
    return { min_minutes: null, max_minutes: null, display: null };
  }

  const fmt = (m: number) =>
    m % 60 === 0
      ? `${m / 60}h`
      : m >= 60
      ? `${Math.floor(m / 60)}h ${m % 60}min`
      : `${m}min`;

  const single = (minM ?? maxM)!;
  if (minM === null || maxM === null || minM === maxM) {
    return { min_minutes: minM, max_minutes: maxM, display: fmt(single) };
  }
  return { min_minutes: minM, max_minutes: maxM, display: `${fmt(minM)}–${fmt(maxM)}` };
}

// --- Price helper ---

function formatPrice(amount: number, currencyCode: string): FactsJson['price'] {
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? `${currencyCode} `;
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return { amount, currency: currencyCode, display: `${symbol}${formatted}` };
}

// --- HTTP fetch with timeout + one retry ---

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw Object.assign(new Error('Headout API request timed out'), { code: 'TIMEOUT' });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTourGroup(tourGroupId: string): Promise<HeadoutTourGroup> {
  const url = `${HEADOUT_BASE}/api/v6/tour-groups/${tourGroupId}/`;

  const attempt = async () => {
    const res = await fetchWithTimeout(url);
    if (res.status === 404) {
      throw Object.assign(
        new Error(`Experience not found: ${tourGroupId}`),
        { code: 'NOT_FOUND' },
      );
    }
    if (!res.ok) {
      throw Object.assign(
        new Error(`Headout API error ${res.status} for tour group ${tourGroupId}`),
        { code: 'API_ERROR', status: res.status },
      );
    }
    const data = await res.json() as HeadoutTourGroup;
    if (!data.city || !data.listingPrice || !data.primaryCategory) {
      throw new Error(`Unexpected API response shape for tour group ${tourGroupId}`);
    }
    return data;
  };

  try {
    return await attempt();
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'NOT_FOUND') throw err;
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    return attempt();
  }
}

// --- Mapping ---

function mapToFactsJson(raw: HeadoutTourGroup, experienceId: string): FactsJson {
  const photos = (raw.imageUploads ?? []).map((img, i) => ({
    index: i,
    url: img.url,
    alt: img.alt ?? '',
    keyword: img.keyword ?? '',
  }));

  const reviews = (raw.topReviews ?? [])
    .filter(r => r.sourceLanguage === 'EN')
    .map(r => ({
      text: r.useTranslatedContent && r.translatedContent ? r.translatedContent : r.content,
      star_rating: r.rating,
      reviewer_name: r.nonCustomerName,
    }));

  return {
    experience_id: experienceId,
    title: raw.name,
    short_title: stripHtml(raw.shortSummary) || null,
    city: raw.city.displayName,
    country: raw.city.country.displayName,
    category: raw.primaryCategory.displayName,
    price: formatPrice(raw.listingPrice.finalPrice, raw.listingPrice.currencyCode),
    duration: formatDuration(raw.minDuration, raw.maxDuration),
    rating: raw.averageRating,
    review_count: raw.reviewCount,
    description: stripHtml(raw.summary),
    usps: (raw.descriptors ?? []).map(d => d.displayName).filter(Boolean),
    highlights: parseHtmlList(raw.highlights),
    inclusions: parseHtmlList(raw.inclusions),
    has_free_cancellation: raw.hasFreeCancellation ?? false,
    has_skip_the_line: raw.hasSkipTheLine ?? false,
    photos,
    top_reviews: reviews,
  };
}

// --- Validation ---

function validateFacts(facts: FactsJson): void {
  const missing: string[] = [];
  if (!facts.title) missing.push('title');
  if (facts.price.amount == null || facts.price.amount <= 0) missing.push('price');
  if (facts.photos.length === 0) missing.push('photos');
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

// --- Stage log helpers ---

async function openStageLog(runId: number, adId: string): Promise<number> {
  const result = await db.query(
    `INSERT INTO stage_logs (run_id, ad_id, stage, status, service, cost_usd)
     VALUES ($1, $2, 'content_ingestion', 'in_progress', 'headout_api', 0)
     RETURNING id`,
    [runId, adId],
  );
  if (!result.rows.length) throw new Error('openStageLog: INSERT returned no rows');
  return result.rows[0].id;
}

async function closeStageLog(logId: number, durationMs: number, result: object) {
  await db.query(
    `UPDATE stage_logs
     SET status = 'completed', completed_at = NOW(), duration_ms = $1, result = $2
     WHERE id = $3`,
    [durationMs, JSON.stringify(result), logId],
  );
}

async function failStageLog(logId: number, durationMs: number, error: string) {
  await db.query(
    `UPDATE stage_logs
     SET status = 'failed', completed_at = NOW(), duration_ms = $1, result = $2
     WHERE id = $3`,
    [durationMs, JSON.stringify({ error }), logId],
  );
}

// --- Public API ---

export async function fetchExperienceFacts(
  experienceId: string,
  runId: number,
  adId: string,
): Promise<FactsJson> {
  if (/[/\\]|\.\./.test(adId)) {
    throw Object.assign(new Error(`Invalid adId: ${adId}`), { code: 'INVALID_AD_ID' });
  }

  const logId = await openStageLog(runId, adId);
  const started = Date.now();

  try {
    const raw = await fetchTourGroup(experienceId);
    const facts = mapToFactsJson(raw, experienceId);
    validateFacts(facts);

    const runDir = path.join(DATA_RUNS_DIR, adId);
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, 'facts.json'), JSON.stringify(facts, null, 2));

    await db.query('UPDATE runs SET facts = $1 WHERE id = $2', [JSON.stringify(facts), runId]);

    await closeStageLog(logId, Date.now() - started, {
      photos: facts.photos.length,
      reviews: facts.top_reviews.length,
      has_free_cancellation: facts.has_free_cancellation,
    });

    return facts;
  } catch (err: unknown) {
    await failStageLog(logId, Date.now() - started, (err as Error).message).catch(() => {});
    throw err;
  }
}
