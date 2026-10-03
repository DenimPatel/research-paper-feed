#!/usr/bin/env node
/*
 * IMP-225 capture harness.
 *
 * Captures the built web app under a *named, logged* set of conditions and
 * writes one PNG per capture plus a JSON sidecar recording the exact
 * environment, so a later reader can tell which pairs are comparable.
 *
 * Nothing in the repository is modified. The app is served from a dist/ and a
 * data/ directory that are both passed in, so the same dist can be pointed at
 * the real paper index or at a pinned fixture index without touching
 * web/public/data.
 *
 * Usage (see .improve/tools/imp225/README.md for the full matrix):
 *   node capture.cjs --out DIR --label NAME --n 6 [--data DIR] [--dsf 1]
 *                    [--tz America/New_York] [--locale en-US] [--headed]
 *                    [--arg "--force-color-profile=srgb"] [--view NAME]
 *
 * Re-run a previous capture exactly:
 *   node capture.cjs --out DIR2 --replay DIR/meta-<LABEL>.json
 */
"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const os = require("os");

function loadPlaywright() {
  const candidates = [
    process.env.PW_CORE,
    path.join(__dirname, "node_modules", "playwright-core"),
    "/tmp/sweep7/node_modules/playwright-core",
    "/Users/denimpatel/Desktop/playwright-mcp/node_modules/playwright-core",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return require(c);
    } catch (e) {
      /* try next */
    }
  }
  try {
    return require("playwright-core");
  } catch (e) {
    console.error(
      "playwright-core not found. Set PW_CORE=/path/to/playwright-core " +
        "or `npm i playwright-core` next to this file.",
    );
    process.exit(3);
  }
}

function parseArgs(argv) {
  const out = {
    dist: "/tmp/imp225/dist",
    data: null,
    out: null,
    label: "run",
    n: 1,
    port: 4500,
    width: 1280,
    height: 900,
    dsf: 1,
    tz: "America/New_York",
    locale: "en-US",
    headed: false,
    args: [],
    view: "feed-desktop-1280",
    settle: 1200,
    pinScroll: false,
    replay: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--dist") out.dist = next();
    else if (a === "--data") out.data = next();
    else if (a === "--out") out.out = next();
    else if (a === "--label") out.label = next();
    else if (a === "--n") out.n = Number(next());
    else if (a === "--port") out.port = Number(next());
    else if (a === "--width") out.width = Number(next());
    else if (a === "--height") out.height = Number(next());
    else if (a === "--dsf") out.dsf = Number(next());
    else if (a === "--tz") out.tz = next();
    else if (a === "--locale") out.locale = next();
    else if (a === "--settle") out.settle = Number(next());
    else if (a === "--pin-scroll") out.pinScroll = true;
    else if (a === "--view") out.view = next();
    else if (a === "--replay") out.replay = next();
    else if (a === "--headed") out.headed = true;
    else if (a === "--arg") out.args.push(next());
    else {
      console.error("unknown arg", a);
      process.exit(2);
    }
  }
  if (!out.out) {
    console.error("--out is required");
    process.exit(2);
  }
  return out;
}

/* The states that make up the 14 stored baselines, plus the two widths. */
const VIEWS = {
  "feed-desktop-1280": { w: 1280, h: 900, url: "" },
  "feed-mobile-390": { w: 390, h: 844, url: "" },
  "feed-empty-search-desktop-1280": {
    w: 1280,
    h: 900,
    url: "#q=zzzqqqnothing",
  },
  "feed-no-categories-selected-desktop-1280": {
    w: 1280,
    h: 900,
    url: "#cat=",
  },
  "feed-focus-ring-desktop-1280": { w: 1280, h: 900, url: "", focus: "input" },
  "feed-savemenu-open-desktop-1280": {
    w: 1280,
    h: 900,
    url: "",
    click: "save-1",
  },
  "feed-savemenu-mobile-390": { w: 390, h: 844, url: "", click: "save-1" },
  "feed-loadmore-desktop-1280": { w: 1280, h: 900, url: "", loadMore: 3 },
  "collections-desktop-1280": { w: 1280, h: 900, url: "#view=collections" },
  "collections-mobile-390": { w: 390, h: 844, url: "#view=collections" },
  "collections-empty-mobile-390": {
    w: 390,
    h: 844,
    url: "#view=collections",
  },
  /* Seeded from a JSON file with --seed, because the stored baseline for this
     state shows a collection called "Robotics reading (0)" that no clean
     clone has. That is itself a finding: the state is unreachable without
     knowing the fixture. */
  "collections-import-error-desktop-1280": {
    w: 1280,
    h: 900,
    url: "#view=collections",
    seed: "collections-import-error",
    upload: "not-json.txt",
  },
  "collections-populated-desktop-1280": {
    w: 1280,
    h: 900,
    url: "#view=collections",
    seed: "collections-populated",
  },
};

