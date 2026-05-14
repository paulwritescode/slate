import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { readCdkOut } from "../adapters/cdk.js";
import { classify } from "../classifiers/index.js";
import { createPricingClient, priceFixedResources } from "../pricing/client.js";
import { calculateTiers } from "../calculator/tiers.js";
import { loadPreviousReport, diffReports } from "../calculator/drift.js";
import { readCostProfile, writeCostProfile, generateCostProfile, countEmptyFields } from "../output/yaml.js";
import { writeReport, REPORT_PATH } from "../output/reporter.js";
import { loadConfig } from "../config.js";
import type { TrafficProfile } from "../types.js";

interface McpRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

const TOOLS: McpTool[] = [
  {
    name: "estimate_cost",
    description: "Run the full cost estimation pipeline and return tier table as JSON",
    inputSchema: { type: "object", properties: { noFreeTier: { type: "boolean", description: "Disable free tier deductions" } } },
  },
  {
    name: "get_cost_profile",
    description: "Return current cost-profile.yaml contents",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_cost_profile_field",
    description: "Set a single field value in cost-profile.yaml",
    inputSchema: { type: "object", properties: { service: { type: "string" }, field: { type: "string" }, value: { type: "number" } }, required: ["service", "field", "value"] },
  },
  {
    name: "get_drift_report",
    description: "Return the drift diff between the last two runs",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_top_cost_drivers",
    description: "Return the top N cost line items at a specified tier",
    inputSchema: { type: "object", properties: { tier: { type: "string", description: "Tier label e.g. '1k-10k'" }, limit: { type: "number" } } },
  },
];

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "estimate_cost": {
      if (!existsSync("cdk.out")) return { error: "cdk.out/ not found. Run `cdk synth` first." };
      const config = await loadConfig();
      const resources = await readCdkOut("cdk.out");
      const { fixed, variable } = classify(resources);
      let pricedFixed = fixed;
      try {
        pricedFixed = await priceFixedResources(createPricingClient(), fixed);
      } catch { /* use fallbacks */ }
      const profile = await generateCostProfile(variable);
      const freeTierEnabled = !args.noFreeTier;
      const tiers = calculateTiers(pricedFixed, variable, config, freeTierEnabled, profile);
      await writeReport({ fixed: pricedFixed, variable, tiers, region: config.region, freeTierApplied: freeTierEnabled });
      return { fixed: pricedFixed, tiers, region: config.region };
    }
    case "get_cost_profile": {
      const profile = await readCostProfile();
      const { empty, total } = countEmptyFields(profile);
      return { profile, empty, total };
    }
    case "update_cost_profile_field": {
      const { service, field, value } = args as { service: string; field: string; value: number };
      const profile = await readCostProfile();
      if (!profile[service]) profile[service] = {} as any;
      (profile[service] as Record<string, unknown>)[field] = value;
      await writeCostProfile(profile);
      return { success: true, service, field, value };
    }
    case "get_drift_report": {
      const report = await loadPreviousReport(REPORT_PATH);
      if (!report) return { error: "No previous report found. Run estimate first." };
      return report.drift || { message: "No drift data. Run estimate twice to see drift." };
    }
    case "get_top_cost_drivers": {
      const report = await loadPreviousReport(REPORT_PATH);
      if (!report) return { error: "No report found." };
      const limit = (args.limit as number) || 5;
      const drivers = report.fixedCosts
        .sort((a, b) => b.monthlyUsd - a.monthlyUsd)
        .slice(0, limit)
        .map((r) => ({ resource: r.description, monthlyUsd: r.monthlyUsd }));
      return { drivers };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function respond(id: number | string, result: unknown) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function respondError(id: number | string, code: number, message: string) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function startMcpServer(): Promise<void> {
  // stdio transport for MCP
  process.stdin.setEncoding("utf-8");
  let buffer = "";

  process.stdin.on("data", async (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const req: McpRequest = JSON.parse(line);
        let response: string;

        switch (req.method) {
          case "initialize":
            response = respond(req.id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "slate", version: "0.1.0" } });
            break;
          case "tools/list":
            response = respond(req.id, { tools: TOOLS });
            break;
          case "tools/call": {
            const { name, arguments: args } = req.params as { name: string; arguments: Record<string, unknown> };
            const result = await handleToolCall(name, args || {});
            response = respond(req.id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
            break;
          }
          default:
            response = respondError(req.id, -32601, `Method not found: ${req.method}`);
        }

        process.stdout.write(response + "\n");
      } catch (err) {
        process.stdout.write(respondError(0, -32700, "Parse error") + "\n");
      }
    }
  });
}
