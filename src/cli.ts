import { Command } from "commander";
import { runEstimate } from "./estimate.js";
import { runWizard } from "./wizard/index.js";
import { initConfig } from "./config.js";
import { loadPreviousReport, diffReports } from "./calculator/drift.js";
import { REPORT_PATH } from "./output/reporter.js";

const program = new Command();

program
  .name("slate")
  .description("Pre-deploy AWS cost estimation for CDK infrastructure")
  .version("0.1.0");

program
  .command("estimate")
  .description("Run full cost estimation pipeline")
  .option("--ci", "CI mode — exit 1 on budget failure")
  .option("--no-free-tier", "Disable free tier deductions")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    await runEstimate({
      ci: opts.ci,
      noFreeTier: !opts.freeTier,
      json: opts.json,
    });
  });

program
  .command("wizard")
  .description("Interactive profile wizard to fill cost-profile.yaml")
  .action(async () => {
    await runWizard();
  });

program
  .command("drift")
  .description("Show cost drift between last two reports")
  .action(async () => {
    const report = await loadPreviousReport(REPORT_PATH);
    if (!report) {
      console.log("  No previous report found. Run `slate estimate` first.");
      return;
    }
    if (report.drift) {
      console.log("\n  COST DRIFT:");
      console.log(`  ${report.drift.summary}`);
    } else {
      console.log("  No drift data available. Run estimate twice to see drift.");
    }
  });

program
  .command("init")
  .description("Create iac-cost.config.json with defaults")
  .action(async () => {
    await initConfig();
  });

program.parse();