function startServer(opts, dataDir) {
  const dist = opts.dist;
  const srv = http.createServer((req, res) => {
    let p = new URL(req.url, "http://x").pathname;
    p = p.replace(/^\/research-paper-feed/, "");
    if (p === "/" || p === "/index.html" || p === "") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(fs.readFileSync(path.join(dist, "index.html"), "utf8"));
    }
    if (p.startsWith("/data/")) {
      const f = path.join(dataDir, path.basename(p.slice(6)));
      if (fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(fs.readFileSync(f, "utf8"));
      }
      res.writeHead(404, { "content-type": "application/json" });
      return res.end('{"error":"not found"}');
    }
    const file = path.join(dist, p);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = file.split(".").pop();
      const ct =
        ext === "js"
          ? "text/javascript"
          : ext === "css"
            ? "text/css"
            : ext === "svg"
              ? "image/svg+xml"
              : "application/octet-stream";
      res.writeHead(200, { "content-type": ct });
      return res.end(fs.readFileSync(file));
    }
    res.writeHead(404);
    res.end("not found");
  });
  return new Promise((resolve) => srv.listen(opts.port, () => resolve(srv)));
}

/* localStorage seeds. Written before the app's first paint via addInitScript so
 * the app mounts with them already present. */
const SEEDS = {
  "collections-import-error": {
    "rpf.collections.v1": JSON.stringify([
      {
        id: "c-robotics",
        name: "Robotics reading",
        paperIds: [],
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ]),
    "rpf.papers.v1": JSON.stringify({}),
  },
  "collections-populated": {
    "rpf.collections.v1": JSON.stringify([
      {
        id: "c-robotics",
        name: "Robotics reading",
        paperIds: [],
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ]),
    "rpf.papers.v1": JSON.stringify({}),
  },
};

async function settle(page) {
  await page
    .waitForFunction(
      () => {
        const s = [...document.querySelectorAll('[role="status"]')]
          .map((n) => n.textContent || "")
          .join(" ");
        return /papers match|papers from|No paper index|Unknown category/.test(s);
      },
      null,
      { timeout: 45000 },
    )
    .catch(() => {});
  /* one animation frame plus the settle delay, same as regression 7 */
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => r(null))),
  );
  await page.waitForTimeout(0);
}

