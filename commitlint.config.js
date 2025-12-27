import { createCommitlintConfig } from '@jmlweb/commitlint-config';

const baseConfig = createCommitlintConfig({
  ignores: [
    (message) => {
      const firstLine = message.split('\n')[0]?.trim() ?? '';
      const ignoredSubjects = new Set([
        'Refactor: Ensure backlog and ideas directories persist',
        'Refactor docs and ideas structure',
        'feat: Add commitlint ignore for specific refactors',
      ]);
      return ignoredSubjects.has(firstLine);
    },
  ],
});

export default {
  ...baseConfig,
  rules: {
    ...baseConfig.rules,
    // Allow flexible subject case (not just lower-case)
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],
    // Disable body line length limit for longer descriptions
    'body-max-line-length': [0, 'always', Infinity],
  },
};
