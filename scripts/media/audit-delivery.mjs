/**
 * Source-aware mobile delivery audit.
 *
 * Transforming is a means, not the goal. A heavily compressed source can come
 * back from Cloudinary *larger* than the original — at which point serving the
 * derivative costs the visitor bandwidth for no benefit. This measures each
 * clip's mobile derivative against its stored original and records which one
 * is actually smaller.
 *
 * Measurement uses a one-byte Range request, so Cloudinary reports the full
 * derivative size in `Content-Range` without the file being downloaded. The
 * derivative is still generated on first request, so the work is bounded by a
 * small pool rather than fired all at once.
 *
 * Nothing is uploaded, deleted or transformed permanently. The only mutation
 * is `mobileProfile` written into media/sync-state.json.
 *
 * Usage: node scripts/media/audit-delivery.mjs [--apply]
 */

import fs from 'node:fs/promises';

import { SYNC_STATE_PATH } from './config.mjs';
import { cloudName, loadEnvironment } from './cloudinary.mjs';

const APPLY = process.argv.includes('--apply');
const CONCURRENCY = 4;

/** Mirrors the mobile tier in src/media/delivery.ts. */
const MOBILE_TRANSFORM = 'f_auto,q_auto:eco,vc_auto,c_limit,w_720';

/**
 * How much bigger a derivative has to be before the original wins.
 *
 * A couple of percent either way is noise, not a reason to change strategy.
 */
const MEANINGFUL = 0.02;

const mb = bytes => (bytes / 1024 / 1024).toFixed(2) + ' MB';

/**
 * The delivered size of a URL, without downloading it.
 *
 * A 206 carries `Content-Range: bytes 0-0/TOTAL`. Some responses refuse the
 * range and return 200 with a length instead; anything else is unmeasurable
 * and reported as such rather than guessed at.
 */
async function deliveredSize(url) {
  const response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  if (response.status === 206) {
    const range = response.headers.get('content-range');
    const total = range ? Number(range.split('/')[1]) : NaN;
    if (Number.isFinite(total)) return { bytes: total, status: response.status };
  }
  const length = Number(response.headers.get('content-length') ?? NaN);
  if (response.ok && Number.isFinite(length) && length > 1) return { bytes: length, status: response.status };
  return { bytes: null, status: response.status };
}

async function main() {
  loadEnvironment();
  const cloud = cloudName();
  if (!cloud) {
    console.error('Cloudinary cloud name is not configured.');
    process.exitCode = 1;
    return;
  }

  const state = JSON.parse(await fs.readFile(SYNC_STATE_PATH, 'utf8'));
  const videos = Object.entries(state)
    .filter(([path, record]) => path.startsWith('sitevideos/') && record.resourceType === 'video');

  console.log(`Mobile delivery audit — ${videos.length} videos, ${CONCURRENCY} at a time`);
  console.log(`Transform: ${MOBILE_TRANSFORM}\n`);

  const rows = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < videos.length) {
      const [path, record] = videos[cursor];
      cursor += 1;
      const url = `https://res.cloudinary.com/${cloud}/video/upload/${MOBILE_TRANSFORM}/${record.publicId}`;
      try {
        const { bytes, status } = await deliveredSize(url);
        rows.push({ path, record, ecoBytes: bytes, sourceBytes: record.bytes, status });
      } catch (error) {
        rows.push({ path, record, ecoBytes: null, sourceBytes: record.bytes, status: 0, error: error.message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, videos.length) }, worker));

  rows.sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }));

  let smaller = 0, similar = 0, larger = 0, unmeasured = 0;
  let bestSaving = null, worstInflation = null;
  let totalSource = 0, totalPreferred = 0;

  for (const row of rows) {
    totalSource += row.sourceBytes ?? 0;
    if (row.ecoBytes == null || !row.sourceBytes) {
      unmeasured += 1;
      // Unmeasurable means unproven, and an unproven derivative is not worth
      // preferring over a file whose size is known.
      row.profile = 'source';
      totalPreferred += row.sourceBytes ?? 0;
      continue;
    }
    const ratio = row.ecoBytes / row.sourceBytes;
    if (ratio > 1 + MEANINGFUL) {
      larger += 1;
      row.profile = 'source';
      totalPreferred += row.sourceBytes;
      if (!worstInflation || ratio > worstInflation.ratio) worstInflation = { ...row, ratio };
    } else if (ratio < 1 - MEANINGFUL) {
      smaller += 1;
      row.profile = 'eco';
      totalPreferred += row.ecoBytes;
      if (!bestSaving || ratio < bestSaving.ratio) bestSaving = { ...row, ratio };
    } else {
      similar += 1;
      // Within noise: prefer the transform, which also gives format negotiation.
      row.profile = 'eco';
      totalPreferred += row.ecoBytes;
    }
  }

  for (const row of rows) {
    const pct = row.ecoBytes && row.sourceBytes ? `${(row.ecoBytes / row.sourceBytes * 100).toFixed(0)}%` : '  ?';
    console.log(
      `  ${row.profile === 'source' ? 'SOURCE' : 'eco   '}  ${pct.padStart(5)}  `
      + `${mb(row.sourceBytes ?? 0).padStart(9)} -> ${(row.ecoBytes == null ? '(unmeasured)' : mb(row.ecoBytes)).padStart(9)}  `
      + row.path.replace('sitevideos/', '').slice(0, 48),
    );
  }

  console.log(`\nTotal videos              ${rows.length}`);
  console.log(`eco smaller than source   ${smaller}`);
  console.log(`eco ~equal (within 2%)    ${similar}`);
  console.log(`eco LARGER than source    ${larger}`);
  console.log(`unmeasured                ${unmeasured}`);
  if (bestSaving) {
    console.log(`largest saving            ${(100 - bestSaving.ratio * 100).toFixed(0)}%  ${bestSaving.path.replace('sitevideos/', '').slice(0, 44)}`);
  }
  if (worstInflation) {
    console.log(`largest inflation         +${(worstInflation.ratio * 100 - 100).toFixed(0)}%  ${worstInflation.path.replace('sitevideos/', '').slice(0, 44)}`);
  }
  console.log(`library original bytes    ${mb(totalSource)}`);
  console.log(`preferred mobile bytes    ${mb(totalPreferred)}`);
  const reduction = totalSource ? (1 - totalPreferred / totalSource) * 100 : 0;
  console.log(`estimated reduction       ${reduction.toFixed(1)}%`);

  if (!APPLY) {
    console.log('\nRead-only. Re-run with --apply to record the profiles in the sync state.');
    return;
  }

  for (const row of rows) state[row.path].mobileProfile = row.profile;
  await fs.writeFile(SYNC_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  console.log(`\nRecorded mobileProfile for ${rows.length} videos in the sync state.`);
  console.log('Run `npm run media:sync` to regenerate the manifest (it will upload nothing).');
}

await main();
