import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { CostReport, DriftResult } from "../types.js";

export async function loadPreviousReport(path: string): Promise<CostReport | null> {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return null;
  }
}

export function diffReports(before: CostReport, after: CostReport): DriftResult {
  const beforeFixed = new Set(before.fixedCosts.map((r) => r.id));
  const afterFixed = new Set(after.fixedCosts.map((r) => r.id));

  const added = after.fixedCosts.filter((r) => !beforeFixed.has(r.id)).map((r) => `+ ${r.description} +$${r.monthlyUsd}/mo (fixed)`);
  const removed = before.fixedCosts.filter((r) => !afterFixed.has(r.id)).map((r) => `- ${r.description} -$${r.monthlyUsd}/mo (fixed)`);

  const tierDeltas: DriftResult["tierDeltas"] = {};
  for (const [tier, afterRange] of Object.entries(after.tiers)) {
    const beforeRange = before.tiers[tier] || { min: 0, max: 0 };
    tierDeltas[tier] = {
      before: beforeRange,
      after: afterRange,
      deltaMin: Math.round((afterRange.min - beforeRange.min) * 100) / 100,
      deltaMax: Math.round((afterRange.max - beforeRange.max) * 100) / 100,
    };
  }

  const summaryLines = [...added, ...removed];
  const significantTier = Object.entries(tierDeltas).find(([, d]) => Math.abs(d.deltaMax) > 10);
  if (significantTier) {
    const [label, d] = significantTier;
    summaryLines.push(`${label}: $${d.before.max}/mo → $${d.after.max}/mo (+$${d.deltaMax}/mo)`);
  }

  return {
    addedResources: added,
    removedResources: removed,
    tierDeltas,
    summary: summaryLines.join("\n") || "No significant changes detected.",
  };
}
