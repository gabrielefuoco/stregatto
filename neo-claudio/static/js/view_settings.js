// view_settings.js - Settings Manager View
import { CatAPI } from './api.js';

export async function renderSettingsView() {
    const container = document.createElement('div');
    container.className = 'w-full h-full p-lg overflow-y-auto bg-surface relative z-10';

    container.innerHTML = `
        <!-- Blueprint Background Overlay -->
        <div class="absolute inset-0 bg-blueprint z-0 pointer-events-none"></div>

        <div class="relative z-10 max-w-4xl mx-auto py-md">
            <div class="mb-xl border-b-2 border-on-surface pb-md">
                <h1 class="font-headline-xl text-headline-xl text-on-surface mb-xs flex items-center gap-sm">
                    <span class="material-symbols-outlined text-primary text-4xl">settings</span> Impostazioni Stregatto
                </h1>
                <p class="font-body-lg text-body-lg text-secondary">
                    Configura i parametri di sistema, il modello LLM e i servizi integrati.
                </p>
            </div>
            
            <div id="settings-list" class="flex flex-col gap-lg">
                <div class="p-xl text-center font-label-md text-secondary border-2 border-on-surface bg-surface-container-lowest shadow-hard">
                    Caricamento impostazioni in corso...
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        loadSettings(container);
    }, 0);
    return container;
}

async function loadSettings(container) {
    const list = container.querySelector('#settings-list');
    try {
        const response = await CatAPI.getSettings();
        const settings = response.settings || (Array.isArray(response) ? response : []); 
        
        list.innerHTML = '';
        
        if (!settings || settings.length === 0) {
            list.innerHTML = `
                <div class="p-xl text-center border-2 border-on-surface bg-surface-container-lowest shadow-hard">
                    <span class="material-symbols-outlined text-4xl text-secondary mb-xs">settings_suggest</span>
                    <p class="font-headline-md font-bold text-on-surface">Nessuna impostazione trovata</p>
                </div>
            `;
            return;
        }

        settings.forEach(setting => {
            const card = document.createElement('div');
            card.className = 'border-2 border-on-surface bg-surface-container-lowest p-lg shadow-hard flex flex-col gap-md';
            
            let html = `
                <div class="border-b-2 border-on-surface pb-sm flex justify-between items-start">
                    <div>
                        <h3 class="font-headline-md text-headline-md font-bold text-on-surface">${setting.name || setting.slug || 'Impostazione'}</h3>
                        <p class="font-label-sm text-label-sm text-secondary font-mono mt-xs">ID: ${setting.slug || setting.id}</p>
                    </div>
                    <span class="material-symbols-outlined text-secondary">tune</span>
                </div>
                <form class="flex flex-col gap-md" data-id="${setting.slug || setting.id}">
            `;

            const schemaProps = setting.schema?.properties || {};
            const values = setting.value || {};
            
            const keys = Object.keys(schemaProps).length > 0 ? Object.keys(schemaProps) : Object.keys(values);

            for (const key of keys) {
                const propSchema = schemaProps[key] || {};
                const val = values[key] !== undefined ? values[key] : (propSchema.default !== undefined ? propSchema.default : '');
                
                const labelText = propSchema.title || key.replace(/_/g, ' ');
                const isBool = propSchema.type === 'boolean' || typeof val === 'boolean';
                const enums = propSchema.enum || (propSchema.anyOf && propSchema.anyOf.find(a => a.enum)?.enum);

                html += `<div class="flex flex-col gap-xs">`;
                
                if (isBool) {
                    html += `
                        <label class="flex items-center gap-sm font-label-md text-label-md cursor-pointer text-on-surface">
                            <input type="checkbox" name="${key}" ${val ? 'checked' : ''} 
                                   class="w-5 h-5 border-2 border-on-surface bg-surface-container text-primary focus:ring-0 rounded-none cursor-pointer" />
                            <span>${labelText}</span>
                        </label>
                    `;
                } else if (enums) {
                    html += `
                        <label class="font-label-md text-label-md font-bold capitalize text-on-surface">${labelText}</label>
                        <select name="${key}" class="bg-surface-container border-2 border-on-surface p-sm font-body-md text-on-surface focus:outline-none focus:border-primary">
                            ${enums.map(opt => `<option value="${opt}" ${opt === val ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    `;
                } else {
                    const inputType = (propSchema.type === 'integer' || propSchema.type === 'number' || typeof val === 'number') ? 'number' : (key.includes('password') || key.includes('key') ? 'password' : 'text');
                    html += `
                        <label class="font-label-md text-label-md font-bold capitalize text-on-surface">${labelText}</label>
                        <input type="${inputType}" 
                               name="${key}" 
                               value="${val === null ? '' : val}" 
                               class="bg-surface-container border-2 border-on-surface p-sm font-body-md text-on-surface focus:outline-none focus:border-primary" />
                    `;
                }
                
                if (propSchema.description) {
                    html += `<p class="font-label-sm text-label-sm text-secondary">${propSchema.description}</p>`;
                }
                html += `</div>`;
            }

            html += `
                    <div class="mt-sm flex justify-end">
                        <button type="submit" class="px-lg py-sm bg-primary-container text-on-primary border-2 border-on-surface font-label-md text-label-md font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all">
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
                    await CatAPI.updateSetting(setting.id || setting.slug, payload);
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
        list.innerHTML = `
            <div class="border-2 border-on-surface bg-error-container text-on-error-container p-md shadow-hard font-mono text-sm">
                <strong>Errore caricamento impostazioni:</strong> ${error.message}
            </div>
        `;
    }
}
