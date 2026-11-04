// Tests for supabase/functions/_shared/push-sender.ts (no Deno APIs, so Node can run it; Node
// 22.18+ strips the types itself). Run with: node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { describe, mock, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = pathToFileURL(join(root, 'supabase/functions/_shared/push-sender.ts')).href;

// A fresh copy of the module per test, because the Expo warning is shown once per module.
let copy = 0;
const load = () => import(`${file}?copy=${copy++}`);

const message = { to: 'ExponentPushToken[abc]', title: 'Final Meal', body: 'Hello.', data: {} };

describe('senderFromEnv', () => {
  test('log is the default for unset, empty and "log"', async () => {
    const { senderFromEnv, logSender } = await load();
    const warn = mock.method(console, 'warn', () => {});
    try {
      for (const value of [undefined, '', '  ', 'log', 'LOG']) {
        assert.equal(senderFromEnv(value), logSender);
      }
      assert.equal(warn.mock.callCount(), 0);
    } finally {
      warn.mock.restore();
    }
  });

  test('noop is chosen by "noop"', async () => {
    const { senderFromEnv, noopSender } = await load();
    assert.equal(senderFromEnv('noop'), noopSender);
    assert.equal(noopSender.name, 'noop');
  });

  test('expo and unknown values fall back to log with one warning', async () => {
    const { senderFromEnv, logSender } = await load();
    const warn = mock.method(console, 'warn', () => {});
    try {
      assert.equal(senderFromEnv('expo'), logSender);
      assert.equal(senderFromEnv('carrier-pigeon'), logSender);
      assert.equal(warn.mock.callCount(), 1);
      assert.equal(warn.mock.calls[0].arguments[0], 'Expo sender arrives in Phase 8; using log');
    } finally {
      warn.mock.restore();
    }
  });
});

describe('the senders', () => {
  test('log writes one line per message and reports them all sent', async () => {
    const { logSender } = await load();
    const log = mock.method(console, 'log', () => {});
    try {
      const result = await logSender.send([message, { ...message, to: 'ExponentPushToken[def]' }]);
      assert.deepEqual(result, { ok: 2, failed: 0 });
      assert.equal(log.mock.callCount(), 2);
      assert.equal(
        log.mock.calls[0].arguments[0],
        '[push:log] ExponentPushToken[abc] Final Meal: Hello.',
      );
    } finally {
      log.mock.restore();
    }
  });

  test('noop writes nothing and reports them all sent', async () => {
    const { noopSender } = await load();
    const log = mock.method(console, 'log', () => {});
    try {
      assert.deepEqual(await noopSender.send([message]), { ok: 1, failed: 0 });
      assert.equal(log.mock.callCount(), 0);
    } finally {
      log.mock.restore();
    }
  });
});
