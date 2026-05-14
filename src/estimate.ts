import { existsSync } from "node:fs";
import chalk from "chalk";
import { readCdkOut } from "./adapters/cdk.js";
import { classify } from "./classifiers/index.js";
import { createPricingClient, priceFixedResources } from "./pricing/client.js";
import { calculateTiers } from "./calculator/tiers.js";
import { loadPreviousReport, diffReports } from "./calculator/drift.js";
import { generateCostProfile, countEmptyFields } from "./output/yaml.js";
import { renderTable } from "./output/table.js";
import { writeReport, REPORT_PATH } from "./output/reporter.js";
import { loadConfig } from "./config.js";
import type { DriftResult } from "./types.js";

export interface EstimateOptions {
  ci?: boolean;
  noFreeTier?: boolean;
  json?: boolean;
}

export async function runEstimate(opts: EstimateOptions = {}): Promise<void> {
  const config = await loadConfig();
  const cdkOutPath = "cdk.out";

  if (!existsSync(cdkOutPath)) {
    console.error(chalk.red("\n  ✗ cdk.out/ not found.\n"));
    console.error(chalk.dim("    Run `cdk synth` to generate your CloudFormation output,"));
    console.error(chalk.dim("    then run `slate estimate` again.\n"));
    process.exit(1);
  }

  // Step 1: Read CDK output
  const resources = await readCdkOut(cdkOutPath);
  if (resources.length === 0) {
    console.error(chalk.yellow("\n  ⚠ No AWS resources found in cdk.out/\n"));
    console.error(chalk.dim("    Check that your CDK app defines at least one stack with resources."));
    console.error(chalk.dim("    Run `cdk synth` and verify cdk.out/ contains template files.\n"));
    return;
  }

  // Step 2: Classify
  const { fixed, variable } = classify(resources);

  // Step 3: Price fixed resources via AWS Price List API
  let pricedFixed = fixed;
  try {
    const client = createPricingClient();
    pricedFixed = await priceFixedResources(client, fixed);
  } catch (err) {
    console.error(chalk.yellow("  ⚠ Could not reach AWS Price List API. Using fallback prices."));
    console.error(chalk.dim(`    ${(err as Error).message}`));
  }

  // Step 4: Generate cost-profile.yaml for variable resources
  const profile = await generateCostProfile(variable);
  const { empty, total } = countEmptyFields(profile);

  // Step 5: Calculate tiers (uses profile values for exact pricing when available)
  const freeTierEnabled = !opts.noFreeTier;
  const tiers = calculateTiers(pricedFixed, variable, config, freeTierEnabled, profile);

  // Step 6: Drift detection
  let drift: DriftResult | undefined;
  const previousReport = await loadPreviousReport(REPORT_PATH);
  if (previousReport) {
    const currentReport = {
      generatedAt: new Date().toISOString(),
      region: config.region,
      iac: "cdk",
      fixedCosts: pricedFixed,
      variableCosts: Object.fromEntries(variable.map((v) => [v.service, { minPerUser: v.minPerUser, maxPerUser: v.maxPerUser }])),
      tiers: Object.fromEntries(tiers.map((t) => [t.label, { min: t.totalMin, max: t.totalMax }])),
      freeTierApplied: freeTierEnabled,
    };
    drift = diffReports(previousReport, currentReport as any);
  }

  // Step 7: Budget gate
  let budgetGate: { tier: string; threshold: number; passed: boolean } | undefined;
  if (config.budget) {
    const targetTier = tiers.find((t) => t.label.replace(/[–—]/g, "-").includes(config.budget!.tier.replace(/[–—]/g, "-")));
    if (targetTier) {
      const estimate = config.budget.use === "min" ? targetTier.totalMin
        : config.budget.use === "max" ? targetTier.totalMax
        : (targetTier.totalMin + targetTier.totalMax) / 2;
      budgetGate = { tier: config.budget.tier, threshold: config.budget.max_monthly_usd, passed: estimate <= config.budget.max_monthly_usd };
    }
  }

  // Step 8: Write report
  await writeReport({ fixed: pricedFixed, variable, tiers, region: config.region, freeTierApplied: freeTierEnabled, drift, budgetGate });

  // Step 9: Output
  if (opts.json) {
    const report = await import("node:fs/promises").then((fs) => fs.readFile(REPORT_PATH, "utf-8"));
    console.log(report);
  } else {
    console.log(renderTable(pricedFixed, tiers, { freeTierApplied: freeTierEnabled, emptyFields: empty, totalFields: total, region: config.region }));

    if (drift && (drift.addedResources.length > 0 || drift.removedResources.length > 0)) {
      console.log(chalk.yellow("\n  COST DRIFT:"));
      console.log(chalk.dim(`  ${drift.summary}`));
    }

    if (budgetGate && !budgetGate.passed) {
      console.log(chalk.red(`\n  ✗ BUDGET GATE FAILED`));
      console.log(chalk.red(`    Tier: ${budgetGate.tier} | Threshold: $${budgetGate.threshold}/mo`));
    }
  }

  // Exit code 1 for CI if budget gate fails
  if (opts.ci && budgetGate && !budgetGate.passed) {
    process.exit(1);
  }
}
