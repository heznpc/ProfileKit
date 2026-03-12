const QUERY = `
query userLanguages($login: String!) {
  user(login: $login) {
    repositories(ownerAffiliations: OWNER, isFork: false, first: 100, orderBy: {direction: DESC, field: SIZE}) {
      nodes {
        name
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node {
              color
              name
            }
          }
        }
      }
    }
  }
}`;

async function fetchLanguages(username, token, excludeRepos = []) {
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
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    const notFound = json.errors.find((e) => e.type === "NOT_FOUND");
    if (notFound) throw new Error(`User not found: ${username}`);
    throw new Error(json.errors[0].message);
  }

  const repos = json.data.user.repositories.nodes;
  const langMap = {};

  for (const repo of repos) {
    if (excludeRepos.includes(repo.name)) continue;
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      if (!langMap[name]) {
        langMap[name] = { name, color: edge.node.color || "#8b949e", size: 0 };
      }
      langMap[name].size += edge.size;
    }
  }

  const sorted = Object.values(langMap).sort((a, b) => b.size - a.size);
  const total = sorted.reduce((sum, l) => sum + l.size, 0);

  return sorted.map((l) => ({
    ...l,
    percentage: total > 0 ? +((l.size / total) * 100).toFixed(1) : 0,
  }));
}

module.exports = { fetchLanguages };
