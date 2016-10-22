# koa-asset
## An asset pipeline for Koa, powered by Mincer.

A wholly untested, but *nearly* drop-in replacement for [koa-mincer](https://www.npmjs.com/package/koa-mincer). Powered by [TypeScript](https://www.typescriptlang.org), written for Koa 2.x. I'll get around to writing tests when I've made more progress on [Overland](https://github.com/overlandjs/overland), for which this is a dependency-of-a-dependency (via [overland-assets](https://github.com/overlandjs/overland-assets)).

Includes a torn-out version of Mincer's internal, Connect-ish asset server, extended to use Koa instead. Obviates the need for a number of abandoned, insecure or otherwise deprecated packages in `koa-mincer`'s dependency tree. Makes extensive (re)use of code from the following packages, all released under the terms of the MIT License.

- [koa-mincer](https://www.npmjs.com/package/koa-mincer)
- [mincer](https://github.com/nodeca/mincer)
- [connect-mincer](https://github.com/clarkdave/connect-mincer)

## Performance
In my (limited) testing, the switch has shaved ~100ms (112ms &rarr; 12ms) off Overland's boot time and about somewhere around 5ms off most file serves. For big files (which you should be serving with Nginx instead of Node, e.g. 3.2MB image, 40ms -> 35ms), that's not going to mean much, but for smaller ones (i.e., 335kb image, 8ms -> 3ms), it could help. Haven't seen a huge difference in serve times for text files (i.e., scripts and styles), so I'm not going to claim that it'll give you magical performance boosts across the board.  ¯\\\_(ツ)_/¯

## Usage
Detailed usage instructions can be found at koa-mincer's [project page](https://github.com/naxmefy/koa-mincer/tree/v2.x).

```typescript
import * as Koa from 'koa';
import assets from 'koa-asset';
import render from 'koa-nunjucks2';
import { resolve } from 'path';

const app = new Koa();

app.use(render({
  path: resolve(__dirname, '../views'),
  nunjucksConfig: { autoescape: true }
}));

app.use(assets({
  production: app.env === 'production',
  mountPoint: '/assets',
  manifest: resolve(__dirname, '../public/assets/manifest.json'),
  paths: [ 'assets/css', 'assets/js', 'assets/templates' ]
}));

app.use(async function foo(ctx) {
  const { asset, css, img, js } = ctx.state;
  ctx.body = await ctx.render('home', { asset, css, img, js });
});

app.listen(3000);
```

And then in your template...

```django
<!-- asset() kicks back a path... -->
<audio src="{{ asset('audio/foo.m4a') }}" controls>
  <p>Get yourself a browser with HTML5 support!</p>
</audio>

<!-- ...and the rest kick back tags -->
{{ js('scripts/foo.js') | safe }}
{{ css('styles/foo.css') | safe }}
{{ image('images/foo.jpg', { alt: 'ONE WHOLE FOO' }) | safe }}
```

And huzzah!

```html
<audio src="/assets/audio/foo.m4a?body=1" controls>
  <p>Get yourself a browser with HTML5 support!</p>
</audio>

<script type="text/javascript" src="/assets/scripts/foo.js?body=1"></script>
<link rel="stylesheet" href="/assets/styles/foo.css?body=1"></script>
<img alt="ONE WHOLE FOO" src="/assets/images/foo.jpg?body=1" />
```

## Roadmap
- write tests you vegan
- document manifest interface

---

Copyright (c) 2016 Noah Lange & al.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.