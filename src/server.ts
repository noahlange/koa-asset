import * as compressible from 'compressible';
import { Server } from 'mincer';
import { isText } from 'mimoza';
import { gzip } from 'mz/zlib';
import { parse } from 'url';
import { isGzipAccepted, getFingerprint, etagMatch } from './utils';

/**
 * Includes code extracted from the mincer library,
 * released by Vitaly Puzrin under the terms of the MIT License.
 */

export default class KoaServer extends Server {

  public environment;
  public manifest;

  public serveSourceMap(asset, ctx, next) {
    let length;
    let buffer;

    if (asset.__server_sourcemap_buffer__) {
      buffer = asset.__server_sourcemap_buffer__;
      length = asset.__server_sourcemap_buffer__.length;
      if (asset.__gzipped_server_sourcemap__ && isGzipAccepted(ctx)) {
        ctx.set('Content-Encoding', 'gzip');
        buffer = asset.__gzipped_server_sourcemap__;
        length = asset.__gzipped_server_sourcemap__.length;
      }
    }

    if (ctx.method === 'HEAD') {
      ctx.status = 200;
    }

    ctx.body = buffer;
  }

  public serveAsset(asset, ctx, next) {
    let buffer = asset.__server_buffer__;
    let length = asset.__server_buffer__.length;
    if (asset.__server_buffer_gzipped__ && isGzipAccepted(ctx)) {
      buffer = asset.__server_buffer_gzipped__;
      length = asset.__server_buffer_gzipped__.length;
      ctx.set('Content-Encoding', 'gzip');
    }

    ctx.set('Content-Type', `${ asset.contentType }${ isText(asset.contentType) ? '; charset=UTF-8' : ''}`);
    ctx.set('Content-Length', length);

    if (ctx.method === 'HEAD') {
      ctx.status = 200;
    } else {
      ctx.body = buffer;
    }
  }

  public async compile(pathname, bundle) {
    let asset = null;

    try {
      const manifest = (this.manifest && !this.manifest.assets[pathname]);
      asset = manifest ? null : this.environment.findAsset(pathname, { bundle: !!bundle });
    } catch (e) {
      throw e;
    }

    if (!asset || asset.__server_buffer__) {
      return asset;
    }

    if (asset.sourceMap && asset.mappingUrlComment) {
      asset.__server_buffer__ = Buffer.from(asset.source + asset.mappingUrlComment());
    } else {
      asset.__server_buffer__ = asset.buffer;
    }

    if (asset.sourceMap) {
      asset.__server_sourcemap_buffer__ = Buffer.from(')]}\'\n' + asset.sourceMap);
      // Strange ")]}'\n" line added to sourcemap is for XSSI protection.
      // See spec for details.
    }
    if (!compressible(asset.contentType)) {
      return asset;
    } else {
      const assetBuffer = await gzip(asset.__server_buffer__);
      if (assetBuffer.length < asset.__server_buffer__.length) {
        asset.__server_buffer_gzipped__ = assetBuffer;
      }
      if (!asset.__server_sourcemap_buffer__) {
        return asset;
      }
      const mapBuffer = await gzip(asset.__server_sourcemap_buffer__);
      if (mapBuffer.length < asset.__server_sourcemap_buffer__.length) {
        asset.__gzipped_server_sourcemap__ = mapBuffer;
      }
      return asset;
    }
  }

  public async handle(ctx, next) {
    let asset;
    let pathname = parse(ctx.request.url).pathname;
    const bundle = !/body=[1t]/.test(parse(ctx.request.url).query);
    const sourceMap = /\.map$/i.test(pathname);
    const fingerprint = getFingerprint(pathname);

    try {
      pathname = decodeURIComponent(pathname.replace(/^\//, ''));
    } catch (e) {
      ctx.throw(400, `Failed to decode URI.`);
    }

    if (pathname.indexOf('..') >= 0 || pathname.indexOf('\u0000') >= 0) {
      ctx.throw(403, `URL contains unsafe chars.`);
    }

    if (ctx.request.method !== 'GET' && ctx.request.method !== 'HEAD') {
      ctx.throw(403, `HTTP method not allowed`);
    }

    if (fingerprint) {
      pathname = pathname.replace(`-${ fingerprint }`, '');
    }

    if (sourceMap) {
      pathname = pathname.replace(/\.map$/i, '');
    }

    try {
      asset = await this.compile(pathname, bundle);
    } catch (e) {
      console.error(e);
      ctx.throw(500, 'Error compiling asset');
    }

    if (!asset) {
      ctx.throw(404, 'Not found');
    }

    ctx.remove('Accept-Ranges');
    ctx.set('Vary', 'Accept-Encoding');
    ctx.set('Cache-Control', fingerprint ? 'public, max-age=31536000' : 'public, max-age=0, must-revalidate');
    ctx.set('Date', new Date().toUTCString());
    ctx.set('Last-Modified', asset.mtime.toUTCString());
    ctx.set('ETag', `"${ asset.digest }"`);

    if (etagMatch(asset, ctx)) {
      ctx.status = 304;
    }

    if (sourceMap) {
      this.serveSourceMap(asset, ctx, next);
    } else {
      this.serveAsset(asset, ctx, next);
    }
  }

  constructor(environment, manifest) {
    super(environment, manifest);
  }
}
