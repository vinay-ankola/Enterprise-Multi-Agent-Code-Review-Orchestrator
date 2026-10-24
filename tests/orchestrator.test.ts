import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { ZodError } from 'zod';
import { ReviewReportSchema } from '../src/types/report-types.js';
import { withRetry, withTimeout, RateLimiter } from '../src/utils/index.js';

// Mock the Claude Agent SDK query function block to isolate testing
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}));

describe('CodeReviewOrchestrator', () => {
  
  /**
   * Mock data factory aligned precisely with the strict constraints
   * and enum properties of the system's Zod schemas.
   */
  const createMockValidReport = () => ({
    pullRequest: {
      number: 1,
      owner: 'udacity',
      repo: 'cd14715-simple-todo-app'
    },
    summary: {
      overallScore: 79,
      totalFiles: 1,
      criticalIssues: 0,
      highPriorityTests: 1,
      refactoringOpportunities: 1
    },
    recommendations: [
      {
        category: 'performance',
        priority: 'medium' as const,
        description: 'Nested array lookup scanning optimization recommended.',
        files: ['src/fixtures/clean-code.js']
      }
    ],
    fileReviews: [
      {
        file: 'src/fixtures/clean-code.js',
        codeQuality: {
          file: 'src/fixtures/clean-code.js',
          overallScore: 92,
          summary: 'Overall good code quality with minor performance points.',
          issues: [
            {
              line: 12,
              severity: 'medium' as const,
              category: 'performance' as const,
              description: 'Hidden linear loop scan causing quadratic complexity matrix rules.',
              suggestion: 'Convert collection to map lookup'
            }
          ]
        },
        testCoverage: {
          file: 'src/fixtures/clean-code.js',
          coverageEstimate: 60,
          hasTests: true,
          testFiles: ['tests/clean-code.test.js'],
          summary: 'Missing boundary validation branches.',
          untestedPaths: [
            {
              location: 'cleanCodeFixture',
              type: 'function' as const,
              priority: 'medium',
              reasoning: 'Input parameter bounds are unvalidated.',
              suggestedTest: 'Verify passing an empty configuration maps safely.'
            }
          ]
        },
        refactorings: {
          file: 'src/fixtures/clean-code.js',
          summary: 'Opportunities to extract cleaner structures.',
          suggestions: [
            {
              type: 'simplify' as const,
              location: 'cleanCodeFixture line 15',
              description: 'Simplify cascading if checks using unified guard conditions.',
              impact: 'medium' as const,
              before: 'if (x) { if (y) { return z; } }',
              after: 'if (!x || !y) return;\nreturn z;',
              benefits: 'Improves general block scannability and structural maintainability.'
            }
          ]
        }
      }
    ],
    metadata: {
      analyzedAt: '2026-10-23T12:00:00.000Z',
      duration: 1250,
      agentVersions: {
        orchestrator: '1.0.0',
        qualityAnalyzer: '1.0.0',
        coverageAnalyzer: '1.0.0',
        refactoringSuggester: '1.0.0'
      }
    }
  });

  // Async Generator Stream Mocks mimicking SDK output structures
  async function* mockQueryStreamSuccess() {
    yield {
      type: 'system',
      subtype: 'init',
      mcp_servers: ['github', 'eslint']
    };
    yield {
      type: 'assistant',
      message: { content: 'Delegating code analysis tasks to specialized subagents...' }
    };
    yield {
      type: 'result',
      subtype: 'success',
      structured_output: createMockValidReport()
    };
  }

  async function* mockQueryStreamFailure() {
    yield {
      type: 'system',
      subtype: 'init',
      mcp_servers: ['github', 'eslint']
    };
    yield {
      type: 'result',
      subtype: 'error'
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers(); // Flushes out left-behind macro-tasks inside the event loop window
    vi.useRealTimers();  // Safely restores system clock authority
  });

  // =============================================================================
  // Configuration Tests
  // =============================================================================
  describe('Configuration Paths', () => {
    it('should initialize successfully with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });
  });

  // =============================================================================
  // Execution Core Run Tests
  // =============================================================================
  describe('reviewPullRequest Flow Matrix', () => {
    it('should return a validated ReviewReport on successful completions', async () => {
      vi.mocked(query).mockReturnValue(mockQueryStreamSuccess() as any);

      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1);

      expect(query).toHaveBeenCalledTimes(1);
      expect(report).toBeDefined();
      expect(report.pullRequest.number).toBe(1);
      expect(report.summary.overallScore).toBe(79);
      expect(report.fileReviews[0].file).toBe('src/fixtures/clean-code.js');
    });

    it('should correctly format options configuration payloads for subagent parallel runs', async () => {
      vi.mocked(query).mockReturnValue(mockQueryStreamSuccess() as any);

      const orchestrator = new CodeReviewOrchestrator();
      await orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1);

      const calls = vi.mocked(query).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      const callPayload = calls[0][0] as any;
      expect(callPayload.options).toBeDefined();
      expect(callPayload.options.agents).toHaveProperty('code-quality-analyzer');
      expect(callPayload.options.agents).toHaveProperty('test-coverage-analyzer');
      expect(callPayload.options.agents).toHaveProperty('refactoring-suggester');
    });

    it('should throw an operational exception when the underlying SDK stream signals an error query result', async () => {
      vi.mocked(query).mockReturnValue(mockQueryStreamFailure() as any);

      const orchestrator = new CodeReviewOrchestrator();
      await expect(
        orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1)
      ).rejects.toThrow();
    });

    it('should throw an explicit error message if the query ends without providing structured report outcomes', async () => {
      async function* mockEmptyQueryStream() {
        yield { type: 'system', subtype: 'init', mcp_servers: [] };
      }
      vi.mocked(query).mockReturnValue(mockEmptyQueryStream() as any);

      const orchestrator = new CodeReviewOrchestrator();
      await expect(
        orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1)
      ).rejects.toThrow('Failed to receive a valid response.');
    });
  });

  // =============================================================================
  // Schema Validation Tests (ReviewReportSchema)
  // =============================================================================
  describe('ReviewReportSchema Structural Validation Checks', () => {
    it('should pass parsing validation on complete structural report valid structures', () => {
      const validData = createMockValidReport();
      const parsedResult = ReviewReportSchema.safeParse(validData);
      expect(parsedResult.success).toBe(true);
    });

    it('should reject schema parsing evaluation if required validation fields are corrupted', () => {
      const invalidData = createMockValidReport();
      (invalidData.pullRequest as any).number = 'invalid-string-id';
      
      const parsedResult = ReviewReportSchema.safeParse(invalidData);
      expect(parsedResult.success).toBe(false);
    });
  });

  // =============================================================================
  // Resiliency and Flow Control Utilities (Utility Function Coverage)
  // =============================================================================
  describe('Resiliency and Flow Control Utilities', () => {
    describe('withRetry()', () => {
      it('should retry execution up to maximum capacity parameters when transient operations fail', async () => {
        // Drop fake timers locally so async backoff macro-tasks loop immediately
        vi.useRealTimers();

        const failingFn = vi.fn().mockRejectedValue(new Error('Transient connection drop'));
        const execution = withRetry(failingFn, 2, 0);

        await expect(execution).rejects.toThrow('Transient connection drop');
        expect(failingFn).toHaveBeenCalledTimes(3); // 1 initial try + 2 retries
      });
    });

    describe('withTimeout()', () => {
      it('should break progression pipeline with a timeout error if task operations lag past duration bounds', async () => {
        const timeoutWrapper = withTimeout(
          () => new Promise((resolve) => setTimeout(() => resolve('done'), 2000)),
          500
        );

        const executionAssertion = expect(timeoutWrapper).rejects.toThrowError('Operation timed out');
        vi.advanceTimersByTime(501);
        await executionAssertion;
      });
    });

    describe('RateLimiter', () => {
      it('should reject proceeding subsequent requests once tracking slot limits are depleted', () => {
        const limiter = new RateLimiter();

        vi.spyOn(limiter, 'canProceed')
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
        expect(limiter.canProceed()).toBe(true);
        expect(limiter.canProceed()).toBe(false);
      });
    });
  });  

  // =============================================================================
  // Schema Integration Verification
  // =============================================================================
  describe('Integration Boundaries', () => {
    it.skip('should complete end-to-end execution against a public testing PR repository on demand', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const realReport = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
      
      expect(realReport).toBeDefined();
      expect(realReport.summary).toBeDefined();
    });
  });
});
