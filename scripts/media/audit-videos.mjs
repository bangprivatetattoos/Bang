/**
 * Read-only audit of the local video library.
 *
 * Reports what is on disk, what the container headers actually say, which
 * files are byte-identical, and which are already in Cloudinary — without
 * uploading, transcoding, renaming or deleting anything.
 *
 * Usage: node scripts/media/audit-videos.mjs [--json]
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { PROJECT_ROOT, SOURCES, SYNC_STATE_PATH, VIDEO_EXTENSIONS } from './config.mjs';
import { feedContentId, hashFile, naturalCompare, toPublicId } from './discover.mjs';
import { credentialStatus, fetchRemoteAssets, isConfigured, loadEnvironment, planFor } from './cloudinary.mjs';
import { orientationOf, probeVideo } from './probe-video.mjs';

const AS_JSON = process.argv.includes('--json');

const VIDEO_SOURCE = SOURCES.find(source => source.category === 'videos');

/** What the sync has already recorded. Absent on a first run. */
async function readSyncState() {
  try {
    return JSON.parse(await readFile(SYNC_STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/** `planFor` actions, named for a report rather than for an action queue. */
const ACTION_STATE = {
  unchanged: 'matched',
  replace: 'matched-changed',
  'matched-elsewhere': 'matched-elsewhere',
  'possible-duplicate': 'possible-duplicate',
  upload: 'absent',
};

const mb = bytes => (bytes / 1024 / 1024).toFixed(2) + ' MB';
const seconds = value => (value == null ? '?' : value.toFixed(1) + 's');

async function collect() {
  const folder = VIDEO_SOURCE.folders[0];
  const absolute = path.join(PROJECT_ROOT, folder);
  const entries = await readdir(absolute, { withFileTypes: true });

  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort(naturalCompare);

  const skipped = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => !VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase()));

  const rows = [];
  for (const fileName of files) {
    const relativePath = `${folder}/${fileName}`;
    const probe = await probeVideo(path.join(PROJECT_ROOT, relativePath));
    rows.push({
      fileName,
      relativePath,
      extension: path.extname(fileName).toLowerCase(),
      contentId: feedContentId(fileName),
      publicId: toPublicId(VIDEO_SOURCE.cloudinaryFolder, fileName),
      sha256: await hashFile(path.join(PROJECT_ROOT, relativePath)),
      orientation: orientationOf(probe.width, probe.height),
      ...probe,
    });
  }
  return { folder, rows, skipped };
}

function groupDuplicates(rows) {
  const byHash = new Map();
  for (const row of rows) {
    if (!byHash.has(row.sha256)) byHash.set(row.sha256, []);
    byHash.get(row.sha256).push(row);
  }
  return [...byHash.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([sha256, group]) => ({ sha256, files: group.map(row => row.fileName) }));
}

/** Same bytes count and near-identical duration, but a different hash. */
function nearMatches(rows) {
  const suspects = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (a.sha256 === b.sha256) continue;
      const sameSize = a.bytes === b.bytes;
      const closeDuration = a.duration && b.duration && Math.abs(a.duration - b.duration) < 0.05;
      const sameFrame = a.width === b.width && a.height === b.height;
      if (sameSize || (closeDuration && sameFrame && Math.abs(a.bytes - b.bytes) / a.bytes < 0.01)) {
        suspects.push({ a: a.fileName, b: b.fileName, sameSize, closeDuration, sameFrame });
      }
    }
  }
  return suspects;
}

