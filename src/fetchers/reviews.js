const { withRotation } = require("../common/github-token");

const QUERY = `
query userReviews($login: String!) {
  user(login: $login) {
    name
    login
    contributionsCollection {
      totalPullRequestReviewContributions
      pullRequestReviewContributions(first: 100) {
        nodes {
          pullRequestReview {
            state
          }
        }
      }
    }
    repositoriesContributedTo(first: 1, contributionTypes: [PULL_REQUEST_REVIEW]) {
      totalCount
    }
    pullRequests(first: 1) {
      totalCount
    }
  }
}`;

// Legacy 2nd-arg (`token`) is a no-op — token rotation now lives in
// src/common/github-token.js via `withRotation`.
async function fetchReviews(username, _legacyToken) {
  return withRotation(async (token) => {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "github-stats-card",
      },
      body: JSON.stringify({ query: QUERY, variables: { login: username } }),
    });

    if (!res.ok) {
      const err = new Error(`GitHub API error: ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    if (json.errors) {
      const notFound = json.errors.find((e) => e.type === "NOT_FOUND");
      if (notFound) throw new Error(`User not found: ${username}`);
      throw new Error(json.errors[0].message);
    }

    const user = json.data.user;
    const contributions = user.contributionsCollection;
    const reviews = contributions.pullRequestReviewContributions.nodes;

    // Count review states
    const states = { APPROVED: 0, CHANGES_REQUESTED: 0, COMMENTED: 0, DISMISSED: 0 };
    for (const r of reviews) {
      const state = r.pullRequestReview.state;
      if (states[state] !== undefined) {
        states[state]++;
      }
    }

    const totalReviews = contributions.totalPullRequestReviewContributions;
    const reposReviewed = user.repositoriesContributedTo.totalCount;
    const totalPRs = user.pullRequests.totalCount;

    // Approval rate based on sampled reviews
    const decisiveReviews = states.APPROVED + states.CHANGES_REQUESTED;
    const approvalRate = decisiveReviews > 0
      ? Math.round((states.APPROVED / decisiveReviews) * 100)
      : 0;

    return {
      name: user.name || user.login,
      totalReviews,
      approved: states.APPROVED,
      changesRequested: states.CHANGES_REQUESTED,
      commented: states.COMMENTED,
      approvalRate,
      reposReviewed,
      totalPRs,
    };
  });
}

module.exports = { fetchReviews };
