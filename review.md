# ProfileKit — review

조사 일자: 2026-04-11
대상 커밋: `8f6522f`
스택: Node 18+ · Vercel serverless · GitHub GraphQL/REST · SVG 렌더링 · `node:test` 표준 러너
도메인: GitHub README 임베드용 동적 SVG 카드 생성기 (27종 카드)

---

## 1. 원격 상태 (newtria/ProfileKit)

- 미해결 이슈: **0건**
- 미해결 PR: **0건**
- 커밋 15+개. 최근 추세: 카드 추가 → UI 옵션 → external themes → composition → playground.
- 작업 트리: clean
- CI: `.github/workflows/` 디렉토리 부재 (확인 필요)
- 배포: Vercel (`vercel.json`, `.vercel/`)

→ 외부 보고 0건. dogfooding 중 (heznpc/heznpc README 가 ProfileKit pin 카드를 사용).

---

## 2. 코드 품질 종합

### 강점

- **27개 카드, 표준화된 옵션 surface**: `parseCardOptions` 가 모든 endpoint 공통 옵션 (theme, font, hide_*, border_radius, card_width, color overrides) 을 한 곳에서 처리. 새 옵션 추가 시 한 줄로 모든 카드에 전파. **이게 본 프로젝트 architecture의 핵심 강점.**
- **SSRF 방어가 textbook**: `theme-url.js` 의 5-layer 방어 (host allowlist, https-only, `redirect: "error"`, 5s AbortController timeout, 스키마 검증). 주석에 모든 layer의 의도가 명시. **외부 fetch가 필요한 모든 코드의 본보기 수준.**
- **LRU cache (insertion-ordered Map)**: 의존성 0으로 cap 128. 가장 오래된 entry 1개 drop. 메모리 폭주 방지.
- **Schema validation도 textbook**: `validatePalette` 가 REQUIRED_KEYS 모두 체크 + accentStops 형식 (`/^#[0-9a-fA-F]{3,8}$/`) + 이외 키 silent ignore (forward-compat).
- **Cache 헤더 분리**: `cacheHeaders()` (30분) vs `errorCacheHeaders()` (2분). 일시 장애가 30분 캐시되는 것을 방지.
- **GraphQL pagination**: `fetchStats` 가 stargazers 4 페이지(=500 repo)까지 추가 fetch. cap 의식적.
- **Fetch error 분기**: NOT_FOUND error type → "User not found", 다른 GraphQL error → first message 반환.
- **테스트 7개 파일, ~1100 라인**: cards.test.js (모든 27개 카드 cross-theme smoke), options.test.js, stack.test.js, theme-url.test.js (286 라인 — SSRF 방어 회귀 가드 두꺼움), themes.test.js, tokens.test.js, utils.test.js. **node:test 표준 러너 사용 → 의존성 0**.
- **Dogfooding**: 본인 README가 본 프로젝트의 pin 카드를 사용 → 동작 확인이 매일.
- **Layered architecture**: `api/` (HTTP) → `src/cards/` (rendering) → `src/fetchers/` (data) → `src/common/` (shared). 명확한 단방향 의존.
- **`stagger animation` fallback**: SVG 애니메이션 미지원 환경에서 컨텐츠 숨김 방지하는 fix가 별도 커밋 (`20854f9`).

### Fix TODO (우선순위순)

**[P1] 단일 GitHub Token 의 rate limit 한계**
- 위치: `api/stats.js:25` `const token = process.env.GITHUB_TOKEN`
- 증상: 모든 사용자가 같은 token을 share. GitHub GraphQL rate limit은 5000 points/hour, fetchStats는 1 호출 + 페이지네이션 4까지 = 최대 5 호출 → 1000 사용자/시간 cap. 인기 사용자의 README가 캐시 만료마다 hit하면 빠른 한도 도달.
- Fix:
  - 옵션 A: 토큰 풀 (`GITHUB_TOKEN_1`, `GITHUB_TOKEN_2`, ...) round-robin.
  - 옵션 B: GitHub App 으로 전환하여 installation token 사용 (시간당 15000 points × installation).
  - 옵션 C: Vercel KV 또는 Upstash Redis로 응답 캐싱 layer 추가 (in-memory만으로는 cold start마다 손실).

**[P1] In-memory cache가 serverless에서 불충분**
- 위치: `src/common/theme-url.js:37` `const cache = new Map()`
- 증상: Vercel serverless function은 cold start마다 새 instance. cache가 단지 warm 인스턴스의 짧은 수명 동안만 유효. 동일 theme_url을 100번 hit해도 cache hit rate가 매우 낮음.
- Fix: Vercel KV/Upstash 옵션 추가 (`if (process.env.KV_URL) ...`). 또는 GitHub raw cache (gist는 raw URL이 변경 안 되므로 etag 기반 conditional GET).

