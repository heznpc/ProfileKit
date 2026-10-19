/* Editable starting points: every visible part remains a document element. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ProfileKitEditorPresets = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const text = (id, x, y, width, height, content, options = {}) => ({
    id, type: "text", x, y, width, height, rotation: 0, opacity: 1,
    text: content, fontFamily: "sans", fontSize: 24, fontWeight: 400,
    color: "#252b28", align: "left", ...options,
  });
  const rect = (id, x, y, width, height, fill, options = {}) => ({
    id, type: "rect", x, y, width, height, rotation: 0, opacity: 1,
    fill, stroke: "none", strokeWidth: 0, radius: 0, ...options,
  });
  const ellipse = (id, x, y, width, height, fill, options = {}) => ({
    ...rect(id, x, y, width, height, fill, options), type: "ellipse",
  });
  const document = (name, background, elements) => ({
    kind: "profilekit-card", version: 1, name, width: 960, height: 540,
    background, elements,
  });

  return {
    editorial: {
      id: "editorial",
      label: "활자 표지",
      description: "큰 활자, 단정한 구획, 충분한 여백. 내가 만드는 것을 소개하세요.",
      make() {
        return document("Small ideas, real things", "#f3eee3", [
          text("editorial-kicker", 52, 37, 440, 22, "A PERSONAL INTRODUCTION", { fontFamily: "mono", fontSize: 14, fontWeight: 700 }),
          text("editorial-edition", 684, 37, 224, 22, "VOL. 01 / HELLO, WORLD", { fontFamily: "mono", fontSize: 12, align: "right", color: "#6f7568" }),
          rect("editorial-rule-top", 52, 82, 856, 1.5, "#252b28"),
          text("editorial-title", 49, 111, 670, 210, "Small ideas.\nReal things.", { fontFamily: "serif", fontSize: 84, fontWeight: 700 }),
          ellipse("editorial-stamp", 758, 136, 148, 148, "#cf5c47"),
          text("editorial-arrow", 776, 148, 112, 112, "↗", { fontFamily: "sans", fontSize: 88, align: "center", fontWeight: 400, rotation: -10 }),
          text("editorial-intro", 54, 340, 770, 76, "안녕하세요, 윤입니다.\n좋아하는 것을 만들고, 배운 것을 기록합니다.", { fontSize: 25, color: "#515b4d" }),
          rect("editorial-rule-bottom", 52, 446, 856, 1, "#9ca18e"),
          text("editorial-footnote", 54, 467, 410, 24, "DESIGN × CODE × EVERYDAY LIFE", { fontFamily: "mono", fontSize: 13, fontWeight: 700 }),
          text("editorial-signoff", 622, 465, 286, 28, "매일 조금씩, 꾸준히.", { fontFamily: "serif", fontSize: 21, align: "right" }),
        ]);
      },
    },
    collage: {
      id: "collage",
      label: "취향의 조각",
      description: "사진 한 장, 마음에 드는 문장, 작은 색 조각. 겹쳐서 만드는 나의 소개.",
      make({ imageSrc } = {}) {
        const photo = imageSrc
          ? { id: "collage-photo", type: "image", x: 62, y: 104, width: 472, height: 296, rotation: -5, opacity: 1, src: imageSrc, fit: "cover" }
          : rect("collage-photo-placeholder", 62, 104, 472, 296, "#507b82", { rotation: -5 });
        return document("취향의 조각 — my little world", "#e4e8d9", [
          text("collage-kicker", 49, 31, 450, 27, "NOTES FROM MY LITTLE WORLD", { fontFamily: "mono", fontSize: 14, fontWeight: 700 }),
          ellipse("collage-sun", 803, 22, 98, 98, "#d97b53"),
          text("collage-sun-symbol", 813, 25, 78, 76, "✳", { fontSize: 63, align: "center", color: "#f8f1d9" }),
          rect("collage-paper", 42, 83, 512, 370, "#fffdf5", { rotation: -5, radius: 2 }),
          photo,
          text("collage-photo-caption", 84, 413, 414, 23, "somewhere I would like to stay.", { fontFamily: "mono", fontSize: 13, rotation: -5, color: "#6f7568" }),
          rect("collage-tape-top", 214, 77, 150, 34, "#ddd39d", { rotation: 4, opacity: 0.83 }),
          text("collage-title", 552, 122, 355, 200, "GOOD\nDAYS.", { fontSize: 79, fontWeight: 700, rotation: 4, color: "#293c34" }),
          rect("collage-sticker", 575, 332, 322, 64, "#e7ab87", { rotation: 5 }),
          text("collage-sticker-text", 586, 348, 300, 35, "만들고 · 배우고 · 기록해요", { fontSize: 21, fontWeight: 700, align: "center", rotation: 5, color: "#513c2e" }),
          text("collage-intro", 566, 430, 350, 74, "취향을 모아\n나를 소개합니다.", { fontFamily: "serif", fontSize: 28, color: "#435347" }),
          text("collage-number", 47, 490, 230, 20, "COLLECTED WITH CARE / 01", { fontFamily: "mono", fontSize: 11, color: "#788571" }),
        ]);
      },
    },
    blank: {
      id: "blank",
      label: "빈 카드",
      description: "정해진 자리 없이, 처음부터 자유롭게 만들어 보세요.",
      make() { return document("이름 없는 카드", "#f3eee3", []); },
    },
  };
});
