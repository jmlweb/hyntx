/**
 * Gold Standard Benchmark Dataset
 */

export type GoldStandardPrompt = {
  readonly text: string;
  readonly expectedScore: number;
  readonly expectedIssues: readonly string[];
  readonly rationale: string;
};

export type ScoreTier = 'excellent' | 'good' | 'fair' | 'poor';

export function getScoreTier(score: number): ScoreTier {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export function scoresMatch(actual: number, expected: number): boolean {
  return getScoreTier(actual) === getScoreTier(expected);
}

export function calculateCorrelation(
  predictions: readonly number[],
  expectations: readonly number[],
): number {
  if (predictions.length !== expectations.length || predictions.length === 0)
    return 0;
  const n = predictions.length;
  const meanPred = predictions.reduce((a, b) => a + b, 0) / n;
  const meanExp = expectations.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    denomPred = 0,
    denomExp = 0;
  for (let i = 0; i < n; i++) {
    const dp = (predictions[i] ?? 0) - meanPred,
      de = (expectations[i] ?? 0) - meanExp;
    num += dp * de;
    denomPred += dp * dp;
    denomExp += de * de;
  }
  const denom = Math.sqrt(denomPred * denomExp);
  return denom === 0 ? 0 : num / denom;
}

export const EXCELLENT_PROMPTS: readonly GoldStandardPrompt[] = [
  {
    text: 'Fix the null pointer exception in auth.ts line 45 where user.email is undefined when called from the password reset flow',
    expectedScore: 95,
    expectedIssues: [],
    rationale: 'Specific file, line, error, and context',
  },
  {
    text: 'Add error handling to validateUser() in src/utils/auth.ts for database timeout after 5s',
    expectedScore: 92,
    expectedIssues: [],
    rationale: 'Clear goal, function, path, constraint',
  },
  {
    text: 'Refactor calculateTotal() to use reduce instead of forEach, maintaining return type number',
    expectedScore: 88,
    expectedIssues: [],
    rationale: 'Specific function, clear transformation',
  },
  {
    text: 'Write unit tests for UserService.createUser covering: success, duplicate email, invalid password',
    expectedScore: 90,
    expectedIssues: [],
    rationale: 'Clear method, specific test cases',
  },
  {
    text: 'Update docker-compose.yml to add Redis container for session caching on port 6379',
    expectedScore: 91,
    expectedIssues: [],
    rationale: 'Specific file, clear addition',
  },
  {
    text: 'Debug why /api/users returns 500 when email contains + sign - check URL encoding',
    expectedScore: 89,
    expectedIssues: [],
    rationale: 'Specific endpoint, exact condition',
  },
  {
    text: 'Implement rate limiting for login: max 5 attempts per IP per minute, return 429',
    expectedScore: 93,
    expectedIssues: [],
    rationale: 'Exact limits specified',
  },
  {
    text: 'Add TypeScript types in src/types/api.ts matching docs/openapi.yaml',
    expectedScore: 87,
    expectedIssues: [],
    rationale: 'Clear file paths, reference doc',
  },
  {
    text: 'Optimize getUserOrders() to use single JOIN instead of N+1 - currently 3s for 100 orders',
    expectedScore: 90,
    expectedIssues: [],
    rationale: 'Specific function, perf baseline',
  },
  {
    text: 'Fix race condition in useAuth hook where logout completes before token refresh resolves',
    expectedScore: 88,
    expectedIssues: [],
    rationale: 'Specific hook, exact race described',
  },
];

export const GOOD_PROMPTS: readonly GoldStandardPrompt[] = [
  {
    text: 'Add validation to signup form for email format and password length',
    expectedScore: 78,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing file path and rules',
  },
  {
    text: 'Fix the bug where users are logged out after page refresh',
    expectedScore: 72,
    expectedIssues: ['missing-technical-details'],
    rationale: 'No file paths or errors',
  },
  {
    text: 'Improve performance of product listing - too slow to load',
    expectedScore: 70,
    expectedIssues: ['missing-technical-details', 'insufficient-constraints'],
    rationale: 'Vague "too slow"',
  },
  {
    text: 'Add loading spinner while API call is in progress in dashboard',
    expectedScore: 75,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing file path',
  },
  {
    text: 'Update button styles to match new design system colors',
    expectedScore: 73,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing colors and files',
  },
  {
    text: 'Fix TypeScript errors in auth module after v5 upgrade',
    expectedScore: 74,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing specific errors',
  },
  {
    text: 'Add error messages to form when validation fails',
    expectedScore: 71,
    expectedIssues: ['missing-technical-details', 'no-context'],
    rationale: 'Which form?',
  },
  {
    text: 'Implement dark mode toggle in settings page',
    expectedScore: 76,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing implementation details',
  },
  {
    text: 'Write documentation for API endpoints in readme',
    expectedScore: 72,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing specifics',
  },
  {
    text: 'Add caching to expensive database queries',
    expectedScore: 74,
    expectedIssues: ['missing-technical-details', 'insufficient-constraints'],
    rationale: 'Which queries?',
  },
  {
    text: 'Create reusable Modal component for confirmation dialogs',
    expectedScore: 77,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing props interface',
  },
  {
    text: 'Fix mobile layout issues on checkout page',
    expectedScore: 73,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing breakpoints',
  },
  {
    text: 'Add pagination to users list in admin panel',
    expectedScore: 78,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing page size',
  },
  {
    text: 'Implement search for blog posts',
    expectedScore: 75,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing criteria',
  },
  {
    text: 'Add input sanitization to prevent XSS in comments',
    expectedScore: 79,
    expectedIssues: ['missing-technical-details'],
    rationale: 'Missing files',
  },
];

export const FAIR_PROMPTS: readonly GoldStandardPrompt[] = [
  {
    text: 'Fix the bug in the login',
    expectedScore: 55,
    expectedIssues: ['no-context', 'missing-technical-details'],
    rationale: 'What bug?',
  },
  {
    text: 'Make the page faster',
    expectedScore: 50,
    expectedIssues: ['vague', 'no-context', 'missing-technical-details'],
    rationale: 'Which page?',
  },
  {
    text: 'Add some tests',
    expectedScore: 45,
    expectedIssues: ['vague', 'no-context', 'insufficient-constraints'],
    rationale: 'What tests?',
  },
  {
    text: 'Clean up the code',
    expectedScore: 42,
    expectedIssues: ['vague', 'no-context'],
    rationale: 'What code?',
  },
  {
    text: 'There is an error somewhere',
    expectedScore: 38,
    expectedIssues: ['vague', 'no-context', 'missing-technical-details'],
    rationale: 'No location',
  },
  {
    text: 'Improve this component',
    expectedScore: 48,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'Which component?',
  },
  {
    text: 'Update the dependencies',
    expectedScore: 55,
    expectedIssues: ['no-goal', 'insufficient-constraints'],
    rationale: 'Which ones?',
  },
  {
    text: 'Something is wrong with authentication',
    expectedScore: 40,
    expectedIssues: ['vague', 'no-context', 'missing-technical-details'],
    rationale: 'No details',
  },
  {
    text: 'Handle edge cases',
    expectedScore: 44,
    expectedIssues: ['vague', 'no-context'],
    rationale: 'What cases?',
  },
  {
    text: 'Make it more secure',
    expectedScore: 46,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'What concerns?',
  },
  {
    text: 'Add error handling',
    expectedScore: 52,
    expectedIssues: ['no-context', 'missing-technical-details'],
    rationale: 'Where?',
  },
  {
    text: 'Refactor this file',
    expectedScore: 45,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'Which file?',
  },
  {
    text: 'The button does not work',
    expectedScore: 50,
    expectedIssues: ['no-context', 'missing-technical-details'],
    rationale: 'Which button?',
  },
  {
    text: 'Add logging',
    expectedScore: 54,
    expectedIssues: ['no-context', 'insufficient-constraints'],
    rationale: 'Where?',
  },
  {
    text: 'Check the API',
    expectedScore: 48,
    expectedIssues: ['vague', 'no-goal', 'no-context'],
    rationale: 'Check what?',
  },
];

export const POOR_PROMPTS: readonly GoldStandardPrompt[] = [
  {
    text: 'Fix it',
    expectedScore: 15,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'No information',
  },
  {
    text: 'Help',
    expectedScore: 10,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'Single word',
  },
  {
    text: 'Make it work',
    expectedScore: 20,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'What?',
  },
  {
    text: 'Debug',
    expectedScore: 12,
    expectedIssues: ['vague', 'no-context', 'no-goal', 'imperative'],
    rationale: 'Just a verb',
  },
  {
    text: '???',
    expectedScore: 5,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'Not a request',
  },
  {
    text: 'Code',
    expectedScore: 8,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'Single word',
  },
  {
    text: 'Do the thing',
    expectedScore: 18,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'What thing?',
  },
  {
    text: 'Error',
    expectedScore: 10,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'Just a word',
  },
  {
    text: 'Please',
    expectedScore: 5,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'Says nothing',
  },
  {
    text: 'This',
    expectedScore: 5,
    expectedIssues: ['vague', 'no-context', 'no-goal'],
    rationale: 'Meaningless',
  },
];

export const GOLD_STANDARD_PROMPTS: readonly GoldStandardPrompt[] = [
  ...EXCELLENT_PROMPTS,
  ...GOOD_PROMPTS,
  ...FAIR_PROMPTS,
  ...POOR_PROMPTS,
];

export function getExpectedScoreRange(issueCount: number): {
  min: number;
  max: number;
} {
  if (issueCount === 0) return { min: 80, max: 100 };
  if (issueCount === 1) return { min: 60, max: 85 };
  if (issueCount === 2) return { min: 40, max: 70 };
  return { min: 0, max: 55 };
}