**[P1] CI 워크플로우 부재**
- 위치: `.github/workflows/` 디렉토리 확인 필요. 보이지 않음.
- 증상: tests는 매우 잘 짜여있는데 push마다 자동 실행이 안 됨. 27개 카드 중 1개가 깨져도 deploy까지 갈 수 있음.
- Fix: GH Actions에 `npm test` 추가. 5분 안에 끝남 (의존성 zero).

**[P2] `parseSearchParams` 의 host header 신뢰**
- 위치: `src/common/options.js:33-35`
  ```js
  return new URL(req.url, `http://${req.headers.host}`).searchParams;
  ```
- 증상: `req.headers.host` 를 base URL로 사용. host header injection 가능 (다만 결과가 path/query만 사용되므로 영향 작음). 이론적으로는 reflection 공격 가능성.
- Fix: `new URL(req.url, "http://localhost")` 같은 고정 base. 또는 Vercel의 `req.query` 객체 직접 사용.

**[P2] `renderError(err.message, ...)` 의 SVG escape**
- 위치: 모든 endpoint에서 `renderError(err.message, { colors, font })` 호출. `err.message` 가 외부 입력에서 유래할 수 있음 (e.g. `?username=<script>` 가 GitHub API error 메시지에 echo).
- Fix: `renderError` 내부에서 escapeHtml. 또는 모든 호출처에서 escapeHtml 적용. (코드를 직접 보지 못해 가정.)

**[P2] `errorCacheHeaders` 가 120초**
- 위치: `src/common/utils.js:69`
- 증상: GitHub API 일시 장애 → 사용자 README가 2분 동안 error 카드 표시. 너무 길 수도 있음 (30초~60초가 일반적).
- Fix: 60초로 줄이거나, error 종류별 분기 (rate limit → 600초, network → 60초).

**[P2] 27개 카드의 코드 중복**
- 위치: `src/cards/*.js` 27개 파일
- 증상: hide_border / hide_title / hide_bar / borderRadius / cardWidth 처리가 카드별 반복. `renderCard` 가 일부 흡수하긴 하지만 destructuring과 default 값이 카드마다.
- Fix:
  - 공통 props를 `BaseCard` 추상화로.
  - 또는 typescript 도입 (interface로 강제).

**[P2] tests/cards.test.js 가 smoke만**
- 위치: `tests/cards.test.js:1-13` (주석 명시)
- 증상: visual regression은 의도적으로 포기. 좋은 방향이지만, layout 깨짐 (e.g. text overflow, color contrast) 도 안 잡힘.
- Fix:
  - 옵션 A: percy.io / chromatic 으로 visual regression. 무료 tier.
  - 옵션 B: SVG path bbox 추출 후 overflow 검증 (직접 구현 가능).

**[P3] `wave/typing/snake/equalizer/heartbeat/constellation/matrix/glitch/neon` 9개의 애니메이션 카드**
- 위치: `src/cards/{wave,typing,snake,...}.js`
- 증상: SVG SMIL 또는 inline CSS animation. GitHub README의 camo 이미지 캐시가 5분 → 새로 받을 때마다 매번 큰 SVG 전송. CDN 트래픽 비용 ↑. 일부 RSS reader는 SMIL 미지원.
- Fix: animated 카드는 별도 group으로 묶고 README에 "GitHub camo cache로 인해 5분마다 새로고침됨" 명시.

**[P3] LeetCode endpoint 가 제3자 사이트 의존**
- 위치: `api/leetcode.js`, `src/fetchers/leetcode.js`
- 증상: LeetCode가 비공식 API 변경 시 즉시 깨짐. error 케이스가 사용자에게 어떻게 보이는지 확인 필요.
- Fix: error fallback이 명확한 메시지 ("LeetCode profile fetch failed — they may have changed their API").

**[P3] `posts.js` 의 RSS 파싱**
- 위치: `src/cards/posts.js`, `src/fetchers/posts.js`
- 증상: RSS 피드의 외부 콘텐츠를 SVG에 embed. XSS 가능성.
- Fix: 모든 RSS field에 escapeHtml 적용 확인.

**[P3] `examples/` 디렉토리 비어있는지 확인**
- 위치: `ls examples/` → 1개 디렉토리
- Fix: README의 모든 카드 종류에 대한 live example 페이지 추가.

---

## 3. 테스트 상태

| 파일 | 라인 | 평가 |
| --- | --- | --- |
| cards.test.js | 244 | 27개 카드 × 모든 theme cross-product smoke. 좋음. |
| options.test.js | 87 | parseCardOptions 옵션 surface. |
| stack.test.js | 192 | card composition 로직. |
| theme-url.test.js | 286 | **SSRF 방어 회귀 가드. 매우 두꺼움. P1 보안의 보호막.** |
| themes.test.js | 116 | 내장 theme 정의. |
| tokens.test.js | 51 | design tokens (radius, spacing). |
| utils.test.js | 106 | escapeHtml, parseColor 등. |

- **node:test 표준 러너** → 의존성 0개. 빠르고 가벼움.
- **엉터리 테스트 없음**, 의도가 명확. theme-url.test.js 가 특히 잘 짜여있음 (보안 회귀 직접 가드).
- **부족한 영역**: visual regression, fetcher의 GraphQL error 분기, error 카드의 SVG escape.

---

## 4. 시장 가치 (2026-04-11 기준, 글로벌 관점)

**한 줄 평**: 카테고리 dominant player (`anuraghazra/github-readme-stats`, `lowlighter/metrics`) 가 매우 강함. 차별화는 **27개 카드의 breadth + SSRF-safe theme_url + node:test 의존성 0** 세 가지. **niche 진입 가능, mainstream 대체는 어려움.**

**경쟁 환경**

- **anuraghazra/github-readme-stats** — 70k+ stars, 사실상 표준. ([github.com](https://github.com/anuraghazra/github-readme-stats))
- **lowlighter/metrics** — 30+ plugins, 300+ options, SVG/Markdown/PDF/JSON 출력. 가장 기능 많음. ([dev.to](https://dev.to/_d7eb1c1703182e3ce1782/top-github-profile-tools-and-stats-generators-2026-2h3h))
- **awesome-github-stats** — 정확한 contribution 데이터 + live preview. ([github.com](https://github.com/brunobritodev/awesome-github-stats))
- **readme-SVG Toolkit** — 동적 SVG 컴포넌트, 본 프로젝트와 가장 유사한 컨셉. ([github.com](https://github.com/readme-SVG))
- **GitHub Cards API (Cloudflare Workers)** — 서버리스, 빠름. 직접 경쟁자.

**ProfileKit의 차별화 가능 포인트**

1. **카드 종류 27개** (stats/languages/pin/leetcode/social/posts/quote/hero/section/divider/now/timeline/tags/toc/typing/wave/terminal/neon/glitch/matrix/snake/equalizer/heartbeat/constellation/radar) — github-readme-stats(7개) 대비 4배. 단 metrics는 30+ plugins이라 동급.
2. **theme_url 외부 파레트**: gist에 JSON 올려서 share. 다른 도구에 거의 없는 기능.
3. **SSRF 방어 textbook 수준** — security-conscious 사용자에게 어필.
4. **No ratings, no rankings** (README의 thesis) — github-readme-stats의 rank/grade 표시를 의도적으로 제거. anti-gamification 정체성.
5. **node:test, 의존성 0** — fork/self-host 시 가장 가벼움.
6. **Animated cards (wave/typing/snake)** — github-readme-stats에 없음, 일부 alternatives에만 있음.

**시장 진입 전략**

- **mainstream 대체**: 어려움. anuraghazra/github-readme-stats가 70k stars의 lock-in.
- **niche 진입 1**: SSRF-conscious 기업 사용자 (보안 audit 통과 필요한 환경). theme-url.js 의 방어층이 무기.
- **niche 진입 2**: animated cards / 27개 breadth가 필요한 dev influencer.
- **niche 진입 3**: anti-gamification 사용자. "No ratings, no rankings" 슬로건이 명확한 가치 주장.
- **수익화**: 0. 개인 hosted serverless는 무료 + traffic 부담만 있음.

**ROI 분석**

- **현재 사용자**: dogfooding (heznpc README 1개)
- **잠재**: 위 niche 3개가 합쳐서 1만 stars 가능. mainstream 대체는 ROI 낮음.
- **운영 부담**: GitHub token rate limit이 가장 큰 부담. KV 캐싱 필수.
- **리스크**: GitHub의 GraphQL API 변경, LeetCode 비공식 API 변경, RSS 사이트 형식 변경.

**결론**

- **글로벌 가치**: ★★★☆☆. 카테고리 dominant player가 있으나 차별화 명확.
- **기술 품질**: ★★★★★. SSRF 방어 / SVG 카드 architecture / 의존성 0 모두 모범적.
- **권장**: KV 캐싱 추가 + CI 추가 + GitHub token 풀로 100~1000 동시 사용자 감당 가능 상태 만든 후 ProductHunt/HN 런칭.

---

## 5. 한 줄 요약

> 27개 카드 + SSRF-safe theme_url + node:test 의존성 0 — github-readme-stats의 의식적 alternative로 매우 잘 만들어짐. **단일 GitHub token rate limit과 in-memory cache 한계, CI 부재** 3개를 닫으면 niche 진입 준비 완료. 카드 코드 중복 정리는 후순위.

## Sources

- [anuraghazra/github-readme-stats — 70k stars dominant](https://github.com/anuraghazra/github-readme-stats)
- [Top GitHub Profile Tools 2026 — DEV Community](https://dev.to/_d7eb1c1703182e3ce1782/top-github-profile-tools-and-stats-generators-2026-2h3h)
- [readme-SVG Toolkit](https://github.com/readme-SVG)
- [brunobritodev/awesome-github-stats](https://github.com/brunobritodev/awesome-github-stats)
- [GitHub Topics — readme-stats](https://github.com/topics/readme-stats)
- [GitHub Topics — profile-card](https://github.com/topics/profile-card)
