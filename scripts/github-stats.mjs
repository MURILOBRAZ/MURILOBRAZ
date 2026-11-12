// Gera assets/github-stats.svg com estatísticas públicas do perfil.
// Uso: GH_TOKEN=... GH_USER=MURILOBRAZ node scripts/github-stats.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const USER = process.env.GH_USER;
const TOKEN = process.env.GH_TOKEN;
if (!USER) throw new Error("Defina GH_USER");

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-stats-script",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} em ${path}`);
  return res.json();
}

async function allRepos() {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/users/${USER}/repos?type=owner&per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}

const searchCount = async (q) =>
  (await api(`/search/issues?q=${encodeURIComponent(q)}&per_page=1`)).total_count;

const [user, repos, prs, issues] = await Promise.all([
  api(`/users/${USER}`),
  allRepos(),
  searchCount(`author:${USER} type:pr is:public`),
  searchCount(`author:${USER} type:issue is:public`),
]);

const own = repos.filter((r) => !r.fork);
const stats = [
  [user.public_repos, "Repositórios públicos"],
  [own.reduce((s, r) => s + r.stargazers_count, 0), "Estrelas recebidas"],
  [own.reduce((s, r) => s + r.forks_count, 0), "Forks dos meus projetos"],
  [prs, "Pull requests públicos"],
  [issues, "Issues públicas"],
  [user.followers, "Seguidores"],
];

const updated = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => n.toLocaleString("pt-BR");

const W = 760, H = 306, PAD = 30, COL = (W - PAD * 2) / 3;
const cells = stats
  .map(([value, label], i) => {
    const x = PAD + (i % 3) * COL;
    const y = 112 + Math.floor(i / 3) * 92;
    return `  <text x="${x}" y="${y}" class="num">${fmt(value)}</text>
  <text x="${x}" y="${y + 30}" class="label">${esc(label)}</text>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estatísticas do GitHub de ${esc(USER)}">
  <style>
    text { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
    .title { fill: #ffffff; font-size: 16px; font-weight: 700; }
    .tag   { fill: #c9d1d9; font-size: 12px; letter-spacing: 0.5px; }
    .num   { fill: #ffffff; font-size: 28px; font-weight: 700; }
    .label { fill: #c9d1d9; font-size: 13px; }
    .foot  { fill: #c9d1d9; font-size: 12px; }
    .link  { fill: #e07b53; font-size: 12px; }
  </style>
  <rect width="${W}" height="${H}" rx="8" fill="#212a26"/>
  <rect x="${PAD}" y="28" width="8" height="8" fill="#e07b53"/>
  <text x="${PAD + 18}" y="37" class="title">${esc(USER)} / GitHub Stats</text>
  <text x="${W - PAD}" y="37" class="tag" text-anchor="end">ATIVIDADE PÚBLICA</text>
  <line x1="${PAD}" y1="64" x2="${W - PAD}" y2="64" stroke="#3a4540"/>
${cells}
  <line x1="${PAD}" y1="252" x2="${W - PAD}" y2="252" stroke="#3a4540"/>
  <text x="${PAD}" y="282" class="foot">Atualizado em ${updated} · GitHub Actions</text>
  <text x="${W - PAD}" y="282" class="link" text-anchor="end">github.com/${esc(USER)}</text>
</svg>
`;

mkdirSync("assets", { recursive: true });
writeFileSync("assets/github-stats.svg", svg);
console.log("assets/github-stats.svg gerado:", Object.fromEntries(stats.map(([v, l]) => [l, v])));
