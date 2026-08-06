/**
 * static/js/view_agent_gallery.js
 * Vista Agent Gallery con stile Neo-Brutalist
 */

import { apiFetch, createModal, renderFormField, renderBadge, confirmModal, bindSearchInput, showToast } from './ui.js?v=13';

export class AgentGallery {
    constructor(app) {
        this.app = app || window.stregattoApp;
        this.presets = [];
        this.activeCategory = 'All Agents';
        this.searchQuery = '';
    }

    async render(containerEl) {
        containerEl.innerHTML = '<div class="p-8 font-headline font-bold">Caricamento Agenti in corso...</div>';
        try {
            this.presets = await apiFetch('/api/presets') || [];
        } catch (e) {
            this.presets = [];
        }
        
        containerEl.innerHTML = '';
        
        const wrapper = document.createElement('div');
        wrapper.className = 'agent-gallery-wrapper w-full h-full overflow-y-auto bg-white p-8 font-body';
        wrapper.innerHTML = this.renderContent();
        containerEl.appendChild(wrapper);

        this.bindEvents(wrapper);
    }

    renderContent() {
        const filteredPresets = this.getFilteredPresets();

        return `
            <div class="max-w-7xl mx-auto pb-12">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div>
                        <h1 class="text-4xl md:text-5xl font-headline font-bold text-black tracking-tight mb-2">Agent Gallery</h1>
                        <p class="text-gray-600 text-base max-w-2xl">Seleziona un template agente specializzato per iniziare, oppure crea un agente personalizzato (System Prompt, Permission Mode, Tools MCP e Hooks).</p>
                    </div>
                    
                    <!-- Search Input with Hard Shadow -->
                    <div class="relative min-w-[280px]">
                        <input type="text" id="search-templates-input" value="${this.searchQuery}" placeholder="Cerca tra i template..." class="w-full bg-white border-2 border-black px-4 py-2.5 text-sm font-body font-medium shadow-[4px_4px_0px_#000] focus:outline-none focus:shadow-[6px_6px_0px_#FF5F1F] transition-all">
                        <span class="absolute right-3 top-2.5 text-lg">🔍</span>
                    </div>
                </div>

                <!-- Category Pills (Filter Bar) -->
                <div class="flex items-center gap-3 overflow-x-auto pb-4 mb-8">
                    ${['All Agents', 'Development', 'Writing', 'Data Analysis', 'Design', 'Utility'].map(cat => `
                        <button class="btn-category-pill px-5 py-2 rounded-full border-2 border-black font-headline text-xs font-bold uppercase tracking-wider transition-all ${this.activeCategory === cat ? 'bg-black text-white shadow-[2px_2px_0px_#000]' : 'bg-white text-black hover:bg-gray-100'}" data-cat="${cat}">
                            ${cat}
                        </button>
                    `).join('')}
                </div>

                <!-- Cards Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <!-- Card 1: Custom Agent (Soft Peach Tint) -->
                    <div id="btn-create-preset" class="bg-[#FDE2D6] border-2 border-black p-6 shadow-[4px_4px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] cursor-pointer transition-all flex flex-col items-center text-center">
                        <div class="w-16 h-16 rounded-full bg-white border-2 border-black flex items-center justify-center text-3xl font-headline font-bold text-black mb-6 shadow-[2px_2px_0px_#000]">
                            +
                        </div>
                        <h3 class="text-xl font-headline font-bold text-black mb-3">Custom Agent</h3>
                        <p class="text-xs text-gray-700 leading-relaxed">Configura istruzioni personalizzate, permission mode, strumenti MCP e hooks da zero.</p>
                    </div>

                    <!-- Dynamic Presets -->
                    ${filteredPresets.map(p => this.renderPresetCard(p)).join('')}
                </div>
            </div>
        `;
    }

    getFilteredPresets() {
        return this.presets.filter(p => {
            const matchesQuery = p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                                 (p.description && p.description.toLowerCase().includes(this.searchQuery.toLowerCase()));
            const matchesCat = this.activeCategory === 'All Agents' || (p.category && p.category === this.activeCategory);
            return matchesQuery && matchesCat;
        });
    }

    renderPresetCard(preset) {
        const permBadge = renderBadge({ text: preset.permission_mode || 'Auto', variant: 'default' });
        const toolBadge = renderBadge({ text: `${(preset.allowed_tools || []).length} Tools`, variant: 'brand' });

        return `
            <div class="preset-card bg-white border-2 border-black p-6 shadow-[4px_4px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000] cursor-pointer transition-all flex flex-col justify-between relative group" data-id="${preset.id}">
                <div class="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="btn-delete-preset bg-white border-2 border-black w-7 h-7 flex items-center justify-center hover:bg-red-500 hover:text-white text-xs font-bold shadow-[1px_1px_0px_#000]" data-id="${preset.id}" title="Elimina">✕</button>
                </div>
                <div>
                    <div class="flex justify-between items-start mb-6">
                        <div class="w-12 h-12 border-2 border-black bg-white flex items-center justify-center text-2xl shadow-[2px_2px_0px_#000]">
                            ${preset.icon || '🤖'}
                        </div>
                        ${permBadge}
                    </div>
                    <h3 class="text-xl font-headline font-bold text-black mb-2">${preset.name}</h3>
                    <p class="text-xs text-gray-600 leading-relaxed">${preset.description || 'Nessuna descrizione specificata.'}</p>
                </div>
                <div class="mt-6 pt-3 border-t-2 border-black flex justify-between items-center text-[10px] font-mono">
                    <span class="text-gray-500">${preset.model || 'Claude 3.5'}</span>
                    ${toolBadge}
                </div>
            </div>
        `;
    }

