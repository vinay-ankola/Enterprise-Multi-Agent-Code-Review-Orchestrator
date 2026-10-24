import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

export const refactoringSuggester: AgentDefinition = {
  prompt: REFACTORING_SUGGESTER_PROMPT,
  description: 'This agent identifies opportunities to improve code structure and modernize patterns.',
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
};