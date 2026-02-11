// ============================================================
// File Manager Demo - Application Logic
// ============================================================

// --- State ---
const state = {
    tree: null,
    selectedNodeId: null,
    expandedDirs: new Set(),
    nextId: 1,
    editMode: false,
    previewMode: false,
    unsavedContent: null,     // 편집 중 아직 저장 안 된 내용
    hasUnsavedChanges: false, // 현재 파일에 미저장 변경이 있는지
    savedFiles: new Set(),    // 저장 완료된 파일 ID 추적
};

let editorInstance = null;

// --- Extension / Language Mapping ---
const EXT_TO_LANG = {
    '.html': 'htmlmixed', '.htm': 'htmlmixed',
    '.css': 'css',
    '.js': 'javascript', '.json': 'javascript',
    '.php': 'php', '.phtml': 'php',
    '.md': 'markdown',
    '.txt': 'text',
    '.htaccess': 'text',
    '.png': 'image', '.jpg': 'image', '.jpeg': 'image',
    '.gif': 'image', '.svg': 'image',
};

const BLOCKED_EXTENSIONS = [
    '.php', '.phtml', '.php3', '.php4', '.php5',
    '.exe', '.bat', '.cmd', '.sh', '.bash',
    '.jsp', '.asp', '.aspx',
    '.cgi', '.pl',
    '.htpasswd', '.env', '.ini',
];

const BLOCKED_PATTERNS = [
    { pattern: /\.\./, desc: 'Path traversal (..)' },
    { pattern: /^\.ht/, desc: '.ht* server config' },
    { pattern: /<\?php/i, desc: 'PHP tag injection' },
];

// --- Helpers ---
function detectLanguage(filename) {
    const name = filename.toLowerCase();
    if (name === '.htaccess') return 'text';
    const dot = name.lastIndexOf('.');
    if (dot === -1) return 'text';
    const ext = name.substring(dot);
    return EXT_TO_LANG[ext] || 'text';
}

function assignIds(node) {
    node.id = state.nextId++;
    if (node.type === 'directory' && node.children) {
        node.children.forEach(assignIds);
    }
}

function findNode(node, id) {
    if (node.id === id) return node;
    if (node.children) {
        for (const child of node.children) {
            const found = findNode(child, id);
            if (found) return found;
        }
    }
    return null;
}

function findParent(node, id) {
    if (node.children) {
        for (const child of node.children) {
            if (child.id === id) return node;
            const found = findParent(child, id);
            if (found) return found;
        }
    }
    return null;
}

function getNodePath(tree, id, path) {
    path = path || [];
    if (tree.id === id) return [...path, tree.name];
    if (tree.children) {
        for (const child of tree.children) {
            const result = getNodePath(child, id, [...path, tree.name]);
            if (result) return result;
        }
    }
    return null;
}

function sortChildren(children) {
    children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name, 'ko');
    });
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// --- 권한 체크: 루트(demos) 자체 제외, 모든 하위 항목 편집 가능 ---
function isInDemos(nodeId) {
    if (!nodeId || !state.tree) return false;
    // 루트 자체는 편집 불가, 하위 항목은 모두 가능
    return nodeId !== state.tree.id;
}

function isEditable(nodeId) {
    if (!nodeId) return false;
    const node = findNode(state.tree, nodeId);
    if (!node || node.type !== 'file' || node.language === 'image') return false;
    return isInDemos(nodeId);
}

function getDemosDir() {
    // 루트가 곧 demos 폴더
    return state.tree;
}

// --- New File Templates ---
function getNewFileTemplate(filename, lang) {
    switch (lang) {
        case 'htmlmixed':
            return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${filename.replace('.html', '')}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Hello World</h1>
    <p>이 내용을 수정한 후 <strong>Save</strong>를 누르고 <strong>Preview</strong>로 확인하세요.</p>
    <div class="card">
        <h2>카드 제목</h2>
        <p>카드 내용입니다.</p>
        <button class="btn">버튼</button>
    </div>
</body>
</html>`;
        case 'css':
            return `/* ${filename} */
body {
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    margin: 0;
    padding: 2rem;
    background-color: #f8f9fa;
    color: #1a1a1a;
}

h1 {
    color: #3b82f6;
    border-bottom: 2px solid #e9ecef;
    padding-bottom: 0.5rem;
}

.card {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 1rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
}

.btn:hover {
    background-color: #2563eb;
}`;
        case 'javascript':
            return `// ${filename}\n\nconsole.log('Hello from ${filename}');\n`;
        case 'markdown':
            return `# ${filename.replace('.md', '')}\n\nWrite your content here.\n`;
        default:
            return '';
    }
}

