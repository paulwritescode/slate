import type { FixedResource, VariableResource, TierResult, Config, TrafficProfile } from "../types.js";
import { DEFAULT_TIERS } from "../types.js";
import { getFreeTierForService } from "../pricing/free-tier.js";

// Unit prices (from AWS Price List API defaults for us-east-1)
const PRICING: Record<string, (fields: Record<string, number>) => number> = {
  lambda: (f) => {
    const invocations = f.invocations_per_user_per_month || 0;
    const durationMs = f.avg_duration_ms || 250;
    const memoryGb = 0.5; // default 512MB from plan
    const computeGbS = invocations * (durationMs / 1000) * memoryGb;
    const invocationCost = invocations * 0.0000002; // $0.20 per 1M
    const computeCost = computeGbS * 0.0000166667;
    return invocationCost + computeCost;
  },
  api_gateway: (f) => {
    const calls = f.calls_per_user_per_month || 0;
    return calls * 0.0000035; // REST: $3.50 per 1M
  },
  dynamodb: (f) => {
    const reads = f.reads_per_user_per_month || 0;
    const writes = f.writes_per_user_per_month || 0;
    const readCost = reads * 0.00000025; // $0.25 per 1M RRU
    const writeCost = writes * 0.00000125; // $1.25 per 1M WRU
    return readCost + writeCost;
  },
  s3: (f) => {
    const puts = f.put_requests_per_user_per_month || 0;
    const gets = f.get_requests_per_user_per_month || 0;
    const putCost = puts * 0.000005; // $0.005 per 1K
    const getCost = gets * 0.0000004; // $0.0004 per 1K
    return putCost + getCost;
  },
  cloudfront: (f) => {
    const requests = f.requests_per_user_per_month || 0;
    return requests * 0.000001; // $0.01 per 10K
  },
  cognito: (f) => {
    const mauPct = f.mau_percentage || 0;
    // $0.0055 per MAU after 10K free
    return (mauPct / 100) * 0.0055;
  },
  sqs: (f) => {
    const messages = f.messages_per_user_per_month || 0;
    return messages * 0.0000004; // $0.40 per 1M
  },
  sns: (f) => {
    const notifications = f.notifications_per_user_per_month || 0;
    return notifications * 0.0000005; // $0.50 per 1M
  },
  step_functions: (f) => {
    const executions = f.executions_per_user_per_month || 0;
    const transitions = f.avg_state_transitions_per_execution || 5;
    return executions * transitions * 0.000025; // $0.025 per 1K transitions
  },
  eventbridge: (f) => {
    const events = f.events_per_user_per_month || 0;
    return events * 0.000001; // $1.00 per 1M
  },
  secrets_manager: (f) => {
    const calls = f.api_calls_per_user_per_month || 0;
    return calls * 0.000005; // $0.05 per 10K
  },
};

export function calculateTiers(
  fixed: FixedResource[],
  variable: VariableResource[],
  config: Config,
  freeTierEnabled: boolean,
  profile?: TrafficProfile,
): TierResult[] {
  const tiers = config.tiers || DEFAULT_TIERS;
  const fixedTotal = fixed.reduce((sum, r) => sum + r.monthlyUsd, 0);

  return tiers.map((tier) => {
    let variableMin = 0;
    let variableMax = 0;

    for (const v of variable) {
      const serviceProfile = profile?.[v.service] as Record<string, number | null | undefined> | undefined;
      const hasExactValues = serviceProfile && Object.values(serviceProfile).some((val) => val !== null && val !== undefined);

      if (hasExactValues && PRICING[v.service]) {
        // Use exact calculation from profile values
        const fields: Record<string, number> = {};
        for (const [k, val] of Object.entries(serviceProfile!)) {
          if (typeof val === "number") fields[k] = val;
        }
        const perUser = PRICING[v.service](fields);
        let cost = perUser * tier.users;

        if (freeTierEnabled) {
          const allowances = getFreeTierForService(v.service);
          for (const a of allowances) {
            // Deduct free tier from total usage, then re-price
            cost = Math.max(0, cost - a.monthlyAmount * perUser * 0.001);
          }
        }

        // Exact: min = max
        variableMin += cost;
        variableMax += cost;
      } else {
        // Fallback: use min/max range
        let minCost = v.minPerUser * tier.users;
        let maxCost = v.maxPerUser * tier.users;

        if (freeTierEnabled) {
          const allowances = getFreeTierForService(v.service);
          for (const a of allowances) {
            minCost = Math.max(0, minCost - a.monthlyAmount * v.minPerUser * 0.001);
            maxCost = Math.max(0, maxCost - a.monthlyAmount * v.maxPerUser * 0.0001);
          }
        }

        variableMin += minCost;
        variableMax += maxCost;
      }
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
