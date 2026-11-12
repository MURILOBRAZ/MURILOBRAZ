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

// ---------- ícones (desenhados num quadro 20x20, centralizados em 0,0) ----------
const star = (() => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3.2 : 7.5;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}" stroke-linejoin="round"/>`;
})();

const icons = {
  repo: `<rect x="-6" y="-7.5" width="12" height="15" rx="1.5"/><path d="M-3 -7.5v15M0 -3h3.5M0 0.5h3.5"/>`,
  star,
  fork: `<circle cx="-4.5" cy="-5.5" r="2"/><circle cx="4.5" cy="-5.5" r="2"/><circle cx="0" cy="6" r="2"/><path d="M-4.5 -3.5v1.5a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-1.5M0 0v4"/>`,
  pr: `<circle cx="-4.5" cy="-5.5" r="2"/><circle cx="-4.5" cy="5.5" r="2"/><circle cx="4.5" cy="5.5" r="2"/><path d="M-4.5 -3.5v7M4.5 3.5v-6a2 2 0 0 0-2-2h-3M0 -7.5l-2 2 2 2"/>`,
  issue: `<circle cx="0" cy="0" r="7"/><circle cx="0" cy="0" r="1.6" fill="currentColor"/>`,
  people: `<circle cx="0" cy="-3" r="3.2"/><path d="M-6.5 7a6.5 6.5 0 0 1 13 0"/>`,
};

const stats = [
  { value: user.public_repos, label: "Repositórios públicos", icon: "repo", color: "#38bdf8" },
  { value: own.reduce((s, r) => s + r.stargazers_count, 0), label: "Estrelas recebidas", icon: "star", color: "#fbbf24" },
  { value: own.reduce((s, r) => s + r.forks_count, 0), label: "Forks dos meus projetos", icon: "fork", color: "#a78bfa" },
  { value: prs, label: "Pull requests públicos", icon: "pr", color: "#34d399" },
  { value: issues, label: "Issues públicas", icon: "issue", color: "#fb7185" },
  { value: user.followers, label: "Seguidores", icon: "people", color: "#f472b6" },
];

const name = user.name || USER;
const updated = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => n.toLocaleString("pt-BR");

// ---------- layout ----------
const W = 800, H = 346, PAD = 28, GAP = 14;
const TILE_W = (W - PAD * 2 - GAP * 2) / 3, TILE_H = 92, TOP = 96;

const tiles = stats
  .map((s, i) => {
    const x = PAD + (i % 3) * (TILE_W + GAP);
    const y = TOP + Math.floor(i / 3) * (TILE_H + GAP);
    return `  <g class="tile" style="animation-delay:${150 + i * 90}ms" transform="translate(${x.toFixed(1)} ${y})">
    <rect width="${TILE_W.toFixed(1)}" height="${TILE_H}" rx="12" fill="#ffffff" fill-opacity="0.035" stroke="#ffffff" stroke-opacity="0.08"/>
    <rect x="0" y="18" width="3" height="${TILE_H - 36}" rx="1.5" fill="${s.color}"/>
    <circle cx="36" cy="34" r="17" fill="${s.color}" fill-opacity="0.14"/>
    <g transform="translate(36 34)" fill="none" stroke="${s.color}" stroke-width="1.6" stroke-linecap="round" color="${s.color}">${icons[s.icon]}</g>
    <text x="64" y="44" class="num">${fmt(s.value)}</text>
    <text x="20" y="76" class="label">${esc(s.label)}</text>
  </g>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estatísticas do GitHub de ${esc(name)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1020"/>
      <stop offset="0.55" stop-color="#111827"/>
      <stop offset="1" stop-color="#1a1033"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#38bdf8"/>
      <stop offset="0.5" stop-color="#a78bfa"/>
      <stop offset="1" stop-color="#f472b6"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.9" cy="0" r="0.6">
      <stop offset="0" stop-color="#a78bfa" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <style>
    text { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
    .name  { fill: #f8fafc; font-size: 20px; font-weight: 700; }
    .sub   { fill: #94a3b8; font-size: 13px; }
    .pill  { fill: #cbd5e1; font-size: 11px; font-weight: 600; letter-spacing: 1px; }
    .num   { fill: #f8fafc; font-size: 28px; font-weight: 800; }
    .label { fill: #94a3b8; font-size: 13px; }
    .foot  { fill: #64748b; font-size: 12px; }
    .link  { fill: url(#edge); font-size: 12px; font-weight: 600; }
    .tile  { opacity: 0; animation: rise .6s ease-out forwards; }
    .dot   { animation: pulse 2s ease-in-out infinite; }
    @keyframes rise  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; } }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  </style>

  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="url(#bg)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="url(#glow)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="none" stroke="url(#edge)" stroke-opacity="0.55" stroke-width="1.5"/>
  <rect x="${PAD}" y="0" width="120" height="3" rx="1.5" fill="url(#edge)"/>

  <text x="${PAD}" y="46" class="name">${esc(name)}</text>
  <text x="${PAD}" y="70" class="sub">@${esc(USER)} · GitHub Stats</text>

  <g transform="translate(${W - PAD - 158} 30)">
    <rect width="158" height="26" rx="13" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.12"/>
    <circle class="dot" cx="16" cy="13" r="4" fill="#34d399"/>
    <text x="28" y="17" class="pill">ATIVIDADE PÚBLICA</text>
  </g>

${tiles}

  <line x1="${PAD}" y1="${H - 42}" x2="${W - PAD}" y2="${H - 42}" stroke="#ffffff" stroke-opacity="0.08"/>
  <text x="${PAD}" y="${H - 18}" class="foot">Atualizado em ${updated} · via GitHub Actions</text>
  <text x="${W - PAD}" y="${H - 18}" class="link" text-anchor="end">github.com/${esc(USER)} →</text>
</svg>
`;

mkdirSync("assets", { recursive: true });
writeFileSync("assets/github-stats.svg", svg);
console.log("assets/github-stats.svg gerado:", Object.fromEntries(stats.map((s) => [s.label, s.value])));