// --- Security Filter ---
function validateFilename(filename) {
    const errors = [];
    if (!filename || !filename.trim()) {
        return { valid: false, errors: ['파일명을 입력하세요'] };
    }
    if (/[<>:"/\\|?*\x00-\x1f]/.test(filename)) {
        errors.push('사용할 수 없는 문자가 포함되어 있습니다: < > : " / \\ | ? *');
    }
    const dot = filename.lastIndexOf('.');
    if (dot !== -1) {
        const ext = filename.substring(dot).toLowerCase();
        if (BLOCKED_EXTENSIONS.includes(ext)) {
            errors.push(`확장자 "${ext}"는 보안상 차단됩니다`);
        }
    }
    for (const bp of BLOCKED_PATTERNS) {
        if (bp.pattern.test(filename)) {
            errors.push(`차단 패턴 감지: ${bp.desc}`);
        }
    }
    return { valid: errors.length === 0, errors };
}

// --- Tree Rendering ---
function renderTree() {
    const container = document.getElementById('treeContent');
    container.innerHTML = '';
    if (state.tree) {
        container.appendChild(renderNode(state.tree, 0));
    }
    updateStatusBar();
}

function renderNode(node, depth) {
    const el = document.createElement('div');
    el.className = 'fm-tree-node';
    el.setAttribute('data-id', node.id);

    const row = document.createElement('div');
    row.className = 'fm-tree-row';
    if (node.id === state.selectedNodeId) row.classList.add('selected');
    row.style.paddingLeft = (depth * 16 + 8) + 'px';

    if (node.type === 'directory') {
        const expanded = state.expandedDirs.has(node.id);
        const chevron = document.createElement('span');
        chevron.className = 'fm-chevron' + (expanded ? ' expanded' : '');
        chevron.textContent = '\u25B6';
        row.appendChild(chevron);

        const icon = document.createElement('span');
        icon.className = 'fm-icon';
        icon.textContent = expanded ? '\uD83D\uDCC2' : '\uD83D\uDCC1';
        row.appendChild(icon);
    } else {
        const spacer = document.createElement('span');
        spacer.className = 'fm-chevron-spacer';
        row.appendChild(spacer);

        const icon = document.createElement('span');
        icon.className = 'fm-icon';
        icon.textContent = getFileIcon(node);
        row.appendChild(icon);
    }

    const label = document.createElement('span');
    label.className = 'fm-label';
    label.textContent = node.name;
    row.appendChild(label);

    // 미저장 변경 표시 (현재 편집중인 파일)
    if (node.type === 'file' && node.id === state.selectedNodeId && state.hasUnsavedChanges) {
        const dot = document.createElement('span');
        dot.className = 'fm-modified-dot unsaved';
        dot.textContent = ' \u25CF';
        dot.title = '미저장';
        row.appendChild(dot);
    }
    // 저장 완료 표시
    else if (node.type === 'file' && state.savedFiles.has(node.id)) {
        const dot = document.createElement('span');
        dot.className = 'fm-modified-dot saved';
        dot.textContent = ' \u25CF';
        dot.title = '저장됨';
        row.appendChild(dot);
    }

    row.addEventListener('click', () => handleNodeClick(node));
    el.appendChild(row);

    if (node.type === 'directory' && state.expandedDirs.has(node.id) && node.children) {
        const childContainer = document.createElement('div');
        childContainer.className = 'fm-tree-children';
        node.children.forEach(child => {
            childContainer.appendChild(renderNode(child, depth + 1));
        });
        el.appendChild(childContainer);
    }

    return el;
}

function getFileIcon(node) {
    if (node.language === 'image') return '\uD83D\uDDBC\uFE0F';
    const name = node.name.toLowerCase();
    if (name.endsWith('.html') || name.endsWith('.htm')) return '\uD83C\uDF10';
    if (name.endsWith('.css')) return '\uD83C\uDFA8';
    if (name.endsWith('.js')) return '\u26A1';
    if (name.endsWith('.json')) return '\uD83D\uDCCB';
    if (name.endsWith('.php') || name.endsWith('.phtml')) return '\uD83D\uDC18';
    if (name.endsWith('.md')) return '\uD83D\uDCDD';
    return '\uD83D\uDCC4';
}

// --- Node Interaction ---
function handleNodeClick(node) {
    // 다른 파일 클릭 시 미저장 내용 버림
    if (state.selectedNodeId !== node.id) {
        state.unsavedContent = null;
        state.hasUnsavedChanges = false;
        state.editMode = false;
        state.previewMode = false;
    }

    state.selectedNodeId = node.id;

    if (node.type === 'directory') {
        if (state.expandedDirs.has(node.id)) {
            state.expandedDirs.delete(node.id);
        } else {
            state.expandedDirs.add(node.id);
        }
        renderTree();
    } else {
        renderTree();
        openFile(node);
    }
    updateToolbarState();
}

function openFile(node, startInEditMode) {
    updateBreadcrumb(node.id);
    state.previewMode = false;

    if (node.language === 'image') {
        state.editMode = false;
        showImagePreview(node);
        updateToolbarState();
        return;
    }

    // demos/ 하위만 편집 가능
    const canEdit = isEditable(node.id);
    state.editMode = canEdit && !!startInEditMode;

    const editorContent = document.getElementById('editorContent');
    editorContent.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.id = 'code-editor';
    editorContent.appendChild(textarea);

    const currentTheme = document.documentElement.getAttribute('data-theme');

    editorInstance = CodeMirror.fromTextArea(textarea, {
        mode: node.language,
        theme: currentTheme === 'dark' ? 'material-darker' : 'default',
        lineNumbers: true,
        readOnly: !state.editMode,
        lineWrapping: true,
        viewportMargin: Infinity,
        tabSize: 4,
        matchBrackets: true,
    });

    // 미저장 내용이 있으면 그걸 표시, 없으면 저장된 내용
    const displayContent = (state.hasUnsavedChanges && state.unsavedContent !== null)
        ? state.unsavedContent
        : (node.content || '');
    editorInstance.setValue(displayContent);

    // 편집 시 unsavedContent에 보관 (node.content는 아직 안 바뀜)
    editorInstance.on('change', () => {
        if (!state.editMode) return;
        const currentValue = editorInstance.getValue();
        state.unsavedContent = currentValue;
        const changed = currentValue !== (node.content || '');
        if (changed !== state.hasUnsavedChanges) {
            state.hasUnsavedChanges = changed;
            renderTree();
            updateToolbarState();
        }
    });

    setTimeout(() => {
        if (editorInstance) {
            editorInstance.refresh();
            if (state.editMode) editorInstance.focus();
        }
    }, 10);

    updateToolbarState();
}

// --- Save ---
function saveFile() {
    if (!state.selectedNodeId) return;
    const node = findNode(state.tree, state.selectedNodeId);
    if (!node || !isEditable(node.id)) return;
    if (!state.hasUnsavedChanges || state.unsavedContent === null) {
        showToast('변경 사항이 없습니다', 'info');
        return;
    }

    // unsavedContent → node.content 에 반영
    node.content = state.unsavedContent;
    state.unsavedContent = null;
    state.hasUnsavedChanges = false;
    state.savedFiles.add(node.id);
    renderTree();
    updateToolbarState();
    showToast(`"${node.name}" 저장 완료`, 'success');
}

// --- Edit / Preview 토글 ---
function toggleEditMode() {
    if (!state.selectedNodeId) return;
    const node = findNode(state.tree, state.selectedNodeId);
    if (!node || node.type !== 'file' || node.language === 'image') return;

    if (!isEditable(node.id)) {
        showToast('이 파일은 편집할 수 없습니다', 'warning');
        return;
    }

    if (state.previewMode) {
        state.previewMode = false;
        state.editMode = true;
        openFile(node, true);
        return;
    }

    state.editMode = !state.editMode;

    if (editorInstance) {
        editorInstance.setOption('readOnly', !state.editMode);
        if (state.editMode) {
            editorInstance.focus();
        }
    }
    updateToolbarState();
}

function togglePreview() {
    if (!state.selectedNodeId) return;
    const node = findNode(state.tree, state.selectedNodeId);
    if (!node || node.type !== 'file') return;

    if (state.previewMode) {
        state.previewMode = false;
        openFile(node, state.editMode);
        return;
    }

    // Preview는 저장된 내용(node.content) 기준으로 보여줌
    if (state.hasUnsavedChanges) {
        showToast('저장되지 않은 변경이 있습니다. Save 후 미리보기하세요.', 'warning');
        return;
    }

    state.previewMode = true;
    showPreview(node);
    updateToolbarState();
}

function showPreview(node) {
    const editorContent = document.getElementById('editorContent');
    const content = node.content || '';

    // demos/ 하위에 같은 폴더의 CSS 파일이 있으면 함께 적용
    let linkedCss = '';
    if (node.language === 'htmlmixed' || node.name.endsWith('.html')) {
        const parent = findParent(state.tree, node.id);
        if (parent && parent.children) {
            const cssFile = parent.children.find(c =>
                c.type === 'file' && c.name.endsWith('.css')
            );
            if (cssFile && cssFile.content) {
                linkedCss = cssFile.content;
            }
        }
    }

    if (node.language === 'htmlmixed' || node.name.endsWith('.html') || node.name.endsWith('.htm')) {
        editorContent.innerHTML = `
            <div class="fm-preview-container">
                <div class="fm-preview-bar">
                    <span class="fm-preview-badge">PREVIEW</span>
                    <span class="fm-preview-filename">${node.name}</span>
                    ${linkedCss ? '<span class="fm-preview-css-note">+ CSS 연결됨</span>' : ''}
                </div>
                <iframe class="fm-preview-iframe" id="previewFrame" sandbox="allow-scripts"></iframe>
            </div>
        `;
        const iframe = document.getElementById('previewFrame');
        // link 태그가 있고 같은 폴더에 해당 CSS가 있으면 인라인으로 삽입
        let finalContent = content;
        if (linkedCss) {
            finalContent = content.replace(
                /<link[^>]*href=["']([^"']+\.css)["'][^>]*>/gi,
                `<style>${linkedCss}</style>`
            );
        }
        iframe.srcdoc = finalContent;
    } else if (node.language === 'css') {
        editorContent.innerHTML = `
            <div class="fm-preview-container">
                <div class="fm-preview-bar">
                    <span class="fm-preview-badge">CSS PREVIEW</span>
                    <span class="fm-preview-filename">${node.name}</span>
                </div>
                <iframe class="fm-preview-iframe" id="previewFrame" sandbox="allow-scripts"></iframe>
            </div>
        `;
        const iframe = document.getElementById('previewFrame');
        iframe.srcdoc = `<!DOCTYPE html>
<html><head><style>${content}</style></head>
<body>
<h1>CSS Preview</h1>
<p>이 페이지에서 CSS 스타일이 적용된 결과를 확인할 수 있습니다.</p>
<div class="card">
    <h2>카드 제목</h2>
    <p>카드 내용입니다.</p>
    <button class="btn">버튼</button>
</div>
<div class="card">
    <h2>두 번째 카드</h2>
    <p>스타일을 수정하고 저장한 후 미리보기를 확인하세요.</p>
</div>
</body></html>`;
    } else if (node.language === 'markdown') {
        editorContent.innerHTML = `
            <div class="fm-preview-container">
                <div class="fm-preview-bar">
                    <span class="fm-preview-badge">MARKDOWN PREVIEW</span>
                    <span class="fm-preview-filename">${node.name}</span>
                </div>
                <div class="fm-markdown-preview">${renderMarkdown(content)}</div>
            </div>
        `;
    } else {
        editorContent.innerHTML = `
            <div class="fm-preview-container">
                <div class="fm-preview-bar">
                    <span class="fm-preview-badge">RAW PREVIEW</span>
                    <span class="fm-preview-filename">${node.name}</span>
                </div>
                <pre class="fm-raw-preview">${escapeHtml(content)}</pre>
            </div>
        `;
    }
}

function renderMarkdown(md) {
    return md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/^```[\s\S]*?```$/gm, (match) => {
            const code = match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
            return '<pre><code>' + escapeHtml(code) + '</code></pre>';
        })
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<[hul1-9]|<p|<pre|<li)(.+)$/gm, '<p>$1</p>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showImagePreview(node) {
    const editorContent = document.getElementById('editorContent');
    const hue = hashString(node.name) % 360;
    editorContent.innerHTML = `
        <div class="fm-image-preview">
            <div class="fm-image-placeholder">
                <svg width="240" height="180" viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
                    <rect width="240" height="180" rx="12" fill="hsl(${hue}, 25%, 88%)"/>
                    <circle cx="72" cy="60" r="24" fill="hsl(${hue}, 45%, 72%)"/>
                    <polygon points="36,156 108,72 156,120 240,60 240,180 0,180"
                             fill="hsl(${hue}, 35%, 72%)" opacity="0.8"/>
                    <polygon points="120,156 180,96 240,132 240,180 96,180"
                             fill="hsl(${hue}, 35%, 62%)" opacity="0.7"/>
                </svg>
            </div>
            <div class="fm-image-info">
                <p class="fm-image-name">${node.name}</p>
                <p class="fm-image-meta">${(node.imageType || 'img').toUpperCase()} Image | Demo Placeholder</p>
                <p class="fm-image-note">
                    실제 시스템에서는 PHP를 통해 서버의 이미지 파일을 로드하여 미리보기합니다.
                </p>
            </div>
        </div>
    `;
}

