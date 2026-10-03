import { chmod } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DenialKind, PromptSource, TurnKind } from '../types/index.js';
import {
  classifyDenial,
  classifyUserRecord,
  deriveProjectName,
  readSessions,
} from './session-reader.js';
import { removeTempDir } from './test-cleanup.js';
import {
  assistantRecord,
  at,
  makeTempDir,
  SESSION_ID,
  textBlock,
  toolResultRecord,
  toolUseBlock,
  typedPrompt,
  userRecord,
  writeJsonl,
} from './test-helpers.js';

const PROJECT_DIR = '-work-app';

describe('classifyUserRecord', () => {
  it('treats tool_result arrays as tool results, not prompts', () => {
    const result = classifyUserRecord(toolResultRecord('toolu_1', 'ok', at(1)));
    expect(result.kind).toBe('tool-results');
  });

  it('classifies wrapped slash commands', () => {
    const result = classifyUserRecord(
      userRecord(
        '<command-message>x</command-message>\n<command-name>/flow:next</command-name>\n<command-args>63</command-args>',
        at(1),
      ),
    );
    expect(result).toEqual({ kind: 'command', name: 'flow:next', args: '63' });
  });

  it.each([
    ['<system-reminder>be nice</system-reminder>'],
    ['Base directory for this skill: /x/y'],
    ['<local-command-caveat>Caveat: ...</local-command-caveat>'],
    ['[Image: source: /tmp/x.png]'],
  ])('classifies injected text %#', (text) => {
    expect(classifyUserRecord(userRecord(text, at(1))).kind).toBe('injected');
  });

  it('classifies meta records and non-human origins as injected', () => {
    expect(
      classifyUserRecord(userRecord('hello', at(1), { isMeta: true })).kind,
    ).toBe('injected');
    expect(
      classifyUserRecord(
        userRecord('hello', at(1), { origin: { kind: 'task-notification' } }),
      ).kind,
    ).toBe('injected');
  });

  it('detects interruption markers in strings and text blocks', () => {
    expect(
      classifyUserRecord(userRecord('[Request interrupted by user]', at(1))),
    ).toEqual({ kind: 'interruption', duringToolUse: false });
    expect(
      classifyUserRecord(
        userRecord(
          [
            {
              type: 'text',
              text: '[Request interrupted by user for tool use]',
            },
          ],
          at(1),
        ),
      ),
    ).toEqual({ kind: 'interruption', duringToolUse: true });
  });

  it('classifies compaction summaries, local output and bash input', () => {
    expect(
      classifyUserRecord(
        userRecord('This session...', at(1), { isCompactSummary: true }),
      ).kind,
    ).toBe('compact-summary');
    expect(
      classifyUserRecord(
        userRecord('<local-command-stdout>x</local-command-stdout>', at(1)),
      ).kind,
    ).toBe('local-output');
    expect(
      classifyUserRecord(userRecord('<bash-input>ls</bash-input>', at(1))).kind,
    ).toBe('bash-input');
  });

  it('returns typed prompts with source and permission mode', () => {
    const typed = classifyUserRecord(typedPrompt('fix the bug', at(1)));
    expect(typed).toMatchObject({
      kind: 'prompt',
      text: 'fix the bug',
      source: PromptSource.TYPED,
      permissionMode: 'default',
    });
    const suggestion = classifyUserRecord(
      typedPrompt('push it', at(1), { promptSource: 'suggestion_accepted' }),
    );
    expect(suggestion).toMatchObject({ source: PromptSource.SUGGESTION });
  });

  it('treats prompts without origin metadata (older versions) as prompts', () => {
    expect(classifyUserRecord(userRecord('old style prompt', at(1))).kind).toBe(
      'prompt',
    );
  });
});

