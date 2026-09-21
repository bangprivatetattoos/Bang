/**
 * Read-only MP4 (ISO base media) inspection.
 *
 * ffprobe is not installed on this machine, and an extension is not a codec:
 * a `.mp4` can carry H.265, AV1 or anything else. So the container's own
 * headers are read directly. Nothing here writes, moves or transcodes — it
 * opens each file, reads a few thousand bytes of box structure, and closes it.
 *
 * Parses: ftyp brands, mvhd duration, and per track the tkhd dimensions and
 * display matrix (so a rotated portrait clip is reported as portrait, not as
 * the landscape its raw dimensions claim) plus the stsd sample-entry codec.
 */

import { open, stat } from 'node:fs/promises';

/** Boxes whose payload is just more boxes. */
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'mvex']);

/** Video sample-entry codes mapped to a human name and a delivery verdict. */
const VIDEO_CODECS = {
  avc1: { name: 'H.264 (AVC)', web: 'safe' },
  avc3: { name: 'H.264 (AVC, in-band params)', web: 'safe' },
  hvc1: { name: 'H.265 (HEVC)', web: 'problematic' },
  hev1: { name: 'H.265 (HEVC)', web: 'problematic' },
  av01: { name: 'AV1', web: 'conditional' },
  vp09: { name: 'VP9', web: 'conditional' },
  vp08: { name: 'VP8', web: 'conditional' },
  mp4v: { name: 'MPEG-4 Part 2', web: 'problematic' },
};

const AUDIO_CODECS = {
  mp4a: { name: 'AAC', web: 'safe' },
  'ac-3': { name: 'Dolby Digital', web: 'problematic' },
  'ec-3': { name: 'Dolby Digital Plus', web: 'problematic' },
  Opus: { name: 'Opus', web: 'conditional' },
  alac: { name: 'ALAC', web: 'problematic' },
  '.mp3': { name: 'MP3', web: 'safe' },
};

/** H.264 profile numbers, for judging decode cost on low-end phones. */
const AVC_PROFILES = {
  66: 'Baseline',
  77: 'Main',
  88: 'Extended',
  100: 'High',
  110: 'High 10',
  122: 'High 4:2:2',
  244: 'High 4:4:4',
};

function readBoxHeader(buffer, offset) {
  if (offset + 8 > buffer.length) return null;
  let size = buffer.readUInt32BE(offset);
  const type = buffer.toString('latin1', offset + 4, offset + 8);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > buffer.length) return null;
    const high = buffer.readUInt32BE(offset + 8);
    const low = buffer.readUInt32BE(offset + 12);
    size = high * 2 ** 32 + low;
    headerSize = 16;
  }
  return { type, size, headerSize };
}

/** Walks the boxes inside `buffer`, calling `visit` for each. */
function walk(buffer, visit, path = []) {
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const header = readBoxHeader(buffer, offset);
    if (!header) break;
    const { type, size, headerSize } = header;
    // size 0 means "to the end of the file"; anything under the header is corrupt.
    const end = size === 0 ? buffer.length : offset + size;
    if (size !== 0 && size < headerSize) break;

    const body = buffer.subarray(offset + headerSize, Math.min(end, buffer.length));
    visit({ type, path, body, size });
    if (CONTAINERS.has(type)) walk(body, visit, [...path, type]);

    offset = end <= offset ? buffer.length : end;
  }
}

/** The rotation a display matrix applies, in degrees. */
function matrixRotation(body, offset) {
  const a = body.readInt32BE(offset) / 65536;
  const b = body.readInt32BE(offset + 4) / 65536;
  const c = body.readInt32BE(offset + 8) / 65536;
  const d = body.readInt32BE(offset + 12) / 65536;
  if (a === 0 && d === 0) {
    if (b === 1 && c === -1) return 90;
    if (b === -1 && c === 1) return 270;
  }
  if (a === -1 && d === -1) return 180;
  return 0;
}

function parseMvhd(body) {
  const version = body[0];
  const base = version === 1 ? 4 + 8 + 8 : 4 + 4 + 4;
  const timescale = body.readUInt32BE(base);
  const duration = version === 1
    ? Number(body.readBigUInt64BE(base + 4))
    : body.readUInt32BE(base + 4);
  return timescale ? duration / timescale : null;
}

function parseTkhd(body) {
  const version = body[0];
  // version+flags(4) + times + trackId(4) + reserved(4) + duration
  const afterDuration = version === 1 ? 4 + 8 + 8 + 4 + 4 + 8 : 4 + 4 + 4 + 4 + 4 + 4;
  // reserved(8) + layer(2) + altGroup(2) + volume(2) + reserved(2)
  const matrixAt = afterDuration + 16;
  const rotation = matrixRotation(body, matrixAt);
  const width = body.readUInt32BE(matrixAt + 36) / 65536;
  const height = body.readUInt32BE(matrixAt + 40) / 65536;
  return { width, height, rotation };
}

