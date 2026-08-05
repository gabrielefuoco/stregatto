export class AgentGallery {
    constructor(apiClient, router) {
        this.api = apiClient;
        this.router = router;
        this.presets = [];
    }

    async render(containerEl) {
        containerEl.innerHTML = '<div class="p-4">Caricamento agenti in corso...</div>';
        try {
            // Recupero presets dal backend
            // For now, mock or empty array if API not fully wired, or use actual API call if apiClient has get method
            if (this.api && this.api.get) {
                this.presets = await this.api.get('/presets');
            } else {
                const response = await fetch('/presets');
                this.presets = await response.json();
            }
            
            let html = `
                <div class="agent-gallery-container p-6 w-full max-w-7xl mx-auto">
                    <div class="flex justify-between items-center mb-8">
                        <h2 class="text-3xl font-bold font-mono tracking-tight uppercase">Agent Gallery</h2>
                        <button id="btn-create-preset" class="neo-btn bg-[#FF5F1F] text-white px-4 py-2 font-bold font-mono">
                            + Nuovo Agent
                        </button>
                    </div>
                    
                    <div class="agent-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        ${this.presets.map(p => this.renderPresetCard(p)).join('')}
                    </div>
                    
                    <div id="preset-form-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <!-- Form injected here via JS -->
                    </div>
                </div>
            `;
            containerEl.innerHTML = html;
            this.bindEvents(containerEl);
        } catch (error) {
            containerEl.innerHTML = `<div class="p-4 text-red-600 font-bold border-2 border-red-600 bg-red-100">Errore: ${error.message}</div>`;
        }
    }

    renderPresetCard(preset) {
        // Neo-Brutalist styling: border-2, sharp corners, hard shadow
        return `
            <div class="preset-card neo-panel flex flex-col bg-white p-5 cursor-pointer transition-transform relative group" data-id="${preset.id}">
                <div class="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="btn-delete-preset bg-white border-2 border-black w-8 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white" data-id="${preset.id}" title="Elimina">✕</button>
                </div>
                
                <div class="flex items-center gap-4 mb-4">
                    <div class="text-4xl bg-yellow-100 border-2 border-black w-16 h-16 flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                        ${preset.icon || '🤖'}
                    </div>
                    <div>
                        <h3 class="text-xl font-bold font-mono uppercase">${preset.name}</h3>
                        <span class="text-xs bg-gray-200 border border-black px-1 font-mono">${preset.model || 'Auto'}</span>
                    </div>
                </div>
                <p class="text-sm flex-grow mb-4 font-sans text-gray-700">${preset.description}</p>
                <div class="flex gap-2 flex-wrap text-xs font-mono mt-auto pt-4 border-t-2 border-black">
                    <span class="bg-[#FF5F1F] text-white px-2 py-1 uppercase">${preset.permission_mode}</span>
                    <span class="bg-blue-100 border border-black px-2 py-1">${(preset.allowed_tools || []).length} Tools</span>
                </div>
            </div>
        `;
    }

    renderCreatePresetForm() {
        return `
            <div class="neo-panel bg-white p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                <button id="btn-close-modal" class="absolute top-4 right-4 font-bold text-xl hover:text-[#FF5F1F]">✕</button>
                <h3 class="text-2xl font-bold font-mono mb-6 uppercase border-b-4 border-black pb-2">Crea Nuovo Agent</h3>
                
                <form id="create-preset-form" class="flex flex-col gap-4 font-mono text-sm">
                    <div class="flex gap-4">
                        <div class="flex flex-col gap-1 w-20">
                            <label class="font-bold uppercase">Icona</label>
                            <input type="text" name="icon" class="neo-input text-center text-2xl" value="🤖" required>
                        </div>
                        <div class="flex flex-col gap-1 flex-grow">
                            <label class="font-bold uppercase">Nome</label>
                            <input type="text" name="name" class="neo-input" placeholder="Es. React Developer" required>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-1">
                        <label class="font-bold uppercase">Descrizione</label>
                        <input type="text" name="description" class="neo-input" placeholder="Descrizione breve...">
                    </div>
                    
                    <div class="flex flex-col gap-1">
                        <label class="font-bold uppercase">Modello LLM</label>
                        <select name="model" class="neo-input bg-white cursor-pointer">
                            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Consigliato)</option>
                            <option value="claude-3-opus">Claude 3 Opus</option>
                            <option value="gpt-4o">GPT-4o</option>
                        </select>
                    </div>
                    
                    <div class="flex flex-col gap-1">
                        <label class="font-bold uppercase">System Prompt</label>
                        <textarea name="system_prompt" class="neo-input h-32 resize-y" placeholder="Istruzioni personalizzate per l'agente..."></textarea>
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <label class="font-bold uppercase">Permission Mode</label>
                        <div class="flex gap-4 bg-gray-100 p-2 border-2 border-black">
                            <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="permission_mode" value="plan" checked> Plan</label>
                            <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="permission_mode" value="auto"> Auto</label>
                            <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="permission_mode" value="acceptEdits"> Accept Edits</label>
                            <label class="flex items-center gap-2 text-red-600 font-bold cursor-pointer"><input type="radio" name="permission_mode" value="bypassPermissions"> Bypass (Pericoloso)</label>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <label class="font-bold uppercase">Tool Consentiti</label>
                        <div class="grid grid-cols-3 gap-2 border-2 border-black p-3 bg-yellow-50">
                            <label><input type="checkbox" name="tools" value="Read" checked> Read</label>
                            <label><input type="checkbox" name="tools" value="Write" checked> Write</label>
                            <label><input type="checkbox" name="tools" value="Edit" checked> Edit</label>
                            <label><input type="checkbox" name="tools" value="Bash" checked> Bash</label>
                            <label><input type="checkbox" name="tools" value="WebFetch"> WebFetch</label>
                            <label><input type="checkbox" name="tools" value="Glob" checked> Glob/Grep</label>
                        </div>
                    </div>
                    
                    <button type="submit" class="neo-btn bg-[#FF5F1F] text-white py-3 mt-4 text-lg font-bold uppercase hover:bg-black">Salva Agent</button>
                </form>
            </div>
        `;
    }

    bindEvents(containerEl) {
        // Apri form creazione
        containerEl.querySelector('#btn-create-preset').addEventListener('click', () => {
            const modal = containerEl.querySelector('#preset-form-modal');
            modal.innerHTML = this.renderCreatePresetForm();
            modal.classList.remove('hidden');
            
            modal.querySelector('#btn-close-modal').addEventListener('click', () => {
                modal.classList.add('hidden');
            });

            modal.querySelector('#create-preset-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                // Costruzione payload ed invio POST...
                // Ricarica la galleria dopo il successo
            });
        });

        // Click sulle card -> Seleziona e vai
        containerEl.querySelectorAll('.preset-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-preset')) return; // ignora se click su elimina
                const presetId = card.dataset.id;
                this.selectPreset(presetId);
            });
        });

        // Elimina preset
        containerEl.querySelectorAll('.btn-delete-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const presetId = e.currentTarget.dataset.id;
                this.deletePreset(presetId);
            });
        });
    }

    selectPreset(presetId) {
        // Logica per avviare una sessione con questo preset per il progetto corrente
        console.log(`Avvio sessione con preset: ${presetId}`);
        // ... chiamata backend POST /sessions { preset_id: presetId, project_id: currentProject }
        // ... redirect alla view del terminale
    }

    async deletePreset(presetId) {
        if(confirm("Sei sicuro di voler eliminare questo Agent?")) {
            if (this.api && this.api.delete) {
                await this.api.delete(`/presets/${presetId}`);
            } else {
                await fetch(`/presets/${presetId}`, {method: 'DELETE'});
            }
            this.render(document.querySelector('#main-content')); // refresh
        }
    }
}
