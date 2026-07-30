const { CatAPI } = await import('./api.js?v=' + Date.now());

// CodeMirror imports (via esm.sh)
import { EditorState, Compartment } from "https://esm.sh/@codemirror/state";
import { EditorView, keymap } from "https://esm.sh/@codemirror/view";
import { defaultKeymap } from "https://esm.sh/@codemirror/commands";
import { javascript } from "https://esm.sh/@codemirror/lang-javascript";
import { basicSetup } from "https://esm.sh/codemirror";
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark";

export async function renderChatView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col md:flex-row relative';

    container.innerHTML = `
        <!-- History Sidebar -->
        <section id="history-panel" class="hidden w-[320px] flex-col border-r border-border h-full bg-[var(--bg-secondary)] flex-shrink-0 shadow-sm z-20 relative">
            <div id="resizer-history" class="w-1 cursor-col-resize absolute right-0 top-0 bottom-0 bg-transparent hover:bg-[var(--accent-color)] active:bg-[var(--accent-color)] transition-colors z-50"></div>
            <div class="pt-6 pb-4 flex items-center justify-between px-4 relative">
                <span class="font-semibold text-[var(--text-primary)] tracking-wide">Chats</span>
                <button id="btn-new-chat" class="p-1.5 rounded-md hover:bg-black/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" title="New Chat">
                    <i data-lucide="edit" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="px-4 pb-2">
                <div class="relative flex items-center">
                    <i data-lucide="search" class="w-4 h-4 absolute left-3 text-gray-400"></i>
                    <input type="text" id="chat-search" class="w-full bg-[var(--bg-primary)] border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-color)] shadow-sm placeholder:text-gray-400" placeholder="Cerca...">
                </div>
            </div>
            <div id="chats-list" class="flex-1 overflow-y-auto px-2 py-2 space-y-1 bg-transparent">
                <div class="text-center text-xs text-gray-500 mt-4">Caricamento...</div>
            </div>
        </section>

        <!-- Chat Panel -->
        <section id="chat-panel" class="flex-1 min-w-[300px] flex flex-col border-r border-border h-full bg-[var(--bg-primary)] relative">
            
            <button id="btn-open-canvas" class="hidden absolute top-4 right-4 z-10 p-2 rounded-xl bg-[var(--bg-primary)] border border-border shadow-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hover:shadow-md" title="Apri Editor">
                <i data-lucide="code" class="w-4 h-4"></i>
            </button>

            <!-- Messages Area -->
            <div id="messages-container" class="flex-1 overflow-y-auto p-4 space-y-6">
                <!-- Empty State -->
                <div id="empty-state" class="h-full flex flex-col items-center justify-center text-center">
                    <i data-lucide="sparkles" class="w-12 h-12 text-[var(--accent-color)] mb-4"></i>
                    <h2 class="text-3xl text-[var(--text-primary)]" style="font-family: var(--font-serif);">Cosa possiamo affrontare insieme?</h2>
                </div>
            </div>

            <!-- Input Area -->
            <div class="p-4 bg-transparent flex justify-center pb-6">
                <form id="chat-form" class="w-full max-w-3xl flex gap-2 bg-[var(--bg-secondary)] p-3 rounded-2xl border border-border shadow-sm hover:shadow focus-within:shadow focus-within:border-gray-400 dark:focus-within:border-gray-600 transition-all relative">
                    <!-- Upload Dropzone Popover -->
                    <div id="upload-popover" class="hidden absolute bottom-full left-0 mb-2 bg-[var(--bg-primary)] border border-border shadow-lg rounded-xl p-4 w-64 z-50">
                        <label class="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-[var(--bg-secondary)] hover:border-[var(--accent-color)] transition-all">
                            <i data-lucide="upload" class="w-6 h-6 text-[var(--text-secondary)] mb-2"></i>
                            <span class="text-xs text-[var(--text-secondary)]">Seleziona o trascina</span>
                            <input type="file" id="file-upload" class="hidden" multiple />
                        </label>
                        <div id="upload-status" class="hidden mt-2 text-xs text-center text-[var(--text-secondary)]">Caricamento...</div>
                    </div>

                    <button type="button" id="btn-upload" class="self-end p-2 rounded-xl text-[var(--text-secondary)] hover:bg-black/10 transition-colors" title="Allega file">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </button>
                    
                    <div class="flex-1 flex flex-col justify-center min-h-[32px]">
                        <div id="chat-attachments" class="flex flex-wrap gap-2 empty:hidden pt-1 pb-2"></div>
                        <textarea 
                            id="chat-input" 
                            class="w-full bg-transparent border-none py-1 resize-none focus:outline-none max-h-48 text-[15px] leading-relaxed" 
                            rows="1" 
                            placeholder="Come posso aiutarti oggi?"></textarea>
                    </div>

                    <select id="agent-select" class="self-end mb-2 bg-transparent border-none font-medium text-xs text-[var(--text-secondary)] focus:outline-none cursor-pointer hover:text-[var(--text-primary)]">
                        <option value="default">Default Agent</option>
                    </select>

                    <button type="submit" class="self-end p-2 rounded-xl text-white transition-colors hover:bg-[var(--accent-hover)]" style="background-color: var(--accent-color);">
                        <i data-lucide="arrow-up" class="w-4 h-4"></i>
                    </button>
                </form>
            </div>
        </section>

        <!-- Canvas Panel -->
        <section id="canvas-panel" class="hidden w-full md:w-1/2 lg:w-2/5 flex-col absolute md:relative h-full inset-0 z-10 bg-[var(--bg-canvas)] transition-transform duration-300 border-l border-border">
            <div id="resizer-canvas" class="w-1 cursor-col-resize absolute left-0 top-0 bottom-0 bg-transparent hover:bg-[var(--accent-color)] active:bg-[var(--accent-color)] transition-colors z-50"></div>
            <!-- Canvas Header -->
            <div class="h-14 flex items-center justify-between px-4 border-b border-border bg-[var(--bg-secondary)] flex-shrink-0">
                <span id="canvas-title" class="font-semibold flex items-center gap-2 text-sm truncate max-w-[250px]">
                    <i data-lucide="code" class="w-4 h-4 flex-shrink-0"></i> Artifact
                </span>
                <div class="flex gap-2">
                    <button id="btn-copy" class="text-xs flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-primary)] border border-border hover:bg-[var(--bg-border)]">
                        <i data-lucide="copy" class="w-3 h-3"></i> Copy
                    </button>
                    <button id="btn-close-canvas" class="p-1 rounded hover:bg-black/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <!-- Editor -->
            <div id="editor-host" class="flex-1 overflow-hidden"></div>
        </section>
    `;

    setTimeout(() => initChatLogic(container), 0);
    return container;
}