describe('classifyDenial', () => {
  it.each([
    [
      "The user doesn't want to proceed with this tool use. The tool use was rejected",
      DenialKind.USER,
    ],
    [
      'Permission for this action was denied by the Claude Code auto mode classifier. Reason: [DNS]',
      DenialKind.CLASSIFIER,
    ],
    ['PreToolUse:Bash hook error: [x.sh]: BLOCKED: use trash', DenialKind.HOOK],
    ['Permission to use Bash(rm:*) has been denied.', DenialKind.RULE],
  ])('maps %#', (text, expected) => {
    expect(classifyDenial(text, true)).toBe(expected);
  });

  it('ignores ordinary errors and non-errors', () => {
    expect(classifyDenial('Exit code 1', true)).toBeNull();
    expect(
      classifyDenial("The user doesn't want to proceed", false),
    ).toBeNull();
  });
});

describe('deriveProjectName', () => {
  it('strips the encoded home and the projects folder', () => {
    expect(
      deriveProjectName('-Users-me-projects-subbuteo', null, '-Users-me'),
    ).toBe('subbuteo');
    expect(deriveProjectName('-Users-me', null, '-Users-me')).toBe('~');
    expect(deriveProjectName('-Users-me--claude', null, '-Users-me')).toBe(
      '.claude',
    );
  });

  it('falls back to the cwd basename for foreign paths', () => {
    expect(deriveProjectName('-opt-thing', '/opt/thing', '-Users-me')).toBe(
      'thing',
    );
  });
});

