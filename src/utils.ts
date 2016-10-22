/**
 * Includes code extracted from the `mincer` library,
 * released by Vitaly Puzrin under the terms of the MIT License.
 */

const FINGERPRINT_RE = /-([0-9a-f]{32,40})\.[^.]+(?:\.map)?$/i;

export function clearMime(mimeType): string {
  if (!mimeType || (String(mimeType) !== mimeType)) { return ''; }
  return mimeType.split(';')[0].trim().toLowerCase();
}

export function getFingerprint(pathname: string): string {
  const m = FINGERPRINT_RE.exec(pathname);
  return m ? m[1] : null;
}

export function isGzipAccepted(ctx): boolean {
  const accept = ctx.headers['accept-encoding'] || '';
  return accept === '*' || accept.indexOf('gzip') >= 0;
}

export function etagMatch(asset, ctx): boolean {
  return `"${ asset.digest }"` === ctx.headers['if-none-match'];
}
