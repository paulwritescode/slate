# I Built a CLI to Show Me What My AI-Generated Infrastructure Actually Costs

Last month I asked an AI assistant to set up a VPC with a private subnet for my side project. It did exactly what I asked. Clean CDK code, proper security groups, everything synthesized on the first try. What it didn't mention was the NAT Gateway it added to route traffic from the private subnet. That's $32.85/month for a project with twelve users. I found out when the bill arrived.

That moment — staring at a line item I never consciously chose — is what led me to build Slate.

## The Problem Is Specific and Getting Worse

AI-assisted infrastructure development is fast. You describe what you want, you get working CDK or Terraform code, you deploy. The feedback loop between "I need a database" and "here's a running RDS instance" has collapsed to minutes. But the cost feedback loop hasn't changed at all. You still find out what things cost when the bill arrives, or when you remember to check the pricing calculator manually.

The issue isn't that AI tools generate expensive infrastructure. It's that they generate infrastructure where cost is invisible at decision time. A few examples I've hit personally:

A NAT Gateway added for private subnet internet access: $32.85/month. Sounds small until you realize it's a fixed cost that exists whether you have zero users or ten thousand.

Multi-AZ RDS enabled by default on a pre-revenue project: that doubles your database cost from $15.33/month to $30.66/month for redundancy you don't need yet.

DynamoDB provisioned mode instead of on-demand for a table that handles 50 requests per day: you're paying for capacity you'll never touch at early scale, and the cost profile inverts completely once you hit thousands of users.

None of these are wrong decisions in the right context. But they're decisions that should be made consciously, with the cost visible at the time you're writing the code.

## What Slate Does

Slate reads your `cdk synth` output, calls the AWS Price List API for real prices, and produces a tiered cost estimate across user growth scenarios. No configuration required. If `cdk synth` works, Slate works — it uses the same AWS credentials.

```bash
npx cdk synth
npx slate estimate
```

The output looks like this:

```
╔══════════════════════════════════════════════╗
║  Slate  │  Region: us-east-1  │  CDK         ║
╠══════════════════════════════════════════════╣
║  FIXED COSTS                                  ║
║  RDS db.t3.micro             $15.33/mo        ║
║  NAT Gateway (1)             $32.85/mo        ║
╠══════════════════════════════════════════════╣
║  Users        Variable    Total               ║
║  0 – 100      $0 ✦        $48 /mo            ║
║  100 – 1k     $2 – $18    $50 – $66 /mo      ║
║  1k – 10k     $18 – $155  $66 – $203 /mo     ║
╚══════════════════════════════════════════════╝
```

The ✦ means free tier was applied. At low usage, your Lambda invocations and DynamoDB reads cost literally nothing — Slate models that accurately instead of pretending every request costs money from day one.

## Fixed vs Variable: The Core Distinction

Every resource in your stack falls into one of two categories. Fixed resources cost the same whether you have one user or one million: an RDS instance, a NAT Gateway, an EKS control plane. Variable resources scale with usage: Lambda invocations, API Gateway requests, DynamoDB reads and writes, S3 storage.

This distinction is the intellectual core of the tool. Fixed costs are your floor — you pay them the moment you deploy, regardless of traffic. Variable costs define your ceiling at each growth stage. Slate classifies every resource it finds in your CloudFormation template, prices the fixed ones exactly, and models the variable ones across five user tiers from 0 to 1 million.

The result is that you can look at your infrastructure and immediately answer: "What does this cost me with no users? What does it cost at 10k users? Where does the cost curve bend?"

## The Precision Dial

Slate generates a `cost-profile.yaml` file with fields for every variable resource it detects. You don't have to fill it in. If you leave it empty, variable costs show as a min–max range. If you fill in some fields — say, you know each user makes about 200 API calls per month — those fields become exact and the rest stay ranged.

```yaml
traffic_profile:
  lambda:
    invocations_per_user_per_month: 120
    avg_duration_ms: 250
  api_gateway:
    calls_per_user_per_month: 200
  dynamodb:
    reads_per_user_per_month: 500
    writes_per_user_per_month: 80
```

The tool never blocks you. More input just narrows the estimate. You can run `npx slate wizard` for an interactive walkthrough that asks about each field one at a time, or you can edit the YAML directly. Either way, the next `slate estimate` run uses whatever you've provided.

## Cost Drift Detection

This is the CI/CD feature. Slate saves a report JSON after each run. On subsequent runs, it diffs the current estimate against the previous one and shows what changed:

```
COST DRIFT:
+ NAT Gateway +$32.85/mo (fixed)
1k–10k: $171/mo → $203/mo (+$32/mo)
```

In CI, you configure a budget threshold. If the estimate exceeds it, Slate exits with code 1 and your pipeline fails. The GitHub Actions workflow posts the cost table as a PR comment, so reviewers see the cost impact of infrastructure changes before they merge.

```yaml
budget:
  tier: "1k-10k"
  max_monthly_usd: 500
  use: "midpoint"
```

This turns cost into a first-class review criterion. Not a surprise on next month's bill — a visible number on every pull request that touches infrastructure.

## Technical Decisions

Three choices I made while building this that I think are worth sharing.

First: Slate never hardcodes prices. Every fixed resource gets priced through the AWS Price List API at the region where it's actually deployed. Prices change, regions differ, and a tool that bakes in numbers becomes wrong silently. The only exception is a handful of simple resources (NAT Gateway, Route 53 hosted zones) where the pricing is stable enough that a fallback makes sense when the API is unreachable.

Second: the credentials story. If `cdk synth` works on your machine, Slate works too. It needs exactly one IAM permission — `pricing:GetProducts` — and it uses whatever credentials are already configured in your environment. No separate auth setup, no service accounts, no config file pointing at an AWS profile. This was a deliberate choice to make adoption zero-friction.

Third: a quirk of the AWS Pricing API that took me longer than I'd like to admit to figure out. The Pricing API endpoint only exists in `us-east-1`. It doesn't matter what region your resources are deployed in — you always call the API in us-east-1 and pass the target region as a filter parameter. The API returns prices for any region, but the endpoint itself is always Virginia. Every other AWS service has regional endpoints. This one doesn't.

## What's Next

The immediate roadmap includes Terraform support (reading `.tfplan` JSON instead of `cdk.out`), Pulumi adapter, and richer variable cost modeling for services like Aurora Serverless v2 where the scaling curve isn't linear. I'm also working on a `--watch` mode that re-estimates live as you iterate on your CDK code.

If you're writing infrastructure with AI assistance — or even without it — and you want to know what it costs before you deploy:

```bash
npm install --save-dev slate
npx cdk synth
npx slate estimate
```

That's it. Three commands, real prices, no config.
