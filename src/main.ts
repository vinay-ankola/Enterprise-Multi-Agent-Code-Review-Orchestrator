import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator, logger, ReviewError } from './utils/index.js';
import { formatError } from './utils/index.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // TODO: Validate command line arguments
  // - Check if owner, repo, and prStr are provided
  // - Convert prStr to number and validate it's a valid integer
  // - Exit with error message if validation fails

  // - Check if owner, repo, and prStr are provided
  if (!owner || !repo || !prStr) {
    console.error('\n❌ Error: Missing command line arguments.');
    console.log('Usage: npm run dev <owner> <repo> <pr-number>');
    console.log('Example: npm run dev udacity cd14715-simple-todo-app 1\n');
    process.exit(1);
  }

  // - Convert prStr to number and validate it's a valid integer
  const prNumber = parseInt(prStr, 10);
  if (isNaN(prNumber) || prNumber <= 0 || !Number.isInteger(prNumber)) {
    console.error(`\n❌ Error: Provided PR parameter "${prStr}" is not a valid positive integer identifier.\n`);
    process.exit(1);
  }

  // ✅ Validate GitHub authentication
  if (!process.env.GITHUB_TOKEN) {
    console.error('\n❌ Error: Missing GITHUB_TOKEN environment variable.');
    console.log('Create a GitHub token with repository read access and set GITHUB_TOKEN before running.');
    process.exit(1);
  }
  // TODO: Validate authentication (choose ONE method)
  // Students must have either:
  //   - ANTHROPIC_API_KEY environment variable, OR
  //   - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY for Bedrock
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  //
  // If using AWS Bedrock:
  //   - Verify AWS_REGION is set
  //   - Log: "🔐 Using AWS Bedrock authentication"
  // If using Anthropic API:
  //   - Log: "🔐 Using Anthropic API authentication"
  // If neither method is configured:
  //   - Exit with clear error message showing both options
    if (!hasAnthropicKey) {
    console.error('\n❌ Error: Missing ANTHROPIC_API_KEY environment variable.');
    console.log('Please supply ANTHROPIC_API_KEY via environment variables.\n');
    process.exit(1);
  }

  if (hasAnthropicKey) {
      logger.info('🔐 Using Anthropic API authentication');
  }

  // TODO: Validate ANTHROPIC_MODEL environment variable
  // This is REQUIRED for both authentication methods
  // - For AWS Bedrock: us.anthropic.claude-sonnet-4-5-20250929-v1:0
  // - For Anthropic API: claude-sonnet-4-5-20250929
  // Exit with error if not set
  if (!process.env.ANTHROPIC_MODEL) {
    console.error('\n❌ Error: ANTHROPIC_MODEL environment variable is required but not set.');
    console.log('For Anthropic API: claude-sonnet-4-5-20250929\n');
    process.exit(1);
  }

  logger.info(`ANTHROPIC_MODEL environment variable error resolved: "${process.env.ANTHROPIC_MODEL}"`);
  // logger.info(`start here: ${owner}/${repo} #PR:${prNumber}`);
  console.log('start here', owner, repo, prStr)
  try {
    // TODO: Create orchestrator instance
    const orchestrator = new CodeReviewOrchestrator();

    // TODO: Call .reviewPullRequest(owner, repo, prNumber);
    const evaluationReport = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    // TODO: Generate formatted reports using ReportGenerator
    // Hint: Use ReportGenerator to create Markdown, HTML, and JSON reports
    // Save reports to 'reports/' directory with appropriate filenames
    const targetOutputDirectory = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(targetOutputDirectory)) {
      fs.mkdirSync(targetOutputDirectory, { recursive: true });
    }

    const reportBasename = `${owner}_${repo}_${prNumber}`;

    const generator = new ReportGenerator();

    // Save reports to 'reports/' directory with appropriate filenames
    // Format 1: Structural JSON Schema Data Map
    const jsonPayload = generator.generateJSONReport(evaluationReport);
    fs.writeFileSync(
      path.join(targetOutputDirectory, `${reportBasename}.json`), 
      jsonPayload, 
      'utf-8'
    );

    // Format 2: Rendered Markdown Document Template Representation
    const markdownPayload = generator.generateMarkdownReport(evaluationReport);
    fs.writeFileSync(
      path.join(targetOutputDirectory, `${reportBasename}.md`), 
      markdownPayload, 
      'utf-8'
    );

    // Format 3: Rendered styled native HTML page preview sheet
    const htmlPayload = generator.generateHTMLReport(evaluationReport);
    fs.writeFileSync(
      path.join(targetOutputDirectory, `${reportBasename}.html`), 
      htmlPayload, 
      'utf-8'
    );

    // Log success messages showing where reports were saved
    logger.info('Analysis steps finished successfully. Output files saved:');
    console.log(`JSON Report -> reports/${reportBasename}.json`);
    console.log(`Markdown    -> reports/${reportBasename}.md`);
    console.log(`HTML Sheet  -> reports/${reportBasename}.html\n`);    

  } catch (error) {
    // console.error('Error:', error);
    console.error(`\n❌ Review failed: ${formatError(error)}`);
    console.log('Please check your token, model name, repository owner, repository name, and PR number.');
    process.exit(1);
  }
}

main();



