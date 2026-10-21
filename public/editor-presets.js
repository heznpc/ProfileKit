/* README starting points built from the same editable ProfileKit card endpoints. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ProfileKitEditorPresets = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const card = (id, endpoint, width, height, params) => ({
    id, type: "card", endpoint, params, sourceOrigin: "https://profilekit.vercel.app",
    nativeWidth: width, nativeHeight: height, x: 0, y: 0, width, height, rotation: 0, opacity: 1,
  });
  const document = (name, width, height, elements) => ({
    kind: "profilekit-card", version: 1, name, width, height, background: "transparent", elements,
  });

  return {
    header: {
      id: "header",
      label: "프로필 헤더",
      description: "이름, 소개와 배경 효과를 편집하는 README 헤더입니다.",
      make({ username = "octocat" } = {}) {
        return document("My README header", 900, 220, [
          card("header-hero", "hero", 900, 220, {
            name: "YOUR NAME", subtitle: "What you build. What you care about.",
            bg: "wave", theme: "tokyo_night", font: "space-grotesk", width: "900", height: "220",
          }),
        ]);
      },
    },
    metrics: {
      id: "metrics",
      label: "GitHub 통계",
      description: "GitHub 계정의 활동을 보여주는 통계 카드입니다.",
      make({ username = "octocat" } = {}) {
        return document("GitHub stats", 495, 255, [
          card("metrics-stats", "stats", 495, 255, { username, theme: "tokyo_night", width: "495", height: "255" }),
        ]);
      },
    },
    matrix: {
      id: "matrix",
      label: "매트릭스 효과",
      description: "색상과 속도를 바꿀 수 있는 매트릭스 애니메이션입니다.",
      make({ username = "octocat" } = {}) {
        return document("Matrix effect", 900, 180, [
          card("matrix-effect", "matrix", 900, 180, { color: "70a5fd", speed: "0.5", width: "900", height: "180" }),
        ]);
      },
    },
    blank: {
      id: "blank",
      label: "빈 캔버스",
      description: "카드와 텍스트, 이미지, 도형을 원하는 대로 배치하세요.",
      make({ username = "octocat" } = {}) { return document("Untitled README", 900, 220, []); },
    },
  };
});