function initChatLogic(container) {
    const chatForm = container.querySelector('#chat-form');
    const chatInput = container.querySelector('#chat-input');
    const messagesContainer = container.querySelector('#messages-container');
    const emptyState = container.querySelector('#empty-state');
    const canvasPanel = container.querySelector('#canvas-panel');
    const editorHost = container.querySelector('#editor-host');
    const btnCloseCanvas = container.querySelector('#btn-close-canvas');
    const btnCopy = container.querySelector('#btn-copy');
    
    // Sidebar elements
    const historyPanel = container.querySelector('#history-panel');
    const btnOpenCanvas = container.querySelector('#btn-open-canvas');
    const chatsList = container.querySelector('#chats-list');
    const searchInput = container.querySelector('#chat-search');
    const btnNewChat = container.querySelector('#btn-new-chat');
    const agentSelect = container.querySelector('#agent-select');
    
    // Toggle Logic
    function updateSidebarToggles() {
        if (canvasPanel.classList.contains('hidden')) {
            btnOpenCanvas.classList.remove('hidden');
        } else {
            btnOpenCanvas.classList.add('hidden');
        }
    }

    // Setup initial sidebar visibility based on screen width
    if (window.innerWidth >= 1024) {
        historyPanel.classList.remove('hidden');
        historyPanel.classList.add('flex');
    }
    const savedHistoryWidth = localStorage.getItem('historyPanelWidth');
    if (savedHistoryWidth) {
        historyPanel.style.width = savedHistoryWidth;
    }
    const savedCanvasWidth = localStorage.getItem('canvasPanelWidth');
    if (savedCanvasWidth) {
        canvasPanel.style.width = savedCanvasWidth;
    }
    updateSidebarToggles();

    if (btnOpenCanvas) btnOpenCanvas.addEventListener('click', () => {
        canvasPanel.classList.remove('hidden');
        canvasPanel.classList.add('flex');
        updateSidebarToggles();
    });

    // Resize Logic
    const resizerHistory = container.querySelector('#resizer-history');
    let isResizingHistory = false;
    if (resizerHistory) {
        resizerHistory.addEventListener('mousedown', (e) => {
            isResizingHistory = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });
    }

    const resizerCanvas = container.querySelector('#resizer-canvas');
    let isResizingCanvas = false;
    if (resizerCanvas) {
        resizerCanvas.addEventListener('mousedown', (e) => {
            isResizingCanvas = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (!isResizingHistory && !isResizingCanvas) return;
        
        e.preventDefault();

        if (isResizingHistory) {
            const historyRect = historyPanel.getBoundingClientRect();
            let newWidth = e.clientX - historyRect.left;
            if (newWidth < 200) newWidth = 200;
            if (newWidth > 600) newWidth = 600;
            historyPanel.style.width = newWidth + 'px';
        }
        
        if (isResizingCanvas) {
            const containerRect = container.getBoundingClientRect();
            let newWidth = containerRect.right - e.clientX;
            if (newWidth < 300) newWidth = 300;
            if (newWidth > containerRect.width - 300) newWidth = containerRect.width - 300;
            canvasPanel.style.width = newWidth + 'px';
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingHistory || isResizingCanvas) {
            if (isResizingHistory) {
                localStorage.setItem('historyPanelWidth', historyPanel.style.width);
            }
            if (isResizingCanvas) {
                localStorage.setItem('canvasPanelWidth', canvasPanel.style.width);
            }
            isResizingHistory = false;
            isResizingCanvas = false;
            document.body.style.cursor = 'default';
        }
    });
    
    // State
    let currentChatId = null;
    let currentChatName = "Nuova Chat";
    let currentMessages = [];
    let currentAttachments = []; // Array of uploaded files {url, mime_type}

    // CodeMirror Setup
    let editorView = null;
    const themeConfig = new Compartment();
    const getTheme = () => document.documentElement.getAttribute('data-theme') === 'dark' ? oneDark : [];
    
    let state = EditorState.create({
        doc: "// Code will appear here",
        extensions: [basicSetup, keymap.of(defaultKeymap), javascript(), themeConfig.of(getTheme())]
    });
    editorView = new EditorView({ state, parent: editorHost });

    // Sync CodeMirror theme with app theme
    const observer = new MutationObserver(() => {
        editorView.dispatch({
            effects: themeConfig.reconfigure(getTheme())
        });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Load Agents
    CatAPI.getAgents().then(agents => {
        if (agents && agents.length > 0) {
            const savedAgent = localStorage.getItem('selectedAgent') || 'default';
            agentSelect.innerHTML = agents.map(a => `<option value="${a.slug}" class="bg-[var(--bg-primary)] text-[var(--text-primary)]" ${a.slug === savedAgent ? 'selected' : ''}>${a.name || a.slug}</option>`).join('');
        }
    }).catch(console.error);

    agentSelect.addEventListener('change', (e) => {
        localStorage.setItem('selectedAgent', e.target.value);
    });

    // Time ago helper
    function timeAgo(dateString) {
        if (!dateString) return '';
        let date;
        // Check if it's a number or numeric string (timestamp)
        if (!isNaN(dateString)) {
            let ts = parseFloat(dateString);
            if (ts < 10000000000) ts *= 1000; // Convert seconds to ms
            date = new Date(ts);
        } else {
            // ISO string
            date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
        }
        
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " anni fa";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " mesi fa";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " giorni fa";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " ore fa";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " min fa";
        if (seconds < 0) return "ora";
        return Math.floor(seconds) + " sec fa";
    }

    // --- Upload Logic ---
    const btnUpload = container.querySelector('#btn-upload');
    const uploadPopover = container.querySelector('#upload-popover');
    const fileUpload = container.querySelector('#file-upload');
    const uploadStatus = container.querySelector('#upload-status');
    const chatAttachments = container.querySelector('#chat-attachments');

    if (btnUpload && uploadPopover) {
        btnUpload.addEventListener('click', (e) => {
            e.stopPropagation();
            uploadPopover.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!btnUpload.contains(e.target) && !uploadPopover.contains(e.target)) {
                uploadPopover.classList.add('hidden');
            }
        });
    }

    if (fileUpload) {
        fileUpload.addEventListener('change', async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            
            uploadStatus.classList.remove('hidden');
            uploadStatus.textContent = "Caricamento...";
            uploadStatus.classList.remove('text-red-500', 'text-green-500');
            uploadStatus.classList.add('text-[var(--text-secondary)]');
            
            try {
                for (let i = 0; i < files.length; i++) {
                    const data = await CatAPI.uploadFile(files[i]);
                    currentAttachments.push({
                        ...data,
                        original_name: files[i].name
                    });
                    
                    // Add badge
                    const badge = document.createElement('div');
                    badge.className = 'flex items-center gap-1 bg-[var(--bg-primary)] border border-border text-xs px-2 py-1 rounded-md max-w-full';
                    badge.innerHTML = `
                        <i data-lucide="file" class="w-3 h-3 flex-shrink-0"></i> 
                        <span class="truncate max-w-[120px] font-medium" title="${files[i].name}">${files[i].name}</span>
                        <button type="button" class="text-red-500 hover:text-red-700 ml-1 p-0.5"><i data-lucide="x" class="w-3 h-3"></i></button>
                    `;
                    badge.querySelector('button').addEventListener('click', () => {
                        badge.remove();
                        currentAttachments = currentAttachments.filter(a => a.url !== data.url);
                    });
                    chatAttachments.appendChild(badge);
                    if(window.lucide) window.lucide.createIcons();
                }
                
                uploadStatus.classList.remove('text-[var(--text-secondary)]');
                uploadStatus.classList.add('text-green-500');
                uploadStatus.textContent = "Completato!";
                
                setTimeout(() => {
                    uploadStatus.classList.add('hidden');
                    uploadPopover.classList.add('hidden');
                    fileUpload.value = '';
                }, 1500);

            } catch (err) {
                console.error("Upload error:", err);
                uploadStatus.classList.remove('text-[var(--text-secondary)]');
                uploadStatus.classList.add('text-red-500');
                uploadStatus.textContent = "Errore upload!";
            }
        });
    }

    // Load Chats
    async function loadChatList(search = '') {
        try {
            const page = await CatAPI.getChats(search);
            const chats = page.items || page; // Page_ChatSelect_ format usually has .items
            
            chatsList.innerHTML = '';
            if (!chats || chats.length === 0) {
                chatsList.innerHTML = '<div class="text-center text-xs text-gray-500 mt-4 font-mono">Nessuna chat.</div>';
                return;
            }

            chats.forEach(chat => {
                const div = document.createElement('div');
                div.className = `relative py-2 px-3 rounded-lg flex items-center gap-3 cursor-pointer transition-colors group ${chat.id === currentChatId ? 'bg-[var(--bg-primary)] text-[var(--text-primary)]' : 'hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`;

                const msgCount = Array.isArray(chat.messages) ? chat.messages.length : 0;
                const time = timeAgo(chat.updated_at || chat.created_at);

                div.innerHTML = `
                    <div class="flex-1 min-w-0 pr-6">
                        <div class="font-medium text-sm truncate text-[var(--text-primary)]">${chat.name || 'Nuova Chat'}</div>
                        <div class="text-[10px] opacity-70 mt-0.5 truncate">${time} &middot; ${msgCount} msgs</div>
                    </div>
                    <button class="btn-delete absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                    </button>
                `;

                div.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-delete')) return;
                    loadChatMessages(chat);
                });

                div.querySelector('.btn-delete').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm('Vuoi eliminare questa chat?')) {
                        try {
                            await CatAPI.fetch('/chats/' + chat.id, { method: 'DELETE' });
                            if (currentChatId === chat.id) btnNewChat.click();
                            loadChatList();
                        } catch (err) {
                            alert('Errore: ' + err.message);
                        }
                    }
                });

                chatsList.appendChild(div);
            });
            if(window.lucide) window.lucide.createIcons();
        } catch (e) {
            console.error(e);
            chatsList.innerHTML = '<div class="text-center text-xs text-red-500 mt-4">Errore caricamento.</div>';
        }
    }

    loadChatList();

    // Debounced search
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadChatList(e.target.value), 300);
    });

    btnNewChat.addEventListener('click', () => {
        currentChatId = null;
        currentChatName = "Nuova Chat";
        currentMessages = [];
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(emptyState);
        emptyState.style.display = 'flex';
        loadChatList(); // Refresh highlighting
    });

    function loadChatMessages(chat) {
        currentChatId = chat.id;
        currentChatName = chat.name || "Chat";
        currentMessages = Array.isArray(chat.messages) ? chat.messages : [];
        messagesContainer.innerHTML = '';
        emptyState.style.display = 'none';
        
        currentMessages.forEach(m => {
            const role = m.role === 'user' ? 'User' : 'Cat';
            if (Array.isArray(m.content)) {
                let text = m.content.find(c => c.type === 'text')?.text || '';
                const responseBox = appendMessage(role, text, false, false);
                
                m.content.filter(c => c.type === 'tool_call' || c.type === 'tool_use').forEach(t => {
                    responseBox.addTool(t.id || Math.random().toString(36).substr(2, 9), t.name);
                    const argsStr = typeof t.args === 'string' ? t.args : JSON.stringify(t.args || {});
                    responseBox.updateToolArgs(t.id, argsStr);
                });
            } else {
                if (m.content) appendMessage(role, m.content, false, false);
            }
        });
        loadChatList(); // Update active highlight
    }

    // Appends a message and returns an object to update it (for streaming)
    function appendMessage(sender, text, isError=false, attachments=[]) {
        if (emptyState) emptyState.style.display = 'none';

        const msgDiv = document.createElement('div');
        const isUser = sender === 'User';
        
        msgDiv.className = `flex w-full justify-center mb-8 px-4 ${isError ? 'text-red-500' : ''}`;
        
        const innerContainer = document.createElement('div');
        innerContainer.className = `flex w-full max-w-3xl gap-4 group ${isUser ? 'justify-end' : 'justify-start'}`;
        
        // Avatar (Only for Agent)
        const avatar = document.createElement('div');
        if (!isUser) {
            avatar.className = `w-8 h-8 flex items-center justify-center shrink-0 mt-1`;
            if (sender === 'System') {
                avatar.innerHTML = '<i data-lucide="alert-triangle" class="w-6 h-6 text-red-500"></i>';
            } else {
                avatar.innerHTML = '<i data-lucide="sparkles" class="w-7 h-7 text-[#d97757]"></i>'; // Claude-like rust spark
            }
        }

        const content = document.createElement('div');
        if (isUser) {
            content.className = 'flex flex-col gap-3 bg-[var(--bg-secondary)] px-5 py-3.5 rounded-2xl max-w-[85%]';
            
            if (attachments && attachments.length > 0) {
                const attGrid = document.createElement('div');
                attGrid.className = 'flex flex-wrap gap-3 mb-1';
                attachments.forEach(att => {
                    const ext = (att.original_name || '').split('.').pop().toUpperCase() || 'FILE';
                    attGrid.innerHTML += `
                        <div class="flex items-center gap-3 bg-[var(--bg-primary)] border border-border shadow-sm rounded-xl p-3 min-w-[180px] max-w-[220px]">
                            <div class="p-2 bg-red-500/10 text-red-600 rounded-lg shrink-0">
                                <i data-lucide="file-text" class="w-5 h-5"></i>
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="text-sm font-semibold truncate text-[var(--text-primary)]">${att.original_name || 'Document'}</span>
                                <span class="text-[10px] font-bold text-gray-400 mt-0.5">${ext}</span>
                            </div>
                        </div>
                    `;
                });
                content.appendChild(attGrid);
            }
        } else {
            content.className = 'flex-1 pt-1 min-w-0 flex flex-col gap-2'; 
        }

        const reasoningContainer = document.createElement('div');
        reasoningContainer.className = 'hidden';
        reasoningContainer.innerHTML = `
            <details class="text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-border rounded-lg p-2">
                <summary class="cursor-pointer font-semibold select-none flex items-center gap-1"><i data-lucide="brain" class="w-3 h-3"></i> Ragionamento</summary>
                <div class="mt-2 whitespace-pre-wrap font-mono opacity-80" id="reasoning-text"></div>
            </details>
        `;

        const body = document.createElement('div');
        body.className = 'markdown-body text-[15px] leading-relaxed overflow-hidden';
        
        const toolsContainer = document.createElement('div');
        toolsContainer.className = 'flex flex-col gap-2 mt-2 empty:hidden';

        if (isUser) {
            if (text) {
                body.textContent = text;
                body.style.whiteSpace = 'pre-wrap';
                content.appendChild(body);
            }
        } else {
            body.innerHTML = DOMPurify.sanitize(marked.parse(text));
            content.appendChild(reasoningContainer);
            content.appendChild(toolsContainer);
            content.appendChild(body);
            
            // Claude-style action bar for AI
            const actionBar = document.createElement('div');
            actionBar.className = 'flex items-center gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200';
            actionBar.innerHTML = `
                <button class="btn-copy p-1.5 text-gray-400 hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors" title="Copia"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
                <button class="btn-retry p-1.5 text-gray-400 hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors ml-1" title="Riprova"><i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i></button>
            `;
            content.appendChild(actionBar);
            
            const btnCopy = actionBar.querySelector('.btn-copy');
            const btnRetry = actionBar.querySelector('.btn-retry');
            
            btnCopy.addEventListener('click', () => {
                navigator.clipboard.writeText(rawTextForCopy || body.textContent).then(() => {
                    const icon = btnCopy.querySelector('i');
                    const oldIcon = icon.getAttribute('data-lucide');
                    icon.setAttribute('data-lucide', 'check');
                    icon.classList.add('text-green-500');
                    if (window.lucide) window.lucide.createIcons();
                    setTimeout(() => {
                        icon.setAttribute('data-lucide', oldIcon);
                        icon.classList.remove('text-green-500');
                        if (window.lucide) window.lucide.createIcons();
                    }, 2000);
                });
            });
            
            btnRetry.addEventListener('click', () => {
                if (window.triggerRetry) {
                    window.triggerRetry(msgDiv);
                }
            });
        }
        
        if (!isUser) {
            innerContainer.appendChild(avatar);
        }
        innerContainer.appendChild(content);
        
        msgDiv.appendChild(innerContainer);
        messagesContainer.appendChild(msgDiv);
        
        if(window.lucide) window.lucide.createIcons();
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        let toolCalls = {}; // id -> HTMLElement
        let rawTextForCopy = text;

        return {
            element: msgDiv,
            updateText: (newText) => {
                rawTextForCopy = newText;
                body.innerHTML = DOMPurify.sanitize(marked.parse(newText));
                if (window.lucide) window.lucide.createIcons();
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            showLoader: () => {
                body.innerHTML = `
                    <div class="flex items-center gap-1.5 h-6">
                        <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-bounce" style="animation-delay: 0ms"></div>
                        <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-bounce" style="animation-delay: 150ms"></div>
                        <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-bounce" style="animation-delay: 300ms"></div>
                    </div>
                `;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            updateReasoning: (newText) => {
                reasoningContainer.classList.remove('hidden');
                reasoningContainer.querySelector('#reasoning-text').textContent = newText;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            addTool: (toolId, toolName) => {
                if (toolName === 'create_artifact') {
                    // Initialize artifact tracking
                    toolCalls[toolId] = { isArtifact: true, name: toolName, argsRaw: "", title: 'Generazione in corso...', language: 'text', content: '' };
                    
                    // Add visual artifact card in chat
                    const toolDiv = document.createElement('div');
                    toolDiv.className = 'my-3 p-3 border border-border rounded-xl bg-[var(--bg-secondary)] flex items-center gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors artifact-card';
                    toolDiv.innerHTML = `
                        <div class="p-2 bg-[var(--accent-color)] text-white rounded-lg opacity-90">
                            <i data-lucide="file-code" class="w-5 h-5"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-sm truncate artifact-title">Scrittura codice...</div>
                            <div class="text-xs text-[var(--text-secondary)] opacity-80 artifact-lang">Artifact</div>
                        </div>
                        <div class="w-1.5 h-1.5 rounded-full bg-[var(--accent-color)] animate-ping"></div>
                    `;
                    toolsContainer.appendChild(toolDiv);
                    toolCalls[toolId].element = toolDiv;
                    
                    // Add click to open Canvas
                    toolDiv.addEventListener('click', () => {
                        canvasPanel.classList.remove('hidden');
                        canvasPanel.classList.add('flex');
                        updateSidebarToggles();
                    });

                    if(window.lucide) window.lucide.createIcons();

                    // Auto-open canvas
                    if (canvasPanel.classList.contains('hidden')) {
                        canvasPanel.classList.remove('hidden');
                        canvasPanel.classList.add('flex');
                        updateSidebarToggles();
                    }
                } else {
                    const toolDiv = document.createElement('div');
                    toolDiv.className = 'text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-border rounded-lg p-2 flex flex-col gap-1';
                    toolDiv.innerHTML = `<div class="font-semibold flex items-center gap-1"><i data-lucide="wrench" class="w-3 h-3"></i> Tool: <span class="text-[var(--accent-color)]">${toolName}</span>...</div><div class="font-mono opacity-80 tool-args"></div>`;
                    toolsContainer.appendChild(toolDiv);
                    if(window.lucide) window.lucide.createIcons();
                    toolCalls[toolId] = { isArtifact: false, name: toolName, argsRaw: "", element: toolDiv };
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            updateToolArgs: (toolId, argsStr) => {
                const tool = toolCalls[toolId];
                if (!tool) return;
                tool.argsRaw = argsStr;

                if (tool.isArtifact) {
                    // Very simple JSON stream parsing (Best Effort)
                    // We look for "title", "language" and "content" in the raw string.
                    
                    let titleMatch = argsStr.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);
                    if (titleMatch) {
                        tool.title = titleMatch[1].replace(/\\"/g, '"');
                        tool.element.querySelector('.artifact-title').textContent = tool.title;
                        
                        const canvasTitle = document.getElementById('canvas-title');
                        if (canvasTitle && canvasTitle.dataset.currentId !== toolId) {
                            canvasTitle.dataset.currentId = toolId;
                            canvasTitle.innerHTML = `<i data-lucide="file-code" class="w-4 h-4 flex-shrink-0"></i> ${tool.title}`;
                            if(window.lucide) window.lucide.createIcons();
                        }
                    }

                    let langMatch = argsStr.match(/"language"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);
                    if (langMatch) {
                        tool.language = langMatch[1].replace(/\\"/g, '"');
                        tool.element.querySelector('.artifact-lang').textContent = `Artifact • ${tool.language}`;
                    }

                    let contentMatch = argsStr.match(/"content"\s*:\s*"(.*)/s);
                    if (contentMatch) {
                        let rawContent = contentMatch[1];
                        // Strip trailing quotes or brackets if JSON is ending
                        if (rawContent.endsWith('"}')) rawContent = rawContent.slice(0, -2);
                        else if (rawContent.endsWith('"')) rawContent = rawContent.slice(0, -1);
                        else if (rawContent.endsWith('"} \n')) rawContent = rawContent.slice(0, -4);
                        
                        // Try native parse first, fallback to regex replace
                        let decoded = "";
                        try {
                            decoded = JSON.parse('"' + rawContent + '"');
                        } catch(e) {
                            decoded = rawContent.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\t/g, '\t');
                        }
                        
                        if (decoded !== tool.content) {
                            tool.content = decoded;
                            // Only update CodeMirror if it's the currently viewed artifact
                            const canvasTitle = document.getElementById('canvas-title');
                            if (canvasTitle && canvasTitle.dataset.currentId === toolId) {
                                const transaction = editorView.state.update({
                                    changes: {from: 0, to: editorView.state.doc.length, insert: tool.content}
                                });
                                editorView.dispatch(transaction);
                            }
                        }
                    }
                } else {
                    tool.element.querySelector('.tool-args').textContent = argsStr;
                }
            },
            extractCode: (newText) => {
                // Deprecated: Artifact XML tags are now parsed directly in updateText
            },
            getToolCalls: () => toolCalls
        };
    }

    // Input handlers
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    window.triggerRetry = (msgDiv) => {
        if (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant') {
            currentMessages.pop();
        }
        msgDiv.remove();
        chatInput.disabled = true;
        triggerAIResponse();
    };

    // Extract AI streaming logic into a reusable function
    async function triggerAIResponse() {
        const agentSlug = agentSelect.value || 'default';
        const responseBox = appendMessage('Cat', '');
        responseBox.showLoader();
        let accumulatedText = "";
        let accumulatedReasoning = "";
        let currentToolArgs = "";

        try {
            await CatAPI.streamMessage(currentMessages, agentSlug, (event) => {
                if (event.type === 'TEXT_MESSAGE_CONTENT' || event.type === 'TEXT_MESSAGE_CHUNK') {
                    accumulatedText += event.delta || '';
                    responseBox.updateText(accumulatedText);
                } else if (event.type === 'REASONING_MESSAGE_CONTENT' || event.type === 'THINKING_TEXT_MESSAGE_CONTENT' || event.type === 'REASONING_MESSAGE_CHUNK') {
                    accumulatedReasoning += event.delta || '';
                    responseBox.updateReasoning(accumulatedReasoning);
                } else if (event.type === 'TOOL_CALL_START') {
                    responseBox.addTool(event.tool_call_id, event.tool_call_name);
                    currentToolArgs = "";
                } else if (event.type === 'TOOL_CALL_ARGS' || event.type === 'TOOL_CALL_CHUNK') {
                    currentToolArgs += event.delta || '';
                    responseBox.updateToolArgs(event.tool_call_id, currentToolArgs);
                } else if (event.type === 'RUN_FINISHED') {
                    responseBox.extractCode(accumulatedText);
                    responseBox.element.querySelectorAll('.animate-ping').forEach(el => el.classList.remove('animate-ping'));
                    if (!accumulatedText) {
                        responseBox.updateText(""); // Clear the bounce loader
                    }
                    
                    const contentArray = [{ type: "text", text: accumulatedText }];
                    const calls = responseBox.getToolCalls();
                    for (const [id, tool] of Object.entries(calls)) {
                        let parsedArgs = {};
                        try { parsedArgs = JSON.parse(tool.argsRaw); } catch(e) {}
                        contentArray.push({
                            type: "tool_call",
                            id: id,
                            name: tool.name,
                            args: parsedArgs
                        });
                    }
                    
                    currentMessages.push({ role: 'assistant', content: contentArray });
                    
                    const payload = { name: currentChatName, messages: currentMessages, context: {} };
                    if (currentChatId) {
                        CatAPI.fetch(`/chats/${currentChatId}`, { method: 'PUT', body: JSON.stringify(payload) }).then(() => loadChatList());
                    } else {
                        CatAPI.fetch('/chats', { method: 'POST', body: JSON.stringify(payload) }).then(res => {
                            currentChatId = res.id;
                            loadChatList();
                        });
                    }
                } else if (event.type === 'RUN_ERROR') {
                    responseBox.updateText(accumulatedText + "\n\n**Error:** " + event.message);
                }
            });
            if (!accumulatedText && responseBox) responseBox.updateText("Nessuna risposta ricevuta (forse solo uso di tool).");
        } catch (error) {
            responseBox.updateText(`**Errore di connessione:** ${error.message}`);
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }

    // Send Message Logic
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text && currentAttachments.length === 0) return;

        let contentArr = [];
        if (text) {
            contentArr.push({ type: "text", text: text });
        }
        
        currentAttachments.forEach(att => {
            // Use local file path if available (so agent's local tools can read it), fallback to URL
            const fileUri = att.path ? 'file:///' + att.path.replace(/\\/g, '/') : att.url;
            contentArr.push({ 
                type: "resource_link", 
                name: att.original_name || "file",
                uri: fileUri, 
                mimeType: att.mime_type || "application/octet-stream" 
            });
        });

        // Clear input and attachments
        const attachmentsCopy = [...currentAttachments]; // Copy for the UI
        chatInput.value = '';
        chatInput.style.height = 'auto';
        currentAttachments = [];
        const attachmentsContainer = container.querySelector('#chat-attachments');
        if (attachmentsContainer) attachmentsContainer.innerHTML = '';
        
        chatInput.disabled = true;
        
        // Save user message to history
        currentMessages.push({ role: 'user', content: contentArr });
        appendMessage('User', text, false, attachmentsCopy);

        if (currentMessages.length === 1) {
            currentChatName = (text || "Chat con file").substring(0, 30) + (text.length > 30 ? "..." : "");
        }

        triggerAIResponse();
    });
    
    if (btnCloseCanvas) {
        btnCloseCanvas.addEventListener('click', () => {
            canvasPanel.classList.add('hidden');
            canvasPanel.classList.remove('flex');
            updateSidebarToggles();
        });
    }

    btnCopy.addEventListener('click', () => {
        const code = editorView.state.doc.toString();
        navigator.clipboard.writeText(code);
        btnCopy.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i> Copied';
        setTimeout(() => {
            btnCopy.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i> Copy';
            if(window.lucide) window.lucide.createIcons();
        }, 2000);
    });
}
