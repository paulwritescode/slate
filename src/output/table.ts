import chalk from "chalk";
import type { FixedResource, TierResult } from "../types.js";

export function renderTable(
  fixed: FixedResource[],
  tiers: TierResult[],
  opts: { freeTierApplied: boolean; emptyFields: number; totalFields: number; region: string },
): string {
  const lines: string[] = [];
  const w = 65;
  const hr = "─".repeat(w - 4);

  lines.push(chalk.cyan("╔" + "═".repeat(w) + "╗"));
  lines.push(chalk.cyan("║") + `  AWS IaC Cost Estimate  │  Region: ${opts.region}  │  IaC: CDK`.padEnd(w) + chalk.cyan("║"));
  lines.push(chalk.cyan("╠" + "═".repeat(w) + "╣"));

  // Fixed costs
  lines.push(chalk.cyan("║") + chalk.bold("  FIXED COSTS").padEnd(w) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));

  for (const r of fixed) {
    const line = `  ${r.description}`.padEnd(w - 12) + chalk.green(`$${r.monthlyUsd.toFixed(2)}/mo`);
    lines.push(chalk.cyan("║") + line.padEnd(w) + chalk.cyan("║"));
  }

  const fixedTotal = fixed.reduce((s, r) => s + r.monthlyUsd, 0);
  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + `  Fixed subtotal`.padEnd(w - 12) + chalk.green(`$${fixedTotal.toFixed(2)}/mo`) + chalk.cyan("║"));

  lines.push(chalk.cyan("╠" + "═".repeat(w) + "╣"));

  // Variable costs
  lines.push(chalk.cyan("║") + chalk.bold("  VARIABLE COSTS BY TIER").padEnd(w) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + "  Users".padEnd(18) + "Variable Cost".padEnd(20) + "Total".padEnd(w - 38) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));

  for (const tier of tiers) {
    const varCost = tier.variableMin === tier.variableMax
      ? `$${tier.variableMin}`
      : `$${tier.variableMin} – $${tier.variableMax}`;
    const total = tier.totalMin === tier.totalMax
      ? `$${tier.totalMin}/mo`
      : `$${tier.totalMin} – $${tier.totalMax}/mo`;
    const freeMark = tier.variableMin === 0 && opts.freeTierApplied ? " ✦" : "";
    const line = `  ${tier.label}`.padEnd(18) + `${varCost}${freeMark}`.padEnd(20) + total;
    lines.push(chalk.cyan("║") + line.padEnd(w) + chalk.cyan("║"));
  }

  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));

  if (opts.freeTierApplied) {
    lines.push(chalk.cyan("║") + chalk.dim("  ✦ Free tier applied.").padEnd(w) + chalk.cyan("║"));
  }
  if (opts.emptyFields > 0) {
    lines.push(chalk.cyan("║") + chalk.yellow(`  ⚠ ${opts.emptyFields} of ${opts.totalFields} variable fields empty.`).padEnd(w) + chalk.cyan("║"));
    lines.push(chalk.cyan("║") + chalk.dim("    Run: npx slate wizard → fill interactively").padEnd(w) + chalk.cyan("║"));
  }

  lines.push(chalk.cyan("╚" + "═".repeat(w) + "╝"));

  return lines.join("\n");
}

