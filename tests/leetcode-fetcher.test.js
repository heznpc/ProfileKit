const test = require("node:test");
const assert = require("node:assert/strict");

const { fetchLeetcode, FETCH_TIMEOUT_MS } = require("../src/fetchers/leetcode");

test("fetchLeetcode maps a successful GraphQL response", async () => {
  const fetchImpl = async (url, init) => {
    assert.equal(url, "https://leetcode.com/graphql");
    assert.equal(init.method, "POST");
    assert.ok(init.signal, "timeout signal must be passed to fetch");
    return {
      ok: true,
      async json() {
        return {
          data: {
            matchedUser: {
              username: "alice",
              submitStats: {
                acSubmissionNum: [
                  { difficulty: "All", count: 42, submissions: 50 },
                  { difficulty: "Easy", count: 20, submissions: 22 },
                  { difficulty: "Medium", count: 15, submissions: 18 },
                  { difficulty: "Hard", count: 7, submissions: 10 },
                ],
              },
              profile: { ranking: 1234 },
            },
            allQuestionsCount: [
              { difficulty: "All", count: 3000 },
              { difficulty: "Easy", count: 800 },
              { difficulty: "Medium", count: 1600 },
              { difficulty: "Hard", count: 600 },
            ],
          },
        };
      },
    };
  };

  const data = await fetchLeetcode("alice", { fetchImpl });
  assert.equal(data.username, "alice");
  assert.equal(data.ranking, 1234);
  assert.equal(data.totalSolved, 42);
  assert.equal(data.medium.total, 1600);
});

test("fetchLeetcode surfaces timer-induced aborts as timeout errors", async () => {
  const fetchImpl = (url, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    });

  await assert.rejects(
    fetchLeetcode("alice", { fetchImpl, timeoutMs: 1 }),
    /LeetCode API timed out after 1ms/
  );
});

test("fetchLeetcode exports the production timeout", () => {
  assert.equal(FETCH_TIMEOUT_MS, 5000);
});