function showWelcome() {
    const editorContent = document.getElementById('editorContent');
    editorContent.innerHTML = `
        <div class="fm-welcome">
            <div class="fm-welcome-icon">\uD83D\uDCC1</div>
            <h2>File Manager Demo</h2>
            <p>상업 프로젝트에서 구현한 파일 관리 시스템의 프론트엔드를 데모로 재현했습니다.</p>

            <div class="fm-welcome-guide">
                <h3>체험 가이드</h3>
                <ol>
                    <li><strong>sample/</strong> 폴더를 열어 <code>index.html</code>과 <code>style.css</code>를 확인하세요</li>
                    <li>파일 선택 → <strong>Edit</strong> 클릭 → 코드 수정</li>
                    <li><strong>Save</strong> 클릭 → 메모리에 저장</li>
                    <li><strong>Preview</strong> 클릭 → 수정 결과 확인</li>
                </ol>
            </div>

            <ul>
                <li><strong>편집</strong> — 모든 파일을 수정, 생성, 삭제할 수 있습니다</li>
                <li><strong>저장</strong> — Save(Ctrl+S)로 저장해야 미리보기에 반영됩니다</li>
                <li><strong>CSS 연결</strong> — HTML과 같은 폴더의 CSS는 미리보기에 자동 적용</li>
                <li><strong>보안 필터</strong> — Security Demo로 위험 확장자 차단 확인</li>
            </ul>

            <p class="fm-welcome-note">
                모든 작업은 메모리에서만 동작합니다. 새로고침 시 초기화됩니다.
            </p>

            <div class="fm-welcome-compare">
                <div class="fm-compare-item">
                    <strong>실제 시스템</strong>
                    <span>서버 파일시스템 → PHP API → AJAX → CodeMirror</span>
                </div>
                <div class="fm-compare-item">
                    <strong>이 데모</strong>
                    <span>정적 JSON → JS → Edit → Save → Preview</span>
                </div>
            </div>
        </div>
    `;
}

