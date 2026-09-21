/**
 * Warms Cloudinary derivatives so no visitor pays for a cold transcode.
 *
 * `f_auto` negotiates a different file per browser — H.264 for most, VP9 in
 * WebM for Chrome, HEVC for Safari — and each one is a SEPARATE derivative
 * that Cloudinary generates on its first request. The visitor who happens to
 * be first waits for that transcode, which measured as multi-second stalls on
 * the live feed.
 *
 * Derivatives are cached per account, not per visitor, so requesting each
 * variant once here removes the stall for everybody. This is a maintenance
 * step to run after a media sync or a delivery-transform change, not part of
 * the build.
 *
 * Only one byte of each file is fetched: the transcode is what takes the
 * time, and Range makes the download itself negligible.
 *
 * Usage: node scripts/media/warm-delivery.mjs [--videos] [--images]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { FRONTEND_MANIFEST_PATH } from './config.mjs';

const ONLY_VIDEOS = process.argv.includes('--videos');
const ONLY_IMAGES = process.argv.includes('--images');
const DO_VIDEOS = ONLY_VIDEOS || !ONLY_IMAGES;
const DO_IMAGES = ONLY_IMAGES || !ONLY_VIDEOS;

/** Modest: this is transcoding work on someone else's servers. */
const CONCURRENCY = 4;

/**
 * The client profiles `f_auto` actually branches on.
 *
 * Measured rather than assumed: these three user agents produce avc1 in MP4,
 * VP9 in WebM and HEVC in MP4 respectively.
 */
const CLIENTS = [
  ['h264', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'],
  ['vp9', 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'],
  ['hevc', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'],
];

/** Mirrors src/media/delivery.ts. Kept in step by hand, verified by the report. */
const VIDEO_WIDTHS = { mobile: 720, tablet: 1080, desktop: 1280 };
const VIDEO_QUALITY = { mobile: 'q_auto:eco', tablet: 'q_auto:good', desktop: 'q_auto:good' };
const IMAGE_TRANSFORMS = {
  carousel: 'f_auto,q_auto,c_fill,g_auto,w_460,h_650,dpr_auto',
  gallery: 'f_auto,q_auto,c_limit,w_800,dpr_auto',
  portrait: 'f_auto,q_auto,c_fill,g_auto,w_640,h_800,dpr_auto',
  thumbnail: 'f_auto,q_auto,c_fill,g_auto,w_160,h_160,dpr_auto',
};

const videoTransform = tier => `f_auto,${VIDEO_QUALITY[tier]},vc_auto,c_limit,w_${VIDEO_WIDTHS[tier]}`;
const posterTransform = tier => `f_auto,q_auto,c_limit,w_${VIDEO_WIDTHS[tier]},so_0`;

async function warm(url, userAgent) {
  const started = Date.now();
  try {
    const headers = { Range: 'bytes=0-0' };
    if (userAgent) headers['User-Agent'] = userAgent;
    const response = await fetch(url, { headers });
    return {
      ok: response.status === 200 || response.status === 206,
      status: response.status,
      type: response.headers.get('content-type') ?? '',
      ms: Date.now() - started,
    };
  } catch (error) {
    return { ok: false, status: 0, type: String(error.message).slice(0, 40), ms: Date.now() - started };
  }
}

async function run(jobs, label) {
  console.log(`\n${label}: ${jobs.length} request${jobs.length === 1 ? '' : 's'}, ${CONCURRENCY} at a time`);
  const results = [];
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      const result = await warm(job.url, job.userAgent);
      done += 1;
      results.push({ ...job, ...result });
      // Only the slow ones are worth printing: those are the cold transcodes
      // this exists to absorb.
      if (!result.ok || result.ms > 1500) {
        console.log(`  ${result.ok ? 'slow' : 'FAIL'} ${String(result.ms).padStart(6)}ms  ${result.status}  ${job.label}`);
      }
      if (done % 50 === 0) console.log(`  … ${done}/${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  const failed = results.filter(r => !r.ok);
  const times = results.map(r => r.ms).sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? 0;
  const slowest = times.at(-1) ?? 0;
  console.log(`  done: ${results.length}, failed: ${failed.length}, median ${median}ms, slowest ${slowest}ms`);
  return { results, failed };
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(FRONTEND_MANIFEST_PATH, 'utf8'));
  const base = `https://res.cloudinary.com/${manifest.cloudName}`;
  console.log(`Warming derivatives for ${manifest.cloudName}`);

  let failures = 0;

  if (DO_VIDEOS) {
    const videos = manifest.assets.videos ?? [];
    const jobs = [];
    for (const asset of videos) {
      // Mobile is what the feed actually serves, so every client profile is
      // warmed for it. A clip whose audit chose the original needs no
      // transform warming — there is nothing to derive.
      if (asset.mobileProfile === 'source') {
        jobs.push({ url: `${base}/video/upload/${asset.publicId}`, userAgent: undefined, label: `${asset.id} (source)` });
      } else {
        for (const [name, userAgent] of CLIENTS) {
          jobs.push({
            url: `${base}/video/upload/${videoTransform('mobile')}/${asset.publicId}`,
            userAgent,
            label: `${asset.id} mobile/${name}`,
          });
        }
      }
      // The poster is what covers any remaining gap, so it must never be cold.
      jobs.push({ url: `${base}/video/upload/${posterTransform('mobile')}/${asset.publicId}.jpg`, userAgent: undefined, label: `${asset.id} poster` });
    }
    const { failed } = await run(jobs, 'Videos (mobile tier + posters)');
    failures += failed.length;
  }

  if (DO_IMAGES) {
    const jobs = [];
    for (const asset of manifest.assets.carousel ?? []) {
      jobs.push({ url: `${base}/image/upload/${IMAGE_TRANSFORMS.carousel}/${asset.publicId}`, userAgent: undefined, label: `carousel ${asset.carouselOrder}` });
    }
    for (const asset of manifest.assets.artists ?? []) {
      jobs.push({ url: `${base}/image/upload/${IMAGE_TRANSFORMS.portrait}/${asset.publicId}`, userAgent: undefined, label: `portrait ${asset.id}` });
      jobs.push({ url: `${base}/image/upload/${IMAGE_TRANSFORMS.thumbnail}/${asset.publicId}`, userAgent: undefined, label: `thumb ${asset.id}` });
    }
    const { failed } = await run(jobs, 'Carousel and portraits');
    failures += failed.length;
  }

  console.log(failures === 0 ? '\nAll derivatives warm.' : `\n${failures} request(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
