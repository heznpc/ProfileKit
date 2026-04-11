const { withRotation } = require("../common/github-token");

const QUERY = `
query repo($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    name
    description
    stargazerCount
    forkCount
    primaryLanguage {
      name
      color
    }
  }
}`;

// Legacy 3rd-arg (`token`) is a no-op — token rotation now lives in
// src/common/github-token.js via `withRotation`.
async function fetchRepo(owner, repo, _legacyToken) {
  return withRotation(async (token) => {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "profilekit",
      },
      body: JSON.stringify({ query: QUERY, variables: { owner, name: repo } }),
    });

    if (!res.ok) {
      const err = new Error(`GitHub API error: ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const json = await res.json();
    if (json.errors) {
      const notFound = json.errors.find((e) => e.type === "NOT_FOUND");
      if (notFound) throw new Error(`Repository not found: ${owner}/${repo}`);
      throw new Error(json.errors[0].message);
    }

    const r = json.data.repository;
    return {
      name: r.name,
      description: r.description || "",
      stars: r.stargazerCount,
      forks: r.forkCount,
      language: r.primaryLanguage?.name || null,
      languageColor: r.primaryLanguage?.color || null,
    };
  });
}

module.exports = { fetchRepo };
