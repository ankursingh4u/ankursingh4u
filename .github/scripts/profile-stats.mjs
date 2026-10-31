// Auto-refreshes the live stats + "latest builds" sections of README.md.
// Run by .github/workflows/profile-stats.yml on a schedule.
import { readFile, writeFile } from "node:fs/promises";

const ACCOUNTS = ["ankursingh4u", "ankur4work"];
const PRIMARY_ACCOUNT = "ankursingh4u";
const TOKEN = process.env.GH_TOKEN;
const README_PATH = "README.md";

const headers = {
  "User-Agent": "profile-stats-script",
  Accept: "application/vnd.github+json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function ghJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  return res.json();
}

async function fetchAllRepos(account) {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await ghJson(
      `https://api.github.com/users/${account}/repos?per_page=100&page=${page}&sort=pushed`
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.filter((r) => !r.fork);
}

function fmtDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function replaceSection(markdown, name, body) {
  const start = `<!--START_SECTION:${name}-->`;
  const end = `<!--END_SECTION:${name}-->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  const block = `${start}\n${body}\n${end}`;
  if (!pattern.test(markdown)) {
    throw new Error(`Markers for section "${name}" not found in README.md`);
  }
  return markdown.replace(pattern, block);
}

async function main() {
  const allRepos = (await Promise.all(ACCOUNTS.map(fetchAllRepos))).flat();
  const profile = await ghJson(`https://api.github.com/users/${PRIMARY_ACCOUNT}`);

  const repoCount = allRepos.length;
  const followers = profile.followers;
  const buildingSinceYear = new Date(profile.created_at).getFullYear();
  const yearsActive = new Date().getFullYear() - buildingSinceYear;

  const statsBody = [
    "<table align=\"center\">",
    "  <tr>",
    `    <td align="center" width="175"><h1>📦&nbsp;${repoCount}</h1><b>Repositories</b><br/><sub>shipped &amp; maintained</sub></td>`,
    `    <td align="center" width="175"><h1>🧑‍💻&nbsp;${followers}</h1><b>Followers</b><br/><sub>&amp; counting</sub></td>`,
    `    <td align="center" width="175"><h1>🚀&nbsp;${buildingSinceYear}</h1><b>Building since</b><br/><sub>${yearsActive} years in</sub></td>`,
    "  </tr>",
    "</table>",
    "",
    `<p align="center"><sub>🔄 Live from the GitHub API across both accounts — last refreshed ${fmtDate(
      new Date().toISOString()
    )}.</sub></p>`,
  ].join("\n");

  const latest = allRepos
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, 8);

  const latestRows = latest
    .map((r) => {
      const desc = (r.description || "—").replace(/\|/g, "\\|");
      const live = r.homepage ? `[demo](${r.homepage})` : "—";
      return `| **[${r.name}](${r.html_url})** | ${desc} | ${live} | ${fmtDate(r.pushed_at)} |`;
    })
    .join("\n");

  const latestBody = [
    "| Project | What it is | Live | Last pushed |",
    "|---|---|---|---|",
    latestRows,
  ].join("\n");

  let readme = await readFile(README_PATH, "utf8");
  readme = replaceSection(readme, "stats", statsBody);
  readme = replaceSection(readme, "latest", latestBody);
  await writeFile(README_PATH, readme);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
