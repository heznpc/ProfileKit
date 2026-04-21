// /api/health — lightweight readiness probe.
//
// Reports token pool state so uptime monitoring (Pingdom, statuspage,
// internal dashboards) can distinguish "Vercel is up" from "ProfileKit is
// actually servable". Intentionally never caches: a cached health response
// would defeat the purpose of a probe. Returns 200 even when the pool is
// empty — the JSON body is what gets inspected, not the status code — so
// monitoring can decide its own severity (zero-token is a warning, not an
// outage, because pure cards like /api/hero still work).

const { poolStats } = require("../common/github-token");
const { ALLOWED_FEED_HOSTS } = require("../fetchers/posts");
const { ALLOWED_HOSTS: ALLOWED_THEME_URL_HOSTS } = require("../common/theme-url");

module.exports = async (req, res) => {
  const pool = poolStats();
  const body = {
    ok: true,
    service: "profilekit",
    time: new Date().toISOString(),
    githubTokenPool: pool,
    allowlists: {
      themeUrl: [...ALLOWED_THEME_URL_HOSTS],
      feedHosts: ALLOWED_FEED_HOSTS,
    },
  };
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.send(JSON.stringify(body, null, 2));
};