// --- Breadcrumb ---
function updateBreadcrumb(nodeId) {
    const breadcrumb = document.getElementById('breadcrumb');
    const pathParts = getNodePath(state.tree, nodeId, []);
    if (!pathParts) {
        breadcrumb.innerHTML = '';
        return;
    }
    breadcrumb.innerHTML = pathParts.map((part, i) => {
        const isLast = i === pathParts.length - 1;
        return `<span class="fm-breadcrumb-item${isLast ? ' current' : ''}">${part}</span>`;
    }).join('<span class="fm-breadcrumb-sep">/</span>');
}

// --- Toolbar ---
function updateToolbarState() {
    const selected = state.selectedNodeId ? findNode(state.tree, state.selectedNodeId) : null;
    const isFile = selected && selected.type === 'file';
    const isTextFile = isFile && selected.language !== 'image';
    const canEdit = isTextFile && isEditable(state.selectedNodeId);
    const inDemos = state.selectedNodeId ? isInDemos(state.selectedNodeId) : false;

    // Rename/Delete: demos 하위만
    document.getElementById('btnRename').disabled = !selected || !inDemos || (selected && selected.id === state.tree.id);
    document.getElementById('btnDelete').disabled = !selected || !inDemos || (selected && selected.id === state.tree.id);

    // Edit / Save / Preview 버튼: demos 하위가 아닌 파일은 아예 숨김
    const btnEdit = document.getElementById('btnEdit');
    const btnSave = document.getElementById('btnSave');
    const btnPreview = document.getElementById('btnPreview');
    const sepEdit = document.getElementById('sepEdit');

    if (isTextFile && !canEdit) {
        // 읽기 전용 파일 (demos 밖): 버튼 및 구분선 숨김
        btnEdit.classList.add('hidden');
        btnSave.classList.add('hidden');
        btnPreview.classList.add('hidden');
        if (sepEdit) sepEdit.classList.add('hidden');
    } else {
        // demos 하위 파일 또는 파일 미선택: 버튼 표시
        btnEdit.classList.remove('hidden');
        btnSave.classList.remove('hidden');
        btnPreview.classList.remove('hidden');
        if (sepEdit) sepEdit.classList.remove('hidden');

        // Edit 버튼
        btnEdit.disabled = !canEdit;
        if (canEdit && state.editMode && !state.previewMode) {
            btnEdit.classList.add('active');
            btnEdit.querySelector('.btn-label').textContent = 'Editing';
        } else {
            btnEdit.classList.remove('active');
            btnEdit.querySelector('.btn-label').textContent = 'Edit';
        }

        // Save 버튼
        btnSave.disabled = !canEdit || !state.hasUnsavedChanges;
        if (state.hasUnsavedChanges) {
            btnSave.classList.add('highlight');
        } else {
            btnSave.classList.remove('highlight');
        }

        // Preview 버튼
        btnPreview.disabled = !isTextFile;
        if (state.previewMode) {
            btnPreview.classList.add('active');
        } else {
            btnPreview.classList.remove('active');
        }
    }

    // 상태바
    const statusRight = document.getElementById('statusRight');
    if (selected && isTextFile) {
        const modeLabel = state.previewMode ? 'PREVIEW' : (state.editMode ? 'EDIT' : 'READ');
        const saveLabel = state.hasUnsavedChanges ? ' [미저장]' : '';
        statusRight.textContent = `${selected.name} | ${(selected.language || 'text').toUpperCase()} | ${modeLabel}${saveLabel}`;
    } else if (selected) {
        statusRight.textContent = selected.type === 'file'
            ? `${selected.name} | ${(selected.language || 'text').toUpperCase()}`
            : selected.name;
    } else {
        statusRight.textContent = 'No selection';
    }
}

