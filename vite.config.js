import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base =
  process.env.GITHUB_PAGES === "true" && repositoryName
    ? `/${repositoryName}/`
    : "/";

const MIME_TYPES = {
  ".swf": "application/x-shockwave-flash",
  ".mp3": "audio/mpeg",
  ".xml": "application/xml",
  ".hqx": "application/mac-binhex40",
};

function serveGameDirectory() {
  return {
    name: "serve-game-directory",
    configureServer(server) {
      server.middlewares.use("/game", (req, res, next) => {
        const urlPath = decodeURIComponent(req.url?.split("?")[0] ?? "/");
        const filePath = path.join(rootDir, "game", urlPath);

        if (!filePath.startsWith(path.join(rootDir, "game"))) {
          next();
          return;
        }

        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) {
            next();
            return;
          }

          const ext = path.extname(filePath).toLowerCase();
          if (MIME_TYPES[ext]) {
            res.setHeader("Content-Type", MIME_TYPES[ext]);
          }

          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
  };
}

function injectRuffleScript() {
  let resolvedBase = "/";

  return {
    name: "inject-ruffle-script",
    configResolved(config) {
      resolvedBase = config.base;
    },
    transformIndexHtml(html) {
      const scriptTag = `<script src="${resolvedBase}ruffle/ruffle.js" data-ruffle="true"></script>`;
      return html.includes("data-ruffle=") ? html : html.replace("</body>", `    ${scriptTag}\n  </body>`);
    },
  };
}

export default defineConfig({
  base,
  publicDir: "static",
  plugins: [
    serveGameDirectory(),
    injectRuffleScript(),
    viteStaticCopy({
      targets: [
        { src: "game/**/*", dest: "game" },
        { src: "ruffle/**/*", dest: "ruffle" },
      ],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
