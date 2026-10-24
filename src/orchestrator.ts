import { query, AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { mcpServersConfig } from './config/mcp.config.js';
import { codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester } from './agents/index.js';
import { ORCHESTRATOR_PROMPT } from './prompts/orchestrator.prompt.js';
import { ReviewReport, ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import path from "path";
import { fileURLToPath } from 'url';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
}

async function* generateMessages(userMessage: string) {
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: userMessage },
    parent_tool_use_id: null,
    session_id: "orchestrator-session",
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {

  constructor(options: OrchestratorOptions = {}) {
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const orchestratorPrompt = ORCHESTRATOR_PROMPT
      .replace('{owner}', owner)
      .replace('{repo}', repo)
      .replace('{prNumber}', prNumber.toString());

    const subagents: Record<string, AgentDefinition> = {
      "code-quality-analyzer": codeQualityAnalyzer,
      "test-coverage-analyzer": testCoverageAnalyzer,
      "refactoring-suggester": refactoringSuggester,
    };
    //const subagents = [codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester];

    const startTime = Date.now();
    const elapsed = () => `Time elapsed so far: ${((Date.now() - startTime) / 1000).toFixed(1)} s`;    

    // Stream execution using the precise options layout required
    for await (const message of query({
      prompt: generateMessages(orchestratorPrompt),
      options: {
        cwd: PROJECT_ROOT,
        settingSources: ["project"],
        mcpServers: mcpServersConfig,
        allowedTools: ['Skill', 'Task', 'mcp__github__*', 'mcp__eslint__*'],
        agents: subagents,
        model: process.env.ANTHROPIC_MODEL,
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema,
        },
        maxTurns: 15,
      },
    })) {
        if (message.type === "system" && message.subtype === "init") {
          console.log("Available MCP servers:", message.mcp_servers);
        }

        // as any here is explicit, the SDK typing system does not yet know about parent_tool_use_id
        if (message.type === "assistant") {
          const content = message.message?.content;
          if ((message as any).parent_tool_use_id) {
            console.log(`  [${elapsed()}](running inside subagent)`, content);
          }
    
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "tool_use" && block.name === "Task") {
                const input = block.input as { description?: string };
                console.log(`[${elapsed()}] Invoking subagent - ${input.description || "task"} `, block);
              }
            }
          }
        } else if (message.type === "result" && message.subtype === "success" && message.structured_output) {
          console.log(`[${elapsed()}] DONE`);
          return ReviewReportSchema.parse(message.structured_output);
        } else if (message.type === "result") {
          throw new Error(`Qualification failed: ${message.subtype} `);
        }
      }

  throw new Error("Failed to receive a valid response.");
  }
}
