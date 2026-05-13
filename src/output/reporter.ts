import { writeFile } from "node:fs/promises";
import type { CostReport, FixedResource, VariableResource, TierResult, DriftResult } from "../types.js";

const REPORT_PATH = ".slate-report.json";

export async function writeReport(opts: {
  fixed: FixedResource[];
  variable: VariableResource[];
  tiers: TierResult[];
  region: string;
  freeTierApplied: boolean;
  drift?: DriftResult;
  budgetGate?: { tier: string; threshold: number; passed: boolean };
}): Promise<CostReport> {
  const report: CostReport = {
    generatedAt: new Date().toISOString(),
    region: opts.region,
    iac: "cdk",
    fixedCosts: opts.fixed,
    variableCosts: Object.fromEntries(
      opts.variable.map((v) => [v.service, { minPerUser: v.minPerUser, maxPerUser: v.maxPerUser }]),
    ),
    tiers: Object.fromEntries(
      opts.tiers.map((t) => [t.label, { min: t.totalMin, max: t.totalMax }]),
    ),
    freeTierApplied: opts.freeTierApplied,
    budgetGate: opts.budgetGate,
    drift: opts.drift,
  };

  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
  return report;
}

export { REPORT_PATH };