// --- CRUD Operations ---
function getSelectedParentDir() {
    const demosDir = getDemosDir();
    if (!state.selectedNodeId) return demosDir || state.tree;
    const node = findNode(state.tree, state.selectedNodeId);
    if (!node) return demosDir || state.tree;

    // demos 하위가 아니면 demos 폴더를 기본으로
    if (!isInDemos(node.id)) return demosDir || state.tree;

    if (node.type === 'directory') return node;
    return findParent(state.tree, node.id) || demosDir || state.tree;
}

function createFile() {
    const parentDir = getSelectedParentDir();
    if (!isInDemos(parentDir.id)) {
        showToast('여기에서는 파일을 생성할 수 없습니다', 'warning');
        return;
    }

    showModal('새 파일', '파일명을 입력하세요', 'newfile.html', (filename) => {
        const validation = validateFilename(filename);
        if (!validation.valid) return validation.errors;

        if (parentDir.children && parentDir.children.some(c => c.name === filename)) {
            return ['같은 이름의 파일이 이미 존재합니다'];
        }

        if (!parentDir.children) parentDir.children = [];
        const lang = detectLanguage(filename);
        const newNode = {
            id: state.nextId++,
            name: filename,
            type: 'file',
            language: lang,
            content: getNewFileTemplate(filename, lang),
        };
        parentDir.children.push(newNode);
        sortChildren(parentDir.children);
        state.expandedDirs.add(parentDir.id);
        state.selectedNodeId = newNode.id;
        state.hasUnsavedChanges = false;
        state.unsavedContent = null;
        state.savedFiles.add(newNode.id); // 템플릿 내용은 바로 저장된 상태
        renderTree();
        openFile(newNode, true);
        showToast(`파일 "${filename}" 생성됨 — 편집 모드`, 'success');
        return null;
    });
}

