# flOw — Ruffle Web Player

A minimal static web wrapper around the original 2006 browser Flash version of [flOw](https://en.wikipedia.org/wiki/Flow_(video_game)) by Jenova Chen and Nicholas Clark. The original SWF and external assets are loaded unchanged through [Ruffle](https://ruffle.rs/) WebAssembly.

## Game files

Place the extracted contents of the original `flOw_04142006.zip` archive in the `game/` directory at the repository root.

This repository currently ships a Macintosh Repository extraction that includes:

- `flOw official.swf` (default entry point)
- `flOw classic.swf`
- `flOw widescreen.swf`
- `levels.xml`
- External MP3 audio files (`c1_*.mp3`)

The original 2006 release used `core.swf` as the loader name in some distributions. This project uses `flOw official.swf` as the default SWF because that is what is present in the bundled archive. The SWF files are not modified.

### Why the directory structure matters

`flOw official.swf` loads external assets with relative paths such as:

- `levels.xml`
- `c1_Flow-lvl 0 drone.mp3`
- `c1_death.mp3`
- `c1_Food-samples-1a.mp3` (constructed at runtime)

Those paths resolve against the SWF base URL. If the base URL is wrong, the game may render but audio and level data will fail to load.

The wrapper configures Ruffle with:

```js
base: new URL("/game/", window.location.href).href
```

so requests like `c1_death.mp3` become `/game/c1_death.mp3`.

Do not flatten or rename files unless you have confirmed the SWF requests different paths.

## How audio loading works

The SWF uses ActionScript loaders (`SndLoader`, `loadSound`) to fetch MP3 files from the same directory as the SWF. Ruffle forwards those requests to the browser as normal HTTP GET requests.

Requirements for working audio:

1. Serve files over HTTP(S), not `file://`
2. Keep MP3 files at the original relative paths under `game/`
3. Preserve spaces in filenames (for example `c1_Flow-lvl 0 drone.mp3`)
4. Set Ruffle `base` to the `game/` directory
5. On iOS Safari, interact with the page once to unlock audio (Ruffle shows an unmute overlay)

## Local development

```bash
npm install
npm run dev
```

Open the printed local URL (for example `http://localhost:5173`).

Do not open `index.html` directly from the filesystem. External asset loading depends on HTTP serving and correct MIME types.

### Debug mode

Add `?debug=1` to the URL to show a diagnostic panel with:

- Ruffle version
- SWF URL and configured base URL
- Browser user agent
- Observed MP3 requests
- Failed network requests for game assets

Example:

```text
http://localhost:5173/?debug=1
```

### SWF variants

Use the `variant` query parameter:

- `?variant=official` (default)
- `?variant=classic`
- `?variant=widescreen`

## Build and preview

```bash
npm run build
npm run preview
```

The build copies `game/` and `ruffle/` into `dist/` for static deployment.

## Deployment

Deploy the contents of `dist/` to any static host:

- GitHub Pages
- Cloudflare Pages
- Netlify
- Any HTTPS web server

Suggested layout after build:

```text
/
  index.html
  manifest.webmanifest
  sw.js
  icons/
  ruffle/
  game/
    flOw official.swf
    levels.xml
    c1_*.mp3
```

### GitHub Pages

This repository includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that builds and deploys automatically when changes are pushed to `main`.

**One-time setup**

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

**Deploy**

1. Merge to `main`, or push directly to `main`.
2. The **Deploy to GitHub Pages** workflow builds with `npm run build:pages` and publishes `dist/`.
3. When the workflow finishes, the site is available at:

   `https://<username>.github.io/reFlOw/`

   For this repository: `https://joshmcarthur.github.io/reFlOw/`

**How the subpath is handled**

GitHub Pages project sites are served from a repository subpath (`/reFlOw/`). The Vite build sets `base` to that path when `GITHUB_PAGES=true`, and the app uses `import.meta.env.BASE_URL` for game assets, Ruffle, the service worker, and the manifest.

**Test a Pages build locally**

```bash
GITHUB_REPOSITORY=joshmcarthur/reFlOw npm run build:pages
npm run preview
```

Open the preview URL and confirm assets load from `/reFlOw/...`.

**Manual deploy**

If you prefer not to use Actions, you can still upload `dist/` after running `npm run build:pages`.

### Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`

## Touch controls

The original game uses mouse movement and mouse button state. Ruffle maps pointer events to Flash mouse events. The wrapper additionally:

- sets `touch-action: none` on the page and player container
- prevents page scrolling during play
- resumes focus/audio on pointer down for mobile Safari

Touch behaviour:

- finger position → mouse position
- touch down → mouse button down
- touch up → mouse button up

## PWA / Add to Home Screen

The site includes a web app manifest, icons, and a lightweight service worker for shell caching. On iOS Safari:

1. Open the site
2. Share → Add to Home Screen
3. Launch from the home screen icon

Game assets remain network-first so audio updates are not stuck behind cache.

## Ruffle integration

- Self-hosted Ruffle `0.5.0` files live in `ruffle/`
- `publicPath` points at `/ruffle/` so WASM files load from the same origin
- `allowNetworking: "all"` permits external `loadSound()` requests
- `letterbox: "fullscreen"` keeps the game centered with black bars when needed

## Known limitations

- This is a compatibility wrapper, not a remake. Gameplay bugs are upstream of this project.
- Some later MP3 files in `game/` (for example boss/manta clips) are referenced dynamically and may not appear in static SWF string analysis.
- iOS Safari may require a user gesture before audio starts.
- Ruffle Flash compatibility is incomplete; edge-case audio or input bugs may remain in Ruffle itself.
- The bundled archive uses `flOw official.swf` rather than `core.swf`. If you have the original `core.swf` distribution, place it in `game/` and change the default SWF path in `src/main.js`.

## License

The wrapper code in this repository is provided for preservation and educational use. The flOw game assets remain the property of their original authors and publishers. Ruffle is licensed under MIT/Apache-2.0; see `ruffle/LICENSE_*`.
