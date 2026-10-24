import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

export const codeQualityAnalyzer: AgentDefinition = {
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  description: 'This agent analyzes code for security vulnerabilities, performance issues, and maintainability concerns.',
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
};
