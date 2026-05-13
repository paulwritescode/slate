export interface FreeTierAllowance {
  service: string;
  dimension: string;
  monthlyAmount: number;
  always: boolean;
}

export const FREE_TIER: FreeTierAllowance[] = [
  { service: "lambda", dimension: "requests", monthlyAmount: 1_000_000, always: true },
  { service: "lambda", dimension: "compute_gb_seconds", monthlyAmount: 400_000, always: true },
  { service: "api_gateway", dimension: "requests", monthlyAmount: 1_000_000, always: false },
  { service: "dynamodb", dimension: "reads", monthlyAmount: 1_000_000, always: true },
  { service: "dynamodb", dimension: "writes", monthlyAmount: 1_000_000, always: true },
  { service: "dynamodb", dimension: "storage_gb", monthlyAmount: 25, always: true },
  { service: "s3", dimension: "storage_gb", monthlyAmount: 5, always: false },
  { service: "s3", dimension: "get_requests", monthlyAmount: 20_000, always: false },
  { service: "s3", dimension: "put_requests", monthlyAmount: 2_000, always: false },
  { service: "cloudfront", dimension: "data_transfer_gb", monthlyAmount: 1_000, always: true },
  { service: "cloudfront", dimension: "requests", monthlyAmount: 10_000_000, always: true },
  { service: "cognito", dimension: "mau", monthlyAmount: 10_000, always: true },
  { service: "sqs", dimension: "requests", monthlyAmount: 1_000_000, always: true },
  { service: "sns", dimension: "publishes", monthlyAmount: 1_000_000, always: true },
  { service: "step_functions", dimension: "transitions", monthlyAmount: 4_000, always: true },
];

export function getFreeTierForService(service: string): FreeTierAllowance[] {
  return FREE_TIER.filter((ft) => ft.service === service);
}

export function applyFreeTierDeduction(
  usage: number,
  allowance: number,
): number {
  return Math.max(0, usage - allowance);
}

export function getFreeTierCoveredServices(services: string[]): string[] {
  return services.filter((s) => FREE_TIER.some((ft) => ft.service === s));
}
