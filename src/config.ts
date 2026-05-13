import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { Config } from "./types.js";
import { DEFAULT_TIERS } from "./types.js";

const CONFIG_PATH = "iac-cost.config.json";

const DEFAULT_CONFIG: Config = {
  region: "us-east-1",
  iac: "cdk",
  tiers: DEFAULT_TIERS,
};

export async function loadConfig(): Promise<Config> {
  if (!existsSync(CONFIG_PATH)) return DEFAULT_CONFIG;
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function initConfig(): Promise<void> {
  if (existsSync(CONFIG_PATH)) {
    console.log(`  ${CONFIG_PATH} already exists.`);
    return;
  }
  const content = JSON.stringify(
    {
      region: "us-east-1",
      iac: "cdk",
      tiers: DEFAULT_TIERS,
      budget: { tier: "1k-10k", max_monthly_usd: 500, use: "midpoint" },
    },
    null,
    2,
  );
  await writeFile(CONFIG_PATH, content, "utf-8");
  console.log(`  ✓ Created ${CONFIG_PATH}`);
}
