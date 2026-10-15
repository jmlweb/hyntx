import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { renderHtml } from '../html.js';
import { JS } from './assets.js';
import { makeLowDataReport, makeRichReport } from './fixtures.js';

type Listener = (event: { target: FakeElement }) => void;

/** The few DOM members the report script touches; no DOM library is installed. */
class FakeElement {
  textContent = '';
  disabled = false;
  checked = false;
  readonly attributes = new Map<string, string>();

  constructor(
    readonly selectors: readonly string[],
    attributes: Readonly<Record<string, string>> = {},
  ) {
    Object.entries(attributes).forEach(([k, v]) => this.attributes.set(k, v));
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  matches(selector: string): boolean {
    return this.selectors.includes(selector);
  }

  closest(selector: string): FakeElement | null {
    return this.matches(selector) ? this : null;
  }
}

function runScript(sources: Readonly<Record<string, string>>): {
  readonly inputs: Record<string, FakeElement>;
  readonly button: FakeElement;
  readonly copied: string[];
  readonly dispatch: (type: 'click' | 'change', target: FakeElement) => void;
} {
  const inputs = Object.fromEntries(
    Object.keys(sources).map((id) => [
      id,
      new FakeElement(['input[data-pick]'], { 'data-pick': id }),
    ]),
  );
  const button = new FakeElement(['#copy-checked'], {});
  button.textContent = 'Copy checked (0)';
  button.disabled = true;
  const byId = new Map<string, FakeElement>([
    ['copy-checked', button],
    ...Object.entries(sources).map(([id, text]): [string, FakeElement] => {
      const el = new FakeElement([]);
      el.textContent = text;
      return [id, el];
    }),
  ]);
  const listeners = new Map<string, Listener[]>();
  const copied: string[] = [];
  const document = {
    documentElement: { classList: { add: (): void => undefined } },
    getElementById: (id: string): FakeElement | null => byId.get(id) ?? null,
    querySelectorAll: (): FakeElement[] => Object.values(inputs),
    addEventListener: (type: string, fn: Listener): void => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
  };
  runInNewContext(JS, {
    document,
    window: { addEventListener: (): void => undefined },
    navigator: {
      clipboard: {
        writeText: (text: string): Promise<void> => {
          copied.push(text);
          return Promise.resolve();
        },
      },
    },
    Element: FakeElement,
    setTimeout: (): number => 0,
  });
  return {
    inputs,
    button,
    copied,
    dispatch: (type, target) => {
      (listeners.get(type) ?? []).forEach((fn) => {
        fn({ target });
      });
    },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
};

describe('copy checked', () => {
  it('renders one checkbox per copy button and a single copy-checked button', () => {
    const html = renderHtml(makeRichReport());
    const copyButtons = html.match(/data-copy-target=/g)?.length ?? 0;
    expect(copyButtons).toBeGreaterThanOrEqual(4);
    expect(html.match(/data-pick=/g)?.length).toBe(copyButtons);
    expect(html.match(/id="copy-checked"/g)).toHaveLength(1);
  });

  it('has no copy-checked button when there is nothing to copy', () => {
    expect(renderHtml(makeLowDataReport())).not.toContain('id="copy-checked"');
  });

  it('copies exactly the checked actions, in page order', async () => {
    const { inputs, button, copied, dispatch } = runScript({
      c1: '- rule one',
      c2: '- rule two',
      c3: '{"permissions":{}}',
    });
    const [first, second, third] = [inputs['c1'], inputs['c2'], inputs['c3']];
    if (!first || !second || !third) {
      throw new Error('inputs exist');
    }
    third.checked = true;
    dispatch('change', third);
    first.checked = true;
    dispatch('change', first);
    expect(button.textContent).toBe('Copy checked (2)');
    expect(button.disabled).toBe(false);

    dispatch('click', button);
    await flush();
    expect(copied).toEqual(['- rule one\n\n{"permissions":{}}']);
  });

  it('stays disabled and copies nothing while nothing is checked', async () => {
    const { inputs, button, copied, dispatch } = runScript({ c1: '- rule' });
    const only = inputs['c1'];
    if (!only) {
      throw new Error('input exists');
    }
    only.checked = true;
    dispatch('change', only);
    only.checked = false;
    dispatch('change', only);
    expect(button.disabled).toBe(true);
    dispatch('click', button);
    await flush();
    expect(copied).toEqual([]);
  });
});
