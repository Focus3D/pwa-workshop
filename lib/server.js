'use strict';

const { get } = require('koa-route');
const Debug = require('debug');
const fs = require('fs');
const indexTmpl = require('./index.tmpl.js');
const infoTmpl = require('./info.tmpl.js');
const testTmpl = require('./test.tmpl.js');
const Koa = require('koa');
const md = require('markdown-it')({ html: true });
const path = require('path');
const readFile = require('./readFile');

const app = new Koa();
const debug = Debug('pwa');

// Add trailing slashes
app.use(async (ctx, next) => {
  if (!path.extname(ctx.path) && ctx.path.slice(-1) !== '/') {
    debug('redirect (trailing slash):', ctx.path);
    ctx.redirect(`${ctx.path}/`);
  }
  return next();
});

// Handle fake offline (foo.js?offline)
app.use(async (ctx, next) => {
  if ('offline' in ctx.query) {
    ctx.respond = false;
    ctx.socket.destroy();
    return;
  }
  return next();
});

// Start page
app.use(
  get('/', async ctx => {
    debug('landing page');
    ctx.body = await indexTmpl(ctx);
  })
);

// Info panel
app.use(
  get('/info/:step/:article?', async (ctx, step) => {
    let readme = readFile(`${step}/README.md`);

    if (!readme) {
      debug('no info:', step);
      readme = readFile('lib/done.md');
    }

    debug('info:', step);
    ctx.state.content = md.render(readme);
    ctx.body = await infoTmpl(ctx);
  })
);

// Test panel
app.use(
  get('/test/:step/:article?', async (ctx, step) => {
    const test = readFile(`${step}/.test.js`);

    if (!test) {
      debug('no test:', step);
      return ctx.throw(404);
    }

    debug('test:', step);
    ctx.state.content = test;
    ctx.body = await testTmpl(ctx);
  })
);

// Init new step
app.use(
  get('/init/:step(step\\d+)/:article?', async (ctx, step) => {
    const prevStep = `step${parseInt(step.replace('step', ''), 10) - 1}`;

    if (fs.existsSync(path.resolve(prevStep))) {
      const files = fs.readdirSync(path.resolve(prevStep));

      if (!files.length) {
        return ctx.throw(404);
      }

      files.forEach((file) => {
        if (!/test|README/.test(file) && !fs.existsSync(path.resolve(step, file))) {
          fs.createReadStream(path.resolve(prevStep, file)).pipe(fs.createWriteStream(path.resolve(step, file)));
        }
      });

    }
    ctx.body = 'ok';
  })
);

// Slow things down
app.use(async (ctx, next) => {
  if (!/^sw/.test(path.basename(ctx.path))) {
    await latency();
  }
  return next();
});

// Handle api
app.use(
  get('/api/:method*', async (ctx, method) => {
    let filepath = `${path.join('lib/app/api', method)}.json`;

    if (!fs.existsSync(filepath)) {
      filepath = path.join(filepath.replace('.json', ''), 'index.json');
    }

    ctx.set('Cache-Control', 'public, max-age=120');
    ctx.type = 'json';
    ctx.body = fs.createReadStream(path.resolve(filepath));
  })
);

// Handle app pages
app.use(
  get('/:step(step\\d+)/:article(\\d\\.\\d{8}\\.html)?', async (ctx, step, article) => {
    if (article) {
      article = article.replace('.html', '');
    }
    const templatePath = `./app/${!article ? 'home' : 'article'}.tmpl.js`;
    const manifestPath = `${step}/manifest.json`;

    if (fs.existsSync(path.resolve(manifestPath))) {
      ctx.state.manifest = true;
    }

    debug('app page:', step, article);
    ctx.body = await require(templatePath)(ctx, article);
  })
);

// Handle asset files
app.use(
  get('/:step(step\\d+)/:article?/*.(js|css|jpg|gif|webp|json|html)', async (ctx, step, article) => {
    const filepath = path.basename(ctx.path);
    const type = path.extname(filepath).slice(1);
    let body;

    ctx.type = type;
    ctx.set('Cache-Control', 'public, max-age=240');

    debug('file:', ctx.path);

    // Concat app + step files
    if (filepath === 'index.js' || filepath === 'index.css' || filepath === 'sw.js') {
      const appFile = `lib/app/${filepath}`;
      const stepFile = `${step}/${filepath}`;

      body = readFile(appFile) + '\n\n' + readFile(stepFile) + '\n\n';
      ctx.set('Content-Length', Buffer.from(body, 'utf8').length);
      ctx.body = body;
    } else {
      let fullpath = path.resolve(`${step}/${filepath}`);

      if (!fs.existsSync(fullpath)) {
        fullpath = path.resolve('lib/app', filepath);
      }
      ctx.body = fs.createReadStream(fullpath);
    }
  })
);

app.use(async ctx => {
  ctx.set('Content-Length', 5);
  ctx.set('Cache-Control', `no-cache, no-storage`);
  ctx.body = '"hello"';
});

app.listen(process.env.PORT);

function latency() {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 50 + Math.random() * 50);
  });
}