describe('readSessions', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await makeTempDir();
  });
  afterEach(async () => {
    await removeTempDir(dir);
  });

  it('dedupes repeated usage of one assistant message across records', async () => {
    const usage = {
      input_tokens: 7,
      output_tokens: 40,
      cache_read_input_tokens: 1000,
      cache_creation_input_tokens: 50,
    };
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('do the thing', at(1)),
      assistantRecord({
        msgId: 'msg_1',
        ts: at(1, 1),
        usage,
        content: [{ type: 'thinking', thinking: '' }],
      }),
      assistantRecord({
        msgId: 'msg_1',
        ts: at(1, 1),
        usage,
        content: [textBlock('working')],
      }),
      assistantRecord({
        msgId: 'msg_1',
        ts: at(1, 1),
        usage,
        content: [toolUseBlock('toolu_1', 'Bash', { command: 'ls' })],
      }),
    ]);
    const { sessions, stats } = await readSessions({ projectsDir: dir });
    const session = sessions[0];
    expect(sessions).toHaveLength(1);
    expect(session?.tokens).toEqual({
      input: 7,
      output: 40,
      cacheRead: 1000,
      cacheCreation: 50,
    });
    expect(session?.assistantMessages).toBe(1);
    expect(session?.toolCalls).toHaveLength(1);
    expect(stats.duplicateRecords).toBe(2);
  });

  it('keeps the largest per-field usage when streamed copies differ', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('go', at(1)),
      assistantRecord({
        msgId: 'm',
        ts: at(1, 1),
        usage: { output_tokens: 5 },
        content: [textBlock('a')],
      }),
      assistantRecord({
        msgId: 'm',
        ts: at(1, 1),
        usage: { output_tokens: 90 },
        content: [textBlock('b')],
      }),
    ]);
    const { sessions } = await readSessions({ projectsDir: dir });
    expect(sessions[0]?.tokens.output).toBe(90);
  });

  it('pairs tool calls with results and flags errors and denials', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('run things', at(1)),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 1),
        content: [
          toolUseBlock('t_ok', 'Bash', { command: 'ls' }),
          toolUseBlock('t_err', 'Bash', { command: 'false' }),
          toolUseBlock('t_deny', 'Bash', { command: 'shred x' }),
        ],
      }),
      toolResultRecord('t_ok', 'fine', at(1, 2)),
      toolResultRecord('t_err', 'Exit code 1\nboom', at(1, 2), true),
      toolResultRecord(
        't_deny',
        "The user doesn't want to proceed with this tool use. The tool use was rejected",
        at(1, 3),
        true,
      ),
    ]);
    const { sessions } = await readSessions({ projectsDir: dir });
    const calls = sessions[0]?.toolCalls ?? [];
    expect(
      calls.map((c) => [c.id, c.result?.isError, c.result?.denial]),
    ).toEqual([
      ['t_ok', false, null],
      ['t_err', true, null],
      ['t_deny', true, DenialKind.USER],
    ]);
    expect(sessions[0]?.turns[0]?.toolCalls).toHaveLength(3);
  });

  it('does not count tool results, injected text or local commands as prompts', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      userRecord('<local-command-caveat>Caveat</local-command-caveat>', at(1), {
        isMeta: true,
      }),
      userRecord(
        '<command-name>/clear</command-name>\n<command-args></command-args>',
        at(1, 1),
      ),
      userRecord('<local-command-stdout></local-command-stdout>', at(1, 1)),
      userRecord('<system-reminder>ctx</system-reminder>', at(1, 2)),
      typedPrompt('first real prompt', at(1, 3)),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 4),
        content: [toolUseBlock('t1', 'Read', { file_path: '/x' })],
      }),
      toolResultRecord('t1', 'content', at(1, 5)),
      userRecord(
        '<command-name>/flow:next</command-name>\n<command-args></command-args>',
        at(1, 6),
      ),
      userRecord('Base directory for this skill: /s', at(1, 6)),
      assistantRecord({
        msgId: 'm2',
        ts: at(1, 7),
        content: [textBlock('done')],
      }),
    ]);
    const { sessions } = await readSessions({ projectsDir: dir });
    const session = sessions[0];
    expect(session?.turns.map((t) => [t.kind, t.prompt.text])).toEqual([
      [TurnKind.TYPED, 'first real prompt'],
      [TurnKind.COMMAND, '/flow:next'],
    ]);
    expect(session?.slashCommands.map((c) => c.name)).toEqual([
      'clear',
      'flow:next',
    ]);
  });

  it('merges multi-record prompts sharing a promptId into one turn', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('look at this', at(1), { promptId: 'p-shared' }),
      typedPrompt('[Image #1]', at(1), { promptId: 'p-shared' }),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 1),
        content: [textBlock('ok')],
      }),
    ]);
    const { sessions } = await readSessions({ projectsDir: dir });
    expect(sessions[0]?.turns).toHaveLength(1);
  });

  it('attaches interruptions to the turn that was running', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('refactor everything', at(1)),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 1),
        content: [toolUseBlock('t1', 'Edit', { file_path: '/a' })],
      }),
      userRecord(
        [{ type: 'text', text: '[Request interrupted by user for tool use]' }],
        at(1, 2),
      ),
      typedPrompt('no, only touch utils', at(1, 3)),
    ]);
    const { sessions } = await readSessions({ projectsDir: dir });
    const turns = sessions[0]?.turns ?? [];
    expect(turns[0]?.interruptions).toEqual([
      { timestamp: at(1, 2), duringToolUse: true },
    ]);
    expect(turns[1]?.interruptions).toHaveLength(0);
  });

  it('merges nested subagent sidechain files into the parent session', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('delegate this', at(1)),
      assistantRecord({
        msgId: 'main1',
        ts: at(1, 1),
        content: [
          toolUseBlock('task1', 'Task', {
            subagent_type: 'Explore',
            prompt: 'x',
          }),
        ],
      }),
    ]);
    await writeJsonl(
      dir,
      PROJECT_DIR,
      `${SESSION_ID}/subagents/agent-abc.jsonl`,
      [
        userRecord('You are an explorer, find things', at(1, 2), {
          isSidechain: true,
          agentId: 'abc',
        }),
        assistantRecord({
          msgId: 'side1',
          ts: at(1, 3),
          usage: {
            input_tokens: 1,
            output_tokens: 1000,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
          content: [toolUseBlock('side_t1', 'Grep', { pattern: 'x' })],
          extra: { isSidechain: true, agentId: 'abc' },
        }),
        toolResultRecord('side_t1', 'match', at(1, 4), false, {
          isSidechain: true,
          agentId: 'abc',
        }),
      ],
    );
    const { sessions, stats } = await readSessions({ projectsDir: dir });
    expect(sessions).toHaveLength(1);
    const session = sessions[0];
    expect(stats.subagentFilesRead).toBe(1);
    expect(session?.turns).toHaveLength(1);
    expect(session?.subagents).toMatchObject({
      agentIds: ['abc'],
      invocations: 1,
      toolCalls: 1,
    });
    expect(session?.subagents.tokens.output).toBe(1000);
    expect(session?.tokens.output).toBe(1020);
    expect(session?.turns[0]?.tokens.output).toBe(1020);
  });

  it('skips and counts unknown record types and malformed lines', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('hello', at(1)),
      { type: 'brand-new-record', sessionId: SESSION_ID, timestamp: at(1, 1) },
      { type: 'brand-new-record', sessionId: SESSION_ID },
      '{not json',
      '[1,2,3]',
      { type: 'file-history-snapshot', snapshot: {} },
      { type: 'attachment', attachment: { type: 'x' }, sessionId: SESSION_ID },
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 2),
        content: [textBlock('hi')],
      }),
    ]);
    const { sessions, stats } = await readSessions({ projectsDir: dir });
    expect(sessions).toHaveLength(1);
    expect(stats.unknownRecordTypes).toEqual({ 'brand-new-record': 2 });
    expect(stats.recordsSkipped).toBe(2);
  });

  it('reads title, permission modes, plan mode and git/version metadata', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      { type: 'ai-title', aiTitle: 'Fix login', sessionId: SESSION_ID },
      {
        type: 'permission-mode',
        permissionMode: 'plan',
        sessionId: SESSION_ID,
      },
      typedPrompt('plan it', at(1), { permissionMode: 'plan' }),
      typedPrompt('now do it', at(1, 5), { permissionMode: 'acceptEdits' }),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 6),
        content: [textBlock('ok')],
      }),
    ]);
    const { sessions, stats } = await readSessions({ projectsDir: dir });
    const session = sessions[0];
    expect(session?.title).toBe('Fix login');
    expect(session?.planModeUsed).toBe(true);
    expect(session?.permissionModes).toEqual({ plan: 1, acceptEdits: 1 });
    expect(session?.gitBranch).toBe('main');
    expect(session?.versions).toEqual(['2.1.278']);
    expect(stats.claudeCodeVersions).toEqual(['2.1.278']);
  });

  it('records one compaction for a boundary plus its summary message', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('long task', at(1)),
      {
        type: 'system',
        subtype: 'compact_boundary',
        sessionId: SESSION_ID,
        timestamp: at(1, 30),
        compactMetadata: { trigger: 'auto', preTokens: 150000 },
      },
      userRecord('This session is being continued...', at(1, 30), {
        isCompactSummary: true,
      }),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 31),
        content: [textBlock('continuing')],
      }),
    ]);
    const { sessions } = await readSessions({ projectsDir: dir });
    expect(sessions[0]?.compactions).toEqual([
      { timestamp: at(1, 30), trigger: 'auto', preTokens: 150000 },
    ]);
  });

  it('counts the synthetic API error message without tokens or model usage', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('hello', at(1)),
      assistantRecord({
        msgId: 'synthetic1',
        ts: at(1, 1),
        model: '<synthetic>',
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        },
        content: [textBlock('Login expired')],
        extra: { isApiErrorMessage: true },
      }),
    ]);
    const { sessions } = await readSessions({ projectsDir: dir });
    expect(sessions[0]?.apiErrors).toBe(1);
    expect(sessions[0]?.models).toEqual({});
  });

  it('ignores records outside the requested period', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('old prompt', at(1)),
      assistantRecord({
        msgId: 'old',
        ts: at(1, 1),
        content: [textBlock('old')],
      }),
      typedPrompt('new prompt', at(20)),
      assistantRecord({
        msgId: 'new',
        ts: at(20, 1),
        content: [textBlock('new')],
      }),
    ]);
    const { sessions } = await readSessions({
      projectsDir: dir,
      from: new Date(2026, 8, 10),
      to: new Date(2026, 8, 30),
    });
    expect(sessions[0]?.turns.map((t) => t.prompt.text)).toEqual([
      'new prompt',
    ]);
    expect(sessions[0]?.assistantMessages).toBe(1);
  });

  it('filters by project name and dedupes messages copied across sessions', async () => {
    const other = 'bbbbbbbb-0000-4000-8000-000000000002';
    await writeJsonl(dir, '-work-alpha', `${SESSION_ID}.jsonl`, [
      typedPrompt('alpha', at(1)),
      assistantRecord({
        msgId: 'shared',
        ts: at(1, 1),
        content: [textBlock('a')],
      }),
    ]);
    await writeJsonl(dir, '-work-beta', `${other}.jsonl`, [
      { ...typedPrompt('beta', at(2)), sessionId: other },
      {
        ...assistantRecord({
          msgId: 'shared',
          ts: at(2, 1),
          content: [textBlock('a')],
        }),
        sessionId: other,
      },
    ]);
    const all = await readSessions({ projectsDir: dir });
    expect(all.sessions).toHaveLength(2);
    expect(all.stats.duplicateRecords).toBe(1);
    expect(all.sessions.reduce((n, s) => n + s.tokens.output, 0)).toBe(20);

    const filtered = await readSessions({ projectsDir: dir, project: 'BETA' });
    expect(filtered.sessions).toHaveLength(1);
  });

  it('returns nothing for a missing directory', async () => {
    const { sessions, stats } = await readSessions({
      projectsDir: `${dir}/missing`,
    });
    expect(sessions).toEqual([]);
    expect(stats.filesRead).toBe(0);
  });

  it('sanitizes before truncating so a cut secret leaves no fragment', async () => {
    const pem = `-----BEGIN PRIVATE KEY-----\n${'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC'.repeat(40)}\n-----END PRIVATE KEY-----`;
    const key = `sk-ant-api03-${'aB3_xY-9'.repeat(12)}`;
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('run it', at(1)),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 1),
        content: [
          toolUseBlock('toolu_1', 'Bash', {
            command: `${'echo hi; '.repeat(55)}export K=${key} && cat <<EOF\n${pem}\nEOF`,
          }),
        ],
      }),
      toolResultRecord('toolu_1', `${'x'.repeat(380)} ${pem}`, at(1, 2)),
    ]);
    const { sessions } = await readSessions({ projectsDir: dir });
    const call = sessions[0]?.toolCalls[0];
    const seen = `${call?.command ?? ''}\n${call?.result?.excerpt ?? ''}`;
    expect(seen).not.toContain('MIIEvQ');
    expect(seen).not.toContain('aB3_xY');
    expect(seen).toContain('[REDACTED');
  });

  it('keeps the end of a long assistant message so a closing question is visible', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('go', at(1)),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 1),
        content: [textBlock(`${'blah '.repeat(300)}Shall I continue?`)],
      }),
    ]);
    const { sessions } = await readSessions({ projectsDir: dir });
    expect(sessions[0]?.turns[0]?.assistantExcerpt?.endsWith('continue?')).toBe(
      true,
    );
  });

  it('skips a file that cannot be read and reports it', async () => {
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('hello', at(1)),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 1),
        content: [textBlock('hi')],
      }),
    ]);
    const locked = await writeJsonl(dir, PROJECT_DIR, 'locked.jsonl', [
      typedPrompt('secret', at(2)),
    ]);
    await chmod(locked, 0o000);
    const { sessions, stats } = await readSessions({ projectsDir: dir });
    await chmod(locked, 0o600);
    // Root can read anything; elsewhere the locked file is counted, not fatal.
    if (process.getuid?.() !== 0) {
      expect(stats.filesFailed).toBe(1);
      expect(stats.failedFiles[0]).toContain('locked.jsonl');
      expect(sessions).toHaveLength(1);
    }
  });

  it('leaves out sessions with no prompt, tool call or reply', async () => {
    const other = 'cccccccc-0000-4000-8000-000000000003';
    await writeJsonl(dir, PROJECT_DIR, `${SESSION_ID}.jsonl`, [
      typedPrompt('hello', at(1)),
      assistantRecord({
        msgId: 'm1',
        ts: at(1, 1),
        content: [textBlock('hi')],
      }),
    ]);
    await writeJsonl(dir, PROJECT_DIR, `${other}.jsonl`, [
      {
        ...userRecord(
          '<command-name>/clear</command-name>\n<command-args></command-args>',
          at(2),
        ),
        sessionId: other,
      },
    ]);
    const { sessions, stats } = await readSessions({ projectsDir: dir });
    expect(sessions).toHaveLength(1);
    expect(stats.emptySessions).toBe(1);
  });
});
