import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const proofRoot = join(projectRoot, "..", "proof");
const logRoot = join(proofRoot, "logs");
const screenshotRoot = join(proofRoot, "screenshots");

function cleanLog(name) {
  return readFileSync(join(logRoot, name), "utf8")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .filter(
      (line) =>
        line &&
        !line.startsWith("Script started on") &&
        !line.startsWith("Script done on"),
    );
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function block(label, lines) {
  return `
    <section>
      <div class="section-label">${escapeHtml(label)}</div>
      <pre>${escapeHtml(lines.join("\n"))}</pre>
    </section>`;
}

async function render(browser, spec) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; letter-spacing: 0; }
          body { margin: 0; padding: 44px; background: #eef1eb; color: #edf2ed; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
          main { max-width: 1352px; margin: 0 auto; border: 1px solid #434c4c; background: #202627; box-shadow: 0 16px 38px rgba(20, 27, 25, 0.18); }
          header { min-height: 96px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px 28px; border-bottom: 1px solid #434c4c; background: #292f30; }
          .title { display: flex; align-items: center; gap: 14px; }
          .mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 4px; background: #d6ff55; color: #171c1d; font-weight: 800; }
          h1 { margin: 0; font: 700 22px/1.2 system-ui, sans-serif; }
          .kicker, .stamp, .section-label { color: #aeb8b5; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .kicker { margin: 0 0 4px; }
          .stamp { padding: 7px 9px; border: 1px solid #586261; border-radius: 4px; color: #d6ff55; }
          section { padding: 22px 28px 26px; border-bottom: 1px solid #3b4443; }
          section:last-child { border-bottom: 0; }
          .section-label { margin-bottom: 12px; color: #83a7ff; }
          pre { margin: 0; color: #edf2ed; font-size: 13px; line-height: 1.62; white-space: pre-wrap; overflow-wrap: anywhere; }
          .ok { color: #d6ff55; }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div class="title">
              <div class="mark">03</div>
              <div><p class="kicker">BUILDLABS3 / OFFCKB DEVNET</p><h1>${escapeHtml(spec.title)}</h1></div>
            </div>
            <div class="stamp">RECORDED OUTPUT</div>
          </header>
          ${spec.sections.map((section) => block(section.label, section.lines)).join("")}
        </main>
      </body>
    </html>`);
  await page.screenshot({
    path: join(screenshotRoot, spec.output),
    fullPage: true,
  });
  await page.close();
}

const testSummary = cleanLog("03-contract-vm-tests.log").filter((line) =>
  /Script log:|Run result:|PASS |accepts the exact|rejects a|Test Suites:|Tests:/.test(
    line,
  ),
);
const deploymentSummary = cleanLog("04-contract-deployment.log").filter(
  (line) =>
    /Running: offckb|contract hash-lock|tx committed|Saving deployment|deployment\.toml|Script info|Deployment completed/.test(
      line,
    ),
);

const specs = [
  {
    title: "Environment and active chain",
    output: "01-offckb-environment.png",
    sections: [
      { label: "Toolchain / RPC", lines: cleanLog("01-environment.log") },
    ],
  },
  {
    title: "Contract build and four VM outcomes",
    output: "02-contract-build-and-tests.png",
    sections: [
      { label: "Bytecode build", lines: cleanLog("02-contract-build.log") },
      { label: "VM result excerpt", lines: testSummary },
    ],
  },
  {
    title: "Deployment and transaction verification",
    output: "03-deployment-and-rpc.png",
    sections: [
      { label: "Deployment excerpt", lines: deploymentSummary },
      {
        label: "47-invariant RPC verifier",
        lines: cleanLog("06-rpc-proof-verification.log"),
      },
    ],
  },
];

const browser = await chromium.launch({ headless: true });
for (const spec of specs) await render(browser, spec);
await browser.close();

for (const spec of specs) console.log(`Rendered ${spec.output}`);
