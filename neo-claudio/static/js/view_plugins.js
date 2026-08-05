// view_plugins.js - Plugins Manager View
import { CatAPI } from './api.js';

export async function renderPluginsView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full p-lg overflow-y-auto bg-surface relative z-10';

    container.innerHTML = `
        <!-- Blueprint Overlay -->
        <div class="absolute inset-0 bg-blueprint z-0 pointer-events-none"></div>

        <div class="relative z-10 max-w-4xl mx-auto py-md">
            <div class="mb-xl border-b-2 border-on-surface pb-md">
                <h1 class="font-headline-xl text-headline-xl text-on-surface mb-xs flex items-center gap-sm">
                    <span class="material-symbols-outlined text-primary text-4xl">extension</span> Plugin
                </h1>
                <p class="font-body-lg text-body-lg text-secondary">
                    Gestisci i plugin attivi nel tuo framework Stregatto.
                </p>
            </div>
            
            <div id="plugins-grid" class="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <div class="col-span-full py-xl text-center font-label-md text-secondary border-2 border-on-surface bg-surface-container-lowest shadow-hard">
                    Caricamento plugin in corso...
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
            grid.innerHTML = `
                <div class="col-span-full text-center py-xl border-2 border-on-surface bg-surface-container-lowest shadow-hard">
                    <span class="material-symbols-outlined text-4xl text-secondary mb-xs">extension_off</span>
                    <p class="font-headline-md text-headline-md font-bold text-on-surface">Nessun plugin installato</p>
                </div>
            `;
            return;
        }

        plugins.forEach(plugin => {
            const card = document.createElement('div');
            card.className = 'border-2 border-on-surface bg-surface-container-lowest p-lg shadow-hard flex flex-col justify-between hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all relative';
            
            const name = plugin.manifest?.name || plugin.name || plugin.id;
            const desc = plugin.manifest?.description || plugin.description || 'Nessuna descrizione.';
            const version = plugin.manifest?.version || plugin.version || '1.0.0';
            const isActive = plugin.active !== undefined ? plugin.active : true;

            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-sm">
                        <h3 class="font-headline-md text-headline-md font-bold text-on-surface">${name}</h3>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer" ${isActive ? 'checked' : ''} data-id="${plugin.id}">
                            <div class="w-12 h-6 bg-surface-container border-2 border-on-surface peer-checked:bg-primary transition-all relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:border-2 after:border-on-surface after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-6 peer-checked:after:bg-on-primary"></div>
                        </label>
                    </div>
                    <p class="font-body-md text-body-md text-secondary mb-md">${desc}</p>
                </div>
                <div class="pt-sm border-t-2 border-on-surface flex justify-between items-center text-label-sm font-label-sm">
                    <span class="px-xs py-[2px] bg-surface-container border border-on-surface uppercase">v${version}</span>
                    <span class="text-secondary font-mono">${plugin.id}</span>
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
                    e.target.checked = !isChecked;
                } finally {
                    toggle.disabled = false;
                }
            });

            grid.appendChild(card);
        });

    } catch (error) {
        grid.innerHTML = `
            <div class="col-span-full border-2 border-on-surface bg-error-container text-on-error-container p-md shadow-hard font-mono text-sm">
                <strong>Errore caricamento plugin:</strong> ${error.message}
            </div>
        `;
    }
}
