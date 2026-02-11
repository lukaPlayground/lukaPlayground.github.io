// File Tree Data - demos/ 폴더 구조
// 이 데모에서는 demos/ 하위만 표시하고 편집 가능
const FILE_TREE_DATA = {
    name: "demos",
    type: "directory",
    children: [
        {
            name: "file-manager",
            type: "directory",
            children: [
                {
                    name: "index.html",
                    type: "file",
                    language: "htmlmixed",
                    content: `<!-- File Manager Demo Page -->
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>File Manager Demo</title>
    <!-- CodeMirror CDN + inline styles -->
</head>
<body>
    <div class="fm-app">
        <!-- navbar, toolbar, tree panel, editor panel -->
    </div>
    <script src="file-tree-data.js"><\/script>
    <script src="file-manager.js"><\/script>
</body>
</html>`
                },
                {
                    name: "file-tree-data.js",
                    type: "file",
                    language: "javascript",
                    content: `// 이 파일! 데모 프로젝트 구조를 JSON으로 정의
const FILE_TREE_DATA = {
    name: "demos",
    type: "directory",
    children: [
        { name: "file-manager", type: "directory", children: [...] },
        { name: "sample", type: "directory", children: [...] },
    ]
};`
                },
                {
                    name: "file-manager.js",
                    type: "file",
                    language: "javascript",
                    content: `// File Manager Application Logic
// - State management (tree, selection, expanded dirs)
// - Tree rendering with expand/collapse
// - CodeMirror integration (edit & read-only)
// - CRUD simulation (create, rename, delete)
// - Save → Preview workflow
// - Security filter (blocked extensions)
// - Theme synchronization with portfolio`
                }
            ]
        },
        {
            name: "sample",
            type: "directory",
            children: [
                {
                    name: "index.html",
                    type: "file",
                    language: "htmlmixed",
                    content: `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample Page</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Hello World</h1>
    <p>이 내용을 수정한 후 <strong>Save</strong>를 누르고 <strong>Preview</strong>로 확인하세요.</p>

    <div class="card">
        <h2>카드 제목</h2>
        <p>카드 내용입니다. 자유롭게 수정해보세요!</p>
        <button class="btn">버튼</button>
    </div>

    <div class="card">
        <h2>두 번째 카드</h2>
        <p>HTML과 CSS를 수정하고 미리보기에서 결과를 확인하세요.</p>
    </div>
</body>
</html>`
                },
                {
                    name: "style.css",
                    type: "file",
                    language: "css",
                    content: `/* Sample Stylesheet */
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    margin: 0;
    padding: 2rem;
    background-color: #f8f9fa;
    color: #1a1a1a;
    line-height: 1.6;
}

h1 {
    color: #3b82f6;
    border-bottom: 2px solid #e9ecef;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
}

p {
    margin-bottom: 1rem;
}

.card {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card h2 {
    color: #1e293b;
    margin-bottom: 0.5rem;
}

.btn {
    background-color: #3b82f6;
    color: white;
    border: none;
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    margin-top: 0.5rem;
    transition: background-color 0.2s;
}

.btn:hover {
    background-color: #2563eb;
}`
                }
            ]
        }
    ]
};
