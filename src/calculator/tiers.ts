import type { FixedResource, VariableResource, TierResult, Config } from "../types.js";
import { DEFAULT_TIERS } from "../types.js";
import { getFreeTierForService, applyFreeTierDeduction } from "../pricing/free-tier.js";

export function calculateTiers(
  fixed: FixedResource[],
  variable: VariableResource[],
  config: Config,
  freeTierEnabled: boolean,
): TierResult[] {
  const tiers = config.tiers || DEFAULT_TIERS;
  const fixedTotal = fixed.reduce((sum, r) => sum + r.monthlyUsd, 0);

  return tiers.map((tier) => {
    let variableMin = 0;
    let variableMax = 0;

    for (const v of variable) {
      let minUsage = v.minPerUser * tier.users;
      let maxUsage = v.maxPerUser * tier.users;

      if (freeTierEnabled) {
        const allowances = getFreeTierForService(v.service);
        if (allowances.length > 0) {
          const totalAllowance = allowances.reduce((s, a) => s + a.monthlyAmount, 0);
          // Simplified: apply free tier as a cost deduction proportional to usage
          const minCostBeforeFreeTier = minUsage;
          const maxCostBeforeFreeTier = maxUsage;
          minUsage = applyFreeTierDeduction(minCostBeforeFreeTier, totalAllowance * v.minPerUser);
          maxUsage = applyFreeTierDeduction(maxCostBeforeFreeTier, totalAllowance * v.maxPerUser * 0.1);
        }
      }

      variableMin += minUsage;
      variableMax += maxUsage;
    }

    variableMin = Math.round(variableMin * 100) / 100;
    variableMax = Math.round(variableMax * 100) / 100;

    return {
      label: tier.label,
      users: tier.users,
      fixedTotal: Math.round(fixedTotal * 100) / 100,
      variableMin,
      variableMax,
      totalMin: Math.round((fixedTotal + variableMin) * 100) / 100,
      totalMax: Math.round((fixedTotal + variableMax) * 100) / 100,
    };
  });
}
