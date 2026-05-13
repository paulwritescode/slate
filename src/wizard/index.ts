import { input } from "@inquirer/prompts";
import { readCostProfile, writeCostProfile } from "../output/yaml.js";

interface FieldMeta {
  description: string;
  example: string;
  rangeDescription: string;
}

const FIELD_METADATA: Record<string, FieldMeta> = {
  "lambda.invocations_per_user_per_month": {
    description: "How many times does a single user trigger a Lambda per month?",
    example: "120 (e.g. ~4 API calls/day)",
    rangeDescription: "assumes 10 (min) to 500 (max) invocations/user/month",
  },
  "lambda.avg_duration_ms": {
    description: "Average Lambda execution time in milliseconds.",
    example: "250 (typical API handler doing a DB read)",
    rangeDescription: "assumes 100ms (min) to 3000ms (max)",
  },
  "api_gateway.calls_per_user_per_month": {
    description: "Total API Gateway requests one user makes per month.",
    example: "200 (moderately active web app user)",
    rangeDescription: "assumes 30 (min) to 600 (max) calls/user/month",
  },
  "api_gateway.avg_response_size_kb": {
    description: "Average response payload in KB.",
    example: "15",
    rangeDescription: "assumes 5KB (min) to 50KB (max)",
  },
  "dynamodb.reads_per_user_per_month": {
    description: "Number of item reads one user triggers per month.",
    example: "500",
    rangeDescription: "assumes 50 (min) to 2000 (max) reads/user/month",
  },
  "dynamodb.writes_per_user_per_month": {
    description: "Number of item writes one user triggers per month.",
    example: "80",
    rangeDescription: "assumes 10 (min) to 200 (max) writes/user/month",
  },
  "dynamodb.avg_item_size_kb": {
    description: "Average DynamoDB item size in KB.",
    example: "2",
    rangeDescription: "assumes 0.5KB (min) to 10KB (max)",
  },
  "dynamodb.storage_gb_per_1000_users": {
    description: "How much storage (GB) grows per 1,000 users.",
    example: "0.5",
    rangeDescription: "assumes 0.1GB (min) to 5GB (max) per 1000 users",
  },
  "s3.storage_gb_per_1000_users": {
    description: "S3 storage (GB) added per 1,000 users.",
    example: "1.2",
    rangeDescription: "assumes 0.01GB (min) to 2GB (max) per user",
  },
  "s3.put_requests_per_user_per_month": {
    description: "Upload/write operations per user per month.",
    example: "20",
    rangeDescription: "assumes 5 (min) to 100 (max) PUTs/user/month",
  },
  "s3.get_requests_per_user_per_month": {
    description: "Download/read operations per user per month.",
    example: "60",
    rangeDescription: "assumes 20 (min) to 500 (max) GETs/user/month",
  },
  "s3.data_transfer_out_gb_per_1000_users": {
    description: "Outbound data (GB) per 1,000 users per month.",
    example: "3",
    rangeDescription: "assumes 0.5GB (min) to 20GB (max) per 1000 users",
  },
  "cognito.mau_percentage": {
    description: "% of total users active in a given month (0–100).",
    example: "70",
    rangeDescription: "assumes 30% (min) to 90% (max) MAU",
  },
  "sqs.messages_per_user_per_month": {
    description: "Average SQS messages enqueued per user per month.",
    example: "50",
    rangeDescription: "assumes 5 (min) to 200 (max) messages/user/month",
  },
  "sns.notifications_per_user_per_month": {
    description: "Notifications sent per user per month.",
    example: "10",
    rangeDescription: "assumes 2 (min) to 50 (max) notifications/user/month",
  },
  "eventbridge.events_per_user_per_month": {
    description: "Events published to EventBridge per user per month.",
    example: "20",
    rangeDescription: "assumes 5 (min) to 200 (max) events/user/month",
  },
};

export async function runWizard(): Promise<void> {
  const profile = await readCostProfile();
  const emptyFields: { service: string; field: string; path: string }[] = [];

  for (const [service, fields] of Object.entries(profile)) {
    if (!fields || typeof fields !== "object") continue;
    for (const [field, value] of Object.entries(fields)) {
      if (value === null || value === undefined) {
        emptyFields.push({ service, field, path: `${service}.${field}` });
      }
    }
  }

  if (emptyFields.length === 0) {
    console.log("\n  ✓ All fields in cost-profile.yaml are already filled.\n");
    return;
  }

  console.log(`\n  Found ${emptyFields.length} empty field(s). Let's fill them in.`);
  console.log("  Press Enter to skip any field and keep the min–max range.\n");

  for (const { service, field, path } of emptyFields) {
    const meta = FIELD_METADATA[path];
    if (!meta) continue;

    console.log(`\n  ┌─ ${path}`);
    console.log(`  │  ${meta.description}`);
    console.log(`  │  Example: ${meta.example}`);
    console.log(`  │  If skipped: ${meta.rangeDescription}`);

    const answer = await input({ message: "  └─ Your value (or Enter to skip):" });

    if (answer.trim() !== "") {
      const serviceObj = profile[service] as Record<string, unknown>;
      serviceObj[field] = parseFloat(answer);
    }
  }

  await writeCostProfile(profile);
  console.log("\n  ✓ cost-profile.yaml updated.\n");
}
