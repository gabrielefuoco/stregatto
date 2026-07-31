// view_agents.js - Agent Gallery View
import { CatAPI } from './api.js';

export async function renderAgentsView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col overflow-y-auto relative bg-surface p-lg z-10';

    container.innerHTML = `
        <!-- Blueprint Overlay -->
        <div class="absolute inset-0 bg-blueprint z-0 pointer-events-none"></div>

        <div class="relative z-10 max-w-6xl mx-auto w-full py-md">
            <!-- Header section -->
            <div class="flex flex-col md:flex-row md:items-end justify-between mb-xl gap-md">
                <div>
                    <h1 class="font-headline-xl text-headline-xl text-on-surface mb-xs">Agent Gallery</h1>
                    <p class="font-body-lg text-body-lg text-secondary">
                        Seleziona un agente specializzato per avviare il tuo task o scopri le sue competenze.
                    </p>
                </div>
                <div class="relative min-w-[280px]">
                    <div class="relative flex items-center bg-surface-container-lowest border-2 border-on-surface shadow-hard">
                        <span class="material-symbols-outlined ml-sm text-secondary">search</span>
                        <input type="text" id="agent-search-input" 
                               class="w-full bg-transparent border-none focus:ring-0 py-sm px-xs font-body-md text-on-surface placeholder:text-secondary" 
                               placeholder="Cerca agenti...">
                    </div>
                </div>
            </div>

            <!-- Categories Filter -->
            <div class="flex flex-wrap gap-sm mb-xl" id="category-filters">
                <button class="filter-btn active px-md py-xs font-label-md text-label-md bg-on-surface text-surface border-2 border-on-surface transition-all" data-category="all">
                    Tutti gli Agenti
                </button>
                <button class="filter-btn px-md py-xs font-label-md text-label-md bg-surface-container-lowest text-on-surface border-2 border-on-surface hover:bg-surface-variant transition-all" data-category="dev">
                    Sviluppo
                </button>
                <button class="filter-btn px-md py-xs font-label-md text-label-md bg-surface-container-lowest text-on-surface border-2 border-on-surface hover:bg-surface-variant transition-all" data-category="writing">
                    Scrittura
                </button>
                <button class="filter-btn px-md py-xs font-label-md text-label-md bg-surface-container-lowest text-on-surface border-2 border-on-surface hover:bg-surface-variant transition-all" data-category="data">
                    Data Analysis
                </button>
                <button class="filter-btn px-md py-xs font-label-md text-label-md bg-surface-container-lowest text-on-surface border-2 border-on-surface hover:bg-surface-variant transition-all" data-category="utility">
                    Utility
                </button>
            </div>

            <!-- Agents Grid Container -->
            <div id="agents-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
                <div class="col-span-full text-center py-xl text-secondary font-label-md">
                    Caricamento agenti in corso...
                </div>
            </div>
        </div>
    `;

    setTimeout(() => initAgentsLogic(container), 0);
    return container;
}

async function initAgentsLogic(container) {
    const grid = container.querySelector('#agents-grid');
    const searchInput = container.querySelector('#agent-search-input');
    const filterBtns = container.querySelectorAll('.filter-btn');

    let loadedAgents = [];

    try {
        const response = await CatAPI.getAgents();
        loadedAgents = Array.isArray(response) ? response : (response?.agents || []);
    } catch (e) {
        console.error("Errore caricamento agenti:", e);
        loadedAgents = [];
    }

    function renderGrid(filterText = '', category = 'all') {
        grid.innerHTML = '';

        // Custom Agent Tile
        const customTile = document.createElement('div');
        customTile.className = 'p-lg bg-[#ffe8df] border-2 border-on-surface shadow-hard flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all cursor-pointer';
        customTile.innerHTML = `
            <div>
                <div class="w-12 h-12 rounded-full border-2 border-on-surface bg-surface-container-lowest flex items-center justify-center mb-md shadow-hard-sm">
                    <span class="material-symbols-outlined text-primary text-2xl">add</span>
                </div>
                <h3 class="font-headline-md text-headline-md font-bold mb-xs text-on-surface">Agente Personalizzato</h3>
                <p class="font-body-md text-body-md text-secondary mb-md">
                    Configura istruzioni, tool e direttive per creare un nuovo agente nello Stregatto.
                </p>
            </div>
            <a href="#settings" class="inline-flex items-center gap-xs font-label-md text-label-md text-primary font-bold hover:underline">
                Configura ora <span class="material-symbols-outlined">arrow_forward</span>
            </a>
        `;
        grid.appendChild(customTile);

        // Filter Agents
        const filtered = loadedAgents.filter(ag => {
            const name = (ag.name || ag.slug || '').toLowerCase();
            const desc = (ag.description || '').toLowerCase();
            const q = filterText.toLowerCase();
            const matchesText = name.includes(q) || desc.includes(q);
            
            if (category === 'all') return matchesText;
            if (category === 'dev') return matchesText && (name.includes('dev') || name.includes('code') || desc.includes('code') || desc.includes('dev'));
            if (category === 'writing') return matchesText && (name.includes('write') || desc.includes('write') || desc.includes('doc'));
            if (category === 'data') return matchesText && (name.includes('data') || desc.includes('data') || desc.includes('csv'));
            if (category === 'utility') return matchesText;
            return matchesText;
        });

        if (filtered.length === 0 && loadedAgents.length > 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'col-span-full p-md text-center text-secondary border-2 border-on-surface bg-surface-container-lowest';
            emptyMsg.textContent = 'Nessun agente trovato per la ricerca effettuata.';
            grid.appendChild(emptyMsg);
            return;
        }

        filtered.forEach(agent => {
            const card = document.createElement('div');
            card.className = 'p-lg bg-surface-container-lowest border-2 border-on-surface shadow-hard flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all relative group';

            const name = agent.name || agent.slug;
            const desc = agent.description || 'Nessuna descrizione fornita per questo agente.';
            const slug = agent.slug;

            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-md">
                        <div class="p-xs bg-surface-container border-2 border-on-surface">
                            <span class="material-symbols-outlined text-on-surface">smart_toy</span>
                        </div>
                        <span class="font-label-sm text-label-sm border-2 border-on-surface px-xs py-[2px] bg-secondary-container text-on-surface uppercase">
                            ${slug}
                        </span>
                    </div>
                    <h3 class="font-headline-md text-headline-md font-bold mb-xs group-hover:text-primary transition-colors text-on-surface">
                        ${name}
                    </h3>
                    <p class="font-body-md text-body-md text-secondary line-clamp-3 mb-md">
                        ${desc}
                    </p>
                </div>
                <a href="#chat?agent=${encodeURIComponent(slug)}" class="w-full py-sm bg-surface-container hover:bg-primary hover:text-on-primary border-2 border-on-surface font-label-md text-label-md font-bold transition-all text-center block">
                    Avvia Chat con Agente
                </a>
            `;
            grid.appendChild(card);
        });
    }

    renderGrid();

    searchInput?.addEventListener('input', (e) => {
        const activeCat = container.querySelector('.filter-btn.active')?.dataset.category || 'all';
        renderGrid(e.target.value, activeCat);
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => {
                b.classList.remove('active', 'bg-on-surface', 'text-surface');
                b.classList.add('bg-surface-container-lowest', 'text-on-surface');
            });
            btn.classList.add('active', 'bg-on-surface', 'text-surface');
            btn.classList.remove('bg-surface-container-lowest', 'text-on-surface');

            renderGrid(searchInput?.value || '', btn.dataset.category);
        });
    });
}
