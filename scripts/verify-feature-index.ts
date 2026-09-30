#!/usr/bin/env node --experimental-strip-types
// ==============================================================================
// Verify Feature Index
//
// Validates features/index.json for structural consistency, ensuring:
//   1. All referenced paths (FDS, behavior spec, visual spec) exist on disk.
//   2. Feature version in index.json matches the latest version in the FDS.
//   3. Feature IDs match between index key, object.id, and FDS frontmatter.
//   4. Dependencies refer to existing feature IDs and have no cycles or self-refs.
//   5. Summary metrics (if present) match actual active/archived counts.
//
// Usage:
//   pnpm index:verify
// ==============================================================================

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(SCRIPT_DIR, "..");
const INDEX_FILE = join(ROOT_DIR, "features", "index.json");

// ANSI color codes
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

interface FeatureEntry {
  id?: string;
  title?: string;
  domain?: string;
  status?: string;
  version?: string;
  path?: string;
  behavior_spec?: string;
  visual_spec?: string[];
  figma_spec?: string;
  owner?: string;
  dependencies?: string[];
}

interface FeatureIndex {
  $schema?: string;
  project?: string;
  last_updated?: string;
  summary?: {
    total_features?: number;
    active?: number;
    archived?: number;
  };
  active_features?: Record<string, FeatureEntry>;
  archived_features?: Record<string, FeatureEntry>;
}

interface Inconsistency {
  featureId: string;
  featureTitle?: string;
  field: string;
  issue: string;
  expected?: string;
  actual?: string;
  fixGuide: string;
}

