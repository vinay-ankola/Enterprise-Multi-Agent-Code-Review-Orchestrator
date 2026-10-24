import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

export const testCoverageAnalyzer: AgentDefinition = {
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  description: 'This agent evaluates test completeness and suggests specific test cases.',
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
};