import * as Koa from 'koa';

interface IMincerEnv {
  production?: boolean;
  assetHost?: string;
  mountPoint?: string;
  paths: string[];
  precompile?: boolean;
  manifest?: string;
}

export default function middleware(opts: IMincerEnv): (ctx: Koa.Context, next: () => Promise<any>) => Promise<any>;