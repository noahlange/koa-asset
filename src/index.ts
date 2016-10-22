import * as Koa from 'koa';
import * as mount from 'koa-mount';
import * as compose from 'koa-compose';
import { Environment } from 'mincer';
import { existsSync } from 'fs';
import Server from './server';

interface IMincerEnv {
  production?: boolean;
  assetHost?: string;
  mountPoint?: string;
  paths: string[];
  precompile?: boolean;
  manifest?: string;
}

interface IManifest {
  assets: any;
}

export default function middleware(opts: IMincerEnv) {
  const mincer = new OverlandMincer(opts);
  const server = new Server(mincer.env, mincer.manifest);
  const app = new Koa();
  const state = async function(ctx, next) {
    for (const helper in mincer.helpers) {
      if (mincer.helpers.hasOwnProperty(helper)) {
        ctx.state[helper] = mincer.helpers[helper];
      }
    }
    await next();
  };
  app.use(server.handle.bind(server));
  return function mincer(ctx, next) {
    const middleware = [ state, mount(opts.mountPoint, app) ];
    // you are oh-so-wrong, compose middleware typings...
    const composed = <any> compose(middleware);
    return composed(ctx, next);
  };
}

/**
 * Includes code extracted from the connect-mincer library,
 * released by Dave Clark under the terms of the MIT License.
 */

class OverlandMincer {

  public static createTag(type: 'js' | 'css' | 'img', path: string, attributes: any) {
    let tag;
    let returned;
    let baseAttributes = {};
    switch (type) {
      case 'js':
        tag = `<script src="${ path }"`;
        break;
      case 'css':
        tag = `<link type='text/css' href="${ path }"`;
        baseAttributes = { media: 'screen', rel: 'stylesheet' };
        break;
      case 'img':
        tag = `<img src="${ path }"`;
        baseAttributes = {};
      default:
        tag = '';
        break;
    }

    const attrs = Object.assign(baseAttributes, attributes || {});
    tag += Object.keys(attrs).reduce((str, a) => str += ` ${a}='${attrs[a]}'`, '');

    switch (type) {
      case 'js':
        returned = `${ tag }></script>`;
        break;
      default:
        returned = `${ tag }/>`;
        break;
    }

    return returned;
  }

  public env: any;
  public mincer: any;
  public production: boolean;
  public options: IMincerEnv;
  public manifest: IManifest;
  public mountPoint: string;
  public assetHost: string;

  public helpers = {
    asset: (path) => {
      const paths = this._findAssetPaths(path);
      return paths ? paths.length === 1 ? paths[0] : paths : '';
    },
    css: (path, attributes) => {
      const paths = this._findAssetPaths(path);
      if (!paths) {
        throw new Error(`CSS asset ['${ path }'] not found`);
      }
      return paths.map(p => OverlandMincer.createTag('css', p, attributes)).join('\n');
    },
    img: (path, attributes) => {
      const paths = this._findAssetPaths(path);
      if (!paths) {
        throw new Error(`Image asset ['${ path }'] not found`);
      }
      return paths.map(p => OverlandMincer.createTag('img', p, attributes)).join('\n');
    },
    js: (path, attributes) => {
      const paths = this._findAssetPaths(path);
      if (!paths) {
        throw new Error(`Javascript asset ['${ path }'] not found`);
      }
      return paths.map(p => OverlandMincer.createTag('js', p, attributes)).join('\n');
    }
  };

  private _normalizeMountPoint(mountPoint: string = '/assets') {
    if (mountPoint.substr(0, 1) !== '/') {
      mountPoint = '/' + mountPoint;
    }
    if (mountPoint.substr(-1) === '/') {
      mountPoint = mountPoint.substr(0, mountPoint.length - 1);
    }
    return mountPoint;
  }

  private _findAssetPaths(path: string, ext?: string): string[] {
    if (this.production) {
      const digestPath = this.manifest.assets[path];
      if (!digestPath) {
        throw new Error(`Asset ${path} has not been compiled.`);
      }
      return [this._toAssetURL(digestPath)];
    }
    const a = this.env.findAsset(path);
    return a ? a.toArray().map(i => this._toAssetURL(i.logicalPath) + '?body=1') : a;
  }

  private _toAssetURL(path: string) {
    return (this.assetHost ? this.assetHost : '') + this.mountPoint + '/' + path;
  }

  private _createEnvironment(paths: string[]) {
    if (!Array.isArray(paths)) {
      throw new Error(`Asset paths are missing, e.g. ['assets/css', 'assets/js']`);
    }
    const env = new Environment();
    paths.forEach(path => env.appendPath(path));
    env.registerHelper('asset', (name, opts) => {
      const asset = env.findAsset(name, opts);
      if (!asset) {
        throw new Error(`File [${ name }] not found`);
      } else {
        return this._toAssetURL(this.production ? asset.digestPath : asset.logicalPath);
      }
    });
    return env;
  }

  constructor(opts: IMincerEnv) {
    this.production = opts.production;
    this.options = opts;
    this.mountPoint = this._normalizeMountPoint(opts.mountPoint);
    this.env = this._createEnvironment(opts.paths);
    this.assetHost = opts.assetHost ? opts.assetHost : null;
    const manifest = opts.manifest;
    if (this.production) {
      if (existsSync(manifest)) {
        this.manifest = require(manifest);
        if (!this.manifest || !this.manifest.assets) {
          throw new Error(`Running in production but manifest file ["${ manifest }"] is not a valid manifest file`);
        }
      } else {
        throw new Error(`Running in production but manifest file ["${ manifest }"] not found`);
      }
    }
  }
}
