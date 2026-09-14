(() => {
  "use strict";

  const STORAGE_KEY = "profilekit.locale";
  const SUPPORTED = new Set(["en", "ko"]);

  const messages = {
    en: {
      ui: {
        pageTitle: "ProfileKit Studio",
        tagline: "Composable profile cards for a README that feels like yours.",
        cards: "Card Studio",
        templates: "Presets",
        compose: "README Builder",
        github: "GitHub",
        docs: "Docs",
        language: "Language",
        catalog: "Card library",
        catalogHint: "Choose a card to start",
        searchCards: "Search cards",
        allCards: "All",
        liveSvg: "Live SVG",
        livePreview: "Live preview",
        useCard: "Use this card",
        useCardHint: "Copy the Markdown and paste it directly into your README.",
        copyMarkdown: "Copy Markdown",
        copyUrl: "Copy URL",
        copyShare: "Copy share link",
        downloadPng: "Download PNG",
        downloadPngHint: "PNG snapshot of this card",
        preparingPng: "Preparing PNG…",
        downloadedPng: "PNG downloaded",
        pngFailed: "PNG unavailable",
        copied: "Copied",
        customize: "Customize",
        customizeHint: "Selected card settings",
        reset: "Reset",
        quickLooks: "Quick looks",
        lookDefault: "Original",
        lookLight: "Light",
        lookDimmed: "Soft dark",
        contentTab: "Content",
        styleTab: "Style",
        adjustTab: "Size & motion",
        templatesTitle: "Ready-made starting points",
        templatesIntro: "Pick a look you like, load it into the editor, and make it yours.",
        loadEditor: "Edit this preset",
        by: "by",
        inventory: "Add a block",
        noBlocksTitle: "Start with one block",
        noBlocksHint: "Choose a card or Markdown block from the library.",
        clear: "Clear",
        copyReadme: "Copy README Markdown",
        slotInspector: "Block settings",
        noBlockSelected: "No block selected",
        selectBlockHint: "Select a block in the canvas to edit it.",
        markdownBlock: "Markdown block",
        editCanvas: "Edit the text directly in the canvas.",
        addBlock: "Add {name} block",
        moveUp: "Move {name} up",
        moveDown: "Move {name} down",
        remove: "Remove {name}",
        clearConfirm: "Clear all blocks?",
        previewUnavailable: "Preview unavailable: {reason}",
        malformedSvg: "The card returned an invalid SVG.",
        loading: "Loading preview...",
        markdown: "Markdown",
        emptySearch: "No cards match your search.",
        customColor: "Use a custom color",
        background: "Background",
        systemFont: "System font",
        monospaceFont: "Monospace font",
        defaultValue: "Default",
      },
      groups: {
        Data: "GitHub data",
        Blog: "Profile layout",
        Animation: "Motion",
        "Blog Layout": "Profile layout",
        Animations: "Motion",
        Plain: "Text",
      },
      cards: {
        stats: ["Stats", "Show commits, pull requests, issues, stars, and repositories."],
        languages: ["Languages", "Present your most-used languages as bars or a donut."],
        reviews: ["Code reviews", "Show review activity with a clear approval ring."],
        pin: ["Repository", "Spotlight one repository with its description and metadata."],
        leetcode: ["LeetCode", "Present your LeetCode problem-solving activity."],
        social: ["Social links", "Collect your public links in one compact card."],
        quote: ["Daily quote", "Add a developer quote that changes daily."],
        hero: ["Profile hero", "Open your README with a personal, animated banner."],
        section: ["Section heading", "Create a strong heading between README sections."],
        divider: ["Divider", "Separate content with one of six visual styles."],
        now: ["Now", "Share what you are coding, reading, listening to, or building."],
        timeline: ["Timeline", "Lay out milestones and work as a vertical timeline."],
        tags: ["Skills", "Show technologies and interests as a tag collection."],
        toc: ["Table of contents", "Give readers a compact map of your README."],
        posts: ["Latest posts", "Show recent writing from supported publishing services."],
        typing: ["Typing", "Animate multiple lines with a typewriter effect."],
        wave: ["Wave", "Pair a title with layered animated waves."],
        terminal: ["Terminal", "Present commands in an animated terminal window."],
        neon: ["Neon", "Give a short message a neon glow and flicker."],
        glitch: ["Glitch", "Create animated RGB-split display text."],
        matrix: ["Matrix", "Place a message over animated code rain."],
        snake: ["Contribution snake", "Add a standalone snake on a contribution grid."],
        equalizer: ["Equalizer", "Show animated audio bars with a live indicator."],
        heartbeat: ["Heartbeat", "Pair a message with an animated pulse line."],
        constellation: ["Constellation", "Connect a title with twinkling stars."],
        radar: ["Radar", "Show a rotating radar sweep with configurable blips."],
      },
      params: {
        username: "GitHub username",
        layout: "Layout",
        langs_count: "Languages shown",
        theme: "Theme",
        font: "Typeface",
        accent_color: "Accent color",
        border_radius: "Corner radius",
        hide_border: "Hide border",
        hide_bar: "Hide accent bar",
        repo: "Repository",
        card_width: "Card width",
        max_desc_lines: "Description lines",
        github: "GitHub username",
        linkedin: "LinkedIn username",
        x: "X username",
        email: "Email",
        website: "Website",
        daily: "Use the daily quote",
        name: "Name",
        subtitle: "Subtitle",
        bg: "Background",
        align: "Alignment",
        width: "Width",
        height: "Height",
        color: "Color",
        title: "Title",
        icon: "Icon",
        style: "Style",
        coding: "Coding",
        reading: "Reading",
        listening: "Listening",
        building: "Building",
        items: "Items",
        tags: "Skills and tags",
        source: "Source",
        url: "Feed URL",
        count: "Item count",
        lines: "Lines",
        size: "Text size",
        frame: "Show frame",
        text: "Text",
        waves: "Wave count",
        commands: "Commands",
        prompt: "Prompt",
        window_title: "Window title",
        speed: "Animation speed",
        density: "Density",
        seed: "Pattern seed",
        cols: "Columns",
        rows: "Rows",
        duration: "Duration",
        label: "Label",
        bars: "Bar count",
        bpm: "Beats per minute",
        blips: "Blip count",
      },
      options: {
        default: "Default",
        compact: "Compact",
        donut: "Donut",
        dark: "Dark",
        dark_dimmed: "Dimmed dark",
        light: "Light",
        center: "Center",
        left: "Left",
        right: "Right",
        gradient: "Gradient",
        wave: "Wave",
        grid: "Grid",
        particles: "Particles",
        line: "Line",
        dots: "Dots",
        dashed: "Dashed",
        double: "Double",
        none: "None",
        sm: "Small",
        md: "Medium",
        lg: "Large",
        xl: "Extra large",
        "2xl": "2X large",
        "3xl": "3X large",
        full: "Round",
      },
      templates: {
        "minimal-stats": ["Minimal stats", "A borderless stats card with no accent bar."],
        "tokyo-hero": ["Tokyo Night hero", "A wide README opener with cool blues and a wave background."],
        "donut-langs": ["Language donut", "Six languages in a compact donut layout."],
        "kanagawa-stats": ["Kanagawa stats", "A calm, ink-inspired palette with reduced metrics."],
        "rose-pine-pin": ["Rose Pine repository", "A soft repository spotlight in the Rose Pine palette."],
        "matrix-banner": ["Matrix banner", "A wide title over classic animated code rain."],
        "gradient-divider": ["Gradient divider", "A clean separator for README sections."],
        "neon-sign": ["Neon sign", "A vivid animated accent for one key message."],
        "research-stats": ["Research profile stats", "A quieter stats card for academic profiles."],
        "research-themes": ["Research themes", "A wide tag collection for fields and interests."],
        "paper-pin": ["Paper repository", "A repository card designed for research projects."],
      },
      examples: {
        hero: { name: "ProfileKit", subtitle: "Make your profile feel like yours" },
        section: { title: "About", subtitle: "A little more about me" },
        now: { coding: "ProfileKit", reading: "A good book", listening: "Favorite tracks", building: "A new project" },
        timeline: { items: "2026;Shipped ProfileKit;Open source|2025;Started building;First prototype" },
        toc: { items: "About|Activity|Projects|Contact" },
        typing: { lines: "ProfileKit,Make+your+profile+yours" },
        equalizer: { label: "Now playing" },
        heartbeat: { text: "Still building" },
        radar: { text: "EXPLORING" },
      },
    },
    ko: {
      ui: {
        pageTitle: "ProfileKit 스튜디오",
        tagline: "나를 닮은 README를 만드는 조합형 프로필 카드.",
        cards: "카드 만들기",
        templates: "프리셋",
        compose: "README 조합",
        github: "GitHub",
        docs: "문서",
        language: "언어",
        catalog: "카드 라이브러리",
        catalogHint: "카드를 골라 시작하세요",
        searchCards: "카드 검색",
        allCards: "전체",
        liveSvg: "실시간 SVG",
        livePreview: "실시간 미리보기",
        useCard: "이 카드 사용하기",
        useCardHint: "Markdown을 복사해 README에 바로 붙여 넣으세요.",
        copyMarkdown: "Markdown 복사",
        copyUrl: "URL 복사",
        copyShare: "공유 링크 복사",
        downloadPng: "PNG 다운로드",
        downloadPngHint: "이 카드의 PNG 이미지",
        preparingPng: "PNG 준비 중…",
        downloadedPng: "PNG 다운로드됨",
        pngFailed: "PNG 변환 실패",
        copied: "복사됨",
        customize: "내 스타일로 설정",
        customizeHint: "선택한 카드 설정",
        reset: "초기화",
        quickLooks: "빠른 스타일",
        lookDefault: "기본",
        lookLight: "라이트",
        lookDimmed: "차분한 다크",
        contentTab: "내용",
        styleTab: "스타일",
        adjustTab: "크기·동작",
        templatesTitle: "바로 시작할 수 있는 프리셋",
        templatesIntro: "마음에 드는 스타일을 골라 편집기로 불러온 뒤 나답게 바꿔보세요.",
        loadEditor: "이 프리셋 편집",
        by: "제작",
        inventory: "블록 추가",
        noBlocksTitle: "블록 하나로 시작하세요",
        noBlocksHint: "라이브러리에서 카드나 Markdown 블록을 선택하세요.",
        clear: "모두 지우기",
        copyReadme: "README Markdown 복사",
        slotInspector: "블록 설정",
        noBlockSelected: "선택한 블록 없음",
        selectBlockHint: "캔버스에서 블록을 선택하면 설정을 바꿀 수 있습니다.",
        markdownBlock: "Markdown 블록",
        editCanvas: "텍스트는 캔버스에서 직접 편집하세요.",
        addBlock: "{name} 블록 추가",
        moveUp: "{name} 위로 이동",
        moveDown: "{name} 아래로 이동",
        remove: "{name} 삭제",
        clearConfirm: "모든 블록을 지울까요?",
        previewUnavailable: "미리보기를 불러오지 못했습니다: {reason}",
        malformedSvg: "카드가 올바른 SVG를 반환하지 않았습니다.",
        loading: "미리보기 불러오는 중...",
        markdown: "Markdown",
        emptySearch: "검색 결과가 없습니다.",
        customColor: "직접 색상 선택",
        background: "배경",
        systemFont: "시스템 글꼴",
        monospaceFont: "고정폭 글꼴",
        defaultValue: "기본값",
      },
      groups: {
        Data: "GitHub 데이터",
        Blog: "프로필 구성",
        Animation: "움직이는 카드",
        "Blog Layout": "프로필 구성",
        Animations: "움직이는 카드",
        Plain: "텍스트",
      },
      cards: {
        stats: ["활동 통계", "커밋, PR, 이슈, 별, 저장소 활동을 한눈에 보여줍니다."],
        languages: ["사용 언어", "자주 사용하는 언어를 막대나 도넛 형태로 보여줍니다."],
        reviews: ["코드 리뷰", "리뷰 활동과 승인 비율을 명확하게 보여줍니다."],
        pin: ["저장소 소개", "설명과 주요 정보를 담아 저장소 하나를 강조합니다."],
        leetcode: ["LeetCode", "LeetCode 문제 풀이 활동을 카드로 보여줍니다."],
        social: ["소셜 링크", "공개 프로필과 연락처를 하나의 카드에 모읍니다."],
        quote: ["오늘의 문장", "매일 바뀌는 개발자 문장을 추가합니다."],
        hero: ["프로필 히어로", "개성 있는 움직이는 배너로 README를 시작합니다."],
        section: ["섹션 제목", "README 섹션 사이에 선명한 제목을 만듭니다."],
        divider: ["구분선", "여섯 가지 스타일로 콘텐츠 사이를 나눕니다."],
        now: ["요즘 하는 일", "코딩, 독서, 음악, 만들고 있는 것을 공유합니다."],
        timeline: ["타임라인", "경력과 주요 순간을 세로 흐름으로 정리합니다."],
        tags: ["기술과 관심사", "기술과 관심사를 태그 모음으로 보여줍니다."],
        toc: ["목차", "README의 내용을 한눈에 볼 수 있게 안내합니다."],
        posts: ["최근 글", "지원되는 글쓰기 서비스의 최근 게시물을 보여줍니다."],
        typing: ["타이핑", "여러 문장을 타자기 효과로 보여줍니다."],
        wave: ["웨이브", "제목과 겹겹이 움직이는 물결을 함께 보여줍니다."],
        terminal: ["터미널", "명령어를 자동으로 입력하는 터미널 창을 만듭니다."],
        neon: ["네온", "짧은 문장에 네온 빛과 깜빡임을 더합니다."],
        glitch: ["글리치", "RGB 분리 효과가 움직이는 제목을 만듭니다."],
        matrix: ["매트릭스", "움직이는 코드 비 위에 메시지를 표시합니다."],
        snake: ["기여 스네이크", "기여 격자 위를 움직이는 스네이크를 추가합니다."],
        equalizer: ["이퀄라이저", "라이브 표시와 함께 오디오 막대를 움직입니다."],
        heartbeat: ["하트비트", "문장과 함께 맥박 선을 움직입니다."],
        constellation: ["별자리", "반짝이는 별과 연결선 사이에 제목을 배치합니다."],
        radar: ["레이더", "설정 가능한 점과 회전하는 레이더를 보여줍니다."],
      },
      params: {
        username: "GitHub 사용자명",
        layout: "배치",
        langs_count: "표시할 언어 수",
        theme: "테마",
        font: "글꼴",
        accent_color: "강조 색상",
        border_radius: "모서리 둥글기",
        hide_border: "테두리 숨기기",
        hide_bar: "강조선 숨기기",
        repo: "저장소",
        card_width: "카드 너비",
        max_desc_lines: "설명 줄 수",
        github: "GitHub 사용자명",
        linkedin: "LinkedIn 사용자명",
        x: "X 사용자명",
        email: "이메일",
        website: "웹사이트",
        daily: "오늘의 문장 사용",
        name: "이름",
        subtitle: "보조 문구",
        bg: "배경",
        align: "정렬",
        width: "너비",
        height: "높이",
        color: "색상",
        title: "제목",
        icon: "아이콘",
        style: "스타일",
        coding: "코딩 중",
        reading: "읽는 중",
        listening: "듣는 중",
        building: "만드는 중",
        items: "항목",
        tags: "기술과 태그",
        source: "출처",
        url: "피드 URL",
        count: "항목 수",
        lines: "문장",
        size: "글자 크기",
        frame: "프레임 표시",
        text: "문구",
        waves: "물결 수",
        commands: "명령어",
        prompt: "프롬프트",
        window_title: "창 제목",
        speed: "움직임 속도",
        density: "밀도",
        seed: "패턴 시드",
        cols: "열 수",
        rows: "행 수",
        duration: "재생 시간",
        label: "레이블",
        bars: "막대 수",
        bpm: "분당 박동",
        blips: "점 개수",
      },
      options: {
        default: "기본",
        compact: "간결하게",
        donut: "도넛",
        dark: "다크",
        dark_dimmed: "차분한 다크",
        light: "라이트",
        center: "가운데",
        left: "왼쪽",
        right: "오른쪽",
        gradient: "그라디언트",
        wave: "물결",
        grid: "격자",
        particles: "입자",
        line: "직선",
        dots: "점",
        dashed: "점선",
        double: "이중선",
        none: "없음",
        sm: "작게",
        md: "보통",
        lg: "크게",
        xl: "매우 크게",
        "2xl": "2단계 크게",
        "3xl": "3단계 크게",
        full: "완전히 둥글게",
      },
      templates: {
        "minimal-stats": ["미니멀 활동 통계", "테두리와 강조선을 덜어낸 깔끔한 통계 카드입니다."],
        "tokyo-hero": ["도쿄 나이트 히어로", "차가운 파란색과 물결 배경을 사용한 넓은 시작 배너입니다."],
        "donut-langs": ["언어 도넛", "여섯 개 언어를 간결한 도넛 배치로 보여줍니다."],
        "kanagawa-stats": ["가나가와 통계", "수묵화처럼 차분한 색과 필요한 지표만 남긴 카드입니다."],
        "rose-pine-pin": ["로즈 파인 저장소", "부드러운 색으로 저장소 하나를 강조합니다."],
        "matrix-banner": ["매트릭스 배너", "움직이는 코드 비 위에 넓은 제목을 배치합니다."],
        "gradient-divider": ["그라디언트 구분선", "README 섹션을 깔끔하게 나누는 구분선입니다."],
        "neon-sign": ["네온 사인", "핵심 문장 하나를 선명하게 강조합니다."],
        "research-stats": ["연구자 활동 통계", "학술 프로필에 맞춘 차분한 통계 카드입니다."],
        "research-themes": ["연구 주제", "연구 분야와 관심사를 넓은 태그 모음으로 보여줍니다."],
        "paper-pin": ["논문 저장소", "연구 프로젝트를 소개하기 위한 저장소 카드입니다."],
      },
      examples: {
        hero: { name: "ProfileKit", subtitle: "나를 닮은 프로필 카드" },
        section: { title: "소개", subtitle: "저를 조금 더 소개합니다" },
        now: { coding: "ProfileKit", reading: "요즘 읽는 책", listening: "좋아하는 음악", building: "새로운 프로젝트" },
        timeline: { items: "2026;ProfileKit 공개;오픈소스|2025;만들기 시작;첫 프로토타입" },
        toc: { items: "소개|활동|프로젝트|연락처" },
        typing: { lines: "ProfileKit,나를+닮은+프로필+카드" },
        equalizer: { label: "지금 듣는 음악" },
        heartbeat: { text: "계속 만들고 있습니다" },
        radar: { text: "탐색 중" },
      },
    },
  };

  function readStoredLocale() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function storeLocale(next) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Language switching still works when storage is disabled.
    }
  }

  function detectLocale() {
    const stored = readStoredLocale();
    if (SUPPORTED.has(stored)) return stored;
    const preferred = (navigator.languages || [navigator.language || "en"])
      .map((value) => value.toLowerCase().split("-")[0])
      .find((value) => SUPPORTED.has(value));
    return preferred || "en";
  }

  let locale = detectLocale();

  function humanize(value) {
    if (!value) return "";
    return value
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .replace(/\bIbm\b/g, "IBM")
      .replace(/\bGithub\b/g, "GitHub");
  }

  function format(template, values = {}) {
    return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  }

  function t(key, values) {
    const value = messages[locale].ui[key] || messages.en.ui[key] || key;
    return format(value, values);
  }

  function group(key) {
    return messages[locale].groups[key] || messages.en.groups[key] || humanize(key);
  }

  function card(key, index, fallback) {
    return messages[locale].cards[key]?.[index]
      || messages.en.cards[key]?.[index]
      || fallback;
  }

  function param(key) {
    return messages[locale].params[key] || messages.en.params[key] || humanize(key);
  }

  function option(value, fallback) {
    if (value === "") return fallback || (locale === "ko" ? "기본값" : "Default");
    return messages[locale].options[value]
      || messages.en.options[value]
      || humanize(value);
  }

  function template(key, index, fallback) {
    return messages[locale].templates[key]?.[index]
      || messages.en.templates[key]?.[index]
      || fallback;
  }

  function example(cardKey, paramKey, fallback) {
    return messages[locale].examples?.[cardKey]?.[paramKey]
      ?? messages.en.examples?.[cardKey]?.[paramKey]
      ?? fallback;
  }

  function applyStatic() {
    document.documentElement.lang = locale;
    document.title = t("pageTitle");
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
    const select = document.getElementById("locale-select");
    if (select) value(select, locale);
  }

  function value(select, next) {
    if (select.value !== next) select.value = next;
  }

  function setLocale(next) {
    if (!SUPPORTED.has(next) || next === locale) return;
    locale = next;
    storeLocale(locale);
    applyStatic();
    window.dispatchEvent(new CustomEvent("profilekit:localechange"));
  }

  window.ProfileKitI18n = {
    applyStatic,
    card,
    example,
    get locale() { return locale; },
    group,
    option,
    param,
    setLocale,
    t,
    template,
  };

  const localeSelect = document.getElementById("locale-select");
  if (localeSelect) {
    localeSelect.addEventListener("change", () => setLocale(localeSelect.value));
  }
  applyStatic();
})();