async function drive(page, view, opts) {
  if (view.focus) {
    await page.click(view.focus);
  }
  if (view.click === "save-1") {
    const btn = page.locator("button", { hasText: /^Save$/ }).first();
    await btn.click({ timeout: 15000 }).catch(() => {});
  }
  if (view.upload) {
    const f = path.join(opts.out, view.upload);
    if (!fs.existsSync(f)) {
      fs.writeFileSync(f, "this is not json\n");
    }
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(f)
      .catch(() => {});
    await page.waitForTimeout(400);
  }
  if (view.loadMore) {
    for (let i = 0; i < view.loadMore; i++) {
      const b = page.locator("button", { hasText: /Load more/i }).first();
      await b.click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }
}

async function captureOne(browser, opts, srvPort, view, i, meta) {
  const ctx = await browser.newContext({
    viewport: { width: view.w || opts.width, height: view.h || opts.height },
    timezoneId: opts.tz,
    locale: opts.locale,
    deviceScaleFactor: opts.dsf,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  if (view.seed) {
    const seed = SEEDS[view.seed];
    if (!seed) throw new Error(`no seed named ${view.seed}`);
    await ctx.addInitScript((pairs) => {
      for (const [k, v] of Object.entries(pairs)) window.localStorage.setItem(k, v);
    }, seed);
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`http://127.0.0.1:${srvPort}/research-paper-feed/${view.url}`, {
    waitUntil: "load",
  });
  await settle(page);
  await drive(page, view, opts);
  await page.waitForTimeout(opts.settle);
  /* Scroll is the one state variable found to move on its own in headed mode
   * (`.improve/reports/impl-IMP-225.md` §4). Reading it before *and* after the
   * screenshot is how a stale read gets caught: an excursion between the read
   * and the shutter is otherwise invisible in the metadata. */
  if (opts.pinScroll) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(120);
  }
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const state = await page.evaluate(() => {
    const main = document.querySelector("main");
    const statuses = [...document.querySelectorAll('[role="status"]')].map(
      (n) => (n.textContent || "").trim(),
    );
    return {
      status: statuses,
      hero: main ? (main.querySelector("p")?.textContent || "") : "",
      cards: document.querySelectorAll("article.paper, .paper").length,
      times: [...new Set(
        [...document.querySelectorAll("time")].map(
          (t) => t.textContent + "|" + t.getAttribute("dateTime"),
        ),
      )].slice(0, 6),
      titles: [...document.querySelectorAll(".paper h2, .paper h3, article h2, article h3")]
        .slice(0, 4)
        .map((n) => n.textContent.trim().slice(0, 70)),
      scrollY: window.scrollY,
      docHeight: document.documentElement.scrollHeight,
    };
  });
  const file = path.join(
    opts.out,
    `${meta.label}__${opts.view}-${String(i + 1).padStart(2, "0")}.png`,
  );
  await page.screenshot({ path: file });
  const scrollAfter = await page.evaluate(() => window.scrollY);
  await ctx.close();
  return {
    file: path.basename(file),
    state,
    scrollBefore,
    scrollAfter,
    scrollStable: scrollBefore === scrollAfter,
    errors,
  };
}

(async () => {
  const opts = parseArgs(process.argv);
  if (opts.replay) {
    const prev = JSON.parse(fs.readFileSync(opts.replay, "utf8"));
    Object.assign(opts, prev.opts, { out: opts.out, label: prev.opts.label + "-replay" });
    opts.args = prev.opts.args || [];
    console.error(
      `replaying ${prev.opts.label} from ${opts.replay}; browser=${prev.browser.version}`,
    );
  }
  fs.mkdirSync(opts.out, { recursive: true });
  /* Default: the data/ vite copied into dist/, i.e. the real index. Pass
   * --data .improve/tools/imp225/fixture to capture against the pinned one. */
  const dataDir = opts.data || path.join(opts.dist, "data");
  const view = VIEWS[opts.view] || VIEWS["feed-desktop-1280"];
  const srv = await startServer(opts, dataDir);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: !opts.headed, args: opts.args });
  const meta = {
    label: opts.label,
    capturedAt: new Date().toISOString(),
    pid: process.pid,
    sessionId: `${os.hostname()}-${process.pid}`,
    view: opts.view,
    dataDir,
    /* Absent on purpose for the index-missing state, so record the absence
       rather than crashing on it -- "which index was this captured against" is
       the question this whole item turns on. */
    dataIndexSha256: fs.existsSync(path.join(dataDir, "index.json"))
      ? require("crypto")
          .createHash("sha256")
          .update(fs.readFileSync(path.join(dataDir, "index.json")))
          .digest("hex")
      : null,
    opts,
    browser: {
      version: browser.version(),
      executable: chromium.executablePath(),
      headless: !opts.headed,
      args: opts.args,
      launchOptions: { headless: !opts.headed, args: opts.args },
    },
    host: {
      platform: `${process.platform} ${os.release()} ${os.arch()}`,
      machine: os.machine ? os.machine() : "unknown",
      cpus: os.cpus().length,
      displays: JSON.stringify(
        (() => {
          try {
            const { execFileSync } = require("child_process");
            const raw = execFileSync("system_profiler", [
              "SPDisplaysDataType",
            ]).toString();
            return raw
              .split("\n")
              .filter((l) => /Resolution|Retina|UI Looks like|Display Type/.test(l))
              .map((l) => l.trim());
          } catch (e) {
            return ["system_profiler unavailable: " + e.message];
          }
        })(),
        null,
        0,
      ),
    },
    captures: [],
  };
  for (let i = 0; i < opts.n; i++) {
    const r = await captureOne(browser, opts, opts.port, view, i, meta);
    meta.captures.push(r);
    console.log(
      `${r.file}  scroll=${r.scrollBefore}->${r.scrollAfter}${r.scrollStable ? "" : " *UNSTABLE*"}` +
        `  cards=${r.state.cards}  status=${JSON.stringify(r.state.status[0] || "")}` +
        `  first=${JSON.stringify(r.state.titles[0] || "")}`,
    );
  }
  await browser.close();
  srv.close();
  fs.writeFileSync(
    path.join(opts.out, `meta-${opts.label}.json`),
    JSON.stringify(meta, null, 2),
  );
  console.error(`wrote ${path.join(opts.out, `meta-${opts.label}.json`)}`);
  process.exit(0);
})();