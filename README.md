# slate

> You used AI to write your infrastructure. Now know exactly what it costs — before you deploy.

A zero-config CLI tool that reads your `cdk synth` output, calls the AWS Price List API for real prices, and produces a tiered cost estimate table across user growth scenarios.

## Why

AI-assisted IaC development generates working infrastructure fast — but a single configuration decision (NAT Gateway, multi-AZ RDS, DynamoDB billing mode change) can shift monthly costs by hundreds of dollars silently. This tool makes that visible before you deploy.

## How It Works

```
cdk synth → CDK Adapter → Classifier → AWS Price List API → Free Tier Deduction → Calculator → Output
```

1. **CDK Adapter** — reads `cdk.out/manifest.json` + CloudFormation templates, normalizes resources
2. **Classifier** — categorizes each resource as Fixed (exact price from plan) or Variable (scales with users)
3. **Pricing Client** — calls AWS Price List API for region-accurate unit prices (never hardcoded)
4. **Free Tier** — deducts AWS Free Tier allowances for accurate low-tier estimates
5. **Calculator** — multiplies variable costs across user growth tiers
6. **Output** — renders tier table, generates `cost-profile.yaml`, writes report JSON

## Features

- **Zero config** — works immediately after `cdk synth` with no setup
- **Real prices** — all costs from AWS Price List API, never hardcoded
- **Tiered output** — costs shown across 0–100, 100–1k, 1k–10k, 10k–100k, 100k–1M users
- **Free tier modeling** — accurate $0 estimates at low usage (`--no-free-tier` to disable)
- **Cost drift detection** — diffs between runs show what changed and by how much
- **Interactive wizard** — guided CLI to fill in usage assumptions field by field
- **CI/CD budget gate** — exits code 1 if cost exceeds threshold
- **MCP server** — expose cost tools to AI editors (Kiro, VS Code, Continue)
- **Multi-region** — prices resources at their deployed region, not a default

## Supported Resources

**Fixed cost** (priced exactly from plan):
EC2, RDS, Aurora Provisioned, ECS Fargate, ElastiCache, NAT Gateway, OpenSearch, ALB/NLB, EKS Control Plane, MSK, WAF WebACL, Transfer Family, Route 53, Kinesis (provisioned)

**Variable cost** (scales with users, generates `cost-profile.yaml` fields):
Lambda, API Gateway, DynamoDB, S3, CloudFront, Cognito, SQS, SNS, Step Functions, EventBridge, Secrets Manager, Bedrock, EKS Nodegroups, Aurora Serverless v2, WAF requests, Kinesis (on-demand), Transfer Family data

## Quick Start

```bash
# Install
npm install --save-dev slate

# Run
npx cdk synth
npx slate estimate

# Interactive wizard to refine estimates
npx slate wizard
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `slate estimate` | Full pipeline — reads cdk.out/, outputs tier table |
| `slate estimate --ci` | CI mode — exits 1 on budget failure, includes drift |
| `slate estimate --no-free-tier` | Disable free tier deductions |
| `slate estimate --json` | Output as JSON |
| `slate wizard` | Interactive profile wizard |
| `slate drift` | Show drift between last two reports |
| `slate init` | Create config file with defaults |

## Configuration

`slate.config.json`:

```json
{
  "region": "us-east-1",
  "iac": "cdk",
  "budget": {
    "tier": "1k-10k",
    "max_monthly_usd": 500,
    "use": "midpoint"
  }
}
```

## The Precision Dial

`cost-profile.yaml` is generated with fields for your detected variable resources. Fill in what you know — leave blank what you don't.

| Fields filled | Output |
|---------------|--------|
| None | All variable costs shown as min–max range |
| Some | Filled fields exact, empty fields ranged |
| All | Every line item exact |

## Requirements

- Node.js 18+
- AWS CDK installed with `cdk synth` working
- IAM permission: `pricing:GetProducts`

## Tech Stack

TypeScript, ESM, Commander, @aws-sdk/client-pricing, @inquirer/prompts, js-yaml, chalk, tsup, vitest

## License

MIT
