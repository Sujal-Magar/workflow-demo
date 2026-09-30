#!/usr/bin/env node --experimental-strip-types
// ==============================================================================
// SonarQube Issue Fetcher
//
// Phase 1 ("Sonar Fetch") of the proposed SonarQube Remediation Workflow
// (see .ai/multi-agent/proposals/sonar-remediation-workflow-playbook.md).
//
// This does NOT run a scan — it assumes a `sonar-scanner` analysis has already
// run against the local SonarQube server, and pulls the resulting issues and
// Security Hotspots back out of its REST API, grouped per-file, into two JSON
// files a Sonar Plan agent can read.
//
// Usage:
//   node scripts/sonar-fetch.ts [options]
//   pnpm sonar:fetch -- [options]
//
// Options:
//   -u, --url <url>         SonarQube server URL (default: $SONAR_HOST_URL or http://localhost:9000)
//   -t, --token <token>     SonarQube authentication token (default: $SONAR_TOKEN)
//   -p, --project <key>     Sonar project key (default: sonar.projectKey from sonar-project.properties)
//   -o, --out-dir <dir>     Output directory for sonar-issues.json / sonar-hotspots.json (default: ./sonar)
//       --profile <name>    Label only, recorded in the output (e.g. "static" or "full") — does not
//                            change which issues are fetched, since SonarQube itself already applied
//                            whichever Quality Gate profile ran the analysis.
//   -h, --help              Show this help message
//
// Environment: reads SONAR_HOST_URL / SONAR_TOKEN from the shell environment first,
// falling back to .env.sonar.local then .env.sonar at the repo root (copy
// .env.sonar.example to .env.sonar.local and fill in your token — kept separate
// from the app's own .env so Sonar credentials never sit alongside AWS/SES/DB config).
//
// Exit code: 0 if zero blocker/critical issues were found, 1 otherwise — so this
// can drive the Phase 1 gate check directly (`if ! pnpm sonar:fetch; then ...`).
// ==============================================================================

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(SCRIPT_DIR, "..");

interface CliOptions {
  url: string;
  token: string;
  project: string;
  outDir: string;
  profile: string;
}

interface SonarIssue {
  key: string;
  rule: string;
  type: string;
  severity: string;
  component: string;
  line?: number;
  message: string;
  status: string;
}

interface SonarHotspot {
  key: string;
  component: string;
  line?: number;
  message: string;
  status: string;
  vulnerabilityProbability: string;
  securityCategory: string;
  ruleKey: string;
}

function printUsage(): void {
  console.log(`Usage: node scripts/sonar-fetch.ts [options]

Options:
  -u, --url <url>         SonarQube server URL (default: $SONAR_HOST_URL or http://localhost:9000)
  -t, --token <token>     SonarQube authentication token (default: $SONAR_TOKEN)
  -p, --project <key>     Sonar project key (default: sonar.projectKey from sonar-project.properties)
  -o, --out-dir <dir>     Output directory for sonar-issues.json / sonar-hotspots.json (default: ./sonar)
      --profile <name>    Label only, recorded in the output (e.g. "static" or "full")
  -h, --help               Show this help message

Environment Variables (also read from .env.sonar.local / .env.sonar):
  SONAR_HOST_URL          URL of the SonarQube server (e.g., http://localhost:9000)
  SONAR_TOKEN             User or project analysis token`);
}