    renderCreatePresetModal() {
        const contentHtml = [
            `<div class="flex gap-4">
                <div class="w-20">
                    ${renderFormField({ label: 'Icona', name: 'icon', value: '🤖', required: true, classNames: 'text-center text-2xl' })}
                </div>
                <div class="flex-grow">
                    ${renderFormField({ label: 'Nome Agent', name: 'name', placeholder: 'Es. Senior Full-Stack Developer', required: true })}
                </div>
            </div>`,
            renderFormField({ label: 'Descrizione Breve', name: 'description', placeholder: 'Descrizione del ruolo e delle competenze...' }),
            renderFormField({
                label: 'Modello LLM', name: 'model', type: 'select',
                options: [
                    { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Consigliato)' },
                    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
                    { value: 'deepseek-r1', label: 'DeepSeek R1' },
                    { value: 'gpt-4o', label: 'GPT-4o' }
                ]
            }),
            renderFormField({ label: 'System Prompt / Direttive', name: 'system_prompt', type: 'textarea', placeholder: 'Istruzioni di sistema e comportamenti desiderati dell\'agente...' }),
            renderFormField({
                label: 'Permission Mode', name: 'permission_mode', type: 'radio', value: 'plan',
                options: [
                    { value: 'plan', label: 'Plan' },
                    { value: 'auto', label: 'Auto' },
                    { value: 'acceptEdits', label: 'Accept Edits' },
                    { value: 'bypassPermissions', label: 'Bypass' }
                ]
            }),
            renderFormField({
                label: 'Tool MCP & Capabilities Consentite', name: 'tools', type: 'checkbox',
                options: [
                    { value: 'Read', label: 'Read', checked: true },
                    { value: 'Write', label: 'Write', checked: true },
                    { value: 'Edit', label: 'Edit', checked: true },
                    { value: 'Bash', label: 'Bash', checked: true },
                    { value: 'WebFetch', label: 'WebFetch', checked: false },
                    { value: 'Glob', label: 'Glob/Grep', checked: true }
                ]
            })
        ].join('<div class="my-2"></div>');

        createModal({
            id: 'preset-form-modal',
            title: 'Crea Nuovo Agent',
            btnText: 'Salva Agent',
            maxWidth: '650px',
            contentHtml,
            onSubmit: async (data, formData, closeModal) => {
                const allowedTools = formData.getAll('tools');
                const payload = {
                    name: data.name,
                    icon: data.icon || '🤖',
                    description: data.description || '',
                    model: data.model,
                    permission_mode: data.permission_mode,
                    system_prompt: data.system_prompt,
                    allowed_tools: allowedTools
                };

                try {
                    await apiFetch('/api/presets', { method: 'POST', body: payload });
                    closeModal();
                    showToast('Agent Preset creato!', 'success');
                    const container = document.getElementById('main-content');
                    if (container) await this.render(container);
                } catch (err) {
                    console.error('Failed to create preset:', err);
                    showToast('Errore durante la creazione dell\'Agent', 'error');
                }
            }
        });
    }

    bindEvents(wrapper) {
        bindSearchInput(wrapper.querySelector('#search-templates-input'), (query) => {
            this.searchQuery = query;
            const container = document.getElementById('main-content');
            if (container) this.render(container);
        });

        wrapper.querySelectorAll('.btn-category-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.activeCategory = e.currentTarget.dataset.cat;
                const container = document.getElementById('main-content');
                if (container) this.render(container);
            });
        });

        const createBtn = wrapper.querySelector('#btn-create-preset');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.renderCreatePresetModal());
        }

        wrapper.querySelectorAll('.preset-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-preset')) return;
                this.selectPreset(card.dataset.id);
            });
        });

        wrapper.querySelectorAll('.btn-delete-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deletePreset(e.currentTarget.dataset.id);
            });
        });
    }

    async selectPreset(presetId) {
        if (!this.app || !this.app.activeProjectId) {
            showToast("Seleziona prima un progetto dalla barra laterale.", 'error');
            return;
        }

        const preset = this.presets.find(p => p.id === presetId || p.slug === presetId);
        const sessionName = preset ? preset.name : 'Nuova Sessione';

        try {
            const newSession = await apiFetch(`/api/projects/${this.app.activeProjectId}/sessions`, {
                method: 'POST',
                body: {
                    name: sessionName,
                    preset_id: presetId,
                    model: preset ? preset.model : null
                }
            });

            if (this.app.tabBar) {
                this.app.tabBar.sessions.push(newSession);
                this.app.tabBar.renderTabs();
                this.app.tabBar.activateTab(newSession.id);
            }
            showToast(`Avviata sessione con preset ${sessionName}`, 'success');
        } catch (err) {
            console.error('Failed to start session with preset:', err);
            showToast('Errore durante l\'avvio della sessione', 'error');
        }
    }

    async deletePreset(presetId) {
        await confirmModal({
            title: 'Elimina Agent',
            message: 'Sei sicuro di voler eliminare questo Agent Preset?',
            danger: true,
            onConfirm: async () => {
                try {
                    await apiFetch(`/api/presets/${presetId}`, { method: 'DELETE' });
                    showToast('Agent eliminato', 'info');
                    const container = document.getElementById('main-content');
                    if (container) await this.render(container);
                } catch (err) {
                    console.error("Failed to delete preset", err);
                    showToast('Errore durante l\'eliminazione', 'error');
                }
            }
        });
    }
}

