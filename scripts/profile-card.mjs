// Generates a neofetch-style profile card with live GitHub stats.
// Usage: GITHUB_TOKEN=... node scripts/profile-card.mjs <username> <out-dir>
// Set CARD_DATA=<file.json> to render from saved stats instead of the API.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [user = "dinushiTJ", outDir = "dist"] = process.argv.slice(2);

const ART = [
  "  ____        _ ",
  " |  _ \\      | |",
  " | | | |     | |",
  " | | | | _   | |",
  " | |_| || |__| |",
  " |____/  \\____/ ",
  "",
  "",
  "    o───o───o",
  "   ╱ ╲ ╱ ╲ ╱ ╲",
  "  o───o───o───o",
  "   ╲ ╱ ╲ ╱ ╲ ╱",
  "    o───o───o",
  "",
  "",
  "  learn · build · repeat",
];

const THEMES = {
  "profile-card.svg": { bg: "#f6f8fa", border: "#e09ae6", text: "#24292f", key: "#800081", value: "#0a3069", dots: "#c9a6cf", art: "#800081" },
  "profile-card-dark.svg": { bg: "#161b22", border: "#6b2378", text: "#c9d1d9", key: "#ff7ad9", value: "#e6d0ef", dots: "#4d3a55", art: "#ff7ad9" },
};

async function fetchStats() {
  if (process.env.CARD_DATA) return JSON.parse(readFileSync(process.env.CARD_DATA, "utf8"));
  const query = `query($login: String!) {
    user(login: $login) {
      createdAt
      followers { totalCount }
      repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100) { totalCount nodes { stargazerCount } }
      contributionsCollection { contributionCalendar { totalContributions } }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  const u = json.data.user;
  return {
    createdAt: u.createdAt,
    followers: u.followers.totalCount,
    repos: u.repositories.totalCount,
    stars: u.repositories.nodes.reduce((n, r) => n + r.stargazerCount, 0),
    contributions: u.contributionsCollection.contributionCalendar.totalContributions,
  };
}

function age(since) {
  const start = new Date(since);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months--;
  return `${Math.floor(months / 12)} years, ${months % 12} months`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function lines(stats) {
  return [
    ["title", "dinushi@waikato"],
    ["rule"],
    ["kv", "Role", "Data Engineer, Research Assistant"],
    ["kv", "Education", "MSc in AI, First Class Honours"],
    ["kv", "University", "University of Waikato"],
    ["kv", "Research", "Māori Data Findability Project"],
    ["kv", "Location", "New Zealand"],
    ["kv", "IDE", "VS Code"],
    ["blank"],
    ["kv", "Languages.Programming", "Python, JavaScript, TypeScript, SQL"],
    ["kv", "Languages.ML", "PyTorch, TensorFlow, scikit-learn"],
    ["kv", "Languages.Data", "PostgreSQL, Spark, dbt, Airflow"],
    ["blank"],
    ["section", "Contact"],
    ["kv", "LinkedIn", "dinushi-jayasinghe"],
    ["kv", "Hugging Face", "dinushiTJ"],
    ["kv", "ORCID", "0009-0005-6042-9137"],
    ["blank"],
    ["section", "GitHub Stats"],
    ["kv", "Repos", `${stats.repos}  |  Stars: ${stats.stars}`],
    ["kv", "Followers", stats.followers],
    ["kv", "Contributions (last year)", stats.contributions],
    ["kv", "GitHub age", age(stats.createdAt)],
  ];
}

const WIDTH = 960;
const LINE = 22;
const TOP = 34;
const INFO_X = 330;
const COLS = 64; // characters available for each info line

function render(stats, t) {
  const rows = lines(stats);
  const height = TOP + rows.length * LINE + 14;
  const art = ART.map((l, i) => `<tspan x="24" y="${TOP + 30 + i * LINE}">${esc(l)}</tspan>`).join("\n");
  const info = rows
    .map((row, i) => {
      const y = TOP + i * LINE;
      const [kind, a, b] = row;
      if (kind === "blank") return "";
      if (kind === "title") return `<tspan x="${INFO_X}" y="${y}" class="key" font-weight="bold">${esc(a)}</tspan>`;
      if (kind === "rule") return `<tspan x="${INFO_X}" y="${y}" class="dots">${"─".repeat(COLS)}</tspan>`;
      if (kind === "section") {
        const label = `─ ${a} `;
        return `<tspan x="${INFO_X}" y="${y}" class="key">${esc(label)}</tspan><tspan class="dots">${"─".repeat(COLS - label.length)}</tspan>`;
      }
      const value = String(b);
      // ". " + key + ": " + dots + " " + value fills exactly COLS characters
      const dots = Math.max(2, COLS - a.length - value.length - 5);
      return (
        `<tspan x="${INFO_X}" y="${y}" class="dots">. </tspan><tspan class="key">${esc(a)}</tspan>` +
        `<tspan class="dots">:${" " + ".".repeat(dots) + " "}</tspan><tspan class="value">${esc(value)}</tspan>`
      );
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" font-family="Consolas, 'SF Mono', Menlo, 'DejaVu Sans Mono', monospace" font-size="15">
<style>
.key { fill: ${t.key}; }
.value { fill: ${t.value}; }
.dots { fill: ${t.dots}; }
text, tspan { white-space: pre; }
</style>
<rect x="1" y="1" width="${WIDTH - 2}" height="${height - 2}" rx="14" fill="${t.bg}" stroke="${t.border}"/>
<text fill="${t.art}">
${art}
</text>
<text fill="${t.text}">
${info}
</text>
</svg>
`;
}

const stats = await fetchStats();
mkdirSync(outDir, { recursive: true });
for (const [file, theme] of Object.entries(THEMES)) {
  writeFileSync(join(outDir, file), render(stats, theme));
  console.log(`wrote ${join(outDir, file)}`);
}
