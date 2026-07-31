// view_chat.js - Main Chat Canvas & Artifacts View
import { CatAPI } from './api.js';

// CodeMirror imports (via esm.sh)
import { EditorState } from "https://esm.sh/@codemirror/state";
import { EditorView } from "https://esm.sh/@codemirror/view";
import { javascript } from "https://esm.sh/@codemirror/lang-javascript";
import { basicSetup } from "https://esm.sh/codemirror";

export async function renderChatView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col relative min-w-0 bg-surface overflow-hidden';

    container.innerHTML = `
        <!-- Blueprint Background Overlay -->
        <div class="absolute inset-0 bg-blueprint z-0 pointer-events-none"></div>

        <!-- TopAppBar (Desktop & Mobile) -->
        <header class="flex justify-between items-center w-full px-lg py-sm bg-surface-container-lowest border-b-2 border-on-surface z-10 shrink-0">
            <!-- Agent Selector Dropdown -->
            <div class="flex items-center gap-xs">
                <div class="relative flex items-center px-xs transition-colors border-2 border-transparent hover:bg-surface-variant active:border-on-surface">
                    <select id="agent-select" class="bg-transparent border-none focus:ring-0 font-headline-md text-[20px] font-black text-on-surface tracking-tight cursor-pointer pr-8 appearance-none py-1" style="background-image: none !important;">
                        <option value="default">Default Agent</option>
                    </select>
                    <span class="material-symbols-outlined pointer-events-none absolute right-2">expand_more</span>
                </div>
            </div>

            <!-- Navigation Links -->
            <nav class="hidden md:flex gap-lg items-center">
                <a href="#settings" class="font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors px-sm py-xs border-b-2 border-transparent">
                    Agent Settings
                </a>
                <a href="#settings" class="font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors px-sm py-xs border-b-2 border-transparent">
                    Knowledge
                </a>
            </nav>

            <!-- Trailing Icons & Actions -->
            <div class="flex items-center gap-sm">
                <button id="right-sidebar-toggle" class="p-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors border-2 border-transparent active:border-on-surface" title="Toggle Artifacts Sidebar">
                    <span class="material-symbols-outlined">data_object</span>
                </button>
            </div>
        </header>

        <!-- Main Body: Chat + Artifacts -->
        <div class="flex-1 flex overflow-hidden relative z-10">
            <!-- Chat Main Canvas -->
            <div class="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden">
                <!-- Messages Area -->
                <div id="messages-container" class="flex-1 overflow-y-auto p-lg space-y-md">
                    <!-- Empty State / Welcome -->
                    <div id="empty-state" class="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full py-xl">
                        <div class="w-24 h-24 bg-surface-container-lowest border-2 border-on-surface shadow-hard flex items-center justify-center mb-xl">
                            <span class="material-symbols-outlined text-primary-container text-5xl" style="font-variation-settings: 'FILL' 1;">forum</span>
                        </div>
                        <h1 class="font-headline-xl text-headline-xl text-on-surface mb-md">Cosa possiamo affrontare insieme?</h1>
                        <p class="font-body-lg text-body-lg text-secondary max-w-lg border-2 border-on-surface bg-surface-container-lowest p-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            Sono pronto ad aiutarti a scrivere codice, analizzare dati o redigere documenti con lo Stregatto.
                        </p>
                    </div>
                </div>

                <!-- Input Area -->
                <div class="w-full max-w-4xl mx-auto px-lg pb-md pt-xs shrink-0">
                    <form id="chat-form" class="relative flex items-end bg-surface-container-lowest border-2 border-on-surface shadow-[4px_4px_0px_0px_#ff5f1f] focus-within:shadow-[4px_4px_0px_0px_#1a1c1c] transition-all p-sm mb-xs">
                        
                        <!-- Upload File Button -->
                        <input type="file" id="file-upload-input" class="hidden" />
                        <button type="button" id="btn-upload" class="p-sm text-secondary hover:text-on-surface transition-colors flex items-center justify-center shrink-0" title="Allega file">
                            <span class="material-symbols-outlined">attach_file</span>
                        </button>

                        <!-- Model Selector Dropdown -->
                        <div class="relative flex items-center border-r-2 border-on-surface pr-xs mr-xs h-11 shrink-0 max-w-[180px]">
                            <select id="model-select" class="bg-transparent border-none focus:ring-0 text-on-surface-variant hover:bg-surface-variant font-label-sm text-label-sm border-2 border-transparent cursor-pointer pr-4 truncate w-full">
                                <option value="default">Caricamento modelli...</option>
                            </select>
                        </div>

                        <!-- Textarea -->
                        <textarea id="chat-input" 
                                  class="w-full bg-transparent border-none focus:ring-0 resize-none max-h-48 min-h-[44px] py-sm px-xs font-body-md text-on-surface placeholder:font-label-md placeholder:text-secondary" 
                                  placeholder="Scrivi un messaggio allo Stregatto..." 
                                  rows="1"></textarea>

                        <!-- Send Button -->
                        <button type="submit" class="p-sm bg-primary-container text-on-primary border-2 border-on-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all ml-xs flex items-center justify-center h-[44px] w-[44px] shrink-0" title="Invia">
                            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">send</span>
                        </button>
                    </form>
                </div>
            </div>

            <!-- Right Sidebar: Artifacts & Terminal -->
            <aside id="right-sidebar" class="hidden xl:flex flex-col h-full sidebar-transition border-l-2 border-on-surface bg-cream-bg shrink-0 z-20 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] artifacts-collapsed relative">
                <!-- Resizer Handle -->
                <div id="right-sidebar-resizer" class="absolute top-0 -left-1 w-2 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary z-30 select-none"></div>

                <!-- Header -->
                <div class="flex items-center justify-between p-md border-b-2 border-on-surface bg-tertiary-fixed whitespace-nowrap">
                    <div class="flex items-center gap-sm">
                        <span class="material-symbols-outlined text-on-surface">data_object</span>
                        <h3 class="font-label-md text-label-md font-bold uppercase tracking-widest" id="canvas-title">Artifacts</h3>
                    </div>
                    <div class="flex gap-xs">
                        <button id="btn-copy-code" class="p-xs border-2 border-transparent hover:border-on-surface hover:bg-surface transition-all flex items-center gap-1 font-label-sm text-label-sm" title="Copia Codice">
                            <span class="material-symbols-outlined text-sm">copy_all</span> Copia
                        </button>
                        <button id="right-sidebar-close" class="p-xs border-2 border-transparent hover:border-on-surface hover:bg-surface transition-all">
                            <span class="material-symbols-outlined text-sm">close</span>
                        </button>
                    </div>
                </div>

                <!-- Code Viewer Section -->
                <div class="flex-1 flex flex-col overflow-hidden bg-cream-bg">
                    <div id="editor-host" class="flex-1 overflow-auto bg-cream-bg text-on-surface font-mono text-sm relative border-b-2 border-on-surface"></div>
                </div>

                <!-- Terminal Section -->
                <div class="h-1/3 border-t-2 border-on-surface bg-cream-bg flex flex-col">
                    <div class="flex items-center justify-between px-md py-xs border-b-2 border-on-surface bg-surface-container">
                        <span class="font-label-sm text-label-sm text-on-surface">Terminal</span>
                        <span class="material-symbols-outlined text-on-surface text-sm">terminal</span>
                    </div>
                    <div id="terminal-output" class="p-md font-mono text-xs text-on-surface overflow-auto flex-1 bg-surface-container-lowest">
                        <p>&gt; Stregatto Agent Ready</p>
                        <p class="animate-pulse">_</p>
                    </div>
                </div>
            </aside>
        </div>
    `;

    setTimeout(() => initChatLogic(container), 0);
    return container;
}

