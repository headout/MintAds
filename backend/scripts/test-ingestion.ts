/**
 * Quick smoke test for the content ingestion module.
 * Usage: npx ts-node scripts/test-ingestion.ts [tourGroupId]
 * Example: npx ts-node scripts/test-ingestion.ts 7148
 */
import fs from 'fs/promises';
import path from 'path';
import { db } from '../src/db';
import { fetchExperienceFacts } from '../src/services/headout-client';

const DATA_RUNS_DIR = path.resolve(__dirname, '../../data/runs');

const TEST_AD_ID = 'TEST_INGESTION';

// Hard safety exit — prevents the script from hanging forever
const safetyTimer = setTimeout(() => {
  console.error('\n⚠️  Safety timeout (30s) hit — force-exiting.');
  process.exit(2);
}, 30_000);
safetyTimer.unref();

async function main() {
  const experienceId = process.argv[2] || '7148';
  console.log(`\nTesting content ingestion for experience ID: ${experienceId}\n`);

  console.log('  [1/4] Cleaning up leftover test run...');
  await db.query('DELETE FROM runs WHERE ad_id = $1', [TEST_AD_ID]);

  console.log('  [2/4] Creating test run record...');
  const { rows } = await db.query(
    `INSERT INTO runs (ad_id, experience_id, persona, journey_type, brand, angle_id, hook_id, video_format, status, current_stage)
     VALUES ($1, $2, 'solo', 'pre_trip', 'headout', 'A3', 'problem', '9:16', 'ingesting', 'content_ingestion')
     RETURNING id`,
    [TEST_AD_ID, experienceId],
  );
  const runId: number = rows[0].id;
  console.log(`  [3/4] Run created (id=${runId}), fetching facts...`);

  let fetchError: Error | null = null;
  let facts: Awaited<ReturnType<typeof fetchExperienceFacts>> | null = null;

  try {
    facts = await fetchExperienceFacts(experienceId, runId, TEST_AD_ID);
  } catch (err: any) {
    fetchError = err;
    console.log(`  fetch threw: ${err.message} (code=${err.code ?? 'n/a'})`);
  }

  console.log('  [4/4] Cleaning up test run...');
  await db.query('DELETE FROM runs WHERE ad_id = $1', [TEST_AD_ID]);
  await fs.rm(path.join(DATA_RUNS_DIR, TEST_AD_ID), { recursive: true, force: true });
  console.log('  [4/4] Done.');

  if (fetchError) {
    console.error(`\n❌ Error: ${fetchError.message}`);
    process.exit(1);
  }

  if (!facts) {
    console.error('\n❌ No facts returned and no error thrown — unexpected.');
    process.exit(1);
  }

  console.log('✅ facts.json produced:\n');
  console.log(`  title:              ${facts.title}`);
  console.log(`  city/country:       ${facts.city}, ${facts.country}`);
  console.log(`  price:              ${facts.price.display}`);
  console.log(`  duration:           ${facts.duration.display ?? 'null (flexible)'}`);
  console.log(`  rating:             ${facts.rating} (${facts.review_count.toLocaleString()} reviews)`);
  console.log(`  photos:             ${facts.photos.length}`);
  console.log(`  highlights:         ${facts.highlights.length}`);
  console.log(`  inclusions:         ${facts.inclusions.length}`);
  console.log(`  usps:               ${facts.usps.length}`);
  console.log(`  top_reviews (EN):   ${facts.top_reviews.length}`);
  console.log(`  has_free_cancel:    ${facts.has_free_cancellation}`);
  console.log(`  has_skip_the_line:  ${facts.has_skip_the_line}`);
  console.log('\n  First photo:');
  console.log(`    url:     ${facts.photos[0]?.url}`);
  console.log(`    alt:     ${facts.photos[0]?.alt}`);
  console.log(`    keyword: ${facts.photos[0]?.keyword}`);
  if (facts.top_reviews[0]) {
    console.log('\n  First EN review:');
    console.log(`    "${facts.top_reviews[0].text.slice(0, 80)}..."`);
    console.log(`    ${facts.top_reviews[0].star_rating}★ — ${facts.top_reviews[0].reviewer_name}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Unhandled error:', err.message);
  process.exit(1);
});
