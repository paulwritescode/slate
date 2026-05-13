import { describe, it, expect } from "vitest";
import { classify } from "../../src/classifiers/index.js";
import type { NormalizedResource } from "../../src/types.js";

describe("Classifier", () => {
  const resources: NormalizedResource[] = [
    { id: "MyDB", type: "AWS::RDS::DBInstance", config: { DBInstanceClass: "db.t3.micro", Engine: "mysql", AllocatedStorage: 20 }, region: "us-east-1", stackName: "Test" },
    { id: "MyNat", type: "AWS::EC2::NatGateway", config: {}, region: "us-east-1", stackName: "Test" },
    { id: "Fn1", type: "AWS::Lambda::Function", config: { MemorySize: 256 }, region: "us-east-1", stackName: "Test" },
    { id: "Api", type: "AWS::ApiGateway::RestApi", config: {}, region: "us-east-1", stackName: "Test" },
    { id: "Table", type: "AWS::DynamoDB::Table", config: { BillingMode: "PAY_PER_REQUEST" }, region: "us-east-1", stackName: "Test" },
  ];

  it("classifies fixed resources", () => {
    const { fixed } = classify(resources);
    expect(fixed.length).toBe(2);
    expect(fixed.map((r) => r.type)).toContain("AWS::RDS::DBInstance");
    expect(fixed.map((r) => r.type)).toContain("AWS::EC2::NatGateway");
  });

  it("classifies variable resources", () => {
    const { variable } = classify(resources);
    expect(variable.length).toBe(3);
    expect(variable.map((r) => r.service)).toContain("lambda");
    expect(variable.map((r) => r.service)).toContain("api_gateway");
    expect(variable.map((r) => r.service)).toContain("dynamodb");
  });

  it("deduplicates variable services", () => {
    const duped: NormalizedResource[] = [
      { id: "Fn1", type: "AWS::Lambda::Function", config: {}, region: "us-east-1", stackName: "Test" },
      { id: "Fn2", type: "AWS::Lambda::Function", config: {}, region: "us-east-1", stackName: "Test" },
    ];
    const { variable } = classify(duped);
    expect(variable.length).toBe(1);
  });
});
