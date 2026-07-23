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

const readme = `<h1 align="center">Hi 👋, I'm Ankur Singh</h1>
<h3 align="center">Full-stack developer · building with AI</h3>

<p align="center">
  <img src="https://komarev.com/ghpvc/?username=${USER}&label=Profile%20views&color=e8734a&style=flat" alt="views" />
</p>

---

### 🤖 AI Coding Ledger &nbsp;<sub>auto-updated ${generated}</sub>

<p align="center">
  ${badge('Estimated cost', money(LEDGER.totalCost), 'e8734a')}
  ${badge('Tokens', B(totalTokens), '38c7c0')}
  ${badge('Output', B(totalOutput), '9aa6b8')}
  ${badge('Active days', String(activeDays), '57c98a')}
</p>

| Metric | Value |
|---|---|
| 💰 Estimated cost | **${money(LEDGER.totalCost)}** (≈ ${money(LEDGER.avgPerDay)} / active day) |
| 🔢 Total tokens | **${B(totalTokens)}** (${totalTokens.toLocaleString('en-US')}) |
| ✍️ Output tokens | **${B(totalOutput)}** across ${modelList.length} models |
| 📈 Peak day | **${money(peak.c)}** on ${peakDate} |
| 🧠 Claude vs Codex | **${claudePct}%** / ${codexPct}% of spend |

**Top models by cost:** ${modelList.slice(0, 4).map(m => `\`${m.n}\` ${money(m.c)}`).join(' · ')}

📊 **Live dashboard → [${USER}.github.io/${USER}](${site})**

<sub>Generated locally with <a href="https://github.com/ryoppippi/ccusage"><code>ccusage</code></a> — spanning ${range}.</sub>

---

### ⏱️ Coding Activity &nbsp;<sub>via WakaTime</sub>

<p align="center">
  <img src="https://github-readme-stats.vercel.app/api/wakatime?username=${USER}&layout=compact&theme=tokyonight&hide_border=true&langs_count=8" alt="WakaTime last 7 days" />
</p>

<sub>Time spent per language, last 7 days · <a href="https://wakatime.com/@${USER}">full dashboard on WakaTime →</a></sub>

---

### 📊 GitHub Stats

<p align="center">
  <img height="180" src="https://github-readme-stats.vercel.app/api?username=${USER}&show_icons=true&include_all_commits=true&count_private=true&theme=tokyonight&hide_border=true" alt="stats" />
  <img height="180" src="https://github-readme-stats.vercel.app/api/top-langs/?username=${USER}&layout=compact&theme=tokyonight&hide_border=true&langs_count=8" alt="langs" />
</p>
<p align="center">
  <img src="https://github-readme-streak-stats.herokuapp.com/?user=${USER}&theme=tokyonight&hide_border=true" alt="streak" />
</p>
<p align="center">
  <img src="https://github-readme-activity-graph.vercel.app/graph?username=${USER}&theme=tokyo-night&hide_border=true&area=true" alt="activity" />
</p>
<p align="center">
  <img src="https://github-profile-trophy.vercel.app/?username=${USER}&theme=tokyonight&no-frame=true&column=7&margin-w=8" alt="trophies" />
</p>
`;
fs.writeFileSync(path.join(HERE, 'README.md'), readme);
console.log('✓ README.md updated');
console.log(`\n  ${money(LEDGER.totalCost)} · ${B(totalTokens)} tokens · ${activeDays} active days · Claude ${claudePct}%`);
