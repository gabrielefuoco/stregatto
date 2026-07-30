const { CatAPI } = await import('./api.js?v=' + Date.now());

export async function renderPluginsView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full p-8 overflow-y-auto bg-[var(--bg-primary)]';

    container.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <h1 class="text-2xl font-bold mb-2 flex items-center gap-2">
                <i data-lucide="blocks" class="w-6 h-6 text-[var(--accent-color)]"></i> Plugins
            </h1>
            <p class="text-[var(--text-secondary)] mb-8">Gestisci i plugin del tuo Antigravity IDE.</p>
            
            <div id="plugins-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="col-span-full py-12 text-center text-[var(--text-secondary)]">
                    <i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2"></i>
                    Caricamento plugin...
                </div>
            </div>
        </div>
    `;

    setTimeout(() => loadPlugins(container), 0);
    return container;
}

async function loadPlugins(container) {
    const grid = container.querySelector('#plugins-grid');
    try {
        const response = await CatAPI.getPlugins();
        let plugins = [];
        if (Array.isArray(response)) {
            plugins = response;
        } else if (response && response.installed) {
            plugins = response.installed;
        }
        
        grid.innerHTML = '';
        
        if (plugins.length === 0) {
            grid.innerHTML = '<p class="col-span-full text-center py-8">Nessun plugin installato.</p>';
            return;
        }

        plugins.forEach(plugin => {
            const card = document.createElement('div');
            card.className = 'border border-border bg-[var(--bg-secondary)] rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:border-[var(--accent-color)] transition-colors relative';
            
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <h3 class="font-bold text-lg">${plugin.manifest?.name || plugin.id}</h3>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer" ${plugin.active ? 'checked' : ''} data-id="${plugin.id}">
                        <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent-color)]"></div>
                    </label>
                </div>
                <p class="text-sm text-[var(--text-secondary)]">${plugin.manifest?.description || 'Nessuna descrizione.'}</p>
                <div class="mt-auto pt-4 flex gap-2 text-xs text-[var(--text-secondary)] font-mono">
                    <span class="bg-[var(--bg-primary)] px-2 py-1 rounded">v${plugin.manifest?.version || '0.0.0'}</span>
                </div>
            `;
            
            // Toggle Logic
            const toggle = card.querySelector('input');
            toggle.addEventListener('change', async (e) => {
                const isChecked = e.target.checked;
                toggle.disabled = true;
                try {
                    await CatAPI.togglePlugin(plugin.id);
                } catch (err) {
                    console.error("Errore nel toggle del plugin", err);
                    alert("Errore durante l'attivazione del plugin.");
                    e.target.checked = !isChecked; // revert
                } finally {
                    toggle.disabled = false;
                }
            });

            grid.appendChild(card);
        });

    } catch (error) {
        grid.innerHTML = `<div class="col-span-full text-red-500 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
            Errore nel caricamento dei plugin: ${error.message}
        </div>`;
    }
}
