import { describe, it, expect } from "vitest";
import { calculateTiers } from "../../src/calculator/tiers.js";
import type { FixedResource, VariableResource, Config } from "../../src/types.js";
import { DEFAULT_TIERS } from "../../src/types.js";

describe("Calculator", () => {
  const config: Config = { region: "us-east-1", iac: "cdk", tiers: DEFAULT_TIERS };

  const fixed: FixedResource[] = [
    { id: "db", type: "AWS::RDS::DBInstance", description: "RDS db.t3.micro", monthlyUsd: 15.33, region: "us-east-1", attributes: {} },
  ];

  const variable: VariableResource[] = [
    { id: "fn", type: "AWS::Lambda::Function", service: "lambda", yamlFields: [], minPerUser: 0.00012, maxPerUser: 0.0058, unitPrice: 0, region: "us-east-1" },
  ];

  it("produces correct number of tiers", () => {
    const tiers = calculateTiers(fixed, variable, config, false);
    expect(tiers.length).toBe(5);
  });

  it("fixed total is consistent across tiers", () => {
    const tiers = calculateTiers(fixed, variable, config, false);
    for (const tier of tiers) {
      expect(tier.fixedTotal).toBe(15.33);
    }
  });

  it("variable costs scale with users", () => {
    const tiers = calculateTiers(fixed, variable, config, false);
    expect(tiers[0].variableMax).toBeLessThan(tiers[4].variableMax);
  });

  it("total = fixed + variable", () => {
    const tiers = calculateTiers(fixed, variable, config, false);
    for (const tier of tiers) {
      expect(tier.totalMin).toBe(Math.round((tier.fixedTotal + tier.variableMin) * 100) / 100);
    }
  });
});