function parseStsd(body) {
  const count = body.readUInt32BE(4);
  if (!count) return null;
  const entrySize = body.readUInt32BE(8);
  const format = body.toString('latin1', 12, 16);
  const entry = body.subarray(8, 8 + entrySize);

  const result = { format };
  // A visual sample entry carries its own coded width/height at a fixed offset.
  if (VIDEO_CODECS[format] && entry.length >= 44) {
    result.codedWidth = entry.readUInt16BE(32);
    result.codedHeight = entry.readUInt16BE(34);
  }
  if (AUDIO_CODECS[format] && entry.length >= 36) {
    result.channels = entry.readUInt16BE(24);
    result.sampleRate = entry.readUInt32BE(32) / 65536;
  }
  // avcC sits after the 78-byte visual sample entry preamble.
  const tail = entry.subarray(Math.min(86, entry.length));
  walk(tail, box => {
    if (box.type === 'avcC' && box.body.length >= 4) {
      result.profile = AVC_PROFILES[box.body[1]] ?? 'profile ' + box.body[1];
      result.level = (box.body[3] / 10).toFixed(1);
    }
    if (box.type === 'hvcC' && box.body.length >= 13) {
      result.profile = 'HEVC profile ' + (box.body[1] & 0x1f);
    }
  });
  return result;
}

/**
 * Reads one file's container metadata.
 *
 * The moov atom can sit at either end of the file, so both ends are checked
 * rather than assuming a faststart layout.
 */
export async function probeVideo(filePath) {
  const info = await stat(filePath);
  const handle = await open(filePath, 'r');
  try {
    const window = Math.min(info.size, 1024 * 1024);
    const head = Buffer.alloc(window);
    await handle.read(head, 0, window, 0);

    let moovAt = null;
    let moovHeader = null;
    let mdatAt = null;
    const brands = [];
    let offset = 0;
    while (offset + 8 <= head.length) {
      const header = readBoxHeader(head, offset);
      if (!header) break;
      if (header.type === 'ftyp') {
        const body = head.subarray(offset + header.headerSize, offset + header.size);
        brands.push(body.toString('latin1', 0, 4).trim());
        for (let i = 8; i + 4 <= body.length; i += 4) brands.push(body.toString('latin1', i, i + 4).trim());
      }
      if (header.type === 'moov' && moovAt === null) {
        moovAt = offset;
        moovHeader = header;
      }
      if (header.type === 'mdat' && mdatAt === null) mdatAt = offset;
      if (header.size === 0) break;
      offset += header.size;
      if (moovAt !== null && mdatAt !== null) break;
    }

    let moovBuffer = null;
    let faststart = moovAt !== null && (mdatAt === null || moovAt < mdatAt);
    if (moovAt !== null && moovAt + moovHeader.size <= info.size) {
      moovBuffer = Buffer.alloc(moovHeader.size - moovHeader.headerSize);
      await handle.read(moovBuffer, 0, moovBuffer.length, moovAt + moovHeader.headerSize);
    }
    if (!moovBuffer) {
      // A trailing moov: scan the last stretch of the file for it.
      const tailSize = Math.min(info.size, 32 * 1024 * 1024);
      const tailStart = info.size - tailSize;
      const tail = Buffer.alloc(tailSize);
      await handle.read(tail, 0, tailSize, tailStart);
      const marker = tail.lastIndexOf(Buffer.from('moov', 'latin1'));
      if (marker >= 4) {
        const boxStart = marker - 4;
        const header = readBoxHeader(tail, boxStart);
        if (header && header.type === 'moov') {
          moovBuffer = tail.subarray(boxStart + header.headerSize, boxStart + header.size);
          faststart = false;
        }
      }
    }
    if (!moovBuffer) return { bytes: info.size, brands, parsed: false };

    let duration = null;
    const tracks = [];
    let current = null;
    walk(moovBuffer, box => {
      if (box.type === 'mvhd') duration = parseMvhd(box.body);
      if (box.type === 'tkhd') {
        current = { ...parseTkhd(box.body) };
        tracks.push(current);
      }
      if (box.type === 'hdlr' && current) current.handler = box.body.toString('latin1', 8, 12);
      if (box.type === 'stsd' && current) Object.assign(current, parseStsd(box.body) ?? {});
    });

    const video = tracks.find(track => track.handler === 'vide');
    const audio = tracks.find(track => track.handler === 'soun');

    // A 90/270 rotation means the stored frame is transposed on playback.
    let width = video ? Math.round(video.width) : null;
    let height = video ? Math.round(video.height) : null;
    if (video && (video.rotation === 90 || video.rotation === 270)) {
      const swap = width;
      width = height;
      height = swap;
    }

    return {
      bytes: info.size,
      brands: [...new Set(brands.filter(Boolean))],
      parsed: true,
      faststart,
      duration,
      width,
      height,
      rotation: video?.rotation ?? 0,
      codedWidth: video?.codedWidth ?? null,
      codedHeight: video?.codedHeight ?? null,
      videoFormat: video?.format ?? null,
      videoCodec: video ? (VIDEO_CODECS[video.format]?.name ?? 'unknown (' + video.format + ')') : null,
      videoSupport: video ? (VIDEO_CODECS[video.format]?.web ?? 'problematic') : 'problematic',
      profile: video?.profile ?? null,
      level: video?.level ?? null,
      audioFormat: audio?.format ?? null,
      audioCodec: audio ? (AUDIO_CODECS[audio.format]?.name ?? 'unknown (' + audio.format + ')') : null,
      audioSupport: audio ? (AUDIO_CODECS[audio.format]?.web ?? 'problematic') : 'none',
      channels: audio?.channels ?? null,
      sampleRate: audio?.sampleRate ?? null,
      trackCount: tracks.length,
    };
  } finally {
    await handle.close();
  }
}

/** portrait | landscape | square, from the displayed dimensions. */
export function orientationOf(width, height) {
  if (!width || !height) return 'unknown';
  const ratio = width / height;
  if (ratio > 1.05) return 'landscape';
  if (ratio < 0.95) return 'portrait';
  return 'square';
}
