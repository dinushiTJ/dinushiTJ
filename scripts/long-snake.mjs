// Generates a long, animated snake that eats the GitHub contribution grid.
// Usage: GITHUB_TOKEN=... node scripts/long-snake.mjs <username> <out-dir>
// Set SNAKE_DATA=<file.json> to render from saved calendar weeks instead of the API.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [user = "dinushiTJ", outDir = "dist"] = process.argv.slice(2);

const SNAKE_LENGTH = 18; // segments
const CELL = 11;
const PITCH = 14;
const PAD = 14;
const STEP_SECONDS = 0.09; // time to move one cell

const THEMES = {
  "github-contribution-grid-snake.svg": {
    empty: "#ebedf0",
    levels: ["#ebedf0", "#f3d1f5", "#e09ae6", "#c04fc9", "#800081"],
    head: "#800081",
    tail: "#e09ae6",
  },
  "github-contribution-grid-snake-dark.svg": {
    empty: "#161b22",
    levels: ["#161b22", "#3d1a45", "#6b2378", "#a63bb5", "#ff7ad9"],
    head: "#ff7ad9",
    tail: "#6b2378",
  },
};

const LEVELS = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];

async function fetchWeeks() {
  if (process.env.SNAKE_DATA) return JSON.parse(readFileSync(process.env.SNAKE_DATA, "utf8"));
  const query = `query($login: String!) {
    user(login: $login) { contributionsCollection { contributionCalendar {
      weeks { contributionDays { contributionLevel weekday } }
    } } }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json));
  return json.data.user.contributionsCollection.contributionCalendar.weeks;
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(a, b, t) {
  const [x, y] = [hex(a), hex(b)];
  return "#" + x.map((v, i) => lerp(v, y[i], t).toString(16).padStart(2, "0")).join("");
}

function render(weeks, theme) {
  const cols = weeks.length;
  const width = PAD * 2 + cols * PITCH - (PITCH - CELL);
  const height = PAD * 2 + 7 * PITCH - (PITCH - CELL);
  const center = (col, row) => [PAD + col * PITCH + CELL / 2, PAD + row * PITCH + CELL / 2];

  // Route: enter from the left, zig-zag down/up every column, exit right.
  const points = [];
  for (let i = SNAKE_LENGTH; i >= 1; i--) points.push(center(-i, 0));
  const stepOf = new Map(); // "col,row" -> step index along the route
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      const row = c % 2 === 0 ? r : 6 - r;
      stepOf.set(`${c},${row}`, points.length);
      points.push(center(c, row));
    }
  }
  const lastRow = (cols - 1) % 2 === 0 ? 6 : 0;
  for (let i = 1; i <= SNAKE_LENGTH + 1; i++) points.push(center(cols - 1 + i, lastRow));

  const steps = points.length - 1;
  const dur = +(steps * STEP_SECONDS).toFixed(2);
  const path = "M" + points.map(([x, y]) => `${x},${y}`).join(" L");
  // Cells refill once the head has left the grid and wrapped around.
  const refill = (steps - SNAKE_LENGTH) / steps;

  const cells = [];
  weeks.forEach((week, c) => {
    for (const day of week.contributionDays) {
      const level = LEVELS.indexOf(day.contributionLevel);
      const [x, y] = center(c, day.weekday);
      const attrs = `x="${x - CELL / 2}" y="${y - CELL / 2}" width="${CELL}" height="${CELL}" rx="2.5"`;
      if (level <= 0) {
        cells.push(`<rect ${attrs} fill="${theme.empty}"/>`);
        continue;
      }
      const eaten = ((stepOf.get(`${c},${day.weekday}`) - SNAKE_LENGTH + 0.5) / steps).toFixed(4);
      cells.push(
        `<rect ${attrs} fill="${theme.levels[level]}"><animate attributeName="fill" ` +
          `values="${theme.levels[level]};${theme.empty};${theme.levels[level]}" ` +
          `keyTimes="0;${eaten};${refill.toFixed(4)}" calcMode="discrete" dur="${dur}s" repeatCount="indefinite"/></rect>`
      );
    }
  });

  // Head starts on the first grid cell at t=0; each segment trails one step behind.
  const segments = [];
  for (let i = SNAKE_LENGTH - 1; i >= 0; i--) {
    const t = i / (SNAKE_LENGTH - 1);
    const size = +(CELL + 1 - t * 4).toFixed(1);
    const begin = -((SNAKE_LENGTH - i) * dur) / steps;
    segments.push(
      `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="${size / 2.5}" fill="${mix(theme.head, theme.tail, t)}">` +
        `<animateMotion path="${path}" dur="${dur}s" begin="${begin.toFixed(3)}s" repeatCount="indefinite" calcMode="linear"/></rect>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<g>${cells.join("")}</g>
<g>${segments.join("")}</g>
</svg>
`;
}

const weeks = await fetchWeeks();
mkdirSync(outDir, { recursive: true });
for (const [file, theme] of Object.entries(THEMES)) {
  writeFileSync(join(outDir, file), render(weeks, theme));
  console.log(`wrote ${join(outDir, file)}`);
}
