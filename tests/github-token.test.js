const test = require("node:test");
const assert = require("node:assert/strict");
const {
  nextToken,
  invalidate,
  withRotation,
  poolStats,
  _resetForTests,
} = require("../src/common/github-token");

// Every test has to start from a clean slate because the pool is
// module-global and memoized after first load. The helper snapshots every
// token env var github-token.js knows about, wipes them, resets the
// memoized pool, lets the test body mutate process.env freely, and then
// restores the original state on the way out.
//
// IMPORTANT: awaits fn() before running the finally cleanup. Without the
// await, an async fn would return its pending promise to `try { return
// fn(); }`, JavaScript would immediately run `finally` (restoring env and
// clearing the pool), and the asynchronous work inside withRotation would
// then observe a restored process.env that bears no relation to the test
// inputs.
async function withEnv(envPatch, fn) {
  const keys = ["GITHUB_TOKEN", "GITHUB_TOKENS"];
  for (let i = 1; i < 32; i++) keys.push(`GITHUB_TOKEN_${i}`);
  const saved = {};
  for (const k of keys) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(envPatch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  _resetForTests();
  try {
    return await fn();
  } finally {
    for (const k of keys) {
      if (saved[k] !== undefined) process.env[k] = saved[k];
      else delete process.env[k];
    }
    _resetForTests();
  }
}

test("pool is empty when no env vars are set", async () => {
  await withEnv({}, () => {
    const stats = poolStats();
    assert.equal(stats.total, 0);
    assert.equal(stats.available, 0);
    assert.equal(stats.cooldown, 0);
    assert.equal(nextToken(), null);
  });
});

test("GITHUB_TOKEN alone loads a single-entry pool", async () => {
  await withEnv({ GITHUB_TOKEN: "tk_solo" }, () => {
    const stats = poolStats();
    assert.equal(stats.total, 1);
    assert.equal(stats.available, 1);
    assert.equal(nextToken(), "tk_solo");
  });
});

test("GITHUB_TOKENS splits on comma and trims", async () => {
  await withEnv({ GITHUB_TOKENS: " tk_a , tk_b ,tk_c " }, () => {
    assert.equal(poolStats().total, 3);
    assert.equal(nextToken(), "tk_a");
    assert.equal(nextToken(), "tk_b");
    assert.equal(nextToken(), "tk_c");
    assert.equal(nextToken(), "tk_a"); // round-robins
  });
});

test("GITHUB_TOKEN_N numbered tokens are loaded up to 31", async () => {
  await withEnv(
    {
      GITHUB_TOKEN_1: "tk_1",
      GITHUB_TOKEN_2: "tk_2",
      GITHUB_TOKEN_3: "tk_3",
    },
    () => {
      const stats = poolStats();
      assert.equal(stats.total, 3);
    }
  );
});

test("duplicate tokens across shapes are deduped", async () => {
  await withEnv(
    {
      GITHUB_TOKEN: "tk_same",
      GITHUB_TOKENS: "tk_same,tk_other",
      GITHUB_TOKEN_1: "tk_same",
      GITHUB_TOKEN_2: "tk_third",
    },
    () => {
      // Expected unique set: tk_same, tk_other, tk_third
      assert.equal(poolStats().total, 3);
    }
  );
});

test("nextToken round-robins across the pool", async () => {
  await withEnv({ GITHUB_TOKENS: "tk_a,tk_b,tk_c" }, () => {
    const seen = [nextToken(), nextToken(), nextToken(), nextToken()];
    assert.deepEqual(seen, ["tk_a", "tk_b", "tk_c", "tk_a"]);
  });
});

test("invalidate puts a token in cooldown and nextToken skips it", async () => {
  await withEnv({ GITHUB_TOKENS: "tk_a,tk_b" }, () => {
    invalidate("tk_a");
    assert.equal(nextToken(), "tk_b");
    assert.equal(nextToken(), "tk_b"); // tk_a still cooled
    assert.equal(poolStats().available, 1);
    assert.equal(poolStats().cooldown, 1);
  });
});

test("nextToken returns null when every token is cooled down", async () => {
  await withEnv({ GITHUB_TOKENS: "tk_a,tk_b" }, () => {
    invalidate("tk_a");
    invalidate("tk_b");
    assert.equal(nextToken(), null);
    assert.equal(poolStats().available, 0);
    assert.equal(poolStats().cooldown, 2);
  });
});

test("withRotation throws 'GITHUB_TOKEN not configured' when pool is empty", async () => {
  await withEnv({}, async () => {
    await assert.rejects(
      withRotation(async () => "unreachable"),
      /GITHUB_TOKEN not configured/
    );
  });
});

test("withRotation returns the function's result on success", async () => {
  await withEnv({ GITHUB_TOKEN: "tk_ok" }, async () => {
    const result = await withRotation(async (token) => {
      assert.equal(token, "tk_ok");
      return { data: "hi" };
    });
    assert.deepEqual(result, { data: "hi" });
  });
});

test("withRotation rotates on 401/403/429 and retries with a new token", async () => {
  await withEnv({ GITHUB_TOKENS: "tk_a,tk_b,tk_c" }, async () => {
    const tried = [];
    const result = await withRotation(async (token) => {
      tried.push(token);
      if (token === "tk_a") {
        const err = new Error("Unauthorized");
        err.status = 401;
        throw err;
      }
      if (token === "tk_b") {
        const err = new Error("Rate limited");
        err.status = 429;
        throw err;
      }
      return "ok-from-" + token;
    });
    assert.deepEqual(tried, ["tk_a", "tk_b", "tk_c"]);
    assert.equal(result, "ok-from-tk_c");
    // tk_a and tk_b should now be in cooldown.
    assert.equal(poolStats().cooldown, 2);
  });
});

test("withRotation rethrows non-rotation errors immediately without trying other tokens", async () => {
  await withEnv({ GITHUB_TOKENS: "tk_a,tk_b" }, async () => {
    let calls = 0;
    await assert.rejects(
      withRotation(async () => {
        calls++;
        // A NOT_FOUND error (no status field, or status 500) is not
        // rotation-eligible — we rethrow it so the caller sees the real
        // GraphQL error instead of masking it behind a token retry.
        throw new Error("User not found: ghost");
      }),
      /User not found/
    );
    assert.equal(calls, 1);
  });
});

test("withRotation throws after every token has been cooled down during the attempt", async () => {
  await withEnv({ GITHUB_TOKENS: "tk_a,tk_b" }, async () => {
    let calls = 0;
    await assert.rejects(
      withRotation(async () => {
        calls++;
        const err = new Error("Forbidden");
        err.status = 403;
        throw err;
      }),
      /Forbidden/
    );
    // Both tokens attempted, both now in cooldown.
    assert.equal(calls, 2);
    assert.equal(poolStats().cooldown, 2);
  });
});
