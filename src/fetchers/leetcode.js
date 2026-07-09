const LEETCODE_API = "https://leetcode.com/graphql";
const FETCH_TIMEOUT_MS = 5000;

const QUERY = `
query userProfile($username: String!) {
  matchedUser(username: $username) {
    username
    submitStats: submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    profile {
      ranking
    }
  }
  allQuestionsCount {
    difficulty
    count
  }
}`;

async function fetchLeetcode(username, opts = {}) {
  const { fetchImpl, timeoutMs } = opts || {};
  const realFetch = fetchImpl || globalThis.fetch;
  const timeout = typeof timeoutMs === "number" ? timeoutMs : FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await realFetch(LEETCODE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "github-stats-card",
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { username },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted && (err.name === "AbortError" || err.message === "aborted")) {
      throw new Error(`LeetCode API timed out after ${timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`LeetCode API error: ${res.status}`);
  const json = await res.json();

  if (json.errors || !json.data.matchedUser) {
    throw new Error(`LeetCode user not found: ${username}`);
  }

  const user = json.data.matchedUser;
  const allQuestions = json.data.allQuestionsCount;
  const submissions = user.submitStats.acSubmissionNum;

  const stats = {};
  for (const s of submissions) {
    stats[s.difficulty] = { solved: s.count, submissions: s.submissions };
  }

  const totals = {};
  for (const q of allQuestions) {
    totals[q.difficulty] = q.count;
  }

  return {
    username: user.username,
    ranking: user.profile.ranking,
    totalSolved: stats.All?.solved || 0,
    totalQuestions: totals.All || 0,
    easy: { solved: stats.Easy?.solved || 0, total: totals.Easy || 0 },
    medium: { solved: stats.Medium?.solved || 0, total: totals.Medium || 0 },
    hard: { solved: stats.Hard?.solved || 0, total: totals.Hard || 0 },
  };
}

module.exports = { fetchLeetcode, FETCH_TIMEOUT_MS };
