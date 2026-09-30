#!/usr/bin/env node --experimental-strip-types
// ==============================================================================
// Sync Feature Index
//
// Automatically recalculates summary metrics (total, active, archived)
// in features/index.json based on active_features and archived_features.
//
// Usage:
//   pnpm index:sync
// ==============================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(SCRIPT_DIR, "..");
const INDEX_FILE = join(ROOT_DIR, "features", "index.json");

interface FeatureIndex {
  $schema?: string;
  project: string;
  last_updated: string;
  summary?: {
    total_features: number;
    active: number;
    archived: number;
  };
  active_features: Record<string, unknown>;
  archived_features: Record<string, unknown>;
}

function syncIndex() {
  const content = readFileSync(INDEX_FILE, "utf-8");
  const data = JSON.parse(content) as FeatureIndex;

  const activeCount = Object.keys(data.active_features ?? {}).length;
  const archivedCount = Object.keys(data.archived_features ?? {}).length;
  const totalCount = activeCount + archivedCount;
  const today = new Date().toISOString().split("T")[0];

  const updatedData: FeatureIndex = {
    $schema: data.$schema,
    project: data.project,
    last_updated: today,
    summary: {
      total_features: totalCount,
      active: activeCount,
      archived: archivedCount,
    },
    active_features: data.active_features ?? {},
    archived_features: data.archived_features ?? {},
  };

  writeFileSync(INDEX_FILE, JSON.stringify(updatedData, null, 2) + "\n", "utf-8");
  console.log(`Synced ${INDEX_FILE}: ${totalCount} total features (${activeCount} active, ${archivedCount} archived).`);
}

syncIndex();
