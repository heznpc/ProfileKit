/* Shared UI translations for the creator and README workspace. Never edits project data. */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ProfileKitStudioI18n = api.createRuntime(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const STORAGE_KEY = "profilekit.locale";
  const SUPPORTED = ["en", "ko"];
  const pairs = [
    ["언어", "Language"],
    ["ProfileKit 카드와 효과를 편집하고 GitHub README에 넣을 임베드 코드를 만드세요.", "Edit ProfileKit cards and effects, then create embed code for your GitHub README."],
    ["README의 글과 배치는 그대로 두고, ProfileKit 카드의 계정과 디자인을 한곳에서 편집하세요.", "Keep your README text and layout while editing your ProfileKit cards in one place."],
    ["README 편집 · ProfileKit", "README Editor · ProfileKit"],
    ["미리보기로 이동", "Skip to preview"],
    ["README 미리보기로 이동", "Skip to README preview"],
    ["ProfileKit 카드 라이브러리", "ProfileKit card library"],
    ["프로젝트", "Project"],
    ["프로젝트와 내보내기", "Project and export"],
    ["수정 없이 돌아가기", "Return without changes"],
    ["README에 반영", "Apply to README"],
    ["이전 초안 복원", "Restore previous draft"],
    ["열기", "Open"],
    ["프로젝트 저장", "Save project"],
    ["README에 넣기", "Use in README"],
    ["편집 화면 이동", "Editor navigation"],
    ["미리보기", "Preview"],
    ["가져오기", "Import"],
    ["카드 추가", "Add a card"],
    ["속성 편집", "Edit properties"],
    ["카드 라이브러리와 레이어", "Card library and layers"],
    ["기존 카드 가져오기", "Import an existing card"],
    ["ProfileKit URL, 이미지 태그 또는 Markdown", "ProfileKit URL, image tag, or Markdown"],
    ["ProfileKit 카드 URL,\n<img> 또는 Markdown 붙여넣기", "Paste a ProfileKit card URL,\n<img> tag, or Markdown"],
    ["카드 불러오기", "Load card"],
    ["README 전체 편집", "Edit your full README"],
    ["새 카드에 사용할 GitHub 계정", "GitHub account for new cards"],
    ["카드 검색", "Search cards"],
    ["카드와 효과 검색", "Search cards and effects"],
    ["사용 가능한 ProfileKit 카드", "Available ProfileKit cards"],
    ["시작 구성", "Starting layouts"],
    ["프로필 헤더", "Profile header"],
    ["GitHub 통계", "GitHub stats"],
    ["매트릭스 효과", "Matrix effect"],
    ["빈 캔버스", "Blank canvas"],
    ["레이어", "Layers"],
    ["위 → 앞", "Top → front"],
    ["캔버스 요소 목록", "Canvas elements"],
    ["카드 라이브러리 둘러보기", "Browse the card library"],
    ["README 카드 작업판", "README card canvas"],
    ["편집 기록", "Edit history"],
    ["실행 취소", "Undo"],
    ["다시 실행", "Redo"],
    ["요소 추가", "Add an element"],
    ["카드 안 꾸미기", "Edit card elements"],
    ["텍스트", "Text"],
    ["이미지", "Image"],
    ["사각형", "Rectangle"],
    ["원", "Circle"],
    ["타원", "Ellipse"],
    ["빈 텍스트", "Empty text"],
    ["README 미리보기", "README preview"],
    ["README 배경 미리보기", "README background preview"],
    ["README 카드 작업판. 요소를 선택해 이동하거나 크기를 조절할 수 있습니다.", "README card canvas. Select an element to move or resize it."],
    ["카드를 선택해 내용과 효과를 편집하세요.", "Select a card to edit its content and effects."],
    ["배경 미리보기는 카드 테마를 바꾸지 않습니다.", "The preview background does not change the card theme."],
    ["카드 URL을 가져오거나 라이브러리에서 카드를 추가하세요.", "Import a card URL or add a card from the library."],
    ["캔버스와 선택한 요소의 속성", "Canvas and selected element properties"],
    ["속성", "Properties"],
    ["캔버스", "Canvas"],
    ["너비", "Width"],
    ["높이", "Height"],
    ["배경", "Background"],
    ["transparent 또는 #ffffff", "transparent or #ffffff"],
    ["모든 카드에 적용할 테마", "Theme for all cards"],
    ["적용", "Apply"],
    ["편집할 카드를 선택하세요", "Select a card to edit"],
    ["캔버스나 레이어를 선택하면", "Select a canvas element or layer"],
    ["내용과 스타일을 바꿀 수 있습니다.", "to change its content and style."],
    ["카드 설정", "Card settings"],
    ["README 표시 설정", "README display settings"],
    ["대체 텍스트", "Alternative text"],
    ["카드의 내용을 설명하세요", "Describe the card content"],
    ["README 표시 너비", "Display width in README"],
    ["원본 너비 · 예: 49% 또는 400", "Original width · e.g. 49% or 400"],
    ["클릭하면 열 주소", "Link when clicked"],
    ["추가 쿼리 매개변수", "Additional query parameters"],
    ["가져온 카드의 고급 옵션을 확인하고 수정합니다.", "Review and edit advanced options for the imported card."],
    ["매개변수 적용", "Apply parameters"],
    ["캔버스를 이 카드 크기에 맞추기", "Fit canvas to this card"],
    ["카드 안의 요소", "Elements inside the card"],
    ["위치 · 색상", "Position · color"],
    ["지원되는 제목·문구·배경을 따로 꾸밉니다. 카드 데이터는 계속 갱신됩니다.", "Customize supported titles, text, and backgrounds individually. Card data keeps updating."],
    ["카드 경계 밖 요소 표시", "Show elements outside the card"],
    ["옮긴 요소를 카드 바깥에도 표시합니다. 캔버스 안에 여백이 있어야 하며, 효과 자체의 마스크는 유지됩니다.", "Show moved elements beyond the card edge. Leave space on the canvas; effect masks stay in place."],
    ["캔버스에서 요소 편집", "Edit elements on canvas"],
    ["미리보기 다시 불러오기", "Reload preview"],
    ["편집 모드를 켜고 카드 안의 요소를 눌러 움직이세요.", "Enable editing, then select and drag an element inside the card."],
    ["편집할 요소", "Element to edit"],
    ["가로 이동", "Horizontal offset"],
    ["세로 이동", "Vertical offset"],
    ["크기 배율", "Scale"],
    ["색상", "Color"],
    ["원래 색상", "Original color"],
    ["도형 채움색", "Shape fill"],
    ["원래 채움색", "Original fill"],
    ["도형 선 색상", "Shape stroke"],
    ["원래 선 색상", "Original stroke"],
    ["#7aa2f7 또는 none(없음). 비우면 원래 색상을 복원합니다. 선택한 요소 안의 도형에 함께 적용됩니다.", "Use #7aa2f7 or none. Leave blank to restore the original color. Applies to shapes within the selected element."],
    ["색상은 #7aa2f7처럼 입력하세요. 비우면 원래 색상을 사용합니다.", "Enter a color such as #7aa2f7. Leave blank to use the original color."],
    ["이 요소 숨기기", "Hide this element"],
    ["요소 초기화", "Reset element"],
    ["배치", "Position"],
    ["카드", "Card"],
    ["X 위치", "X position"],
    ["Y 위치", "Y position"],
    ["회전", "Rotation"],
    ["불투명도", "Opacity"],
    ["캔버스 가운데로 정렬", "Center on canvas"],
    ["가로 가운데로 정렬", "Center horizontally"],
    ["가로 가운데", "Horizontal center"],
    ["세로 가운데로 정렬", "Center vertically"],
    ["세로 가운데", "Vertical center"],
    ["내용", "Content"],
    ["추가할 텍스트를 입력하세요.", "Enter text to add."],
    ["글꼴", "Font"],
    ["산세리프", "Sans serif"],
    ["세리프", "Serif"],
    ["고정폭", "Monospace"],
    ["크기", "Size"],
    ["굵기", "Weight"],
    ["보통", "Regular"],
    ["굵게", "Bold"],
    ["글자색", "Text color"],
    ["문단 정렬", "Text alignment"],
    ["왼쪽", "Left"],
    ["가운데", "Center"],
    ["오른쪽", "Right"],
    ["도형", "Shape"],
    ["채우기 색상", "Fill color"],
    ["채우기 색상 선택", "Choose fill color"],
    ["#6366f1 또는 none", "#6366f1 or none"],
    ["테두리 색상", "Border color"],
    ["테두리 색상 선택", "Choose border color"],
    ["#30363d 또는 none", "#30363d or none"],
    ["테두리 두께", "Border width"],
    ["모서리 둥글기", "Corner radius"],
    ["이미지 교체", "Replace image"],
    ["이미지 맞춤", "Image fit"],
    ["꽉 채우기", "Cover"],
    ["전체 보기", "Contain"],
    ["업로드한 이미지는 프로젝트에 함께 저장됩니다.", "Uploaded images are saved with the project."],
    ["레이어 효과", "Layer effects"],
    ["그림자 · 빛", "Shadow · glow"],
    ["효과", "Effect"],
    ["없음", "None"],
    ["그림자", "Shadow"],
    ["빛 번짐", "Glow"],
    ["효과 색상", "Effect color"],
    ["퍼짐", "Blur"],
    ["선택한 레이어 전체에 적용됩니다. 캔버스 바깥의 효과는 잘립니다.", "Applies to the whole selected layer. Effects outside the canvas are clipped."],
    ["효과가 보이도록 캔버스 여백 추가", "Add canvas space for the effect"],
    ["효과 지우기", "Clear effect"],
    ["요소 관리", "Manage elements"],
    ["앞으로 한 칸", "Bring forward"],
    ["뒤로 한 칸", "Send backward"],
    ["복제", "Duplicate"],
    ["삭제", "Delete"],
    ["내보내기 닫기", "Close export"],
    ["카드를 호스팅하는 주소로 임베드 코드를 만듭니다.", "Create embed code using the address that hosts your cards."],
    ["README에 넣는 방식", "README embed format"],
    ["카드별 이미지 · 링크와 실시간 정보 유지", "Separate card images · keep links and live data"],
    ["하나로 합친 이미지 · 캔버스 배치 유지", "One combined image · keep the canvas layout"],
    ["ProfileKit 배포 주소", "ProfileKit deployment URL"],
    ["GitHub에서 보려면 공개 배포 주소가 필요합니다. localhost 주소는 README에서 표시되지 않습니다.", "Use a public deployment URL for GitHub. localhost URLs cannot display in a README."],
    ["README 코드", "README code"],
    ["카드 URL", "Card URL"],
    ["배포에서 이미지 확인", "Verify deployed image"],
    ["README 코드 복사", "Copy README code"],
    ["README 다운로드", "Download README"],
    ["SVG 파일을 저장소에 직접 넣기", "Add an SVG file to your repository"],
    ["SVG를 내려받아 저장소에 추가한 뒤, 아래 경로를 README에 사용하세요. 애니메이션은 유지되며 통계는 저장 시점의 값입니다.", "Download the SVG, add it to your repository, and use the path below in your README. Animations are preserved; statistics reflect the time of download."],
    ["SVG 다운로드", "Download SVG"],
    ["PNG 다운로드", "Download PNG"],
    ["저장소 안의 SVG 경로", "SVG path in your repository"],
    ["파일을 사용하는 README 코드", "README code for the file"],
    ["파일용 README 코드 복사", "Copy file README code"],
    ["SVG 다운로드 후 README에 반영", "Download SVG and apply to README"],
    ["나를 담는 README", "A README that feels like you"],
    ["편집기 선택", "Choose an editor"],
    ["README 편집", "Edit README"],
    ["카드 꾸미기", "Customize cards"],
    ["브라우저에서 편집", "Edit in your browser"],
    ["작업 이름", "Project name"],
    ["작업 저장과 README 내보내기", "Save project and export README"],
    ["작업 열기", "Open project"],
    ["작업 저장", "Save workspace"],
    ["복사", "Copy"],
    ["README 붙여넣기", "Paste README"],
    [".md 파일 열기", "Open .md file"],
    ["글과 배치는 그대로,", "Keep your text and layout."],
    ["카드만 내 것으로.", "Make the cards yours."],
    ["변경 기록", "Change history"],
    ["작업 공간 이동", "Workspace navigation"],
    ["카드 목록", "Card list"],
    ["README 속 카드", "Cards in your README"],
    ["발견한 카드 수", "Number of cards found"],
    ["바꿀 카드를 선택하세요", "Select the cards to change"],
    ["전체", "All"],
    ["해제", "None selected"],
    ["README에서 찾은 ProfileKit 카드", "ProfileKit cards found in the README"],
    ["README를 불러오면", "Load your README"],
    ["ProfileKit 카드가 여기에 모여요.", "to find your ProfileKit cards here."],
    ["밝은 화면·어두운 화면용 카드는 원래의 연결 관계를 유지해요.", "Linked light and dark cards stay paired."],
    ["README 위치", "README location"],
    ["선택 사항", "Optional"],
    ["GitHub 저장소", "GitHub repository"],
    ["README 안의 상대 경로 이미지와 링크를 미리 볼 때 사용해요.", "Used to preview relative image paths and links in your README."],
    ["직접 호스팅한 ProfileKit", "Self-hosted ProfileKit"],
    ["ProfileKit 주소", "ProfileKit URL"],
    ["README 원본과 미리보기", "README source and preview"],
    ["README 보기", "README view"],
    ["원본", "Source"],
    ["미리보기 화면 너비", "Preview width"],
    ["넓은 화면", "Wide screen"],
    ["데스크톱", "Desktop"],
    ["좁은 화면", "Narrow screen"],
    ["모바일", "Mobile"],
    ["미리보기 화면 색상", "Preview appearance"],
    ["밝은 화면", "Light appearance"],
    ["어두운 화면", "Dark appearance"],
    ["README.md", "README.md"],
    ["README 전체 미리보기", "Full README preview"],
    ["이미 만든 README에서", "Start with the README"],
    ["시작하세요.", "you already have."],
    ["소개글, 이미지, 두 칸 배치까지 그대로.", "Keep your introduction, images, and columns."],
    ["ProfileKit 카드의 계정과 디자인을 바꿔보세요.", "Update the accounts and designs of your ProfileKit cards."],
    ["위의", "You can also use"],
    ["로 가져올 수도 있어요.", "above to import your README."],
    ["화면 색상은 미리보기에만 적용돼요. 카드의 색상은 오른쪽에서 바꿀 수 있어요.", "Appearance changes apply only to the preview. Change card colors in the panel on the right."],
    ["README 원본", "README source"],
    ["README 전체를 붙여넣고 불러오세요.", "Paste and load your full README."],
    ["README 전체 Markdown 원본", "Full README Markdown source"],
    ["# 안녕하세요 👋\n\nREADME 전체를 이곳에 붙여넣으세요.\n글과 이미지, HTML 배치도 함께 가져올 수 있어요.", "# Hello 👋\n\nPaste your full README here.\nText, images, and HTML layouts can all be imported."],
    ["원본을 직접 수정한 뒤에도 다시 불러올 수 있어요.", "You can edit the source directly and load it again."],
    ["원본 불러오기", "Load source"],
    ["카드를 선택하세요", "Select a card"],
    ["왼쪽 목록에서 카드를 누르면 내용을 바꿀 수 있어요.", "Select a card in the list to edit its content."],
    ["제작기 결과 프로젝트 저장", "Save creator result as project"],
    ["제작기로 열기", "Open in creator"],
    ["선택한 카드 내용 편집", "Edit selected card content"],
    ["편집할 포함 카드", "Embedded card to edit"],
    ["선택한 카드의 설정이 여기에 표시돼요.", "Settings for the selected card appear here."],
    ["추가 설정", "Additional settings"],
    ["카드 주소에 추가할 값", "Additional URL parameters"],
    ["표시되지 않은 설정은 이곳에서 수정할 수 있어요.", "Edit settings that are not shown above here."],
    ["이 카드에 적용", "Apply to this card"],
    ["선택한 카드 한 번에 바꾸기", "Update selected cards together"],
    ["필요한 항목만 채우면 나머지는 유지돼요.", "Fill in only what you want to change. Everything else stays as it is."],
    ["내 계정으로", "Use my account"],
    ["바꿀 기존 계정", "Existing account to replace"],
    ["모든 계정", "All accounts"],
    ["하나의 계정만 바꾸려면 입력하세요.", "Enter an account to replace only that account."],
    ["새 GitHub 계정", "New GitHub account"],
    ["변경하지 않음", "Keep unchanged"],
    ["저장소 카드의 소유자도 변경", "Also change repository card owners"],
    ["저장소 소유자는 기본으로 유지돼요. 선택하면 일치하는 GitHub 저장소 링크와 소유자를 함께 바꾸고, 저장소 이름은 유지해요.", "Repository owners are kept by default. Enable this to update matching owners and GitHub repository links while keeping repository names."],
    ["함께 쓰는 디자인", "Shared design"],
    ["기본 테마", "Default theme"],
    ["밝은 화면용", "For light appearance"],
    ["어두운 화면용", "For dark appearance"],
    ["화면별 카드가 있는 경우 각각의 테마를 지정할 수 있어요.", "Assign separate themes when your README has light and dark card variants."],
    ["강조 색상", "Accent color"],
    ["직접 지정한 색상 지우기", "Clear custom colors"],
    ["배경·글자 색상을 지우고 선택한 테마의 색상을 써요.", "Clear background and text overrides to use the selected theme colors."],
    ["선택한 카드에 적용", "Apply to selected cards"],
    ["변경한 내용", "Changes"],
    ["카드를 수정하면 변경한 내용을", "After editing a card,"],
    ["여기서 확인할 수 있어요.", "review your changes here."],
    ["README를 붙여넣거나 .md 파일을 열어 시작하세요.", "Paste a README or open an .md file to get started."],
    ["새 카드 만들기", "Create a new card"],
  ];
  pairs.push(
    ["GitHub 계정", "GitHub account"], ["LeetCode 계정", "LeetCode account"],
    ["사용자명", "Username"], ["저장소", "Repository"], ["이름", "Name"],
    ["제목", "Title"], ["소개", "Subtitle"], ["문구", "Message"], ["테마", "Theme"],
    ["강조색", "Accent"], ["배경색", "Background color"], ["카드 너비", "Card width"],
    ["카드 높이", "Card height"], ["구성", "Layout"], ["레이아웃", "Layout"],
    ["밀도", "Density"], ["속도", "Speed"], ["효과 시드", "Effect seed"],
    ["배경 효과", "Background effect"], ["정렬", "Alignment"], ["모서리", "Corners"],
    ["테두리 숨김", "Hide border"], ["제목 숨김", "Hide title"], ["상단 바 숨김", "Hide accent bar"],
    ["항목", "Items"], ["태그", "Tags"], ["줄 내용", "Lines"], ["설명", "Description"],
    ["이메일", "Email"], ["웹사이트", "Website"], ["애니메이션", "Animation"],
    ["스타일", "Style"], ["기본값", "Default"], ["켜기", "On"], ["끄기", "Off"],
    ["기본색 · 예: 7aa2f7", "Default color · e.g. 7aa2f7"], ["공통", "Both appearances"],
    ["합성 디자인", "Combined design"], ["ProfileKit 카드", "ProfileKit card"],
    ["소개 문구", "Intro text"], ["카드 제목", "Card title"], ["저장소 이름", "Repository name"],
    ["저장소 설명", "Repository description"],
    ["내부 편집 마치기", "Finish editing elements"], ["캔버스에서 직접 편집", "Edit directly on canvas"],
    ["아직 비어 있어요. 위 도구에서 첫 요소를 추가하세요.", "The canvas is empty. Add your first element using the tools above."],
    ["일치하는 카드가 없습니다.", "No cards match your search."],
    ["먼저 카드를 추가하세요.", "Add a card first."],
    ["미리보기를 불러오지 못했습니다", "Could not load the preview"],
    ["꾸미기 미리보기를 불러오는 중…", "Loading design preview…"],
    ["카드 내부 요소를 불러오는 중…", "Loading card elements…"],
    ["현재 카드에 이 요소가 없습니다. 카드 설정에서 내용을 넣거나 다른 요소를 선택하세요.", "This element is not present in the card. Add content in card settings or select another element."],
    ["이 요소를 숨겼습니다. 체크를 해제하면 다시 표시됩니다.", "This element is hidden. Uncheck the option to show it again."],
    ["선택한 요소를 직접 끌어 이동하세요. 모서리 핸들로 크기를 조절할 수 있습니다.", "Drag the selected element to move it. Use the corner handles to resize it."],
    ["카드 안의 요소를 꾸며도 계정 정보와 애니메이션은 유지됩니다.", "Account data and animations are preserved when you customize card elements."],
    ["카드를 추가했습니다. 같은 테마를 적용하거나 자유롭게 배치하세요.", "Card added. Apply a shared theme or arrange it freely."],
    ["기존 카드와 크기를 불러오는 중…", "Loading the existing card and its dimensions…"],
    ["카드를 불러왔습니다. 기존 옵션은 그대로 유지됩니다. 오른쪽에서 편집하세요.", "Card loaded with its existing options. Edit it in the panel on the right."],
    ["조합한 카드를 불러왔습니다. 카드와 요소를 다시 편집할 수 있습니다.", "Combined design loaded. You can edit its cards and elements again."],
    ["이 브라우저에 저장됨 · 다른 기기에서는 프로젝트 파일을 열어주세요.", "Saved in this browser · Open the project file to continue on another device."],
    ["브라우저에 저장하지 못했습니다. ‘프로젝트 저장’으로 파일을 보관하세요.", "Could not save in this browser. Use Save project to keep a file copy."],
    ["다른 탭에서 초안이 변경됐습니다. 덮어쓰기를 멈췄으니 이 탭의 작업은 ‘프로젝트 저장’으로 보관하세요.", "The draft changed in another tab. Saving has stopped to avoid overwriting it. Use Save project to keep this tab's work."],
    ["다른 탭에서 초안이 변경됐습니다. 이 탭의 작업은 프로젝트 파일로 저장하세요.", "The draft changed in another tab. Save this tab's work as a project file."],
    ["다른 탭에서 초안이 변경됐습니다. 이 탭의 작업은 ‘프로젝트 저장’으로 보관하세요.", "The draft changed in another tab. Use Save project to keep this tab's work."],
    ["카드 크기를 갱신하지 못했습니다. 연결을 확인한 뒤 다시 변경해 주세요.", "Could not update card dimensions. Check your connection and try again."],
    ["카드 응답이 SVG가 아닙니다.", "The card response is not an SVG."],
    ["카드 크기를 확인할 수 없습니다.", "Could not determine the card dimensions."],
    ["원래 README 연결을 찾지 못했습니다. 프로젝트를 저장해 주세요.", "The original README connection could not be found. Save your project."],
    ["README 연결을 찾지 못했습니다. 프로젝트를 저장해 주세요.", "The README connection could not be found. Save your project."],
    ["전달 중 디자인이 변경됐습니다. 다시 반영해 주세요.", "The design changed during transfer. Apply it again."],
    ["전달 중 디자인이나 경로가 변경됐습니다. 다시 반영해 주세요.", "The design or path changed during transfer. Apply it again."],
    ["이 디자인은 SVG 파일로 README에 넣습니다. 파일을 내려받고 지정한 저장소 경로에 추가하세요. 편집 원본은 README 프로젝트에도 보관됩니다.", "Add this design to your README as an SVG file. Download it and add it at the specified repository path. The editable design is also saved in the README project."],
    ["SVG 상대 경로를 입력하세요. 예: assets/profilekit.svg", "Enter a relative SVG path, such as assets/profilekit.svg"],
    ["저장소 안의 상대 경로를 사용하세요. 예: assets/profilekit.svg", "Use a relative repository path, such as assets/profilekit.svg"],
    ["이 SVG 경로는 다른 디자인에서 사용 중입니다. 다른 파일 이름을 선택하세요.", "Another design uses this SVG path. Choose a different file name."],
    ["캔버스 최대 높이(2048px)를 넘습니다. 카드를 줄이거나 옆으로 배치해 공간을 만든 뒤 추가하세요.", "This exceeds the maximum canvas height (2048px). Reduce card sizes or move cards beside one another before adding another."],
    ["각 카드의 링크와 README 표시 너비를 유지합니다. 위에서 아래 순서로 넣으며, 캔버스의 간격과 겹침은 합친 이미지 방식에서 유지됩니다.", "Keeps each card's link and README display width, in top-to-bottom order. Use a combined image to preserve canvas spacing and overlap."],
    ["현재 배치를 하나의 이미지로 만듭니다. 합친 이미지 안의 개별 카드는 따로 클릭할 수 없습니다.", "Creates one image from the current layout. Individual cards inside it cannot have separate clickable links."],
    ["이 주소는 로컬 미리보기용입니다. README에서는 공개 배포 주소를 입력하거나 SVG 파일을 저장소에 넣으세요.", "This URL is for local previews. For a README, enter a public deployment URL or add an SVG file to your repository."],
    ["합친 이미지는 새 /api/design 기능이 배포된 주소가 필요합니다. 먼저 배포에서 이미지를 확인하세요.", "Combined images require a deployment with /api/design support. Verify the deployed image first."],
    ["배포된 이미지가 열리는 것을 확인했습니다. 이 코드를 README에 넣으면 됩니다.", "The deployed image loads successfully. Add this code to your README."],
    ["기존 카드 URL을 사용합니다. 코드를 README에 붙여넣으면 됩니다. GitHub 이미지 캐시에 따라 변경 반영에 시간이 걸릴 수 있습니다.", "Uses the existing card URL. Paste this code into your README. GitHub's image cache may delay updates."],
    ["이미지를 확인하지 못했습니다. 이 주소에 새 버전이 배포되어 있는지 확인하거나 SVG 파일 방식을 사용하세요.", "Could not verify the image. Check that the latest version is deployed at this URL, or use an SVG file."],
    ["카드 크기를 확인한 뒤 README 코드를 준비합니다…", "Checking card dimensions before preparing README code…"],
    ["README 코드를 복사했습니다.", "README code copied."],
    ["복사가 제한됐습니다. 선택된 코드를 직접 복사하세요.", "Clipboard access is restricted. Copy the selected code manually."],
    ["캔버스 최대 크기를 넘습니다. 카드나 효과 크기를 줄인 뒤 여백을 추가하세요.", "This exceeds the maximum canvas size. Reduce card or effect sizes before adding space."],
    ["PNG, JPG, WebP 이미지를 선택하세요.", "Choose a PNG, JPG, or WebP image."],
    ["이미지는 12MB 이하로 선택하세요.", "Choose an image no larger than 12MB."],
    ["이미지가 너무 큽니다. 1600만 화소 이하로 줄여주세요.", "The image is too large. Reduce it to 16 megapixels or fewer."],
    ["이미지를 추가하는 동안 카드가 변경됐습니다. 현재 카드에 추가할까요?", "The card changed while the image was loading. Add the image to the current card?"],
    ["교체할 이미지가 없어졌습니다. 다시 선택해 주세요.", "The image to replace is no longer available. Select it again."],
    ["위치와 크기를 유지하고 이미지를 교체했습니다.", "Image replaced with its position and size preserved."],
    ["이미지를 추가했습니다. 모서리로 크기를 조절하세요.", "Image added. Drag its corners to resize it."],
    ["다른 카드를 열까요? 현재 작업을 보관하려면 취소 후 ‘프로젝트 저장’을 눌러주세요. 변경 직후에는 실행 취소로 돌아갈 수 있습니다.", "Open another card? To keep this work, cancel and use Save project. You can undo immediately after replacing the card."],
    ["원본 파일을 내보냈습니다. ‘열기’에서 이어서 편집할 수 있어요.", "Project file exported. Use Open to continue editing later."],
    ["원본 파일은 8MB 이하여야 합니다.", "Project files must be 8MB or smaller."],
    ["원본 안의 이미지가 손상되었습니다. 현재 카드는 유지됩니다.", "An image in the project is corrupted. Your current card has been kept."],
    ["원본을 열었습니다. 모든 요소를 다시 편집할 수 있어요.", "Project opened. All elements are editable again."],
    ["SVG를 저장했습니다. 애니메이션은 유지되며 통계는 저장 시점의 값입니다.", "SVG saved. Animations are preserved; statistics reflect the time of download."],
    ["SVG를 저장소에 올리고 파일용 README 코드를 사용하세요. 통계는 저장 시점의 값이며 URL 방식은 계속 갱신됩니다.", "Add the SVG to your repository and use the file README code. Statistics reflect the time of download; URL embeds continue updating."],
    ["PNG 변환에 실패했습니다.", "Could not convert the image to PNG."],
    ["정지 이미지 PNG를 2배 해상도로 저장했습니다.", "Static PNG saved at 2× resolution."],
    ["내부 편집을 마친 뒤 카드를 복제할 수 있습니다.", "Finish editing card elements before duplicating the card."],
    ["이전 버전의 초안을 복원했습니다. 프로젝트로 저장해 계속 편집할 수 있습니다.", "Previous draft restored. Save it as a project to continue editing."],
    ["README 연결이 만료됐습니다. README에서 카드를 다시 열어 주세요.", "The README connection expired. Open the card again from the README editor."],
    ["저장한 SVG의 편집 원본을 열었습니다. 변경 후 SVG를 다시 저장해 README에 반영하세요.", "Opened the editable design for the saved SVG. Save the SVG again after editing and apply it to the README."],
    ["README에서 꾸미던 카드를 복원했습니다. 반영하면 원래 자리의 카드만 바뀝니다.", "Restored the card from your README. Applying changes replaces only that card in its original location."],
    ["이전 임시 저장을 열지 못했습니다. 저장해 둔 원본 파일을 열어주세요.", "Could not open the previous draft. Open a saved project file."],
    ["기존 카드 URL을 불러오거나 카드를 골라 편집한 뒤, README에 넣기를 누르세요.", "Import an existing card URL or choose a card to edit, then select Use in README."],
    ["갤러리 카드의 독립적인 사본을 열었습니다. 원본은 바뀌지 않습니다.", "Opened an independent copy of the gallery card. The original remains unchanged."],
    ["README는 1MB 이하의 텍스트여야 합니다.", "The README must be text no larger than 1MB."],
    ["README 원문을 반영했습니다. 기존 카드 선택을 유지하고 새 카드는 선택하지 않았습니다.", "README source applied. Existing card selections were kept; new cards are not selected."],
    ["편집 가능한 ProfileKit 이미지가 없습니다. 원문은 그대로 내보낼 수 있습니다.", "No editable ProfileKit images were found. You can still export the original source."],
    ["README를 불러오면 사용 중인 카드가 여기에 표시됩니다.", "Load your README to see its cards here."],
    ["테마별 이미지", "Images by appearance"],
    ["이 디자인에는 포함된 카드가 없습니다. 제작기에서 글과 도형을 편집하세요.", "This design has no embedded cards. Edit its text and shapes in the creator."],
    ["원문을 편집 중입니다. ‘README 불러오기’ 또는 미리보기에서 반영합니다.", "Editing source. Use Load source or switch to Preview to apply it."],
    ["파일은 1MB 이하여야 합니다.", "The file must be 1MB or smaller."],
    ["UTF-8로 저장한 README 파일을 사용해 주세요.", "Use a README file saved as UTF-8."],
    ["전달 중 README가 변경됐습니다. 다시 제작기를 열어 주세요.", "The README changed during transfer. Open the creator again."],
    ["변경된 카드가 없습니다. 대상 카드와 계정·스타일 설정을 확인하세요.", "No cards changed. Check the selected cards and account or style settings."],
    ["마지막 변경을 되돌렸습니다.", "Last change undone."],
    ["변경을 다시 적용했습니다.", "Change reapplied."],
    ["이 배포의 카드 주소를 다시 확인했습니다.", "Card URLs were checked again for this deployment."],
    ["ProfileKit README 프로젝트 파일이 아닙니다.", "This is not a ProfileKit README project file."],
    ["프로젝트 설정이 올바르지 않습니다.", "The project settings are invalid."],
    ["README 프로젝트를 열었습니다.", "README project opened."],
    ["README 파일을 저장했습니다. 저장소의 README.md에 반영하면 됩니다.", "README saved. Add the changes to README.md in your repository."],
    ["README 전체를 복사했습니다.", "Full README copied."],
    ["클립보드가 제한되어 원문을 선택했습니다. 직접 복사하세요.", "Clipboard access is restricted. The source is selected; copy it manually."],
    ["README와 편집 설정을 프로젝트 파일로 저장했습니다.", "README and editor settings saved as a project file."],
    ["프로젝트 파일은 40MB 이하여야 합니다.", "Project files must be 40MB or smaller."],
    ["다른 탭에서 초안이 바뀌었습니다. 이 탭의 작업은 프로젝트 파일로 저장하세요.", "The draft changed in another tab. Save this tab's work as a project file."],
    ["브라우저 저장 공간이 부족합니다. 프로젝트 파일로 작업을 보관하세요.", "Browser storage is full. Keep your work by saving a project file."],
    ["다른 탭에서 초안이 변경됐습니다. 작업을 덮어쓰지 않도록 이 탭의 자동 저장을 멈췄습니다.", "The draft changed in another tab. Autosave is paused here to avoid overwriting it."],
    ["이전 초안을 열 수 없습니다. 파일을 불러오거나 README 원문을 붙여넣어 주세요.", "Could not open the previous draft. Load a file or paste your README source."],
    ["제작기에서 돌아온 작업을 찾을 수 없습니다.", "Could not find the work returned from the creator."],
    ["원래 README 카드와 제작기 작업이 일치하지 않습니다.", "The creator result does not match the original README card."],
    ["이 SVG 경로는 다른 디자인에서 사용 중입니다. 제작기에서 다른 파일 이름을 선택하세요.", "Another design uses this SVG path. Choose another file name in the creator."],
    ["원래 카드 위치를 찾을 수 없습니다.", "Could not find the original card location."],
    ["제작기 결과를 프로젝트로 저장했습니다. 현재 초안을 보관한 뒤 프로젝트 열기로 불러오세요.", "Creator result saved as a project. Keep your current draft, then use Open project to load it."],
    ["다른 탭에서 README 초안이 바뀌어 현재 초안을 유지했습니다. ‘제작기 결과 프로젝트 저장’으로 편집 결과를 보관하세요.", "The README draft changed in another tab, so the current draft was kept. Use Save creator result as project to keep your edits."],
    ["수정 없이 README로 돌아왔습니다.", "Returned to README without changes."],
    ["제작기 변경을 README에 반영했습니다. 주변 글과 링크는 유지됩니다.", "Creator changes applied to the README. Surrounding text and links are preserved."],
    ["README에 반영했습니다. 자동 저장 용량을 넘어 복구 원본을 보관했습니다. 프로젝트 파일로 저장해 주세요. 이 주소를 새로 열면 전달된 디자인을 복구합니다.", "Applied to README. The autosave limit was exceeded, so a recovery copy was kept. Save a project file. Reopening this URL restores the transferred design."],
    ["{count}개 카드 주소를 찾았습니다. 원문과 배치는 유지됩니다.", "Found {count} card URLs. The original source and layout are preserved."],
    ["화면별 이미지 {count}", "Appearance variants {count}"],
    ["합성 디자인 · 포함 카드 {count}개", "Combined design · {count} embedded cards"],
    ["표시 너비 {width}", "Display width {width}"],
    ["{count}곳에서 사용", "Used in {count} locations"],
    ["포함 카드 {count}개 · 위치·크기·레이어와 장식은 유지됩니다. 일괄 변경은 포함된 카드에도 적용됩니다.", "{count} embedded cards · Position, size, layers, and decorations are preserved. Batch changes also apply to embedded cards."],
    ["{path} · 저장된 SVG입니다. 제작기에서 수정한 뒤 교체할 SVG를 내려받으세요. 내용 편집과 일괄 변경은 파일에 자동 반영되지 않습니다.", "{path} · Saved SVG. Edit it in the creator and download a replacement. Content edits and batch changes do not update the file automatically."],
    ["{filename}을 불러왔습니다. 수정하지 않은 내용과 배치는 그대로 유지됩니다.", "Loaded {filename}. Unedited content and layout are preserved."],
    ["{name} 설정을 반영했습니다. 주변 글·링크·배치는 그대로 유지됩니다.", "Applied settings for {name}. Surrounding text, links, and layout are preserved."],
    ["{count}개 카드 변경 · {fields}", "Updated {count} cards · {fields}"],
    ["기존 배치를 유지하며 사방에 {padding}px 여백을 추가했습니다. 실행 취소로 되돌릴 수 있습니다.", "Added {padding}px of space on every side, preserving the layout. You can undo this change."],
    ["{name} 카드를 불러오는 중…", "Loading {name} card…"],
    ["{name} 카드를 불러오지 못했습니다. 계정·저장소·내용을 확인하세요.", "Could not load the {name} card. Check its account, repository, and content."],
    ["{name}: {message}. URL 임베드를 사용하거나 이 배포의 연결 설정을 확인하세요.", "{name}: {message}. Use a URL embed or check this deployment's connection settings."],
    ["중복된 매개변수입니다. 위 카드 설정에서 바꿔주세요: {key}", "Duplicate parameter. Change it in the card settings above: {key}"],
    ["중복 매개변수입니다: {key}", "Duplicate parameter: {key}"],
    ["저장된 디자인 미리보기를 만들지 못했습니다: {message}", "Could not create the saved design preview: {message}"],
    ["미리보기를 만들지 못했습니다: {message}", "Could not create the preview: {message}"],
    ["미리보기를 불러오지 못했습니다. {message}", "Could not load the preview. {message}"],
    ["제작기로 작업을 전달할 수 없습니다. {message}", "Could not send the project to the creator. {message}"],
    ["{message} 중복 카드의 선택은 해제했으니 변경할 카드를 다시 선택하세요.", "{message} Duplicate cards were deselected; select the cards you want to change again."],
    ["{name} 편집 영역", "Editing area: {name}"],
    ["{name} 선택", "Select {name}"],
    ["{name} 일괄 변경 선택", "Select {name} for batch changes"]
  );

  const cards = {
    stats: ["활동 통계", "커밋, PR, 이슈, 별, 저장소 활동을 보여줍니다."],
    languages: ["사용 언어", "사용 언어를 막대나 도넛으로 보여줍니다."],
    reviews: ["코드 리뷰", "코드 리뷰 활동과 승인 비율을 보여줍니다."],
    pin: ["저장소 소개", "저장소를 소개하는 카드입니다."],
    leetcode: ["LeetCode", "LeetCode 문제 풀이 통계를 보여줍니다."],
    social: ["소셜 링크", "소셜 프로필과 연락처를 보여줍니다."],
    quote: ["오늘의 문장", "무작위 또는 오늘의 개발자 문장을 보여줍니다."],
    hero: ["프로필 히어로", "움직이는 배경을 담은 넓은 프로필 배너입니다."],
    section: ["섹션 제목", "움직이는 밑줄이 있는 섹션 제목입니다."],
    divider: ["구분선", "여섯 가지 스타일의 구분선입니다."],
    now: ["요즘 하는 일", "요즘 하고 있는 일을 소개합니다."],
    timeline: ["타임라인", "주요 순간을 세로 타임라인으로 보여줍니다."],
    tags: ["기술과 관심사", "기술과 관심사를 태그로 보여줍니다."],
    toc: ["목차", "README 목차를 만듭니다."],
    posts: ["최근 글", "dev.to, Medium, RSS의 최근 글을 보여줍니다."],
    typing: ["타이핑", "문장을 타자기 효과로 보여줍니다."],
    wave: ["웨이브", "여러 겹의 물결을 움직입니다."],
    terminal: ["터미널", "명령어를 자동 입력하는 터미널입니다."],
    neon: ["네온", "깜빡이는 네온 효과입니다."],
    glitch: ["글리치", "RGB 분리 효과가 있는 문구입니다."],
    matrix: ["매트릭스", "코드가 비처럼 흘러내리는 효과입니다."],
    snake: ["기여 스네이크", "기여 격자 위를 움직이는 스네이크입니다."],
    equalizer: ["이퀄라이저", "LIVE 표시와 오디오 막대를 움직입니다."],
    heartbeat: ["하트비트", "맥박 선과 점을 움직입니다."],
    constellation: ["별자리", "별과 연결선이 반짝이는 효과입니다."],
    radar: ["레이더", "점과 회전하는 레이더를 보여줍니다."],
  };
  pairs.push(["GitHub 데이터", "Data"], ["프로필 구성", "Blog"], ["움직이는 카드", "Animation"],
    ["어둡게", "Dark"], ["밝게", "Light"]);

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fill = (template, values) => template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
  function compile(template) {
    const names = [];
    const chunks = template.split(/(\{\w+\})/g).map((part) => {
      if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return "([\\s\\S]*?)"; }
      return escapeRegExp(part);
    });
    return { names, regex: new RegExp("^" + chunks.join("") + "$") };
  }
  function createTranslator(extraPairs = []) {
    const exact = new Map(), patterns = [];
    for (const [ko, en] of [...pairs, ...extraPairs]) {
      const pair = { ko, en };
      for (const source of [ko, en]) {
        if (!exact.has(source)) exact.set(source, pair);
        if (/\{\w+\}/.test(source)) patterns.push({ ...compile(source), pair });
      }
    }
    return function translate(source, locale = "en", values = {}) {
      const input = String(source ?? "");
      const target = SUPPORTED.includes(locale) ? locale : "en";
      if (exact.has(input)) return fill(exact.get(input)[target], values);
      for (const pattern of patterns) {
        const match = input.match(pattern.regex);
        if (match) {
          const captured = Object.fromEntries(pattern.names.map((name, index) => [name, match[index + 1]]));
          return fill(pattern.pair[target], captured);
        }
      }
      return fill(input, values);
    };
  }
  const translate = createTranslator();

  function detectLocale(host) {
    let saved;
    try { saved = host.localStorage.getItem(STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
    if (SUPPORTED.includes(saved)) return saved;
    if (SUPPORTED.includes(host.ProfileKitI18n?.locale)) return host.ProfileKitI18n.locale;
    const preferences = host.navigator?.languages || [host.navigator?.language || "en"];
    return preferences.map((value) => String(value).toLowerCase().split("-")[0]).find((value) => SUPPORTED.includes(value)) || "en";
  }

  function createRuntime(host) {
    const document = host.document;
    let locale = detectLocale(host);
    const schema = host.ProfileKitCards?.CARDS || {};
    const extraPairs = Object.entries(cards).flatMap(([key, values]) => schema[key] ? [[values[0], schema[key].label], [values[1], schema[key].desc]] : []);
    let localize = createTranslator(extraPairs);
    const records = new WeakMap(), bindings = new WeakMap(), attributeBindings = new WeakMap(), boundElements = new Set();
    // These nodes can contain user-authored text even when it resembles a UI label.
    const contentSelector = 'svg, [data-studio-content], [data-studio-i18n="off"], [contenteditable]:not([contenteditable="false"]), #canvas-host, .template-thumb, #layer-list .layer-item, .readme-card-name, .readme-card-meta, #readme-card-title, #readme-design-card, pre, code';
    const textless = new Set(["SCRIPT", "STYLE", "SVG", "IFRAME", "TEXTAREA", "INPUT"]);
    const attributes = ["placeholder", "title", "aria-label"];
    const t = (source, values) => localize(source, locale, values);
    const bindingValues = (binding) => typeof binding.values === "function" ? binding.values() : binding.values;
    function isContent(element) { return !!element?.closest?.(contentSelector); }
    function translated(node, key, source) {
      let fields = records.get(node);
      if (!fields) { fields = new Map(); records.set(node, fields); }
      let record = fields.get(key);
      if (!record || record.rendered !== source) record = { source, rendered: source };
      const match = record.source.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const output = match[1] + t(match[2]) + match[3];
      record.rendered = output; fields.set(key, record);
      return output;
    }
    function visit(node) {
      if (node.nodeType === 3) {
        if (bindings.has(node.parentElement) || isContent(node.parentElement) || textless.has(node.parentElement?.tagName?.toUpperCase())) return;
        const next = translated(node, "text", node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 9) return;
      const boundAttributes = attributeBindings.get(node);
      for (const [attribute, binding] of boundAttributes || []) {
        const next = t(binding.source, bindingValues(binding));
        if (node.getAttribute(attribute) !== next) node.setAttribute(attribute, next);
      }
      const bound = bindings.get(node);
      if (bound) {
        const next = t(bound.source, bindingValues(bound));
        if (node.textContent !== next) node.textContent = next;
        return;
      }
      if (isContent(node)) return;
      for (const attribute of attributes) {
        if (boundAttributes?.has(attribute)) continue;
        const value = node.getAttribute?.(attribute);
        if (value !== null && value !== undefined) {
          const next = translated(node, attribute, value);
          if (next !== value) node.setAttribute(attribute, next);
        }
      }
      if (node.matches?.('meta[name="description"]')) {
        const value = node.getAttribute("content");
        const next = translated(node, "content", value);
        if (next !== value) node.setAttribute("content", next);
      }
      if (textless.has(node.tagName?.toUpperCase())) return;
      for (const child of Array.from(node.childNodes || [])) visit(child);
    }
    function apply(root = document.documentElement) {
      visit(root);
      // Explicit bindings may sit inside otherwise protected user-content labels.
      for (const element of boundElements) {
        if (element.isConnected === false) { boundElements.delete(element); continue; }
        visit(element);
      }
      document.documentElement.lang = locale;
      const select = document.getElementById("studio-locale");
      if (select && select.value !== locale) select.value = locale;
    }
    function setLocale(next, persist = true) {
      if (!SUPPORTED.includes(next) || next === locale) return;
      locale = next;
      if (persist) { try { host.localStorage.setItem(STORAGE_KEY, locale); } catch { /* Switching still works. */ } }
      apply();
      if (host.ProfileKitI18n && host.ProfileKitI18n.locale !== locale) host.ProfileKitI18n.setLocale(locale);
      else host.dispatchEvent(new host.CustomEvent("profilekit:localechange", { detail: { locale } }));
    }
    function text(element, source, values = {}) {
      bindings.set(element, { source, values: typeof values === "function" ? values : { ...values } });
      boundElements.add(element);
      visit(element);
      return element;
    }
    function attribute(element, name, source, values = {}) {
      if (!attributes.includes(name)) throw new Error("Unsupported UI translation attribute: " + name);
      let fields = attributeBindings.get(element);
      if (!fields) { fields = new Map(); attributeBindings.set(element, fields); }
      fields.set(name, { source, values: typeof values === "function" ? values : { ...values } });
      boundElements.add(element);
      visit(element);
      return element;
    }
    const selector = document.getElementById("studio-locale");
    selector?.addEventListener("change", () => setLocale(selector.value));
    host.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY && SUPPORTED.includes(event.newValue)) setLocale(event.newValue, false);
    });
    host.addEventListener("profilekit:localechange", () => {
      const sharedLocale = host.ProfileKitI18n?.locale;
      if (SUPPORTED.includes(sharedLocale) && sharedLocale !== locale) { locale = sharedLocale; apply(); }
    });
    const observer = new host.MutationObserver((mutations) => {
      // Visit only changed subtrees. Never poll or rebuild application state.
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) visit(node);
        } else visit(mutation.target);
      }
    });
    apply();
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
    return {
      get locale() { return locale; },
      t, text, attribute, apply, setLocale,
      addMessages(messages) {
        const entries = Array.isArray(messages) ? messages : Object.entries(messages);
        for (const entry of entries) {
          if (Array.isArray(entry) && entry.length === 2 && entry.every((value) => typeof value === "string")) extraPairs.push(entry);
        }
        localize = createTranslator(extraPairs);
        apply();
      },
      card(key) { return locale === "ko" ? cards[key]?.[0] || schema[key]?.label || key : schema[key]?.label || key; },
      cardSearchText(key) {
        const card = schema[key] || {}, group = card.group || "";
        return [...new Set([key, card.label, card.desc, group, ...(cards[key] || []),
          localize(group, "en"), localize(group, "ko")])].filter(Boolean).join(" ");
      },
      disconnect() { observer.disconnect(); },
    };
  }
  return { STORAGE_KEY, SUPPORTED, pairs, translate, createTranslator, detectLocale, createRuntime };
});
