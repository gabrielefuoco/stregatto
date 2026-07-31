// view_history.js - History Log View
import { CatAPI } from './api.js';

function extractTextFromContent(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(c => {
            if (typeof c === 'string') return c;
            if (c && c.text) return c.text;
            return '';
        }).join(' ');
    }
    if (content && content.text) return content.text;
    return '';
}

function showConfirmModal(title, onConfirm) {
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-on-surface/60 backdrop-blur-xs z-50 flex items-center justify-center p-md animate-fade-in';
    
    backdrop.innerHTML = `
        <div class="bg-surface-container-lowest border-2 border-on-surface p-lg max-w-md w-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-md">
            <div class="flex items-center gap-sm text-error">
                <span class="material-symbols-outlined text-3xl">warning</span>
                <h3 class="font-headline-md text-headline-md font-bold">Conferma eliminazione</h3>
            </div>
            <p class="font-body-md text-on-surface leading-relaxed">
                Sei sicuro di voler eliminare la chat <strong class="text-primary font-bold">"${title}"</strong>? Questa azione non può essere annullata.
            </p>
            <div class="flex justify-end gap-md mt-sm">
                <button id="modal-btn-cancel" class="px-md py-xs border-2 border-on-surface bg-surface-container hover:bg-surface-variant font-label-md font-bold transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
                    Annulla
                </button>
                <button id="modal-btn-confirm" class="px-md py-xs border-2 border-on-surface bg-error text-on-error hover:bg-error/90 font-label-md font-bold transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center gap-xs">
                    <span class="material-symbols-outlined text-sm">delete</span> Elimina
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);

    const close = () => {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    };

    backdrop.querySelector('#modal-btn-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
    });

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            close();
            window.removeEventListener('keydown', handleKeyDown);
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    backdrop.querySelector('#modal-btn-confirm').addEventListener('click', async () => {
        close();
        await onConfirm();
    });
}

export async function renderHistoryView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col overflow-y-auto relative bg-surface p-lg z-10';

    container.innerHTML = `
        <!-- Blueprint Background Overlay -->
        <div class="absolute inset-0 bg-blueprint z-0 pointer-events-none"></div>

        <div class="relative z-10 max-w-4xl mx-auto w-full py-md">
            <!-- Header Section -->
            <div class="mb-xl">
                <h1 class="font-headline-xl text-headline-xl text-on-surface mb-md">History</h1>
                <div class="relative flex items-center bg-surface-container-lowest border-2 border-on-surface shadow-hard">
                    <span class="material-symbols-outlined ml-sm text-secondary">search</span>
                    <input type="text" id="history-search-input" 
                           class="w-full bg-transparent border-none focus:ring-0 py-sm px-xs font-body-md text-on-surface placeholder:text-secondary" 
                           placeholder="Cerca conversazioni...">
                </div>
            </div>

            <!-- Conversations List Container -->
            <div id="history-list-container" class="flex flex-col gap-lg">
                <div class="p-md text-center text-secondary font-label-md border-2 border-on-surface bg-surface-container-lowest">
                    Caricamento cronologia in corso...
                </div>
            </div>
        </div>
    `;

    setTimeout(() => initHistoryLogic(container), 0);
    return container;
}

async function initHistoryLogic(container) {
    const listContainer = container.querySelector('#history-list-container');
    const searchInput = container.querySelector('#history-search-input');

    let loadedChats = [];
    let availableAgents = [];

    try {
        const [chatsRes, agentsRes] = await Promise.allSettled([
            CatAPI.getChats(),
            CatAPI.getAgents()
        ]);

        if (chatsRes.status === 'fulfilled' && Array.isArray(chatsRes.value)) {
            loadedChats = chatsRes.value;
        }
        if (agentsRes.status === 'fulfilled') {
            availableAgents = Array.isArray(agentsRes.value) ? agentsRes.value : (agentsRes.value?.agents || []);
        }
    } catch (err) {
        console.error("Errore caricamento dati storico:", err);
    }

    function renderHistory(query = '') {
        listContainer.innerHTML = '';

        const q = query.toLowerCase();
        const filtered = loadedChats.filter(chat => {
            const title = (chat.name || chat.id || '').toLowerCase();
            const lastMsg = chat.messages && chat.messages.length > 0 ? extractTextFromContent(chat.messages[chat.messages.length - 1].content).toLowerCase() : '';
            return title.includes(q) || lastMsg.includes(q);
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="p-lg text-center text-secondary border-2 border-on-surface bg-surface-container-lowest shadow-hard">
                    <span class="material-symbols-outlined text-4xl mb-xs">history_toggle_off</span>
                    <p class="font-headline-md font-bold">Nessuna conversazione trovata</p>
                    <p class="font-body-md text-sm mt-xs">Inizia una nuova chat per popolare la tua cronologia.</p>
                </div>
            `;
            return;
        }

        // Group chats by date
        const groups = {
            'Today': [],
            'Yesterday': [],
            'In precedenza': []
        };

        const now = new Date();
        filtered.forEach(chat => {
            const chatDate = chat.updated_at ? new Date(chat.updated_at) : (chat.created_at ? new Date(chat.created_at) : null);
            if (!chatDate) {
                groups['In precedenza'].push(chat);
            } else {
                const diffHours = (now - chatDate) / (1000 * 60 * 60);
                if (diffHours < 24) groups['Today'].push(chat);
                else if (diffHours < 48) groups['Yesterday'].push(chat);
                else groups['In precedenza'].push(chat);
            }
        });

        Object.keys(groups).forEach(groupTitle => {
            const items = groups[groupTitle];
            if (items.length === 0) return;

            const groupSection = document.createElement('div');
            groupSection.className = 'flex flex-col gap-sm';

            groupSection.innerHTML = `
                <div class="flex items-center gap-xs mb-xs">
                    <span class="w-2 h-2 rounded-full bg-primary inline-block"></span>
                    <h3 class="font-headline-md text-headline-md font-bold text-on-surface">${groupTitle}</h3>
                </div>
            `;

            items.forEach(chat => {
                const title = chat.name || chat.id || 'Chat';
                const chatId = chat.id || chat.chat_id;
                
                const rawAgent = chat.context?.agent_slug || 'default';
                const matchedAgent = availableAgents.find(a => a.slug === rawAgent);
                const agentDisplayName = matchedAgent ? (matchedAgent.name || matchedAgent.slug) : rawAgent;
                const agentTag = (agentDisplayName.toLowerCase().endsWith('agent') ? agentDisplayName : `${agentDisplayName} Agent`).toUpperCase();
                
                let excerpt = 'Apri la conversazione per visualizzare i dettagli.';
                if (chat.messages && chat.messages.length > 0) {
                    const lastMsg = chat.messages[chat.messages.length - 1];
                    excerpt = extractTextFromContent(lastMsg.content) || excerpt;
                }

                const timeStr = chat.updated_at ? new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                const card = document.createElement('div');
                card.className = 'p-md bg-surface-container-lowest border-2 border-on-surface shadow-hard hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all flex flex-col md:flex-row md:items-center justify-between gap-md group';

                card.innerHTML = `
                    <a href="#chat?id=${encodeURIComponent(chatId)}" class="flex-1 min-w-0">
                        <div class="flex items-center gap-sm mb-xs">
                            <h4 class="font-headline-md text-headline-md font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                                ${title}
                            </h4>
                            <span class="font-label-sm text-label-sm border-2 border-on-surface px-xs bg-surface-container uppercase shrink-0">
                                ${agentTag}
                            </span>
                        </div>
                        <p class="font-body-md text-body-md text-secondary truncate">
                            ${excerpt}
                        </p>
                    </a>
                    <div class="flex items-center gap-sm shrink-0">
                        ${timeStr ? `<span class="font-label-sm text-label-sm text-secondary mr-xs">${timeStr}</span>` : ''}
                        <button class="btn-delete p-xs border-2 border-on-surface bg-surface-container hover:bg-error hover:text-on-error transition-colors" title="Elimina chat" data-id="${chatId}">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                `;

                // Delete action handler with custom modal popup
                const btnDelete = card.querySelector('.btn-delete');
                btnDelete?.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showConfirmModal(title, async () => {
                        try {
                            await CatAPI.deleteChat(chatId);
                            loadedChats = loadedChats.filter(c => (c.id || c.chat_id) !== chatId);
                            renderHistory(searchInput?.value || '');
                        } catch (err) {
                            console.error("Impossibile eliminare la chat:", err);
                        }
                    });
                });

                groupSection.appendChild(card);
            });

            listContainer.appendChild(groupSection);
        });
    }

    renderHistory();

    searchInput?.addEventListener('input', (e) => {
        renderHistory(e.target.value);
    });
}
