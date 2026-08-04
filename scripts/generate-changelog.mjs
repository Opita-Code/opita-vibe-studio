#!/usr/bin/env node
/**
 * generate-changelog.mjs
 *
 * Parses conventional commits since the last release and prepends
 * a new entry to landing/changelog.json.
 *
 * Usage:
 *   TAG_NAME=web/v0.5.0 node scripts/generate-changelog.mjs
 *
 * Environment:
 *   TAG_NAME — the tag that triggered the workflow (e.g. web/v0.4.0)
 *
 * Idempotent: if the version already exists in changelog.json, exits 0.
 * Zero dependencies — uses only Node.js built-ins + git CLI.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = resolve(__dirname, "../landing/changelog.json");

// ─── Helpers ───────────────────────────────────────────────────

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: "utf-8" }).trim();
}

function extractVersion(tag) {
  // web/v0.4.0 → 0.4.0, backend/v0.4.0 → 0.4.0, v0.4.0 → 0.4.0
  const match = tag.match(/v?(\d+\.\d+\.\d+)/);
  if (!match) throw new Error(`Cannot extract version from tag: ${tag}`);
  return match[1];
}

function extractComponent(tag) {
  if (tag.startsWith("web/")) return "Web App";
  if (tag.startsWith("backend/")) return "Backend";
  if (tag.startsWith("landing/")) return "Landing";
  return "Desktop";
}

const COMPONENT_ORDER = ["Web App", "Backend", "Landing", "Desktop"];

// ─── Conventional commit parser ────────────────────────────────

const COMMIT_RE = /^(?<type>feat|fix|refactor|perf|chore|docs|style|test|ci|build)(?:\((?<scope>[^)]+)\))?!?:\s+(?<subject>.+)$/;

const TYPE_LABELS = {
  feat: "✨",
  fix: "🐛",
  refactor: "♻️",
  perf: "⚡",
  chore: "",
  docs: "📝",
  ci: "🔧",
  build: "📦",
};

function parseCommit(line) {
  // line: "abc1234 feat(auth): add login flow"
  const [hash, ...rest] = line.split(" ");
  const message = rest.join(" ");
  const match = message.match(COMMIT_RE);

  if (!match) return null;

  const { type, scope, subject } = match.groups;
  return { hash, type, scope: scope || null, subject };
}

function classifyByScope(commits) {
  const groups = {};

  for (const c of commits) {
    // Map scope to component
    let component = "Web App"; // default
    const s = (c.scope || "").toLowerCase();

    if (["backend", "api", "sst", "lambda", "cognito", "ses", "billing"].includes(s)) {
      component = "Backend";
    } else if (["landing", "seo"].includes(s)) {
      component = "Landing";
    } else if (["tauri", "desktop", "wails"].includes(s)) {
      component = "Desktop";
    } else if (["ci", "build", "deps"].includes(s)) {
      // CI/build changes go to whatever component triggered the tag
      component = "Web App";
    }

    if (!groups[component]) groups[component] = [];

    const prefix = TYPE_LABELS[c.type] || "";
    const text = prefix ? `${prefix} ${c.subject}` : c.subject;
    groups[component].push(text);
  }

  return groups;
}

function generateTitle(commits) {
  // Pick the most significant feat/refactor commit for the title
  const significant = commits.find(c => c.type === "feat" || c.type === "refactor");
  if (significant) {
    // Capitalize first letter
    const s = significant.subject;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // Fallback: count by type
  const feats = commits.filter(c => c.type === "feat").length;
  const fixes = commits.filter(c => c.type === "fix").length;
  if (feats > 0 && fixes > 0) return `${feats} nuevas funciones y ${fixes} correcciones`;
  if (feats > 0) return `${feats} nuevas funciones`;
  if (fixes > 0) return `${fixes} correcciones`;
  return "Actualizaciones y mejoras";
}

function generateHighlights(commits) {
  // Top 3 most important commits (feat > refactor > fix > rest)
  const priority = ["feat", "refactor", "fix", "perf"];
  const sorted = [...commits].sort((a, b) => {
    return priority.indexOf(a.type) - priority.indexOf(b.type);
  });

  return sorted
    .slice(0, 3)
    .map(c => {
      const s = c.subject;
      return s.charAt(0).toUpperCase() + s.slice(1);
    });
}

// ─── Main ──────────────────────────────────────────────────────

function main() {
  const tagName = process.env.TAG_NAME;
  if (!tagName) {
    console.error("❌ TAG_NAME environment variable is required");
    process.exit(1);
  }

  const version = extractVersion(tagName);
  console.log(`📋 Generating changelog for v${version} (triggered by ${tagName})`);

  // Load existing changelog
  let changelog;
  try {
    changelog = JSON.parse(readFileSync(CHANGELOG_PATH, "utf-8"));
  } catch {
    changelog = [];
  }

  // Idempotent: skip if version already exists
  if (changelog.some(entry => entry.version === version)) {
    console.log(`⏭️  v${version} already exists in changelog.json — skipping`);
    process.exit(0);
  }

  // Find all tags for this version (web/v0.4.0, backend/v0.4.0, etc.)
  const allTags = git("tag -l").split("\n").filter(Boolean);
  const versionTags = allTags.filter(t => t.includes(`v${version}`));

  console.log(`📦 Tags for this version: ${versionTags.join(", ")}`);

  // Find the previous release version
  // Get all semver versions from tags, sorted descending
  const allVersions = [...new Set(
    allTags
      .map(t => { const m = t.match(/v?(\d+\.\d+\.\d+)/); return m ? m[1] : null; })
      .filter(Boolean)
  )].sort((a, b) => {
    const [a1, a2, a3] = a.split(".").map(Number);
    const [b1, b2, b3] = b.split(".").map(Number);
    return b1 - a1 || b2 - a2 || b3 - a3;
  });

  const currentIdx = allVersions.indexOf(version);
  const prevVersion = currentIdx >= 0 && currentIdx < allVersions.length - 1
    ? allVersions[currentIdx + 1]
    : null;

  // Get commits between previous release and current
  let commitLines;
  if (prevVersion) {
    // Find the actual tag name for the previous version (prefer web/ then backend/)
    const prevTag = allTags.find(t => t === `web/v${prevVersion}`)
      || allTags.find(t => t === `backend/v${prevVersion}`)
      || allTags.find(t => t.includes(`v${prevVersion}`));

    console.log(`📊 Commits: ${prevTag}..${tagName}`);
    commitLines = git(`log --oneline ${prevTag}..HEAD --no-merges`).split("\n").filter(Boolean);
  } else {
    console.log(`📊 Commits: all (no previous version found)`);
    commitLines = git(`log --oneline -20 --no-merges`).split("\n").filter(Boolean);
  }

  // Parse conventional commits
  const parsed = commitLines.map(parseCommit).filter(Boolean);

  // Filter out chore(release) and pure CI commits
  const meaningful = parsed.filter(c =>
    !(c.type === "chore" && c.scope === "release") &&
    c.type !== "ci" &&
    c.type !== "test"
  );

  if (meaningful.length === 0) {
    console.log("⚠️  No meaningful conventional commits found — generating minimal entry");
  }

  // Build components list
  const components = versionTags
    .map(t => ({ name: extractComponent(t), tag: t }))
    .sort((a, b) => COMPONENT_ORDER.indexOf(a.name) - COMPONENT_ORDER.indexOf(b.name));

  // Build details per component
  const details = classifyByScope(meaningful);

  // Build entry
  const entry = {
    version,
    date: new Date().toISOString().split("T")[0],
    title: generateTitle(meaningful),
    components,
    highlights: generateHighlights(meaningful),
    details,
  };

  // Prepend
  changelog.unshift(entry);

  // Write
  writeFileSync(CHANGELOG_PATH, JSON.stringify(changelog, null, 2) + "\n", "utf-8");

  console.log(`✅ Changelog updated with v${version}`);
  console.log(`   Title: ${entry.title}`);
  console.log(`   Highlights: ${entry.highlights.length}`);
  console.log(`   Components: ${components.map(c => c.name).join(", ")}`);
}

main();
