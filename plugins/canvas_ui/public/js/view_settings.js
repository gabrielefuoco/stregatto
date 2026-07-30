const { CatAPI } = await import('./api.js?v=' + Date.now());

export async function renderSettingsView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full p-8 overflow-y-auto bg-[var(--bg-primary)]';

    container.innerHTML = `
        <div class="max-w-3xl mx-auto relative">
            <div class="absolute top-0 right-0 flex items-center gap-4">
                <button id="btn-theme" class="p-2 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" title="Cambia Tema">
                    <i data-lucide="sun"></i>
                </button>
                <button id="btn-lang" class="font-bold text-sm p-2 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" title="Cambia Lingua">
                    IT
                </button>
            </div>
            <h1 class="text-2xl font-bold mb-2 flex items-center gap-2">
                <i data-lucide="settings" class="w-6 h-6 text-[var(--accent-color)]"></i> Settings
            </h1>
            <p class="text-[var(--text-secondary)] mb-8">Configura il modello linguistico e i componenti di sistema.</p>
            
            <div id="settings-list" class="flex flex-col gap-6">
                <div class="py-12 text-center text-[var(--text-secondary)]">
                    <i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2"></i>
                    Caricamento impostazioni...
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        loadSettings(container);
        
        const btnTheme = container.querySelector('#btn-theme');
        if (btnTheme) {
            btnTheme.addEventListener('click', () => {
                const root = document.documentElement;
                const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                root.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
            });
        }
    }, 0);
    return container;
}

async function loadSettings(container) {
    const list = container.querySelector('#settings-list');
    try {
        const response = await CatAPI.getSettings();
        const settings = response.settings || response; 
        
        list.innerHTML = '';
        
        if (!settings || settings.length === 0) {
            list.innerHTML = '<p class="text-center py-8">Nessuna impostazione trovata.</p>';
            return;
        }

        settings.forEach(setting => {
            const card = document.createElement('div');
            card.className = 'border border-border bg-[var(--bg-secondary)] rounded-xl p-6 shadow-sm';
            
            let html = `
                <div class="mb-4">
                    <h3 class="font-bold text-lg">${setting.name}</h3>
                    <p class="text-xs text-[var(--text-secondary)] font-mono mt-1">ID: ${setting.slug}</p>
                </div>
                <form class="flex flex-col gap-4" data-id="${setting.slug}">
            `;

            const schemaProps = setting.schema?.properties || {};
            const values = setting.value || {};
            
            // Generate fields based on schema if available, otherwise fallback to values
            const keys = Object.keys(schemaProps).length > 0 ? Object.keys(schemaProps) : Object.keys(values);

            for (const key of keys) {
                const propSchema = schemaProps[key] || {};
                const val = values[key] !== undefined ? values[key] : (propSchema.default !== undefined ? propSchema.default : '');
                
                const labelText = propSchema.title || key.replace(/_/g, ' ');
                const isBool = propSchema.type === 'boolean' || typeof val === 'boolean';
                const enums = propSchema.enum || (propSchema.anyOf && propSchema.anyOf.find(a => a.enum)?.enum);

                html += `<div class="flex flex-col gap-1">`;
                
                if (isBool) {
                    html += `
                        <label class="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                            <input type="checkbox" name="${key}" ${val ? 'checked' : ''} class="w-4 h-4 rounded bg-[var(--bg-primary)] border-border text-[var(--accent-color)] focus:ring-[var(--accent-color)]" />
                            ${labelText}
                        </label>
                    `;
                } else if (enums) {
                    html += `
                        <label class="text-sm font-semibold capitalize">${labelText}</label>
                        <select name="${key}" class="bg-[var(--bg-primary)] border border-border rounded-lg p-2 focus:outline-none focus:border-[var(--accent-color)]">
                            ${enums.map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    `;
                } else {
                    const inputType = (propSchema.type === 'integer' || propSchema.type === 'number' || typeof val === 'number') ? 'number' : (key.includes('password') || key.includes('key') ? 'password' : 'text');
                    html += `
                        <label class="text-sm font-semibold capitalize">${labelText}</label>
                        <input type="${inputType}" 
                               name="${key}" 
                               value="${val === null ? '' : val}" 
                               class="bg-[var(--bg-primary)] border border-border rounded-lg p-2 focus:outline-none focus:border-[var(--accent-color)]" />
                    `;
                }
                
                if (propSchema.description) {
                    html += `<p class="text-xs text-[var(--text-secondary)]">${propSchema.description}</p>`;
                }
                html += `</div>`;
            }

            html += `
                    <div class="mt-4 flex justify-end">
                        <button type="submit" class="px-4 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity" style="background-color: var(--accent-color);">
                            Salva Modifiche
                        </button>
                    </div>
                </form>
            `;
            
            card.innerHTML = html;

            // Handle Save
            const form = card.querySelector('form');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = {};
                for (const key of keys) {
                    const input = form.elements[key];
                    if (!input) continue;
                    
                    if (input.type === 'checkbox') {
                        payload[key] = input.checked;
                    } else if (input.type === 'number') {
                        payload[key] = input.value !== '' ? Number(input.value) : null;
                    } else {
                        payload[key] = input.value;
                    }
                }

                const btn = form.querySelector('button');
                const oldText = btn.textContent;
                btn.textContent = 'Salvataggio...';
                btn.disabled = true;

                try {
                    await CatAPI.updateSetting(setting.id, payload);
                    btn.textContent = 'Salvato!';
                    setTimeout(() => { btn.textContent = oldText; btn.disabled = false; }, 2000);
                } catch (err) {
                    console.error(err);
                    alert("Errore nel salvataggio.");
                    btn.textContent = oldText;
                    btn.disabled = false;
                }
            });

            list.appendChild(card);
        });

    } catch (error) {
        list.innerHTML = `<div class="text-red-500 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
            Errore nel caricamento dei settings: ${error.message}
        </div>`;
    }
}
