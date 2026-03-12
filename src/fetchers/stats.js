const QUERY = `
query userStats($login: String!) {
  user(login: $login) {
    name
    login
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
    }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) {
      totalCount
    }
    pullRequests(first: 1) {
      totalCount
    }
    openIssues: issues(states: OPEN) {
      totalCount
    }
    closedIssues: issues(states: CLOSED) {
      totalCount
    }
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}) {
      totalCount
      nodes {
        stargazerCount
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

const REPOS_QUERY = `
query userRepos($login: String!, $after: String!) {
  user(login: $login) {
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: {direction: DESC, field: STARGAZERS}, after: $after) {
      nodes {
        stargazerCount
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

async function graphql(query, variables, token) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "github-stats-card",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    const notFound = json.errors.find((e) => e.type === "NOT_FOUND");
    if (notFound) throw new Error(`User not found: ${variables.login}`);
    throw new Error(json.errors[0].message);
  }

  return json.data;
}

async function fetchStats(username, token) {
  const data = await graphql(QUERY, { login: username }, token);
  const user = data.user;

  let totalStars = user.repositories.nodes.reduce(
    (sum, r) => sum + r.stargazerCount,
    0
  );

  // Paginate remaining repos (max 4 extra pages = 500 repos total)
  let pageInfo = user.repositories.pageInfo;
  let pages = 0;
  while (pageInfo.hasNextPage && pages < 4) {
    const more = await graphql(
      REPOS_QUERY,
      { login: username, after: pageInfo.endCursor },
      token
    );
    const repos = more.user.repositories;
    totalStars += repos.nodes.reduce((sum, r) => sum + r.stargazerCount, 0);
    pageInfo = repos.pageInfo;
    pages++;
  }

  return {
    name: user.name || user.login,
    totalCommits:
      user.contributionsCollection.totalCommitContributions +
      user.contributionsCollection.restrictedContributionsCount,
    totalPRs: user.pullRequests.totalCount,
    totalIssues:
      user.openIssues.totalCount + user.closedIssues.totalCount,
    totalStars,
    totalRepos: user.repositories.totalCount,
    contributedTo: user.repositoriesContributedTo.totalCount,
  };
}

module.exports = { fetchStats };