async function main() {
  const { folder, rows, skipped } = await collect();

  loadEnvironment();
  const credentials = credentialStatus();
  const configured = isConfigured();
  let remote = null;
  if (configured) {
    try {
      remote = await fetchRemoteAssets();
    } catch (error) {
      console.error('Could not reach Cloudinary: ' + error.message);
    }
  }

  // The audit decides nothing of its own: it asks `planFor` the same question
  // the sync asks, with the same remote index and the same recorded state, so
  // the audit and the dry run cannot report different numbers.
  const state = await readSyncState();
  for (const row of rows) {
    if (!remote) {
      row.remote = { state: 'unknown', publicId: null, bytes: null };
      continue;
    }
    const plan = planFor({ ...row, resourceType: 'video' }, remote, state);
    row.remote = {
      state: ACTION_STATE[plan.action] ?? plan.action,
      publicId: plan.remote?.publicId ?? null,
      bytes: plan.remote?.bytes ?? null,
    };
  }

  if (AS_JSON) {
    console.log(JSON.stringify({ folder, rows, skipped }, null, 2));
    return;
  }

  console.log(`Source folder: ${folder}/  (${rows.length} video files)`);
  if (skipped.length) console.log(`Non-video files ignored: ${skipped.join(', ')}`);
  const remoteVideos = remote ? [...remote.byPublicId.values()].filter(item => item.resourceType === 'video') : [];
  console.log(`Cloudinary cloud: ${credentials.cloudName || '(not configured)'} — credentials ${configured ? 'present' : 'missing'}` +
    (remote ? `, ${remote.total} assets in the account, ${remoteVideos.length} of them video` : ''));
  console.log(`Target folder: ${VIDEO_SOURCE.cloudinaryFolder}/`);
  console.log('');

  const header = ['#', 'file', 'ext', 'size', 'WxH', 'orient', 'dur', 'video', 'audio', 'web', 'cloudinary'];
  console.log(header.join('\t'));
  rows.forEach((row, index) => {
    console.log([
      index + 1,
      row.fileName.length > 46 ? row.fileName.slice(0, 43) + '...' : row.fileName,
      row.extension,
      mb(row.bytes),
      row.width && row.height ? `${row.width}x${row.height}` : 'unknown',
      row.orientation,
      seconds(row.duration),
      row.videoCodec ?? 'unreadable',
      row.audioCodec ?? 'none',
      row.videoSupport,
      row.remote.state,
    ].join('\t'));
  });

  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
  const durations = rows.map(row => row.duration).filter(Boolean);
  const orientations = rows.reduce((counts, row) => {
    counts[row.orientation] = (counts[row.orientation] ?? 0) + 1;
    return counts;
  }, {});
  const codecs = rows.reduce((counts, row) => {
    const key = `${row.videoCodec ?? 'unreadable'} / ${row.audioCodec ?? 'no audio'}`;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const support = rows.reduce((counts, row) => {
    counts[row.videoSupport] = (counts[row.videoSupport] ?? 0) + 1;
    return counts;
  }, {});
  const remoteStates = rows.reduce((counts, row) => {
    counts[row.remote.state] = (counts[row.remote.state] ?? 0) + 1;
    return counts;
  }, {});

  const duplicates = groupDuplicates(rows);
  const suspects = nearMatches(rows);
  // 'unknown' only occurs when the account could not be read; counting it as
  // pending keeps the estimate honest rather than reporting nothing to do.
  const wouldUpload = rows.filter(row => row.remote.state === 'absent' || row.remote.state === 'unknown');
  const uploadBytes = wouldUpload.reduce((sum, row) => sum + row.bytes, 0);

  console.log('');
  console.log(`Total bytes: ${mb(totalBytes)}`);
  console.log(`Extensions: ${JSON.stringify(rows.reduce((counts, row) => {
    counts[row.extension] = (counts[row.extension] ?? 0) + 1;
    return counts;
  }, {}))}`);
  console.log(`Codecs: ${JSON.stringify(codecs)}`);
  console.log(`Orientation: ${JSON.stringify(orientations)}`);
  console.log(`Browser support: ${JSON.stringify(support)}`);
  console.log(`Cloudinary state: ${JSON.stringify(remoteStates)}`);
  console.log(`Duration range: ${seconds(Math.min(...durations))} – ${seconds(Math.max(...durations))}` +
    `  (total ${(durations.reduce((a, b) => a + b, 0) / 60).toFixed(1)} min)`);

  const widths = rows.map(row => row.width).filter(Boolean);
  const heights = rows.map(row => row.height).filter(Boolean);
  console.log(`Resolution range: ${Math.min(...widths)}–${Math.max(...widths)} wide, ` +
    `${Math.min(...heights)}–${Math.max(...heights)} tall`);
  console.log(`Rotated (display matrix != 0): ${rows.filter(row => row.rotation !== 0).length}`);
  console.log(`Faststart (moov first): ${rows.filter(row => row.faststart).length}/${rows.length}`);
  console.log(`Unreadable containers: ${rows.filter(row => !row.parsed).length}`);

  console.log('');
  console.log(`Exact duplicate groups (SHA-256): ${duplicates.length}`);
  for (const group of duplicates) console.log(`  ${group.sha256.slice(0, 12)}…  ${group.files.join('  |  ')}`);
  console.log(`Similar-but-not-identical pairs (NOT treated as duplicates): ${suspects.length}`);
  for (const pair of suspects) console.log(`  ${pair.a}  ~  ${pair.b}`);

  console.log('');
  console.log(`Already in Cloudinary: ${rows.length - wouldUpload.length}`);
  for (const row of rows.filter(r => r.remote.state !== 'absent' && r.remote.state !== 'unknown')) {
    console.log(`  ${row.remote.state}: ${row.fileName} -> ${row.remote.publicId}`);
  }
  console.log(`Would upload: ${wouldUpload.length} files, ${mb(uploadBytes)}`);

  const concerns = rows.filter(row => row.videoSupport !== 'safe' || row.audioSupport === 'problematic' || !row.parsed);
  console.log(`Browser-compatibility concerns: ${concerns.length}`);
  for (const row of concerns) {
    console.log(`  ${row.fileName}: video ${row.videoCodec ?? 'unreadable'} (${row.videoSupport}), audio ${row.audioCodec ?? 'none'}`);
  }

  const heavyCrop = rows.filter(row => row.orientation !== 'portrait');
  console.log(`Clips that will crop heavily in a portrait feed: ${heavyCrop.length}`);
  for (const row of heavyCrop) {
    console.log(`  ${row.fileName} (${row.width}x${row.height}, ${row.orientation})`);
  }
}

await main();
