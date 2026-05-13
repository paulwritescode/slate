import chalk from "chalk";
import type { FixedResource, TierResult } from "../types.js";

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(2);
}

function fmtUsd(n: number): string {
  return `$${fmt(n)}`;
}

function getTierInsight(tier: TierResult, hasFixed: boolean): string {
  const mid = (tier.totalMin + tier.totalMax) / 2;
  const label = tier.label;

  if (label === "0–100" || label === "100–1k") {
    if (mid < 20) return "early-stage serverless — very cheap, expected for this architecture";
    if (mid < 100) return "early-stage — moderate cost, review if any resource is over-provisioned";
    return "early-stage — higher than typical, check for fixed costs or over-provisioning";
  }
  if (label === "1k–10k") {
    if (mid < 100) return "growth stage — still lean, good unit economics";
    if (mid < 500) return "growth stage — normal range for a production serverless app";
    return "growth stage — on the higher side, consider reserved capacity";
  }
  if (label === "10k–100k") {
    if (mid < 1000) return "scale stage — efficient, well-optimized";
    if (mid < 5000) return "scale stage — typical for this user volume";
    return "scale stage — consider caching, CDN, or provisioned capacity";
  }
  if (label === "100k–1M") {
    if (mid < 10000) return "high scale — strong unit economics at volume";
    return "high scale — review architecture for cost optimization opportunities";
  }
  return "";
}

export function renderTable(
  fixed: FixedResource[],
  tiers: TierResult[],
  opts: { freeTierApplied: boolean; emptyFields: number; totalFields: number; region: string },
): string {
  const lines: string[] = [];
  const w = 65;
  const hr = "─".repeat(w - 4);

  lines.push(chalk.cyan("╔" + "═".repeat(w) + "╗"));
  lines.push(chalk.cyan("║") + `  Slate Cost Estimate  │  Region: ${opts.region}  │  IaC: CDK`.padEnd(w) + chalk.cyan("║"));
  lines.push(chalk.cyan("╠" + "═".repeat(w) + "╣"));

  // Fixed costs
  lines.push(chalk.cyan("║") + chalk.bold("  FIXED COSTS").padEnd(w) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));

  if (fixed.length === 0) {
    lines.push(chalk.cyan("║") + chalk.dim("  (none — all resources are usage-based)").padEnd(w) + chalk.cyan("║"));
  }
  for (const r of fixed) {
    const line = `  ${r.description}`.padEnd(w - 12) + chalk.green(`${fmtUsd(r.monthlyUsd)}/mo`);
    lines.push(chalk.cyan("║") + line.padEnd(w) + chalk.cyan("║"));
  }

  const fixedTotal = fixed.reduce((s, r) => s + r.monthlyUsd, 0);
  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + `  Fixed subtotal`.padEnd(w - 12) + chalk.green(`${fmtUsd(fixedTotal)}/mo`) + chalk.cyan("║"));

  lines.push(chalk.cyan("╠" + "═".repeat(w) + "╣"));

  // Variable costs
  lines.push(chalk.cyan("║") + chalk.bold("  VARIABLE COSTS BY TIER").padEnd(w) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + chalk.dim("  (MAU = Monthly Active Users)").padEnd(w) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + "  MAU".padEnd(18) + "Variable Cost".padEnd(20) + "Total".padEnd(w - 38) + chalk.cyan("║"));
  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));

  for (const tier of tiers) {
    const varCost = tier.variableMin === tier.variableMax
      ? fmtUsd(tier.variableMin)
      : `${fmtUsd(tier.variableMin)} – ${fmtUsd(tier.variableMax)}`;
    const total = tier.totalMin === tier.totalMax
      ? `${fmtUsd(tier.totalMin)}/mo`
      : `${fmtUsd(tier.totalMin)} – ${fmtUsd(tier.totalMax)}/mo`;
    const freeMark = tier.variableMin === 0 && opts.freeTierApplied ? " ✦" : "";
    const line = `  ${tier.label}`.padEnd(18) + `${varCost}${freeMark}`.padEnd(20) + total;
    lines.push(chalk.cyan("║") + line.padEnd(w) + chalk.cyan("║"));

    // Contextual insight per tier
    const insight = getTierInsight(tier, fixed.length > 0);
    if (insight) {
      lines.push(chalk.cyan("║") + chalk.dim(`    ↳ ${insight}`).padEnd(w) + chalk.cyan("║"));
    }
  }

  lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));

  if (opts.freeTierApplied) {
    lines.push(chalk.cyan("║") + chalk.dim("  ✦ Free tier applied.").padEnd(w) + chalk.cyan("║"));
  }
  if (opts.emptyFields > 0) {
    lines.push(chalk.cyan("║") + chalk.yellow(`  ⚠ ${opts.emptyFields} of ${opts.totalFields} variable fields empty — ranges are wide.`).padEnd(w) + chalk.cyan("║"));
    lines.push(chalk.cyan("║") + chalk.dim("    Fill more fields to tighten estimates:").padEnd(w) + chalk.cyan("║"));
    lines.push(chalk.cyan("║") + chalk.dim("    Run: npx slate wizard").padEnd(w) + chalk.cyan("║"));
  }

  // Bottom-line summary
  const lowTiers = tiers.filter((t) => t.label === "0–100" || t.label === "100–1k");
  if (lowTiers.length > 0) {
    const minCost = Math.min(...lowTiers.map((t) => t.totalMin));
    const maxCost = Math.max(...lowTiers.map((t) => t.totalMax));
    lines.push(chalk.cyan("║") + `  ${hr}` + " ".repeat(w - hr.length - 2) + chalk.cyan("║"));
    lines.push(chalk.cyan("║") + chalk.green(`  💡 Bottom line: 0–1k users ≈ ${fmtUsd(minCost)} – ${fmtUsd(maxCost)}/mo`).padEnd(w) + chalk.cyan("║"));
    if (fixed.length === 0) {
      lines.push(chalk.cyan("║") + chalk.dim("     No fixed costs — you only pay for what you use.").padEnd(w) + chalk.cyan("║"));
    }
  }

  lines.push(chalk.cyan("╚" + "═".repeat(w) + "╝"));

  return lines.join("\n");
}