function initChatLogic(container) {
    const chatForm = container.querySelector('#chat-form');
    const chatInput = container.querySelector('#chat-input');
    const messagesContainer = container.querySelector('#messages-container');
    const emptyState = container.querySelector('#empty-state');
    const agentSelect = container.querySelector('#agent-select');
    const bentoPrompts = container.querySelectorAll('.bento-prompt');
    const rightSidebar = container.querySelector('#right-sidebar');
    const rightSidebarToggle = container.querySelector('#right-sidebar-toggle');
    const rightSidebarClose = container.querySelector('#right-sidebar-close');
    const editorHost = container.querySelector('#editor-host');
    const terminalOutput = container.querySelector('#terminal-output');
    const btnCopyCode = container.querySelector('#btn-copy-code');
    const canvasTitle = container.querySelector('#canvas-title');

    let currentMessages = [];
    let currentChatId = null;
    let currentChatName = "Nuova Chat";
    
    // Artifact parsing state
    let artifactToolCalls = {}; 

    // CodeMirror Setup
    let editorView = new EditorView({
        state: EditorState.create({
            doc: "// Genera un artifact per visualizzarlo qui\n",
            extensions: [basicSetup, javascript()]
        }),
        parent: editorHost
    });

    // Check URL parameters for active agent or chat ID
    const hashParts = window.location.hash.split('?');
    const urlParams = new URLSearchParams(hashParts[1] || '');
    const activeChatId = urlParams.get('id');
    const urlAgent = urlParams.get('agent');

    // Load agents dynamically & handle state persistence
    async function loadAgents() {
        try {
            const agents = await CatAPI.getAgents();
            if (agents && agents.length > 0) {
                agentSelect.innerHTML = agents.map(ag => `
                    <option value="${ag.slug}">${ag.name || ag.slug}</option>
                `).join('');
            }
            
            // Priority: URL agent > saved localStorage > default
            if (urlAgent) {
                agentSelect.value = urlAgent;
                localStorage.setItem('stregatto_selected_agent', urlAgent);
            } else {
                const savedAgent = localStorage.getItem('stregatto_selected_agent');
                if (savedAgent && agentSelect.querySelector(`option[value="${savedAgent}"]`)) {
                    agentSelect.value = savedAgent;
                }
            }
        } catch (e) {
            console.warn("Impossibile caricare agenti:", e);
        }
    }

    loadAgents();

    agentSelect?.addEventListener('change', () => {
        if (agentSelect.value) {
            localStorage.setItem('stregatto_selected_agent', agentSelect.value);
        }
    });

    // Dynamically populate Models dropdown & handle state persistence
    const modelSelect = container.querySelector('#model-select');
    if (modelSelect) {
        CatAPI.getModels().then(models => {
            if (models && models.length > 0) {
                modelSelect.innerHTML = models.map(m => `
                    <option value="${m.id}">${m.name || m.id}</option>
                `).join('');
                
                const savedModel = localStorage.getItem('stregatto_selected_model');
                if (savedModel && modelSelect.querySelector(`option[value="${savedModel}"]`)) {
                    modelSelect.value = savedModel;
                }
            }
        }).catch(err => console.warn("Could not load models:", err));

        modelSelect.addEventListener('change', () => {
            if (modelSelect.value) {
                localStorage.setItem('stregatto_selected_model', modelSelect.value);
            }
        });
    }

    // Load conversation history if chatId is provided
    if (activeChatId) {
        currentChatId = activeChatId;
        (async () => {
            try {
                const chat = await CatAPI.getChat(activeChatId);
                if (chat && chat.messages && chat.messages.length > 0) {
                    if (emptyState) emptyState.remove();
                    currentMessages = chat.messages;
                    currentChatName = chat.name || "Chat recuperata";

                    // Restore saved agent slug from chat context if available
                    if (chat.context && chat.context.agent_slug && agentSelect) {
                        agentSelect.value = chat.context.agent_slug;
                        localStorage.setItem('stregatto_selected_agent', chat.context.agent_slug);
                    }

                    chat.messages.forEach(msg => {
                        const role = msg.role || 'assistant';
                        
                        if (role === 'user') {
                            const text = extractTextFromContent(msg.content);
                            appendMessage('user', text || "");
                        } else {
                            const msgBox = appendMessage('assistant', "");

                            if (Array.isArray(msg.content)) {
                                msg.content.forEach(c => {
                                    if (!c) return;
                                    if (c.type === 'text' && c.text) {
                                        msgBox.appendStepText(c.text);
                                    } else if (c.type === 'tool_use' || c.type === 'tool_call') {
                                        const tcName = c.name || c.function?.name || 'tool';
                                        const tcArgs = typeof c.input === 'string' ? c.input : (c.input ? JSON.stringify(c.input, null, 2) : (c.arguments || ''));
                                        const tcId = c.id || ("tc_" + Math.random().toString(36).substr(2, 9));

                                        msgBox.addTool(tcId, tcName);
                                        msgBox.updateToolArgs(tcId, tcArgs);
                                        msgBox.finishTool(tcId, tcArgs);
                                    }
                                });
                            } else {
                                const text = extractTextFromContent(msg.content);
                                msgBox.appendStepText(text || "");
                            }
                        }
                    });
                }
            } catch (err) {
                console.error("Errore caricamento dettagli chat:", err);
            }
        })();
    }

    // Copy Code handler
    if (btnCopyCode) {
        btnCopyCode.addEventListener('click', () => {
            const code = editorView.state.doc.toString();
            navigator.clipboard.writeText(code);
            const originalHTML = btnCopyCode.innerHTML;
            btnCopyCode.innerHTML = `<span class="material-symbols-outlined text-sm">check</span> Copiato`;
            setTimeout(() => { btnCopyCode.innerHTML = originalHTML; }, 2000);
        });
    }

    // Right Sidebar Resizer & Toggle
    const rightResizer = container.querySelector('#right-sidebar-resizer');

    function openSidebar() {
        if (rightSidebar) {
            rightSidebar.classList.remove('hidden');
            rightSidebar.classList.add('flex');
            rightSidebar.classList.add('artifacts-expanded');
            rightSidebar.classList.remove('artifacts-collapsed');
            const w = localStorage.getItem('stregatto_right_sidebar_width');
            if (w) rightSidebar.style.width = w;
        }
    }

    if (rightSidebarToggle && rightSidebar) {
        rightSidebarToggle.addEventListener('click', () => {
            if (rightSidebar.classList.contains('artifacts-expanded')) {
                rightSidebar.classList.remove('artifacts-expanded');
                rightSidebar.classList.add('artifacts-collapsed');
                rightSidebar.style.width = '';
            } else {
                rightSidebar.classList.remove('hidden');
                rightSidebar.classList.add('flex');
                rightSidebar.classList.add('artifacts-expanded');
                rightSidebar.classList.remove('artifacts-collapsed');
                const w = localStorage.getItem('stregatto_right_sidebar_width');
                if (w) rightSidebar.style.width = w;
            }
        });
    }

    if (rightSidebarClose && rightSidebar) {
        rightSidebarClose.addEventListener('click', () => {
            rightSidebar.classList.add('artifacts-collapsed');
            rightSidebar.classList.remove('artifacts-expanded');
            rightSidebar.style.width = '';
        });
    }

    if (rightResizer && rightSidebar) {
        let isResizingRight = false;

        rightResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (rightSidebar.classList.contains('artifacts-collapsed')) return;
            isResizingRight = true;
            rightSidebar.classList.remove('sidebar-transition');
            document.body.classList.add('select-none');
            document.body.style.cursor = 'col-resize';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizingRight) return;
            let newWidth = rightSidebar.getBoundingClientRect().right - e.clientX;
            if (newWidth < 260) newWidth = 260;
            if (newWidth > Math.min(900, window.innerWidth * 0.6)) newWidth = Math.min(900, window.innerWidth * 0.6);
            rightSidebar.style.width = `${newWidth}px`;
            localStorage.setItem('stregatto_right_sidebar_width', `${newWidth}px`);
        });

        window.addEventListener('mouseup', () => {
            if (isResizingRight) {
                isResizingRight = false;
                rightSidebar.classList.add('sidebar-transition');
                document.body.classList.remove('select-none');
                document.body.style.cursor = '';
            }
        });
    }

    // Bento prompts handler
    bentoPrompts.forEach(btn => {
        btn.addEventListener('click', () => {
            const promptText = btn.dataset.prompt;
            if (promptText && chatInput) {
                chatInput.value = promptText;
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    });

    // Auto-resize textarea
    chatInput?.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = `${Math.min(chatInput.scrollHeight, 180)}px`;
    });
    
    // File upload logic
    const btnUpload = container.querySelector('#btn-upload');
    const fileUploadInput = container.querySelector('#file-upload-input');
    
    if (btnUpload && fileUploadInput) {
        btnUpload.addEventListener('click', () => {
            fileUploadInput.click();
        });

        fileUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            logTerminal(`Caricamento file: ${file.name}...`);
            try {
                const res = await CatAPI.uploadFile(file);
                if (res && res.url) {
                    logTerminal(`File caricato: ${res.url}`);
                    // Add the file as a system context message or inject to chat
                    currentMessages.push({ role: 'user', content: [{ type: "file", file_url: res.url }] });
                    appendMessage('user', `📄 [File allegato: ${file.name}]`);
                    
                    if (!currentChatId && currentMessages.length === 1) {
                        currentChatName = `Chat con file ${file.name}`;
                    }
                }
            } catch (err) {
                logTerminal(`Errore caricamento file: ${err.message}`);
                alert('Errore durante il caricamento del file.');
            }
            fileUploadInput.value = '';
        });
    }

    // Enter to submit
    chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    // Helper: extract text from complex content
    function extractTextFromContent(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content.map(c => {
                if (typeof c === 'string') return c;
                if (c && c.text) return c.text;
                return '';
            }).join('\n');
        }
        if (content && content.text) return content.text;
        return JSON.stringify(content || '');
    }

    // Helper: Append message to chat container (Delicate Timeline Layout)
    function appendMessage(role, text) {
        if (emptyState) emptyState.remove();

        const isUser = role === 'user';
        const msgBox = document.createElement('div');

        if (isUser) {
            msgBox.className = 'flex justify-end w-full mb-lg pr-xs';

            const userCard = document.createElement('div');
            userCard.className = 'max-w-[80%] bg-surface-container-lowest border-2 border-on-surface p-md shadow-[4px_4px_0px_0px_#1a1c1c] text-on-surface font-body-md flex flex-col gap-xs relative group';

            const contentDiv = document.createElement('div');
            contentDiv.className = 'font-medium text-sm leading-relaxed whitespace-pre-wrap text-on-surface';
            contentDiv.textContent = text;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'mt-xs flex justify-end gap-xs opacity-60 hover:opacity-100 transition-opacity';
            actionsDiv.innerHTML = `
                <button class="btn-copy-user flex items-center gap-1 px-1.5 py-0.5 bg-surface border border-on-surface text-[10px] font-bold uppercase hover:bg-surface-variant transition-colors" title="Copia testo">
                    <span class="material-symbols-outlined text-[12px]">content_copy</span> COPY
                </button>
            `;

            actionsDiv.querySelector('.btn-copy-user').addEventListener('click', () => {
                navigator.clipboard.writeText(text);
                const btn = actionsDiv.querySelector('.btn-copy-user');
                btn.innerHTML = `<span class="material-symbols-outlined text-[12px]">check</span> COPIED`;
                setTimeout(() => {
                    btn.innerHTML = `<span class="material-symbols-outlined text-[12px]">content_copy</span> COPY`;
                }, 1500);
            });

            userCard.appendChild(contentDiv);
            userCard.appendChild(actionsDiv);
            msgBox.appendChild(userCard);
        } else {
            // Agent Response with Delicate Timeline Layout (Left-aligned & Spacious)
            msgBox.className = 'max-w-6xl relative pl-10 w-full mb-xl ml-2 md:ml-6';

            // Vertical Timeline Guide Line
            const timelineLine = document.createElement('div');
            timelineLine.className = 'timeline-line';
            msgBox.appendChild(timelineLine);

            // Agent Header Badge
            const agentHeader = document.createElement('div');
            agentHeader.className = 'flex items-center gap-sm mb-md -ml-10 relative z-10';
            agentHeader.innerHTML = `
                <div class="w-6 h-6 bg-primary border-2 border-on-surface flex items-center justify-center text-on-primary shadow-[2px_2px_0px_0px_#1a1c1c]">
                    <span class="material-symbols-outlined text-xs">smart_toy</span>
                </div>
                <span class="font-label-sm text-[11px] font-black uppercase tracking-widest bg-surface-container-lowest px-2 py-0.5 border-2 border-on-surface">AGENT</span>
            `;
            msgBox.appendChild(agentHeader);

            // Inner Steps Container (stores all steps in chronological order)
            const stepsContainer = document.createElement('div');
            stepsContainer.className = 'space-y-md relative';
            msgBox.appendChild(stepsContainer);

            // Agent Actions Footer (Copy / Regenerate)
            const actionsFooter = document.createElement('div');
            actionsFooter.className = 'flex items-center gap-md pt-xs opacity-50 hover:opacity-100 transition-opacity pl-xs';
            actionsFooter.innerHTML = `
                <button class="btn-copy-agent flex items-center gap-xs font-label-sm text-[11px] font-bold uppercase tracking-wider hover:text-primary transition-colors">
                    <span class="material-symbols-outlined text-xs">content_copy</span> Copy
                </button>
                <button class="btn-regenerate-agent flex items-center gap-xs font-label-sm text-[11px] font-bold uppercase tracking-wider hover:text-primary transition-colors">
                    <span class="material-symbols-outlined text-xs">refresh</span> Regenerate
                </button>
            `;

            actionsFooter.querySelector('.btn-copy-agent').addEventListener('click', () => {
                const textContent = Array.from(stepsContainer.querySelectorAll('.markdown-body'))
                    .map(b => b.innerText || b.textContent)
                    .join('\n\n');
                navigator.clipboard.writeText(textContent);
                const btn = actionsFooter.querySelector('.btn-copy-agent');
                btn.innerHTML = `<span class="material-symbols-outlined text-xs">check</span> Copied`;
                setTimeout(() => {
                    btn.innerHTML = `<span class="material-symbols-outlined text-xs">content_copy</span> Copy`;
                }, 1500);
            });

            actionsFooter.querySelector('.btn-regenerate-agent').addEventListener('click', () => {
                regenerateResponse(msgBox);
            });

            msgBox.appendChild(actionsFooter);
        }

        messagesContainer.appendChild(msgBox);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        let activeTextStep = null;
        let toolCalls = {};

        function createTextStep(initialText = '') {
            if (isUser) return null;
            const stepsContainer = msgBox.querySelector('.space-y-md');
            if (!stepsContainer) return null;

            const stepDiv = document.createElement('div');
            stepDiv.className = 'relative my-xs';

            const dot = document.createElement('div');
            dot.className = 'timeline-dot';
            stepDiv.appendChild(dot);

            const card = document.createElement('div');
            card.className = 'bg-surface-container-lowest border-2 border-on-surface p-md shadow-[4px_4px_0px_0px_#1a1c1c] max-w-4xl w-full';

            const body = document.createElement('div');
            body.className = 'markdown-body text-sm leading-relaxed overflow-hidden';

            if (initialText && window.marked && window.DOMPurify) {
                body.innerHTML = window.DOMPurify.sanitize(window.marked.parse(initialText));
            } else {
                body.textContent = initialText;
            }

            card.appendChild(body);
            stepDiv.appendChild(card);

            stepsContainer.appendChild(stepDiv);
            activeTextStep = { stepDiv, body, text: initialText };
            return activeTextStep;
        }

        if (!isUser && text) {
            createTextStep(text);
        }

        return {
            element: msgBox,
            appendStepText: (textChunk) => {
                if (isUser || !textChunk) return;
                if (!activeTextStep) {
                    createTextStep(textChunk);
                } else if (activeTextStep.isLoader) {
                    activeTextStep.isLoader = false;
                    activeTextStep.text = textChunk;
                    if (window.marked && window.DOMPurify) {
                        activeTextStep.body.innerHTML = window.DOMPurify.sanitize(window.marked.parse(activeTextStep.text));
                    } else {
                        activeTextStep.body.textContent = activeTextStep.text;
                    }
                } else {
                    activeTextStep.text += textChunk;
                    if (window.marked && window.DOMPurify) {
                        activeTextStep.body.innerHTML = window.DOMPurify.sanitize(window.marked.parse(activeTextStep.text));
                    } else {
                        activeTextStep.body.textContent = activeTextStep.text;
                    }
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            updateText: (newText) => {
                if (isUser) return;
                if (!activeTextStep) {
                    createTextStep(newText);
                } else {
                    activeTextStep.isLoader = false;
                    activeTextStep.text = newText;
                    if (window.marked && window.DOMPurify) {
                        activeTextStep.body.innerHTML = window.DOMPurify.sanitize(window.marked.parse(activeTextStep.text));
                    } else {
                        activeTextStep.body.textContent = activeTextStep.text;
                    }
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            showLoader: () => {
                if (isUser) return;
                if (!activeTextStep) {
                    createTextStep('');
                }
                if (activeTextStep && activeTextStep.body) {
                    activeTextStep.isLoader = true;
                    activeTextStep.body.innerHTML = `
                        <div class="flex items-center gap-2 h-6 p-xs">
                            <div class="w-2 h-2 rounded-none bg-primary animate-bounce" style="animation-delay: 0ms"></div>
                            <div class="w-2 h-2 rounded-none bg-primary animate-bounce" style="animation-delay: 150ms"></div>
                            <div class="w-2 h-2 rounded-none bg-primary animate-bounce" style="animation-delay: 300ms"></div>
                        </div>
                    `;
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            addTool: (toolId, toolName) => {
                if (isUser) return;
                
                // If active step is a loader step, remove it from DOM
                if (activeTextStep && activeTextStep.isLoader) {
                    if (activeTextStep.stepDiv && activeTextStep.stepDiv.parentNode) {
                        activeTextStep.stepDiv.parentNode.removeChild(activeTextStep.stepDiv);
                    }
                }
                activeTextStep = null; // Close active text step so subsequent text creates a new step below this tool call

                const stepsContainer = msgBox.querySelector('.space-y-md');
                if (!stepsContainer) return;

                const stepDiv = document.createElement('div');
                stepDiv.className = 'relative my-xs';

                const stepDot = document.createElement('div');
                stepDot.className = 'timeline-dot';
                stepDiv.appendChild(stepDot);

                if (toolName === 'create_artifact') {
                    toolCalls[toolId] = { isArtifact: true, title: 'Generazione Artifact...', content: '' };

                    const card = document.createElement('div');
                    card.className = 'p-sm border-2 border-on-surface bg-surface-container flex items-center justify-between cursor-pointer hover:bg-surface-variant transition-colors artifact-card shadow-[2px_2px_0px_0px_#1a1c1c] hover:shadow-[4px_4px_0px_0px_#ff5f1f] max-w-2xl';
                    card.innerHTML = `
                        <div class="flex items-center gap-sm min-w-0">
                            <div class="p-xs bg-on-surface text-on-primary shrink-0">
                                <span class="material-symbols-outlined text-lg">code_blocks</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="font-label-md text-label-md font-bold truncate artifact-title">Generazione Artifact...</div>
                                <div class="font-label-sm text-label-sm text-secondary truncate artifact-lang">Attendere prego</div>
                            </div>
                        </div>
                        <div class="w-2 h-2 bg-primary animate-ping"></div>
                    `;

                    card.addEventListener('click', () => {
                        openSidebar();
                        if (canvasTitle) canvasTitle.innerHTML = `<span class="material-symbols-outlined text-sm">code_blocks</span> ${toolCalls[toolId].title}`;
                        const transaction = editorView.state.update({
                            changes: {from: 0, to: editorView.state.doc.length, insert: toolCalls[toolId].content || '// Nessun contenuto'}
                        });
                        editorView.dispatch(transaction);
                    });

                    stepDiv.appendChild(card);
                    openSidebar();
                } else {
                    // Tool Call (Compact Accordion)
                    const details = document.createElement('details');
                    details.className = 'group border-2 border-on-surface shadow-[2px_2px_0px_0px_#1a1c1c] max-w-3xl bg-surface-container-lowest overflow-hidden';
                    details.innerHTML = `
                        <summary class="flex items-center justify-between cursor-pointer list-none p-sm bg-surface-container border-b-2 border-on-surface select-none">
                            <div class="flex items-center gap-sm">
                                <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <div>
                                    <span class="text-[9px] font-black uppercase text-secondary block leading-none mb-0.5 tracking-wider">TOOL EXECUTED</span>
                                    <span class="text-xs font-mono font-bold text-on-surface">${toolName}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-xs">
                                <span class="text-[10px] font-mono text-secondary tool-timer">executing...</span>
                                <span class="material-symbols-outlined text-sm transition-transform group-open:rotate-180">expand_more</span>
                            </div>
                        </summary>
                        <div class="p-md bg-[#1a1c1c] text-green-400 font-mono text-xs overflow-x-auto tool-args-code">
                            <code>{ "status": "running" }</code>
                        </div>
                    `;
                    toolCalls[toolId] = { isArtifact: false, element: details };
                    stepDiv.appendChild(details);
                }

                toolCalls[toolId].stepDiv = stepDiv;
                stepsContainer.appendChild(stepDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            updateToolArgs: (toolId, argsStr) => {
                const tool = toolCalls[toolId];
                if (!tool) return;

                if (tool.isArtifact) {
                    let titleMatch = argsStr.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);
                    if (titleMatch) {
                        tool.title = titleMatch[1].replace(/\\"/g, '"');
                        const el = tool.stepDiv.querySelector('.artifact-title');
                        if (el) el.textContent = tool.title;
                    }
                    let langMatch = argsStr.match(/"language"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);
                    if (langMatch) {
                        tool.language = langMatch[1].replace(/\\"/g, '"');
                        const el = tool.stepDiv.querySelector('.artifact-lang');
                        if (el) el.textContent = `Lingua: ${tool.language}`;
                    }
                } else {
                    const codeEl = tool.stepDiv.querySelector('.tool-args-code code');
                    if (codeEl) codeEl.textContent = argsStr || '{ "status": "running" }';
                }
            },
            finishTool: (toolId, argsStr) => {
                const tool = toolCalls[toolId];
                if (!tool) return;

                if (tool.isArtifact) {
                    try {
                        const parsedArgs = JSON.parse(argsStr);
                        tool.title = parsedArgs.title || tool.title;
                        tool.content = parsedArgs.content || "";
                        const el = tool.stepDiv.querySelector('.artifact-title');
                        if (el) el.textContent = tool.title;

                        const ping = tool.stepDiv.querySelector('.animate-ping');
                        if (ping) ping.remove();

                        if (canvasTitle) canvasTitle.innerHTML = `<span class="material-symbols-outlined text-sm">code_blocks</span> ${tool.title}`;
                        const transaction = editorView.state.update({
                            changes: {from: 0, to: editorView.state.doc.length, insert: tool.content}
                        });
                        editorView.dispatch(transaction);

                    } catch (e) {
                        console.warn("Failed to parse artifact JSON payload:", e);
                    }
                } else {
                    const timerEl = tool.stepDiv.querySelector('.tool-timer');
                    if (timerEl) timerEl.textContent = 'done';
                    const codeEl = tool.stepDiv.querySelector('.tool-args-code code');
                    if (codeEl && argsStr) codeEl.textContent = argsStr;
                }
            }
        };
    }

    // Helper: Regenerate assistant response
    function regenerateResponse(targetMsgBox) {
        while (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant') {
            currentMessages.pop();
        }
        if (targetMsgBox && targetMsgBox.parentNode) {
            targetMsgBox.parentNode.removeChild(targetMsgBox);
        }
        const responseBox = appendMessage('assistant', '');
        executeAssistantRun(responseBox);
    }

    // Helper: Execute LLM run streaming
    async function executeAssistantRun(responseBox) {
        if (!responseBox) {
            responseBox = appendMessage('assistant', '');
        }
        responseBox.showLoader();

        if (chatInput) chatInput.disabled = true;
        const agentSlug = agentSelect?.value || 'default';
        logTerminal(`Generazione risposta dall'agente [${agentSlug}]...`);

        try {
            let accumulatedText = '';
            let currentToolArgs = '';
            let currentToolCallName = '';
            let currentToolCalls = [];
            
            const sanitizeMessagesForApi = (messages) => {
                let cleanMessages = messages.map(m => {
                    let cleanContent = [];
                    if (Array.isArray(m.content)) {
                        m.content.forEach(c => {
                            if (!c) return;
                            if (c.type === 'text' || c.type === 'file' || c.type === 'image') {
                                cleanContent.push(c);
                            } else if (c.type === 'tool_use' || c.type === 'tool_call') {
                                cleanContent.push(c);
                            }
                        });
                    } else if (typeof m.content === 'string') {
                        cleanContent.push({ type: 'text', text: m.content });
                    }
                    if (cleanContent.length === 0) {
                        cleanContent.push({ type: 'text', text: '' });
                    }
                    return {
                        role: m.role || 'user',
                        content: cleanContent
                    };
                });

                // Guarantee LLM payload never ends with an assistant message
                while (cleanMessages.length > 0 && cleanMessages[cleanMessages.length - 1].role === 'assistant') {
                    cleanMessages.pop();
                }

                return cleanMessages;
            };

            const sanitizedStreamMessages = sanitizeMessagesForApi(currentMessages);

            await CatAPI.streamMessage(sanitizedStreamMessages, agentSlug, (event) => {
                if (event.type === 'TEXT_MESSAGE_CONTENT' || event.type === 'TEXT_MESSAGE_CHUNK') {
                    const delta = event.delta || '';
                    accumulatedText += delta;
                    responseBox.appendStepText(delta);
                } else if (event.type === 'TOOL_CALL_START') {
                    currentToolCallName = event.tool_call_name;
                    if (event.tool_call_name === 'create_artifact') {
                        artifactToolCalls[event.tool_call_id] = { args: "" };
                    }
                    currentToolCalls.push({
                        id: event.tool_call_id,
                        type: 'function',
                        function: { name: event.tool_call_name, arguments: "" }
                    });
                    responseBox.addTool(event.tool_call_id, event.tool_call_name);
                } else if (event.type === 'TOOL_CALL_ARGS' || event.type === 'TOOL_CALL_CHUNK') {
                    let tc = currentToolCalls.find(t => t.id === event.tool_call_id);
                    if (tc) {
                        tc.function.arguments += event.delta || '';
                    }
                    
                    if (artifactToolCalls[event.tool_call_id]) {
                        artifactToolCalls[event.tool_call_id].args += event.delta || '';
                        responseBox.updateToolArgs(event.tool_call_id, artifactToolCalls[event.tool_call_id].args);
                    } else {
                        currentToolArgs += event.delta || '';
                        responseBox.updateToolArgs(event.tool_call_id, currentToolArgs);
                    }
                } else if (event.type === 'TOOL_CALL_END') {
                    if (artifactToolCalls[event.tool_call_id]) {
                        responseBox.finishTool(event.tool_call_id, artifactToolCalls[event.tool_call_id].args);
                        logTerminal(`Artifact Completato: ${event.tool_call_id}`);
                    }
                    currentToolArgs = "";
                } else if (event.type === 'RUN_FINISHED') {
                    if (!accumulatedText && currentToolCalls.length === 0) {
                        responseBox.updateText("");
                    }
                    
                    let contentArray = [];
                    if (accumulatedText) {
                        contentArray.push({ type: "text", text: accumulatedText });
                    }
                    if (currentToolCalls.length > 0) {
                        currentToolCalls.forEach(tc => {
                            let inputObj = tc.function?.arguments || tc.arguments || {};
                            if (typeof inputObj === 'string') {
                                try { inputObj = JSON.parse(inputObj); } catch(e) { inputObj = { text: inputObj }; }
                            }
                            contentArray.push({
                                type: "tool_use",
                                id: tc.id,
                                name: tc.function?.name || tc.name,
                                input: inputObj
                            });
                        });
                    }
                    if (contentArray.length === 0) {
                        contentArray.push({ type: "text", text: "" });
                    }

                    currentMessages.push({ role: 'assistant', content: contentArray });
                    
                    const sanitizedMessages = sanitizeMessagesForApi(currentMessages);

                    const payload = { 
                        name: currentChatName, 
                        messages: sanitizedMessages, 
                        context: { agent_slug: agentSlug } 
                    };
                    if (currentChatId) {
                        CatAPI.fetch(`/chats/${currentChatId}`, { method: 'PUT', body: JSON.stringify(payload) })
                            .then(res => { if (res && res.id) currentChatId = res.id; })
                            .catch(err => console.error("Error updating chat:", err));
                    } else {
                        CatAPI.fetch('/chats', { method: 'POST', body: JSON.stringify(payload) })
                            .then(res => {
                                if (res && res.id) {
                                    currentChatId = res.id;
                                    window.history.replaceState(null, '', `#chat?id=${res.id}`);
                                }
                                console.log("Nuova chat creata con ID:", currentChatId);
                            })
                            .catch(err => console.error("Error creating chat:", err));
                    }
                    logTerminal(`Risposta completata dall'agente.`);
                } else if (event.type === 'RUN_ERROR') {
                    responseBox.updateText((accumulatedText ? accumulatedText + "\n\n" : "") + "**Errore:** " + event.message);
                    logTerminal(`Errore: ${event.message}`);
                }
            });
            if (!accumulatedText && currentToolCalls.length === 0) responseBox.updateText("Nessuna risposta testuale.");
        } catch (err) {
            console.error("Errore chat:", err);
            responseBox.updateText("**Si è verificato un errore di connessione.**");
            logTerminal(`Errore: ${err.message}`);
        } finally {
            if (chatInput) {
                chatInput.disabled = false;
                chatInput.focus();
            }
        }
    }

    // Terminal Logger helper
    function logTerminal(line) {
        if (!terminalOutput) return;
        const p = document.createElement('p');
        p.textContent = `> ${line}`;
        terminalOutput.insertBefore(p, terminalOutput.lastElementChild);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // Chat submit handler
    chatForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text && currentMessages.length === 0) return;

        if (text) {
            appendMessage('user', text);
            currentMessages.push({ role: 'user', content: [{ type: "text", text: text }] });
            
            if (currentMessages.length === 1) {
                currentChatName = (text).substring(0, 30) + (text.length > 30 ? "..." : "");
            }
        }
        
        chatInput.value = '';
        chatInput.style.height = 'auto';

        const responseBox = appendMessage('assistant', '');
        executeAssistantRun(responseBox);
    });
}
