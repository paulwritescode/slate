import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NormalizedResource } from "../types.js";

interface CdkManifest {
  artifacts: Record<string, CdkArtifact>;
}

interface CdkArtifact {
  type: string;
  environment?: string;
  properties?: { templateFile?: string };
}

export async function readCdkOut(cdkOutPath: string): Promise<NormalizedResource[]> {
  const manifestPath = join(cdkOutPath, "manifest.json");
  const manifest: CdkManifest = JSON.parse(await readFile(manifestPath, "utf-8"));
  const resources: NormalizedResource[] = [];

  for (const [stackName, artifact] of Object.entries(manifest.artifacts)) {
    if (artifact.type !== "aws:cloudformation:stack") continue;

    const region = parseRegion(artifact.environment) || "us-east-1";
    const templateFile = artifact.properties?.templateFile;
    if (!templateFile) continue;

    const templatePath = join(cdkOutPath, templateFile);
    const template = JSON.parse(await readFile(templatePath, "utf-8"));
    const cfnResources = template.Resources || {};

    for (const [logicalId, resource] of Object.entries(cfnResources)) {
      const r = resource as { Type: string; Properties?: Record<string, unknown> };
      resources.push({
        id: logicalId,
        type: r.Type,
        config: r.Properties || {},
        region,
        stackName,
      });
    }
  }

  return resources;
}

function parseRegion(environment?: string): string | undefined {
  if (!environment) return undefined;
  // Format: aws://ACCOUNT/REGION
  const match = environment.match(/aws:\/\/[^/]+\/(.+)/);
  return match?.[1];
}