function createFolder() {
    const parentDir = getSelectedParentDir();
    if (!isInDemos(parentDir.id)) {
        showToast('여기에서는 폴더를 생성할 수 없습니다', 'warning');
        return;
    }

    showModal('새 폴더', '폴더명을 입력하세요', 'new-folder', (foldername) => {
        if (!foldername || !foldername.trim()) return ['폴더명을 입력하세요'];
        if (/[<>:"/\\|?*]/.test(foldername)) return ['사용할 수 없는 문자가 포함되어 있습니다'];
        if (parentDir.children && parentDir.children.some(c => c.name === foldername)) {
            return ['같은 이름의 폴더가 이미 존재합니다'];
        }

        if (!parentDir.children) parentDir.children = [];
        const newNode = {
            id: state.nextId++,
            name: foldername,
            type: 'directory',
            children: [],
        };
        parentDir.children.push(newNode);
        sortChildren(parentDir.children);
        state.expandedDirs.add(parentDir.id);
        state.selectedNodeId = newNode.id;
        renderTree();
        updateToolbarState();
        showToast(`폴더 "${foldername}" 생성됨`, 'success');
        return null;
    });
}

function renameNode() {
    if (!state.selectedNodeId) return;
    const node = findNode(state.tree, state.selectedNodeId);
    if (!node || node.id === state.tree.id) return;

    if (!isInDemos(node.id)) {
        showToast('이 항목의 이름은 변경할 수 없습니다', 'warning');
        return;
    }

    const isFile = node.type === 'file';
    showModal('이름 변경', '새 이름을 입력하세요', node.name, (newName) => {
        if (!newName || !newName.trim()) return ['이름을 입력하세요'];
        if (newName === node.name) return null;

        if (isFile) {
            const validation = validateFilename(newName);
            if (!validation.valid) return validation.errors;
        } else {
            if (/[<>:"/\\|?*]/.test(newName)) return ['사용할 수 없는 문자가 포함되어 있습니다'];
        }

        const parent = findParent(state.tree, node.id);
        if (parent && parent.children.some(c => c.name === newName && c.id !== node.id)) {
            return ['같은 이름이 이미 존재합니다'];
        }

        const oldName = node.name;
        node.name = newName;
        if (isFile) node.language = detectLanguage(newName);
        if (parent) sortChildren(parent.children);
        renderTree();
        if (isFile && state.selectedNodeId === node.id) updateBreadcrumb(node.id);
        showToast(`"${oldName}" → "${newName}" 변경됨`, 'success');
        return null;
    });
}

function deleteNode() {
    if (!state.selectedNodeId) return;
    const node = findNode(state.tree, state.selectedNodeId);
    if (!node || node.id === state.tree.id) return;

    if (!isInDemos(node.id)) {
        showToast('이 항목은 삭제할 수 없습니다', 'warning');
        return;
    }

    const typeLabel = node.type === 'directory' ? '폴더' : '파일';
    if (!confirm(`"${node.name}" ${typeLabel}을(를) 삭제하시겠습니까?\n\n(데모이므로 메모리에서만 제거됩니다.)`)) {
        return;
    }

    const parent = findParent(state.tree, node.id);
    if (parent) {
        parent.children = parent.children.filter(c => c.id !== node.id);
    }

    state.selectedNodeId = null;
    state.hasUnsavedChanges = false;
    state.unsavedContent = null;
    state.editMode = false;
    state.previewMode = false;
    renderTree();
    showWelcome();
    updateBreadcrumb(null);
    updateToolbarState();
    showToast(`"${node.name}" 삭제됨`, 'success');
}

// --- Security Demo ---
async function runSecurityDemo() {
    const panel = document.getElementById('editorContent');
    state.selectedNodeId = null;
    state.editMode = false;
    state.previewMode = false;
    state.hasUnsavedChanges = false;
    state.unsavedContent = null;
    renderTree();
    updateBreadcrumb(null);
    updateToolbarState();

    const tests = [
        { name: 'malware.php' },
        { name: 'hack.exe' },
        { name: '../../../etc/passwd' },
        { name: '.htaccess' },
        { name: 'script.bat' },
        { name: 'inject.phtml' },
        { name: 'safe-page.html' },
        { name: 'styles.css' },
        { name: 'app.js' },
    ];

    panel.innerHTML = `
        <div class="fm-security-demo">
            <h2>Security Filter Demo</h2>
            <p>파일 생성 시 보안 필터가 위험한 확장자를 차단하는 과정을 보여줍니다.</p>
            <p class="fm-security-subtitle">실제 시스템에서는 PHP <code>chkExt()</code> 함수가 서버 측에서 동일한 검증을 수행합니다.</p>
            <div class="fm-security-list" id="securityList"></div>
            <div class="fm-security-summary" id="securitySummary"></div>
        </div>
    `;

    const list = document.getElementById('securityList');
    let blockedCount = 0;
    let allowedCount = 0;

    for (const test of tests) {
        await new Promise(r => setTimeout(r, 400));

        const validation = validateFilename(test.name);
        const isBlocked = !validation.valid;
        if (isBlocked) blockedCount++; else allowedCount++;

        const item = document.createElement('div');
        item.className = 'fm-security-item ' + (isBlocked ? 'blocked' : 'allowed');
        item.innerHTML = `
            <span class="fm-security-filename">${test.name}</span>
            <span class="fm-security-badge ${isBlocked ? 'blocked' : 'allowed'}">
                ${isBlocked ? 'BLOCKED' : 'ALLOWED'}
            </span>
            ${isBlocked ? `<span class="fm-security-reason">${validation.errors[0]}</span>` : ''}
        `;
        list.appendChild(item);
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    await new Promise(r => setTimeout(r, 300));
    document.getElementById('securitySummary').innerHTML = `
        <div class="fm-security-result">
            <span class="fm-security-stat blocked">${blockedCount} Blocked</span>
            <span class="fm-security-stat allowed">${allowedCount} Allowed</span>
        </div>
        <p>보안 필터가 ${blockedCount}개의 위험한 파일을 차단했습니다.</p>
    `;
}

// --- Modal ---
let modalCallback = null;

function showModal(title, description, placeholder, callback) {
    modalCallback = callback;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalDesc').textContent = description;
    const input = document.getElementById('modalInput');
    input.value = placeholder || '';
    input.placeholder = placeholder || '';
    document.getElementById('modalError').textContent = '';
    document.getElementById('modalOverlay').style.display = 'flex';
    setTimeout(() => { input.focus(); input.select(); }, 50);
}

function hideModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    modalCallback = null;
}

function confirmModal() {
    if (!modalCallback) return;
    const input = document.getElementById('modalInput');
    const errors = modalCallback(input.value.trim());
    if (errors && errors.length > 0) {
        document.getElementById('modalError').textContent = errors.join('\n');
        return;
    }
    hideModal();
}

// --- Toast Notifications ---
function showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'fm-toast fm-toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Status Bar ---
function updateStatusBar() {
    let fileCount = 0;
    let dirCount = 0;
    function count(node) {
        if (node.type === 'file') fileCount++;
        else {
            dirCount++;
            if (node.children) node.children.forEach(count);
        }
    }
    if (state.tree) count(state.tree);

    document.getElementById('statusLeft').textContent = `${dirCount} folders, ${fileCount} files`;
}

// --- Theme Toggle ---
function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    if (editorInstance) {
        editorInstance.setOption('theme', next === 'dark' ? 'material-darker' : 'default');
    }
}

// --- Resizable Divider ---
function initDivider() {
    const divider = document.getElementById('divider');
    const treePanel = document.getElementById('treePanel');
    let isDragging = false;

    divider.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        treePanel.style.width = Math.max(180, Math.min(500, e.clientX)) + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (editorInstance) editorInstance.refresh();
    });
}

// --- Keyboard Shortcuts ---
function initKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (document.getElementById('modalOverlay').style.display === 'flex') {
            if (e.key === 'Escape') hideModal();
            if (e.key === 'Enter') confirmModal();
            return;
        }

        // Ctrl+S / Cmd+S: 저장
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveFile();
            return;
        }

        // CodeMirror 편집 중이면 일반 키 허용
        if (state.editMode && !state.previewMode && e.target.closest('.CodeMirror')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            deleteNode();
        } else if (e.key === 'F2') {
            e.preventDefault();
            renameNode();
        } else if (e.key === 'e' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleEditMode();
        } else if (e.key === 'p' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            togglePreview();
        }
    });
}