function loadEnvVar(name: string): string {
  for (const file of [join(ROOT_DIR, ".env.sonar.local"), join(ROOT_DIR, ".env.sonar")]) {
    if (!existsSync(file)) continue;
    const line = readFileSync(file, "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith(`${name}=`));
    if (line) {
      return line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

function loadProjectKeyFromProperties(): string {
  const propsPath = join(ROOT_DIR, "sonar-project.properties");
  if (!existsSync(propsPath)) return "";
  const line = readFileSync(propsPath, "utf8")
    .split("\n")
    .find((l) => l.trim().startsWith("sonar.projectKey="));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    url: process.env.SONAR_HOST_URL || loadEnvVar("SONAR_HOST_URL") || "http://localhost:9000",
    token: process.env.SONAR_TOKEN || loadEnvVar("SONAR_TOKEN") || "",
    project: loadProjectKeyFromProperties(),
    outDir: join(ROOT_DIR, "sonar"),
    profile: "",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "-u":
      case "--url":
        options.url = argv[++i];
        break;
      case "-t":
      case "--token":
        options.token = argv[++i];
        break;
      case "-p":
      case "--project":
        options.project = argv[++i];
        break;
      case "-o":
      case "--out-dir":
        options.outDir = join(process.cwd(), argv[++i]);
        break;
      case "--profile":
        options.profile = argv[++i];
        break;
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!options.project) {
    console.error(
      "Error: no Sonar project key found. Pass --project <key> or add sonar.projectKey to sonar-project.properties."
    );
    process.exit(1);
  }

  return options;
}

function authHeader(token: string): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}` };
}

async function checkConnection(url: string): Promise<void> {
  try {
    const res = await fetch(`${url}/api/system/status`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(`\n❌ Error: Cannot connect to SonarQube server at ${url}`);
    console.error(`   (${err instanceof Error ? err.message : String(err)})`);
    console.error("\nMake sure the server is running and reachable, then try again.\n");
    process.exit(1);
  }
}

async function fetchAllPages<T, K extends string>(url: string, token: string, key: K): Promise<T[]> {
  const pageSize = 500;
  let pageIndex = 1;
  const results: T[] = [];

  for (;;) {
    const paged = new URL(url);
    paged.searchParams.set("p", String(pageIndex));
    paged.searchParams.set("ps", String(pageSize));

    const res = await fetch(paged, { headers: authHeader(token) });
    if (!res.ok) {
      if (res.status === 401) {
        console.error("\n❌ Error: SonarQube rejected the request (401 Unauthorized). Pass a valid --token.\n");
      } else {
        console.error(`\n❌ Error: SonarQube returned HTTP ${res.status} for ${paged}\n`);
      }
      process.exit(1);
    }

    const body = (await res.json()) as { paging: { total: number } } & Record<K, T[]>;
    results.push(...body[key]);

    if (results.length >= body.paging.total || body[key].length === 0) break;
    pageIndex++;
  }

  return results;
}

function stripProjectPrefix(component: string, projectKey: string): string {
  const prefix = `${projectKey}:`;
  return component.startsWith(prefix) ? component.slice(prefix.length) : component;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  console.log("============================================================");
  console.log(" SonarQube Issue Fetcher");
  console.log("============================================================");
  console.log(` Server URL   : ${options.url}`);
  console.log(` Project key  : ${options.project}`);
  console.log(` Output dir   : ${options.outDir}`);
  console.log("============================================================\n");

  await checkConnection(options.url);

  console.log("Fetching issues (Bugs / Vulnerabilities / Code Smells)...");
  const issuesUrl = new URL("/api/issues/search", options.url);
  issuesUrl.searchParams.set("componentKeys", options.project);
  issuesUrl.searchParams.set("resolved", "false");
  const rawIssues = await fetchAllPages<SonarIssue, "issues">(issuesUrl.toString(), options.token, "issues");

  console.log("Fetching Security Hotspots...");
  const hotspotsUrl = new URL("/api/hotspots/search", options.url);
  hotspotsUrl.searchParams.set("projectKey", options.project);
  hotspotsUrl.searchParams.set("status", "TO_REVIEW");
  const rawHotspots = await fetchAllPages<SonarHotspot, "hotspots">(hotspotsUrl.toString(), options.token, "hotspots");

  const bySeverity: Record<string, number> = {};
  const files: Record<string, unknown[]> = {};
  for (const issue of rawIssues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    const file = stripProjectPrefix(issue.component, options.project);
    (files[file] ??= []).push({
      key: issue.key,
      rule: issue.rule,
      type: issue.type,
      severity: issue.severity,
      line: issue.line,
      message: issue.message,
      status: issue.status,
    });
  }
  const blockerOrCriticalCount = (bySeverity["BLOCKER"] || 0) + (bySeverity["CRITICAL"] || 0);

  const issuesOutput = {
    generatedAt: new Date().toISOString(),
    sonarHostUrl: options.url,
    projectKey: options.project,
    gateProfile: options.profile || undefined,
    totalIssues: rawIssues.length,
    bySeverity,
    blockerOrCriticalCount,
    files,
  };

  const hotspotsOutput = {
    generatedAt: new Date().toISOString(),
    sonarHostUrl: options.url,
    projectKey: options.project,
    totalHotspots: rawHotspots.length,
    hotspots: rawHotspots.map((h) => ({
      key: h.key,
      file: stripProjectPrefix(h.component, options.project),
      line: h.line,
      ruleKey: h.ruleKey,
      securityCategory: h.securityCategory,
      vulnerabilityProbability: h.vulnerabilityProbability,
      status: h.status,
      message: h.message,
    })),
  };

  mkdirSync(options.outDir, { recursive: true });
  writeFileSync(join(options.outDir, "sonar-issues.json"), JSON.stringify(issuesOutput, null, 2));
  writeFileSync(join(options.outDir, "sonar-hotspots.json"), JSON.stringify(hotspotsOutput, null, 2));

  console.log("\n------------------------------------------------------------");
  console.log(` Issues found      : ${rawIssues.length} (across ${Object.keys(files).length} files)`);
  console.log(` By severity       : ${JSON.stringify(bySeverity)}`);
  console.log(` Blocker/Critical  : ${blockerOrCriticalCount}`);
  console.log(` Security Hotspots : ${rawHotspots.length} (never auto-resolved — route to a human)`);
  console.log("------------------------------------------------------------");
  console.log(` Wrote: ${join(options.outDir, "sonar-issues.json")}`);
  console.log(` Wrote: ${join(options.outDir, "sonar-hotspots.json")}`);
  console.log("============================================================\n");

  if (blockerOrCriticalCount === 0) {
    console.log("✓ No blocker/critical issues — nothing to remediate.");
    process.exit(0);
  } else {
    console.log(`❌ ${blockerOrCriticalCount} blocker/critical issue(s) — remediation needed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
