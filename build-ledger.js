#!/usr/bin/env node
/*
 * build-ledger.js  —  regenerates index.html + README.md from live ccusage data.
 * Usage:  node build-ledger.js
 * No dependencies. Requires: node, and `npx ccusage` (fetched automatically).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const USER = 'ankursingh4u';
const HERE = __dirname;

// ── Featured project one-liners — EDIT THESE to your real descriptions ──
const PROJECT_BRIEFS = {
  'zenith-ai-brain':        '🧠 AI “second brain” — a Python engine for capturing & querying knowledge',
  'PalmInsights':           '🖐️ AI-powered palm-reading & insights web app',
  'seo4ai':                 '📈 AuraRank — AI-driven SEO analysis & ranking toolkit',
  'universal-Shopify-theme':'🛍️ One Shopify theme, 13 niche presets — auto-adapting colors & content',
};
// ───────────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const isClaude = m => /claude|opus|sonnet|haiku|fable/i.test(m);
const famName = m => isClaude(m) ? 'Claude' : 'Codex';
const dTok = b => b.cacheReadTokens + b.cacheCreationTokens + b.inputTokens + b.outputTokens;

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

console.log('· fetching ccusage data …');
const monthly = JSON.parse(run('npx -y ccusage@latest monthly --json')).monthly;
const dailyRaw = JSON.parse(run('npx -y ccusage@latest --json')).daily;

// ---- aggregate models ----
const models = {};
let totalCost = 0, totalTokens = 0, totalOutput = 0;
for (const m of monthly) {
  for (const b of m.modelBreakdowns) {
    const k = b.modelName;
    models[k] = models[k] || { n: k, fam: famName(k), claude: isClaude(k), c: 0, t: 0 };
    models[k].c += b.cost;
    models[k].t += dTok(b);
    totalOutput += b.outputTokens;
  }
  totalCost += m.totalCost;
  totalTokens += m.totalTokens;
}
const modelList = Object.values(models)
  .sort((a, b) => b.c - a.c)
  .map(m => ({ n: m.n.replace(/-\d{8}$/, ''), fam: m.fam, claude: m.claude, c: +m.c.toFixed(2), t: +(m.t / 1e6).toFixed(1) }));

// ---- claude vs codex ----
let claudeCost = 0, codexCost = 0;
for (const m of Object.values(models)) (m.claude ? (claudeCost += m.c) : (codexCost += m.c));
const claudePct = +(claudeCost / totalCost * 100).toFixed(1);
const codexPct = +(100 - claudePct).toFixed(1);
const listFam = fam => Object.values(models).filter(m => m.claude === fam).sort((a,b)=>b.c-a.c)
  .map(m => m.n.replace(/^claude-|(-\d{8})$/g, '').replace(/-/g, ' ')).join(' · ');

// ---- monthly bars (fill gaps) ----
const byPeriod = Object.fromEntries(monthly.map(m => [m.period, m.totalCost]));
const periods = monthly.map(m => m.period).sort();
const [y0, m0] = periods[0].split('-').map(Number);
const [y1, m1] = periods[periods.length - 1].split('-').map(Number);
const monthsOut = [];
for (let y = y0, mo = m0; y < y1 || (y === y1 && mo <= m1); mo++) {
  if (mo > 12) { mo = 1; y++; }
  const key = `${y}-${String(mo).padStart(2, '0')}`;
  const v = byPeriod[key] || 0;
  monthsOut.push({ m: MONTHS[mo - 1], v: +v.toFixed(2), z: v === 0 });
}

// ---- daily series ----
const daily = dailyRaw.map(x => ({ d: (x.date || x.period).slice(5), c: +x.totalCost.toFixed(2) }));
const activeDays = daily.length;
const peak = daily.reduce((a, b) => b.c > a.c ? b : a, daily[0]);
const peakDate = (() => { const [mm, dd] = peak.d.split('-'); return `${dd} ${MONTHS[+mm - 1]}`; })();
const fmtDay = s => { const [y, mm, dd] = s.split('-'); return `${dd} ${MONTHS[+mm - 1]}`; };
const firstFull = dailyRaw[0].date || dailyRaw[0].period;
const lastFull = dailyRaw[dailyRaw.length - 1].date || dailyRaw[dailyRaw.length - 1].period;
const range = `${fmtDay(firstFull)} → ${fmtDay(lastFull)} ${lastFull.slice(0, 4)}`;
const generated = `${fmtDay(lastFull)} ${lastFull.slice(0, 4)}`;

const LEDGER = {
  user: USER, generated, range, activeDays,
  totalCost: +totalCost.toFixed(2), totalTokens, outputTokens: totalOutput,
  modelCount: modelList.length, avgPerDay: +(totalCost / activeDays).toFixed(2),
  peak: { date: peakDate, cost: +peak.c.toFixed(2) },
  claudePct, codexPct, claudeCost: +claudeCost.toFixed(2), codexCost: +codexCost.toFixed(2),
  claudeModels: listFam(true), codexModels: listFam(false),
  months: monthsOut, models: modelList, daily,
};

// ---- inject into index.html ----
const htmlPath = path.join(HERE, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const block = `/*LEDGER_START*/\nwindow.LEDGER = ${JSON.stringify(LEDGER, null, 2)};\n/*LEDGER_END*/`;
html = html.replace(/\/\*LEDGER_START\*\/[\s\S]*?\/\*LEDGER_END\*\//, block);
fs.writeFileSync(htmlPath, html);
console.log('✓ index.html updated');

// ---- write README.md (profile) ----
const B = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n.toLocaleString();
const money = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const badge = (label, val, color) =>
  `<img alt="${label}" src="https://img.shields.io/badge/${encodeURIComponent(label)}-${encodeURIComponent(val)}-${color}?style=flat-square" />`;
const site = `https://${USER}.github.io/${USER}/`;