// --- Init ---
function init() {
    state.tree = JSON.parse(JSON.stringify(FILE_TREE_DATA));
    assignIds(state.tree);

    // 루트(demos)와 sample 폴더 자동 펼침
    state.expandedDirs.add(state.tree.id);
    if (state.tree.children) {
        const sampleDir = state.tree.children.find(c => c.name === 'sample');
        if (sampleDir) state.expandedDirs.add(sampleDir.id);
    }

    initTheme();
    renderTree();
    showWelcome();
    updateToolbarState();
    initDivider();
    initKeyboard();

    // Toolbar
    document.getElementById('btnNewFile').addEventListener('click', createFile);
    document.getElementById('btnNewFolder').addEventListener('click', createFolder);
    document.getElementById('btnRename').addEventListener('click', renameNode);
    document.getElementById('btnDelete').addEventListener('click', deleteNode);
    document.getElementById('btnEdit').addEventListener('click', toggleEditMode);
    document.getElementById('btnSave').addEventListener('click', saveFile);
    document.getElementById('btnPreview').addEventListener('click', togglePreview);
    document.getElementById('btnSecurityDemo').addEventListener('click', runSecurityDemo);

    // Theme
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Modal
    document.getElementById('modalCancel').addEventListener('click', hideModal);
    document.getElementById('modalConfirm').addEventListener('click', confirmModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') hideModal();
    });

    document.getElementById('modalInput').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
            const v = validateFilename(val);
            document.getElementById('modalError').textContent = v.valid ? '' : v.errors.join('\n');
        } else {
            document.getElementById('modalError').textContent = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