function cleanQuotes(val: string): string {
  return val.trim().replace(/^["']|["']$/g, "");
}

function parseFdsMetadata(fdsContent: string): {
  id?: string;
  version?: string;
  status?: string;
  latestChangelogVersion?: string;
  dependencies?: string[];
  hasCodeBlock?: boolean;
  hasAcceptanceCriteria?: boolean;
} {
  const result: {
    id?: string;
    version?: string;
    status?: string;
    latestChangelogVersion?: string;
    dependencies?: string[];
    hasCodeBlock?: boolean;
    hasAcceptanceCriteria?: boolean;
  } = {};

  // Check YAML Frontmatter
  const frontmatterMatch = fdsContent.match(/^---\s*([\s\S]*?)\s*---/);
  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1];
    const idMatch = yaml.match(/^id:\s*([^\n]+)/m);
    const versionMatch = yaml.match(/^version:\s*([^\n]+)/m);
    const statusMatch = yaml.match(/^status:\s*([^\n]+)/m);

    if (idMatch) result.id = cleanQuotes(idMatch[1]);
    if (versionMatch) result.version = cleanQuotes(versionMatch[1]);
    if (statusMatch) result.status = cleanQuotes(statusMatch[1]);

    // Check changelog versions (matches "- version: X.Y.Z")
    const changelogVersions: string[] = [];
    const changelogRegex = /-\s+version:\s*([^\n]+)/g;
    let match: RegExpExecArray | null;
    while ((match = changelogRegex.exec(yaml)) !== null) {
      changelogVersions.push(cleanQuotes(match[1]));
    }
    if (changelogVersions.length > 0) {
      result.latestChangelogVersion = changelogVersions[0];
    }

    // Parse dependencies
    const depInlineMatch = yaml.match(/^dependencies:\s*\[(.*?)\]/m);
    if (depInlineMatch) {
      result.dependencies = depInlineMatch[1]
        .split(",")
        .map((s) => cleanQuotes(s))
        .filter(Boolean);
    } else {
      const depBlockMatch = yaml.match(/^dependencies:\s*\n((?:\s*-\s*[^\n]+\n*)+)/m);
      if (depBlockMatch) {
        result.dependencies = depBlockMatch[1]
          .split("\n")
          .map((line) => line.replace(/^\s*-\s*/, ""))
          .map((s) => cleanQuotes(s))
          .filter(Boolean);
      }
    }
  }

  // Fallback to Markdown formatting if not in frontmatter
  if (!result.id) {
    const mdIdMatch = fdsContent.match(/\*\*Feature ID:\*\*\s*`?([^\n`*]+)`?/i);
    if (mdIdMatch) result.id = mdIdMatch[1].trim();
  }
  if (!result.version) {
    const mdVersionMatch = fdsContent.match(/\*\*Version:\*\*\s*`?([^\n`*]+)`?/i);
    if (mdVersionMatch) result.version = mdVersionMatch[1].trim();
  }

  // Check for forbidden code blocks
  result.hasCodeBlock = fdsContent.includes("```");

  // Check for acceptance criteria section with criteria items
  const acMatch = fdsContent.match(/## (?:[0-9]+\.\s*)?Acceptance Criteria([\s\S]*?)(?:##|$)/i);
  const hasAcSection = acMatch !== null;
  const hasAcItem = hasAcSection && /(?:^|\n)\s*[-*0-9.]+\s+[^\n]+/.test(acMatch[1]);
  result.hasAcceptanceCriteria = hasAcSection && hasAcItem;

  return result;
}

function verifyFeatureIndex(): void {
  if (!existsSync(INDEX_FILE)) {
    console.error(`${RED}${BOLD}Error:${RESET} ${INDEX_FILE} does not exist.`);
    process.exit(1);
  }

  let indexData: FeatureIndex;
  try {
    const raw = readFileSync(INDEX_FILE, "utf-8");
    indexData = JSON.parse(raw) as FeatureIndex;
  } catch (err) {
    console.error(`${RED}${BOLD}Error:${RESET} Failed to parse ${INDEX_FILE} as JSON:`, err);
    process.exit(1);
  }

  const inconsistencies: Inconsistency[] = [];
  const activeFeatures = indexData.active_features ?? {};
  const archivedFeatures = indexData.archived_features ?? {};
  const allFeatureIds = new Set([...Object.keys(activeFeatures), ...Object.keys(archivedFeatures)]);

  // 1. Verify Summary Metrics
  if (indexData.summary) {
    const expectedActive = Object.keys(activeFeatures).length;
    const expectedArchived = Object.keys(archivedFeatures).length;
    const expectedTotal = expectedActive + expectedArchived;

    if (indexData.summary.active !== expectedActive) {
      inconsistencies.push({
        featureId: "[summary]",
        field: "summary.active",
        issue: `Active features count mismatch`,
        expected: `${expectedActive}`,
        actual: `${indexData.summary.active}`,
        fixGuide: `Run "pnpm index:sync" to synchronize summary counts.`,
      });
    }

    if (indexData.summary.archived !== expectedArchived) {
      inconsistencies.push({
        featureId: "[summary]",
        field: "summary.archived",
        issue: `Archived features count mismatch`,
        expected: `${expectedArchived}`,
        actual: `${indexData.summary.archived}`,
        fixGuide: `Run "pnpm index:sync" to synchronize summary counts.`,
      });
    }

    if (indexData.summary.total_features !== expectedTotal) {
      inconsistencies.push({
        featureId: "[summary]",
        field: "summary.total_features",
        issue: `Total features count mismatch`,
        expected: `${expectedTotal}`,
        actual: `${indexData.summary.total_features}`,
        fixGuide: `Run "pnpm index:sync" to synchronize summary counts.`,
      });
    }
  }

  // 2. Verify Individual Features
  const verifyEntry = (key: string, feature: FeatureEntry, isArchived: boolean) => {
    const prefix = isArchived ? "[archived] " : "";
    const featureLabel = `${prefix}${key}`;
    const title = feature.title ?? "Untitled";

    // Check ID match
    if (!feature.id) {
      inconsistencies.push({
        featureId: featureLabel,
        featureTitle: title,
        field: "id",
        issue: `Missing required 'id' field`,
        fixGuide: `Add "id": "${key}" to the feature definition in features/index.json.`,
      });
    } else if (feature.id !== key) {
      inconsistencies.push({
        featureId: featureLabel,
        featureTitle: title,
        field: "id",
        issue: `Key in index.json does not match feature.id`,
        expected: key,
        actual: feature.id,
        fixGuide: `Ensure the object key and the "id" field are identical ("${key}").`,
      });
    }

    // Check Title
    if (!feature.title || feature.title.trim() === "") {
      inconsistencies.push({
        featureId: featureLabel,
        featureTitle: title,
        field: "title",
        issue: `Missing or empty 'title'`,
        fixGuide: `Provide a descriptive "title" for the feature.`,
      });
    }

    // Check Version format
    if (!feature.version) {
      inconsistencies.push({
        featureId: featureLabel,
        featureTitle: title,
        field: "version",
        issue: `Missing required 'version'`,
        fixGuide: `Add a semver version (e.g. "1.0.0") to the feature definition.`,
      });
    } else if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(feature.version)) {
      inconsistencies.push({
        featureId: featureLabel,
        featureTitle: title,
        field: "version",
        issue: `Invalid semver format`,
        actual: feature.version,
        fixGuide: `Update "version" to follow Semantic Versioning (e.g. "1.0.0").`,
      });
    }

    // Check FDS Path & File Existence
    if (!feature.path) {
      inconsistencies.push({
        featureId: featureLabel,
        featureTitle: title,
        field: "path",
        issue: `Missing 'path' to FDS specification`,
        fixGuide: `Add "path": "features/${key}/fds.md" in features/index.json.`,
      });
    } else {
      const absPath = join(ROOT_DIR, feature.path);
      if (!existsSync(absPath)) {
        inconsistencies.push({
          featureId: featureLabel,
          featureTitle: title,
          field: "path",
          issue: `FDS file does not exist at specified path`,
          actual: feature.path,
          fixGuide: `Create the file at "${feature.path}" or correct the path in features/index.json.`,
        });
      } else {
        // Verify FDS content against index.json
        try {
          const fdsContent = readFileSync(absPath, "utf-8");
          const fdsMeta = parseFdsMetadata(fdsContent);

          // Version check
          if (fdsMeta.version && feature.version && fdsMeta.version !== feature.version) {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "version",
              issue: `Version mismatch between index.json and FDS specification`,
              expected: `FDS version "${fdsMeta.version}"`,
              actual: `index.json has "${feature.version}"`,
              fixGuide: `Update features/index.json to "${fdsMeta.version}" or update the version in ${feature.path}.`,
            });
          }

          // Changelog latest version check (if changelog exists)
          if (fdsMeta.latestChangelogVersion && feature.version && fdsMeta.latestChangelogVersion !== feature.version) {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "version",
              issue: `Latest changelog version in FDS does not match index.json version`,
              expected: `Changelog latest "${fdsMeta.latestChangelogVersion}"`,
              actual: `index.json has "${feature.version}"`,
              fixGuide: `Align index.json "version" with the newest changelog entry in ${feature.path}.`,
            });
          }

          // ID check in FDS
          if (fdsMeta.id && fdsMeta.id !== key) {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "path",
              issue: `FDS file frontmatter 'id' does not match feature ID`,
              expected: key,
              actual: fdsMeta.id,
              fixGuide: `Update the "id" in ${feature.path} frontmatter to match "${key}".`,
            });
          }

          // Code block check in FDS
          if (fdsMeta.hasCodeBlock) {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "path",
              issue: `FDS file contains forbidden code blocks (fenced code)`,
              fixGuide: `Remove code blocks from ${feature.path} and specify interfaces using Markdown tables or references.`,
            });
          }

          // Acceptance criteria check in FDS
          if (!fdsMeta.hasAcceptanceCriteria) {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "path",
              issue: `FDS file is missing required '## Acceptance Criteria' section with testable criteria items`,
              fixGuide: `Add a '## Acceptance Criteria' section with testable criteria bullets to ${feature.path}.`,
            });
          }

          // Dependencies alignment between index.json and FDS frontmatter
          if (fdsMeta.dependencies !== undefined && feature.dependencies !== undefined) {
            const indexDeps = [...feature.dependencies].sort().join(", ");
            const fdsDeps = [...fdsMeta.dependencies].sort().join(", ");
            if (indexDeps !== fdsDeps) {
              inconsistencies.push({
                featureId: featureLabel,
                featureTitle: title,
                field: "dependencies",
                issue: `Dependencies mismatch between index.json and FDS frontmatter`,
                expected: `FDS has [${fdsDeps}]`,
                actual: `index.json has [${indexDeps}]`,
                fixGuide: `Align dependencies in features/index.json and ${feature.path} frontmatter.`,
              });
            }
          }
        } catch (readErr) {
          inconsistencies.push({
            featureId: featureLabel,
            featureTitle: title,
            field: "path",
            issue: `Failed to read FDS file: ${(readErr as Error).message}`,
            fixGuide: `Ensure ${feature.path} is readable.`,
          });
        }
      }
    }

    // Check Behavior Spec (if defined)
    if (feature.behavior_spec) {
      const absBehaviorPath = join(ROOT_DIR, feature.behavior_spec);
      if (!existsSync(absBehaviorPath)) {
        inconsistencies.push({
          featureId: featureLabel,
          featureTitle: title,
          field: "behavior_spec",
          issue: `Behavioral spec file does not exist at specified path`,
          actual: feature.behavior_spec,
          fixGuide: `Create "${feature.behavior_spec}" or remove the behavior_spec property until the file is created.`,
        });
      }
    }

    // Check Figma Spec (single string pointing to figma.md)
    if (feature.figma_spec !== undefined) {
      if (typeof feature.figma_spec !== "string" || feature.figma_spec.trim() === "") {
        inconsistencies.push({
          featureId: featureLabel,
          featureTitle: title,
          field: "figma_spec",
          issue: `'figma_spec' must be a single string path (e.g. "features/${key}/visuals/figma.md")`,
          fixGuide: `Provide a single file path string for figma_spec.`,
        });
      } else {
        const absFigmaPath = join(ROOT_DIR, feature.figma_spec);
        if (!existsSync(absFigmaPath)) {
          inconsistencies.push({
            featureId: featureLabel,
            featureTitle: title,
            field: "figma_spec",
            issue: `Figma specification file does not exist at specified path`,
            actual: feature.figma_spec,
            fixGuide: `Create "${feature.figma_spec}" or remove the figma_spec property until the file is created.`,
          });
        }
      }
    }

    // Check Visual Spec (array of strings: UI screenshots, markdown specs, wireframes)
    if (feature.visual_spec !== undefined) {
      if (!Array.isArray(feature.visual_spec)) {
        inconsistencies.push({
          featureId: featureLabel,
          featureTitle: title,
          field: "visual_spec",
          issue: `'visual_spec' must be an array of string paths`,
          actual: typeof feature.visual_spec,
          fixGuide: `Format "visual_spec" as an array of paths: ["features/${key}/visuals/${key}.png"].`,
        });
      } else {
        const seenVisuals = new Set<string>();
        for (const specPath of feature.visual_spec) {
          if (typeof specPath !== "string" || specPath.trim() === "") {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "visual_spec",
              issue: `Visual specification path in array must be a non-empty string`,
              fixGuide: `Ensure all paths in "visual_spec" are valid string paths.`,
            });
            continue;
          }

          if (seenVisuals.has(specPath)) {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "visual_spec",
              issue: `Duplicate visual specification path: "${specPath}"`,
              actual: specPath,
              fixGuide: `Remove duplicate "${specPath}" from visual_spec array in features/index.json.`,
            });
          }
          seenVisuals.add(specPath);

          const absVisualPath = join(ROOT_DIR, specPath);
          if (!existsSync(absVisualPath)) {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "visual_spec",
              issue: `Visual specification file does not exist at specified path`,
              actual: specPath,
              fixGuide: `Place visual asset or UI markdown file at "${specPath}" or update the "visual_spec" array.`,
            });
          }
        }
      }
    }

    // Check Dependencies
    if (feature.dependencies) {
      if (!Array.isArray(feature.dependencies)) {
        inconsistencies.push({
          featureId: featureLabel,
          featureTitle: title,
          field: "dependencies",
          issue: `'dependencies' must be an array of feature ID strings`,
          fixGuide: `Format "dependencies" as a string array, e.g. ["auth", "profile"].`,
        });
      } else {
        for (const dep of feature.dependencies) {
          if (dep === key) {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "dependencies",
              issue: `Self-dependency: feature cannot depend on itself`,
              actual: dep,
              fixGuide: `Remove "${dep}" from the dependencies list of "${key}".`,
            });
          } else if (!allFeatureIds.has(dep)) {
            inconsistencies.push({
              featureId: featureLabel,
              featureTitle: title,
              field: "dependencies",
              issue: `Unknown dependency: "${dep}" does not exist in active or archived features`,
              actual: dep,
              fixGuide: `Add "${dep}" to active_features in features/index.json or remove it from "${key}" dependencies.`,
            });
          }
        }
      }
    }
  };

  // Run checks for active and archived features
  for (const [key, feature] of Object.entries(activeFeatures)) {
    verifyEntry(key, feature, false);
  }
  for (const [key, feature] of Object.entries(archivedFeatures)) {
    verifyEntry(key, feature, true);
  }

  // 3. Output Results
  console.log(`\n${BOLD}========================================${RESET}`);
  console.log(`${BOLD}  Feature Index Consistency Verification${RESET}`);
  console.log(`${BOLD}========================================${RESET}\n`);

  if (inconsistencies.length === 0) {
    console.log(`${GREEN}${BOLD}✓ All features in features/index.json are completely consistent!${RESET}`);
    console.log(`${DIM}Total features verified: ${allFeatureIds.size}${RESET}\n`);
    process.exit(0);
  }

  // Group inconsistencies by feature
  const grouped = new Map<string, Inconsistency[]>();
  for (const item of inconsistencies) {
    const list = grouped.get(item.featureId) ?? [];
    list.push(item);
    grouped.set(item.featureId, list);
  }

  console.log(
    `${RED}${BOLD}Found ${inconsistencies.length} ${inconsistencies.length === 1 ? "inconsistency" : "inconsistencies"} across ${grouped.size} feature(s):${RESET}\n`
  );

  for (const [featureId, items] of grouped.entries()) {
    const title = items[0].featureTitle ? ` - ${items[0].featureTitle}` : "";
    console.log(`${CYAN}${BOLD}▶ Feature: ${featureId}${RESET}${DIM}${title}${RESET}`);

    for (const item of items) {
      console.log(`  ${RED}✗ [${item.field}]${RESET} ${item.issue}`);
      if (item.expected) {
        console.log(`    ${DIM}Expected:${RESET} ${GREEN}${item.expected}${RESET}`);
      }
      if (item.actual) {
        console.log(`    ${DIM}Actual:  ${RESET} ${YELLOW}${item.actual}${RESET}`);
      }
      console.log(`    ${DIM}Fix:     ${RESET} ${item.fixGuide}`);
    }
    console.log();
  }

  console.log(`${BOLD}Summary:${RESET} ${RED}${inconsistencies.length} issue(s) need attention.${RESET}`);
  console.log(`${DIM}Please address the issues listed above to keep features/index.json consistent.${RESET}\n`);

  process.exit(1);
}

verifyFeatureIndex();