// Preserve the detailed WakaTime block (written by the GitHub Action) across rebuilds
let wakaBlock = '<!--START_SECTION:waka-->\n_⏳ Detailed coding-activity stats (most-productive time of day, days of the week, languages, editors) will appear here once WakaTime has collected a few days of data._\n<!--END_SECTION:waka-->';
try {
  const prev = fs.readFileSync(path.join(HERE, 'README.md'), 'utf8');
  const m = prev.match(/<!--START_SECTION:waka-->[\s\S]*?<!--END_SECTION:waka-->/);
  if (m) wakaBlock = m[0];
} catch { /* first run */ }

// tech-stack badge helper (simpleicons via shields.io)
const tech = (label, slug, color, logoColor = 'white') =>
  `<img alt="${label}" src="https://img.shields.io/badge/${encodeURIComponent(label)}-${color}?style=for-the-badge&logo=${slug}&logoColor=${logoColor}" />`;

const readme = `<h1 align="center">Hey, I'm Ankur Singh 👋</h1>
<h3 align="center">Full-stack developer — I ship AI apps, web tools &amp; Shopify experiences</h3>

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&size=18&pause=1200&color=E8734A&center=true&vCenter=true&width=520&lines=TypeScript+%C2%B7+React+%C2%B7+Node+%C2%B7+Python;Building+in+public+since+2021;Turning+ideas+into+shipped+products" alt="typing" />
</p>
<p align="center">
  <img src="https://komarev.com/ghpvc/?username=${USER}&label=Profile%20views&color=e8734a&style=flat" alt="views" />
  <a href="https://github.com/${USER}?tab=followers"><img src="https://img.shields.io/github/followers/${USER}?label=Followers&style=flat&color=38c7c0" alt="followers" /></a>
  <a href="https://wakatime.com/@${USER}"><img src="https://img.shields.io/badge/WakaTime-tracked-57c98a?style=flat&logo=wakatime&logoColor=white" alt="wakatime" /></a>
</p>

---

### 🛠️ Tech Stack

<p align="center">
  ${tech('TypeScript', 'typescript', '3178C6')}
  ${tech('JavaScript', 'javascript', 'F7DF1E', 'black')}
  ${tech('React', 'react', '20232A')}
  ${tech('Node.js', 'nodedotjs', '5FA04E')}
  ${tech('Python', 'python', '3776AB')}
  ${tech('Kotlin', 'kotlin', '7F52FF')}
</p>
<p align="center">
  ${tech('HTML5', 'html5', 'E34F26')}
  ${tech('CSS3', 'css3', '1572B6')}
  ${tech('Tailwind', 'tailwindcss', '06B6D4')}
  ${tech('Shopify', 'shopify', '7AB55C')}
  ${tech('Git', 'git', 'F05032')}
  ${tech('GitHub Actions', 'githubactions', '2088FF')}
</p>

---

### 🚀 Featured Projects

<p align="center">
  <a href="https://github.com/${USER}/zenith-ai-brain"><img src="https://github-readme-stats.vercel.app/api/pin/?username=${USER}&repo=zenith-ai-brain&theme=tokyonight&hide_border=true" alt="zenith-ai-brain" /></a>
  <a href="https://palm-drab.vercel.app"><img src="https://github-readme-stats.vercel.app/api/pin/?username=${USER}&repo=PalmInsights&theme=tokyonight&hide_border=true" alt="PalmInsights" /></a>
</p>
<p align="center">
  <a href="https://aurarank-five.vercel.app"><img src="https://github-readme-stats.vercel.app/api/pin/?username=${USER}&repo=seo4ai&theme=tokyonight&hide_border=true" alt="seo4ai" /></a>
  <a href="https://github.com/${USER}/universal-Shopify-theme"><img src="https://github-readme-stats.vercel.app/api/pin/?username=${USER}&repo=universal-Shopify-theme&theme=tokyonight&hide_border=true" alt="universal-Shopify-theme" /></a>
</p>

| Project | What it is | Live |
|---|---|---|
| **[zenith-ai-brain](https://github.com/${USER}/zenith-ai-brain)** | ${PROJECT_BRIEFS['zenith-ai-brain']} | — |
| **[PalmInsights](https://github.com/${USER}/PalmInsights)** | ${PROJECT_BRIEFS['PalmInsights']} | [demo](https://palm-drab.vercel.app) |
| **[seo4ai](https://github.com/${USER}/seo4ai)** | ${PROJECT_BRIEFS['seo4ai']} | [AuraRank](https://aurarank-five.vercel.app) |
| **[universal-Shopify-theme](https://github.com/${USER}/universal-Shopify-theme)** | ${PROJECT_BRIEFS['universal-Shopify-theme']} | — |

---

### 📈 What I've shipped

<p align="center">
  <img height="170" src="https://github-readme-stats.vercel.app/api?username=${USER}&show_icons=true&include_all_commits=true&count_private=true&theme=tokyonight&hide_border=true&custom_title=Ankur's%20Code%20Output" alt="stats" />
  <img height="170" src="https://github-readme-stats.vercel.app/api/top-langs/?username=${USER}&layout=compact&theme=tokyonight&hide_border=true&langs_count=8&custom_title=Languages%20I%20write" alt="langs" />
</p>

<p align="center">
  <img src="https://github-readme-streak-stats.herokuapp.com/?user=${USER}&theme=tokyonight&hide_border=true" alt="streak — how many days I code" />
</p>

<p align="center"><sub>👆 Commits &amp; lines shipped all-time, and my day-by-day coding streak.</sub></p>

<p align="center">
  <img src="https://github-readme-activity-graph.vercel.app/graph?username=${USER}&theme=tokyo-night&hide_border=true&area=true&custom_title=Contribution%20Activity" alt="activity graph" />
</p>

---

### ⏱️ When &amp; how I code &nbsp;<sub>· live via WakaTime</sub>

${wakaBlock}

<p align="center">
  <img src="https://github-readme-stats.vercel.app/api/wakatime?username=${USER}&layout=compact&theme=tokyonight&hide_border=true&langs_count=8&custom_title=Coding%20time%20by%20language%20(last%207%20days)" alt="WakaTime languages" />
</p>

<sub>⏱️ Real editor time — hours, languages &amp; time-of-day · <a href="https://wakatime.com/@${USER}">full breakdown on WakaTime →</a></sub>

---

### 🏆 Trophies

<p align="center">
  <img src="https://github-profile-trophy.vercel.app/?username=${USER}&theme=tokyonight&no-frame=true&column=7&margin-w=8" alt="trophies" />
</p>

---

<details>
<summary>🤖 <b>Bonus: my AI-assisted coding ledger</b> &nbsp;<sub>(auto-updated ${generated})</sub></summary>

<br/>

<p align="center">
  ${badge('AI spend', money(LEDGER.totalCost), 'e8734a')}
  ${badge('Tokens', B(totalTokens), '38c7c0')}
  ${badge('AI active days', String(activeDays), '57c98a')}
</p>

A running tally of the AI tooling I code with (Claude + Codex), read locally with <a href="https://github.com/ryoppippi/ccusage"><code>ccusage</code></a> — **${B(totalTokens)} tokens** across ${modelList.length} models, spanning ${range}.

📊 **Full interactive dashboard → [${USER}.github.io/${USER}](${site})**

</details>
`;
fs.writeFileSync(path.join(HERE, 'README.md'), readme);
console.log('✓ README.md updated');
console.log(`\n  ${money(LEDGER.totalCost)} · ${B(totalTokens)} tokens · ${activeDays} active days · Claude ${claudePct}%`);
