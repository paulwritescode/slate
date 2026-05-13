import { describe, it, expect } from "vitest";
import { readCdkOut } from "../../src/adapters/cdk.js";
import { join } from "node:path";

describe("CDK Adapter", () => {
  const fixturePath = join(import.meta.dirname, "../../fixtures/cdk-out-simple");

  it("reads manifest and extracts resources", async () => {
    const resources = await readCdkOut(fixturePath);
    expect(resources.length).toBe(8);
  });

  it("parses region from environment", async () => {
    const resources = await readCdkOut(fixturePath);
    expect(resources[0].region).toBe("us-east-1");
  });

  it("extracts resource types correctly", async () => {
    const resources = await readCdkOut(fixturePath);
    const types = resources.map((r) => r.type);
    expect(types).toContain("AWS::RDS::DBInstance");
    expect(types).toContain("AWS::Lambda::Function");
    expect(types).toContain("AWS::DynamoDB::Table");
  });

  it("attaches stack name", async () => {
    const resources = await readCdkOut(fixturePath);
    expect(resources.every((r) => r.stackName === "TestStack")).toBe(true);
  });
});
