export interface NormalizedResource {
  id: string;
  type: string;
  config: Record<string, unknown>;
  region: string;
  stackName: string;
}

export interface FixedResource {
  id: string;
  type: string;
  description: string;
  monthlyUsd: number;
  region: string;
  attributes: Record<string, unknown>;
}

export interface VariableResource {
  id: string;
  type: string;
  service: string;
  yamlFields: YamlField[];
  minPerUser: number;
  maxPerUser: number;
  unitPrice: number;
  region: string;
}

export interface YamlField {
  path: string;
  description: string;
  example: string;
  rangeDescription: string;
}

export interface TierResult {
  label: string;
  users: number;
  fixedTotal: number;
  variableMin: number;
  variableMax: number;
  totalMin: number;
  totalMax: number;
}

export interface CostReport {
  generatedAt: string;
  region: string;
  iac: string;
  fixedCosts: FixedResource[];
  variableCosts: Record<string, { minPerUser: number; maxPerUser: number }>;
  tiers: Record<string, { min: number; max: number }>;
  freeTierApplied: boolean;
  budgetGate?: { tier: string; threshold: number; passed: boolean };
  drift?: DriftResult;
}

export interface DriftResult {
  addedResources: string[];
  removedResources: string[];
  tierDeltas: Record<string, { before: { min: number; max: number }; after: { min: number; max: number }; deltaMin: number; deltaMax: number }>;
  summary: string;
}

export interface Config {
  region: string;
  iac: string;
  tiers: { label: string; users: number }[];
  budget?: { tier: string; max_monthly_usd: number; use: "min" | "midpoint" | "max" };
}

export interface TrafficProfile {
  [service: string]: Record<string, number | string | boolean | null | undefined>;
}

export const DEFAULT_TIERS = [
  { label: "0–100", users: 100 },
  { label: "100–1k", users: 1000 },
  { label: "1k–10k", users: 10000 },
  { label: "10k–100k", users: 100000 },
  { label: "100k–1M", users: 1000000 },
];
