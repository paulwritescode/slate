import type { NormalizedResource, FixedResource, VariableResource } from "../types.js";

const FIXED_TYPES: Record<string, (r: NormalizedResource) => FixedResource | null> = {
  "AWS::EC2::Instance": (r) => ({
    id: r.id,
    type: r.type,
    description: `EC2 ${r.config.InstanceType || "unknown"}`,
    monthlyUsd: 0, // filled by pricing
    region: r.region,
    attributes: { instanceType: r.config.InstanceType },
  }),
  "AWS::RDS::DBInstance": (r) => ({
    id: r.id,
    type: r.type,
    description: `RDS ${r.config.DBInstanceClass || "unknown"} (${r.config.MultiAZ ? "Multi-AZ" : "Single-AZ"}, ${r.config.AllocatedStorage || 20}GB)`,
    monthlyUsd: 0,
    region: r.region,
    attributes: {
      instanceClass: r.config.DBInstanceClass,
      engine: r.config.Engine,
      multiAZ: r.config.MultiAZ || false,
      storageGb: r.config.AllocatedStorage || 20,
    },
  }),
  "AWS::ECS::Service": (r) => ({
    id: r.id,
    type: r.type,
    description: `ECS Fargate Service`,
    monthlyUsd: 0,
    region: r.region,
    attributes: { config: r.config },
  }),
  "AWS::ElastiCache::CacheCluster": (r) => ({
    id: r.id,
    type: r.type,
    description: `ElastiCache ${r.config.CacheNodeType || "unknown"}`,
    monthlyUsd: 0,
    region: r.region,
    attributes: { nodeType: r.config.CacheNodeType, numNodes: r.config.NumCacheNodes || 1 },
  }),
  "AWS::EC2::NatGateway": (r) => ({
    id: r.id,
    type: r.type,
    description: `NAT Gateway`,
    monthlyUsd: 32.85, // $0.045/hr × 730
    region: r.region,
    attributes: {},
  }),
  "AWS::OpenSearchService::Domain": (r) => ({
    id: r.id,
    type: r.type,
    description: `OpenSearch Domain`,
    monthlyUsd: 0,
    region: r.region,
    attributes: { config: r.config },
  }),
  "AWS::ElasticLoadBalancingV2::LoadBalancer": (r) => ({
    id: r.id,
    type: r.type,
    description: `${(r.config.Type as string)?.toUpperCase() || "ALB"}`,
    monthlyUsd: 16.43, // ~$0.0225/hr × 730
    region: r.region,
    attributes: { type: r.config.Type || "application" },
  }),
  "AWS::EKS::Cluster": (r) => ({
    id: r.id,
    type: r.type,
    description: `EKS Control Plane`,
    monthlyUsd: 73.0, // $0.10/hr × 730
    region: r.region,
    attributes: {},
  }),
  "AWS::Route53::HostedZone": (r) => ({
    id: r.id,
    type: r.type,
    description: `Route 53 Hosted Zone`,
    monthlyUsd: 0.5,
    region: r.region,
    attributes: {},
  }),
};

const VARIABLE_SERVICES: Record<string, { service: string; minPerUser: number; maxPerUser: number }> = {
  "AWS::Lambda::Function": { service: "lambda", minPerUser: 0.00012, maxPerUser: 0.0058 },
  "AWS::ApiGateway::RestApi": { service: "api_gateway", minPerUser: 0.000105, maxPerUser: 0.0021 },
  "AWS::ApiGatewayV2::Api": { service: "api_gateway", minPerUser: 0.00003, maxPerUser: 0.0006 },
  "AWS::DynamoDB::Table": { service: "dynamodb", minPerUser: 0.00031, maxPerUser: 0.0082 },
  "AWS::S3::Bucket": { service: "s3", minPerUser: 0.00005, maxPerUser: 0.002 },
  "AWS::CloudFront::Distribution": { service: "cloudfront", minPerUser: 0.00004, maxPerUser: 0.002 },
  "AWS::Cognito::UserPool": { service: "cognito", minPerUser: 0.0, maxPerUser: 0.005 },
  "AWS::SQS::Queue": { service: "sqs", minPerUser: 0.000002, maxPerUser: 0.00008 },
  "AWS::SNS::Topic": { service: "sns", minPerUser: 0.000001, maxPerUser: 0.000025 },
  "AWS::StepFunctions::StateMachine": { service: "step_functions", minPerUser: 0.000075, maxPerUser: 0.0075 },
  "AWS::Events::Rule": { service: "eventbridge", minPerUser: 0.000005, maxPerUser: 0.0002 },
  "AWS::SecretsManager::Secret": { service: "secrets_manager", minPerUser: 0.000005, maxPerUser: 0.00015 },
};

export function classify(resources: NormalizedResource[]): { fixed: FixedResource[]; variable: VariableResource[] } {
  const fixed: FixedResource[] = [];
  const variable: VariableResource[] = [];
  const seenServices = new Set<string>();

  for (const resource of resources) {
    const fixedFn = FIXED_TYPES[resource.type];
    if (fixedFn) {
      const result = fixedFn(resource);
      if (result) fixed.push(result);
      continue;
    }

    const varInfo = VARIABLE_SERVICES[resource.type];
    if (varInfo && !seenServices.has(varInfo.service)) {
      seenServices.add(varInfo.service);
      variable.push({
        id: resource.id,
        type: resource.type,
        service: varInfo.service,
        yamlFields: [],
        minPerUser: varInfo.minPerUser,
        maxPerUser: varInfo.maxPerUser,
        unitPrice: 0,
        region: resource.region,
      });
    }
  }

  return { fixed, variable };
}
