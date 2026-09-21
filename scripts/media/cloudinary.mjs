import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';

import { CLOUDINARY_ROOT, PROJECT_ROOT } from './config.mjs';

/**
 * Cloudinary access for the media sync tooling.
 *
 * Server-side only. Nothing here is imported by the application, the SDK is a
 * devDependency, and the key and secret are read from the process environment
 * — never from a VITE_ variable, which would be compiled into the public
 * bundle. No credential value is ever logged, printed or written to a file.
 */

/** Loads .env.local then .env, without echoing anything. */
export function loadEnvironment() {
  for (const file of ['.env.local', '.env']) {
    try {
      process.loadEnvFile(path.join(PROJECT_ROOT, file));
    } catch {
      // Absent or unreadable is fine; the variables may come from the shell.
    }
  }
}

export function cloudName() {
  // The cloud name is public — it appears in every delivery URL — so a
  // configured value is preferred but not a secret.
  return process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || '';
}

/** Which credentials are present. Reports presence only, never values. */
export function credentialStatus() {
  return {
    cloudName: cloudName(),
    hasCloudName: Boolean(cloudName()),
    hasApiKey: Boolean(process.env.CLOUDINARY_API_KEY),
    hasApiSecret: Boolean(process.env.CLOUDINARY_API_SECRET),
  };
}

export function isConfigured() {
  const status = credentialStatus();
  return status.hasCloudName && status.hasApiKey && status.hasApiSecret;
}

export function configure() {
  if (!isConfigured()) throw new Error('Cloudinary credentials are not configured.');
  cloudinary.config({
    cloud_name: cloudName(),
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

/**
 * Every asset already in the account, indexed for matching.
 *
 * The whole account is read, not just our root folder, so an asset uploaded
 * by hand through the dashboard — which lands wherever the person put it — is
 * still recognised and never uploaded a second time.
 */
export async function fetchRemoteAssets() {
  const api = configure();
  const byPublicId = new Map();
  const byStem = new Map();
  const bySize = new Map();
  let total = 0;

  for (const resourceType of ['image', 'video']) {
    let nextCursor;
    do {
      const response = await api.search
        .expression(`resource_type:${resourceType}`)
        .max_results(500)
        .next_cursor(nextCursor)
        .execute();

      for (const resource of response.resources ?? []) {
        total += 1;
        const record = {
          publicId: resource.public_id,
          resourceType: resource.resource_type,
          format: resource.format,
          bytes: resource.bytes,
          width: resource.width ?? null,
          height: resource.height ?? null,
          duration: resource.duration ?? null,
          version: resource.version,
          folder: resource.folder ?? resource.asset_folder ?? '',
        };
        byPublicId.set(record.publicId, record);

        const stem = record.publicId.slice(record.publicId.lastIndexOf('/') + 1).toLowerCase();
        if (!byStem.has(stem)) byStem.set(stem, []);
        byStem.get(stem).push(record);

        if (!bySize.has(record.bytes)) bySize.set(record.bytes, []);
        bySize.get(record.bytes).push(record);
      }
      nextCursor = response.next_cursor;
    } while (nextCursor);
  }

  return { byPublicId, byStem, bySize, total };
}

/**
 * Decides what the sync should do with one local file.
 *
 * `matched-elsewhere` is the case that keeps the account clean: the same
 * artwork is already up under a different path, usually because it was
 * uploaded through the dashboard. Uploading it again would duplicate it, so
 * the sync reports it and leaves it alone.
 */
export function planFor(asset, remote, state) {
  const known = state[asset.relativePath];
  const exact = remote.byPublicId.get(asset.publicId);

  if (exact) {
    if (known && known.sha256 === asset.sha256) return { action: 'unchanged', remote: exact };
    return { action: 'replace', remote: exact };
  }

  const stem = asset.publicId.slice(asset.publicId.lastIndexOf('/') + 1).toLowerCase();
  const elsewhere = (remote.byStem.get(stem) ?? []).filter(item => item.resourceType === asset.resourceType);
  if (elsewhere.length > 0) return { action: 'matched-elsewhere', remote: elsewhere[0] };

  const sameSize = (remote.bySize.get(asset.bytes) ?? []).filter(item => item.resourceType === asset.resourceType);
  if (sameSize.length > 0) return { action: 'possible-duplicate', remote: sameSize[0] };

  return { action: 'upload', remote: null };
}

/**
 * What actually went wrong, in one line and without a credential in it.
 *
 * The Cloudinary SDK rejects with a plain object rather than an Error, so
 * `error.message` on an `instanceof Error` check misses it entirely and the
 * real cause is reported as "unknown error". Only the three named fields are
 * read; the object is never stringified whole, because the request config it
 * may carry is not something to print.
 */
export function describeUploadError(error) {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  const parts = [];
  if (typeof error.message === 'string' && error.message) parts.push(error.message);
  else if (typeof error.name === 'string' && error.name) parts.push(error.name);
  if (error.http_code) parts.push(`http ${error.http_code}`);
  return parts.length ? parts.join(' — ') : 'unknown error';
}

/**
 * Uploads one asset at its deterministic public id, retrying a refusal.
 *
 * Cloudinary intermittently rejects a request partway through a long burst.
 * Retrying is safe here and nowhere near a duplicate risk: the public id is
 * derived from the path and `overwrite` is set, so a second attempt writes
 * the same asset at the same id rather than making another copy.
 */
export async function uploadAsset(asset, { attempts = 3 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await uploadOnce(asset);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise(resolve => setTimeout(resolve, 1500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function uploadOnce(asset) {
  const api = configure();
  const absolutePath = path.join(PROJECT_ROOT, asset.relativePath);
  const result = await api.uploader.upload(absolutePath, {
    public_id: asset.publicId,
    resource_type: asset.resourceType,
    // The id is derived from the path, so overwriting is an in-place update of
    // that same asset rather than a new copy.
    overwrite: true,
    invalidate: true,
    unique_filename: false,
    use_filename: false,
    // Videos are transcoded in the background so the sync is not held open by
    // Cloudinary's encoder.
    eager_async: true,
    // This product environment runs in dynamic-folder mode, where the Media
    // Library folder is its own field rather than a prefix of the public id.
    // Sending it keeps new assets visible under the right folder in the UI
    // while the public id — and so the delivery URL — stays exactly as
    // planned. The legacy `folder` parameter is deliberately not used: in
    // this mode it would fight the public id instead of placing the asset.
    ...(asset.assetFolder ? { asset_folder: asset.assetFolder } : {}),
  });
  return {
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    width: result.width ?? null,
    height: result.height ?? null,
    duration: result.duration ?? null,
    version: result.version,
    // Recorded so a later run can verify where the asset actually landed
    // rather than assuming the request was honoured.
    assetFolder: result.asset_folder ?? null,
  };
}

export { CLOUDINARY_ROOT };
