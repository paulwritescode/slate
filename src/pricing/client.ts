import { PricingClient, GetProductsCommand } from "@aws-sdk/client-pricing";
import type { FixedResource } from "../types.js";

const REGION_TO_LOCATION: Record<string, string> = {
  "us-east-1": "US East (N. Virginia)",
  "us-east-2": "US East (Ohio)",
  "us-west-1": "US West (N. California)",
  "us-west-2": "US West (Oregon)",
  "eu-west-1": "Europe (Ireland)",
  "eu-west-2": "Europe (London)",
  "eu-central-1": "Europe (Frankfurt)",
  "ap-southeast-1": "Asia Pacific (Singapore)",
  "ap-southeast-2": "Asia Pacific (Sydney)",
  "ap-northeast-1": "Asia Pacific (Tokyo)",
  "ap-south-1": "Asia Pacific (Mumbai)",
  "sa-east-1": "South America (Sao Paulo)",
  "ca-central-1": "Canada (Central)",
};

const cache = new Map<string, number>();

export function createPricingClient(): PricingClient {
  return new PricingClient({ region: "us-east-1" });
}

export async function priceFixedResources(
  client: PricingClient,
  resources: FixedResource[],
): Promise<FixedResource[]> {
  const priced: FixedResource[] = [];

  for (const resource of resources) {
    const price = await getResourcePrice(client, resource);
    priced.push({ ...resource, monthlyUsd: price || resource.monthlyUsd });
  }

  return priced;
}

async function getResourcePrice(client: PricingClient, resource: FixedResource): Promise<number | null> {
  const { type, attributes, region } = resource;

  if (type === "AWS::EC2::NatGateway") return 32.85;
  if (type === "AWS::EKS::Cluster") return 73.0;
  if (type === "AWS::Route53::HostedZone") return 0.5;
  if (type === "AWS::ElasticLoadBalancingV2::LoadBalancer") return 16.43;

  const cacheKey = `${type}:${JSON.stringify(attributes)}:${region}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  try {
    const price = await fetchFromPriceListApi(client, type, attributes, region);
    if (price !== null) cache.set(cacheKey, price);
    return price;
  } catch {
    return null;
  }
}

async function fetchFromPriceListApi(
  client: PricingClient,
  type: string,
  attributes: Record<string, unknown>,
  region: string,
): Promise<number | null> {
  const location = REGION_TO_LOCATION[region] || REGION_TO_LOCATION["us-east-1"];
  let serviceCode: string;
  const filters: { Type: "TERM_MATCH"; Field: string; Value: string }[] = [
    { Type: "TERM_MATCH", Field: "location", Value: location },
  ];

  switch (type) {
    case "AWS::EC2::Instance":
      serviceCode = "AmazonEC2";
      filters.push(
        { Type: "TERM_MATCH", Field: "instanceType", Value: String(attributes.instanceType || "t3.micro") },
        { Type: "TERM_MATCH", Field: "operatingSystem", Value: "Linux" },
        { Type: "TERM_MATCH", Field: "tenancy", Value: "Shared" },
        { Type: "TERM_MATCH", Field: "preInstalledSw", Value: "NA" },
        { Type: "TERM_MATCH", Field: "capacitystatus", Value: "Used" },
      );
      break;
    case "AWS::RDS::DBInstance":
      serviceCode = "AmazonRDS";
      filters.push(
        { Type: "TERM_MATCH", Field: "instanceType", Value: String(attributes.instanceClass || "db.t3.micro") },
        { Type: "TERM_MATCH", Field: "databaseEngine", Value: mapRdsEngine(String(attributes.engine || "mysql")) },
        { Type: "TERM_MATCH", Field: "deploymentOption", Value: attributes.multiAZ ? "Multi-AZ" : "Single-AZ" },
      );
      break;
    case "AWS::ElastiCache::CacheCluster":
      serviceCode = "AmazonElastiCache";
      filters.push(
        { Type: "TERM_MATCH", Field: "instanceType", Value: String(attributes.nodeType || "cache.t3.micro") },
      );
      break;
    default:
      return null;
  }

  const command = new GetProductsCommand({ ServiceCode: serviceCode, Filters: filters, MaxResults: 1 });
  const response = await client.send(command);

  if (!response.PriceList?.length) return null;

  const priceItem = JSON.parse(response.PriceList[0]);
  const onDemand = priceItem.terms?.OnDemand;
  if (!onDemand) return null;

  const termKey = Object.keys(onDemand)[0];
  const priceDimensions = onDemand[termKey].priceDimensions;
  const dimKey = Object.keys(priceDimensions)[0];
  const hourlyPrice = parseFloat(priceDimensions[dimKey].pricePerUnit.USD);

  let monthly = hourlyPrice * 730;

  // Add storage for RDS
  if (type === "AWS::RDS::DBInstance") {
    const storageGb = Number(attributes.storageGb) || 20;
    monthly += storageGb * 0.115; // gp2 storage
  }

  return Math.round(monthly * 100) / 100;
}

function mapRdsEngine(engine: string): string {
  const map: Record<string, string> = {
    mysql: "MySQL",
    postgres: "PostgreSQL",
    mariadb: "MariaDB",
    "aurora-mysql": "Aurora MySQL",
    "aurora-postgresql": "Aurora PostgreSQL",
  };
  return map[engine.toLowerCase()] || engine;
}
