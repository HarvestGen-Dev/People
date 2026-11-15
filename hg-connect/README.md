# HG Link

HG Link is the standalone Harvest Generation Church connections hub. Its four
forms are local previews. Use fictional details. Form checks run in the browser
and no responses are sent or stored.

## Local preview

With Node 24, run these commands from this folder:

```sh
npm run dev
```

Open [HG Link locally](http://127.0.0.1:4310/). The server binds to loopback and
serves only the assets listed in `assets.mjs`. Set `PORT` to use a different
local port.

```sh
npm run check
npm run build
```

The build copies the allowlisted assets into `dist/`. On a static host, configure
extensionless form routes to resolve to their matching HTML files. Live
submissions still require a backend with server-side validation, abuse controls,
and approved email routing.

Inter and Bricolage Grotesque are served locally. Their font licenses are
included alongside the font files.
