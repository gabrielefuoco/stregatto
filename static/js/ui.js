/**
 * static/js/ui.js - Utility parametrizzate Neo-Brutalist per il frontend
 */

/**
 * Wrapper compatto per chiamate API REST con gestione JSON ed errori.
 */
export async function apiFetch(url, options = {}) {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    const config = {
        ...options,
        headers: { ...defaultHeaders, ...(options.headers || {}) }
    };
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }
    const res = await fetch(url, config);
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API Error ${res.status}: ${errorText}`);
    }
    if (res.status === 204 || res.headers.get('content-length') === '0') return null;
    return await res.json();
}

/**
 * Genera un Menu Contestuale dinamico Neo-Brutalist con auto-dismiss.
 * @param {Object} opts - { x, y, items: [{ label, action, danger }] }
 */
export function createContextMenu({ x, y, items }) {
    const oldMenu = document.getElementById('active-context-menu');
    if (oldMenu) oldMenu.remove();

    const menu = document.createElement('div');
    menu.id = 'active-context-menu';
    menu.className = 'fixed bg-white border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] z-50 flex flex-col py-1 min-w-[160px] font-headline text-xs font-bold';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = `text-left px-4 py-2 hover:bg-gray-100 transition-colors uppercase ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-black'}`;
        btn.innerText = item.label;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.remove();
            item.action();
        });
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

/**
 * Genera una Modale dinamica Neo-Brutalist con form.
 * @param {Object} opts - { id, title, contentHtml, onSubmit, btnText, maxWidth }
 */
export function createModal({ id = 'app-modal', title, contentHtml, onSubmit, btnText = 'Salva', maxWidth = '400px' }) {
    const oldModal = document.getElementById(id);
    if (oldModal) oldModal.remove();

    const modalHtml = `
        <div id="${id}" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div class="bg-white border-4 border-black p-6 w-full shadow-[8px_8px_0px_#FF5F1F] relative max-h-[90vh] overflow-y-auto" style="max-width: ${maxWidth};">
                <button type="button" class="btn-modal-close absolute top-4 right-4 font-headline font-bold text-xl hover:text-[#FF5F1F]">✕</button>
                <h2 class="text-2xl font-headline font-bold uppercase border-b-4 border-black pb-2 mb-4 text-black">${title}</h2>
                <form class="modal-form flex flex-col gap-4">
                    ${contentHtml}
                    <div class="flex justify-end gap-3 mt-4">
                        <button type="button" class="btn-cancel neo-btn neo-btn-white neo-btn-sm font-bold">Annulla</button>
                        <button type="submit" class="neo-btn neo-btn-orange neo-btn-md font-bold">${btnText}</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById(id);

    const closeModal = () => modal.remove();
    modal.querySelector('.btn-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.btn-cancel').addEventListener('click', closeModal);

    modal.querySelector('.modal-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        if (onSubmit) {
            await onSubmit(data, formData, closeModal);
        }
    });

    return modal;
}

/**
 * Genera l'HTML di un campo form Neo-Brutalist parametrizzato.
 * @param {Object} opts - { label, name, type, value, options, placeholder, required, classNames }
 */
export function renderFormField({ label, name, type = 'text', value = '', options = [], placeholder = '', required = false, classNames = '' }) {
    const reqAttr = required ? 'required' : '';
    const labelHtml = label ? `<label class="block font-headline font-bold text-xs uppercase mb-1">${label}</label>` : '';
    let inputHtml = '';

    if (type === 'select') {
        const optsHtml = options.map(opt => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const lbl = typeof opt === 'object' ? opt.label : opt;
            const selected = String(val) === String(value) ? 'selected' : '';
            return `<option value="${val}" ${selected}>${lbl}</option>`;
        }).join('');
        inputHtml = `<select name="${name}" class="w-full neo-input p-2 border-2 border-black font-headline font-bold ${classNames}" ${reqAttr}>${optsHtml}</select>`;
    } else if (type === 'textarea') {
        inputHtml = `<textarea name="${name}" class="w-full neo-input p-2 border-2 border-black font-mono text-xs ${classNames}" placeholder="${placeholder}" ${reqAttr}>${value}</textarea>`;
    } else if (type === 'radio') {
        const radioGroup = options.map(opt => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const lbl = typeof opt === 'object' ? opt.label : opt;
            const isChecked = String(val) === String(value) ? 'checked' : '';
            return `<label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="${name}" value="${val}" ${isChecked}> ${lbl}</label>`;
        }).join('');
        inputHtml = `<div class="flex flex-wrap gap-4 bg-gray-100 p-3 border-2 border-black font-headline text-xs font-bold ${classNames}">${radioGroup}</div>`;
    } else if (type === 'checkbox') {
        const checkboxGroup = options.map(opt => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const lbl = typeof opt === 'object' ? opt.label : opt;
            const isChecked = (Array.isArray(value) ? value.includes(val) : opt.checked) ? 'checked' : '';
            return `<label><input type="checkbox" name="${name}" value="${val}" ${isChecked}> ${lbl}</label>`;
        }).join('');
        inputHtml = `<div class="grid grid-cols-3 gap-2 border-2 border-black p-3 bg-yellow-50 font-mono text-xs ${classNames}">${checkboxGroup}</div>`;
    } else {
        inputHtml = `<input type="${type}" name="${name}" value="${value}" placeholder="${placeholder}" class="w-full neo-input p-2 border-2 border-black ${classNames}" ${reqAttr}>`;
    }

    return `<div class="flex flex-col gap-1">${labelHtml}${inputHtml}</div>`;
}

/**
 * Genera un Badge Neo-Brutalist parametrizzato.
 * @param {Object} opts - { text, variant, extraClass }
 */
export function renderBadge({ text, variant = 'default', extraClass = '' }) {
    const variants = {
        default: 'bg-white text-black border-black',
        brand: 'bg-[#FF5F1F] text-white border-black',
        active: 'bg-black text-white border-black',
        success: 'bg-green-100 text-green-900 border-black',
        local: 'bg-[#ffdbcf] text-[#390c00] border-black',
        cloud: 'bg-blue-100 text-blue-900 border-black'
    };
    const style = variants[variant] || variants.default;
    return `<span class="inline-block text-[10px] font-headline font-bold px-1.5 py-0.5 border uppercase ${style} ${extraClass}">${text}</span>`;
}

/**
 * Mostra un modale di conferma Neo-Brutalist. Ritorna una Promise boolean o esegue il callback onConfirm.
 * @param {Object} opts - { title, message, onConfirm, danger }
 */
export function confirmModal({ title = 'Conferma Operazione', message = 'Sei sicuro di voler proseguire?', onConfirm, danger = false }) {
    return new Promise((resolve) => {
        const modalId = 'confirm-dialog-modal';
        const contentHtml = `
            <p class="text-sm font-body text-gray-800 leading-relaxed mb-2">${message}</p>
        `;
        const modal = createModal({
            id: modalId,
            title,
            contentHtml,
            btnText: danger ? 'Elimina' : 'Conferma',
            maxWidth: '380px',
            onSubmit: async (data, formData, closeModal) => {
                closeModal();
                if (onConfirm) await onConfirm();
                resolve(true);
            }
        });

        // Modifica classe del bottone submit se danger
        if (danger) {
            const submitBtn = modal.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.className = 'neo-btn neo-btn-sm font-bold bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-red-700';
            }
        }

        const cancelBtn = modal.querySelector('.btn-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => resolve(false));
        }
    });
}

/**
 * Mostra una notifica Toast Neo-Brutalist temporanea.
 * @param {string} message 
 * @param {string} type - 'info' | 'success' | 'error'
 * @param {number} duration - ms
 */
export function showToast(message, type = 'info', duration = 3000) {
    const existing = document.getElementById('neo-toast-container');
    const container = existing || document.createElement('div');
    if (!existing) {
        container.id = 'neo-toast-container';
        container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-green-100 text-green-900 border-green-900' : type === 'error' ? 'bg-red-100 text-red-900 border-red-900' : 'bg-white text-black border-black';
    toast.className = `pointer-events-auto p-3 border-2 font-headline font-bold text-xs shadow-[4px_4px_0px_#000] uppercase transition-all transform translate-y-2 ${bg}`;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Collega un listener di ricerca ad un input.
 * @param {HTMLElement} inputEl 
 * @param {Function} callback 
 */
export function bindSearchInput(inputEl, callback) {
    if (!inputEl) return;
    inputEl.addEventListener('input', (e) => callback(e.target.value.toLowerCase()));
}

/**
 * Gestisce l'attivazione/disattivazione visiva di un gruppo di tab/pulsanti.
 * @param {NodeList|Array} buttons 
 * @param {string} activeClass 
 * @param {string} inactiveClass 
 * @param {Function} onSelect 
 */
export function bindTabGroup(buttons, activeClass, inactiveClass, onSelect) {
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            buttons.forEach(b => {
                b.className = b.className.replace(activeClass, '').trim();
                if (!b.className.includes(inactiveClass)) {
                    b.className += ` ${inactiveClass}`;
                }
            });
            e.currentTarget.className = e.currentTarget.className.replace(inactiveClass, '').trim() + ` ${activeClass}`;
            if (onSelect) onSelect(e.currentTarget);
        });
    });
}

/**
 * Controller Parametrico DRY per la gestione animata dei Drawer (Sidebar SX e DX)
 */
export class DrawerController {
    constructor({ element, width = '280px', direction = 'left', isOpen = true, onToggle }) {
        this.element = element;
        this.width = width;
        this.direction = direction; // 'left' o 'right'
        this.isOpen = isOpen;
        this.onToggle = onToggle;
        
        this.init();
    }

    init() {
        if (!this.element) return;
        this.element.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
        this.element.style.overflow = 'hidden';
        this.element.style.flexShrink = '0';
        this.setOpen(this.isOpen, false);
    }

    setOpen(open, animate = true) {
        this.isOpen = open;
        if (!this.element) return;

        if (!animate) {
            this.element.style.transition = 'none';
        } else {
            this.element.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
        }

        if (open) {
            this.element.style.display = 'flex';
            void this.element.offsetWidth;
            this.element.style.width = this.width;
            this.element.style.opacity = '1';
            this.element.style.pointerEvents = 'auto';
        } else {
            this.element.style.width = '0px';
            this.element.style.opacity = '0';
            this.element.style.pointerEvents = 'none';
            if (animate) {
                setTimeout(() => {
                    if (!this.isOpen && this.element) this.element.style.display = 'none';
                }, 310);
            } else {
                this.element.style.display = 'none';
            }
        }

        if (!animate) {
            setTimeout(() => {
                if (this.element) this.element.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
            }, 50);
        }

        if (this.onToggle) this.onToggle(this.isOpen);

        // Notifica il ridimensionamento a xterm.js
        setTimeout(() => window.dispatchEvent(new Event('resize')), 320);
    }

    toggle() {
        this.setOpen(!this.isOpen);
    }
}

/**
 * Componente Padre Parametrico per la struttura visiva delle Sidebar (Progetti & MCP Apps)
 */
export class BaseSidebarComponent {
    constructor({ containerEl, title, icon = '', width = '280px' }) {
        this.container = containerEl;
        this.title = title;
        this.icon = icon;
        this.width = width;
    }

    renderShell({ searchHtml = '', contentHtml = '', footerHtml = '' }) {
        this.container.innerHTML = `
            <div class="flex flex-col h-full w-[${this.width}] border-2 border-black bg-white shadow-[6px_6px_0px_#000] shrink-0 overflow-hidden font-body">
                <!-- Header Unificato -->
                <div class="sidebar-header p-4 border-b-2 border-black flex justify-between items-center bg-white shrink-0">
                    <h2 class="text-xl font-headline font-bold uppercase tracking-tight text-[#1a1c1c] flex items-center gap-2">
                        ${this.icon ? `<span class="text-lg">${this.icon}</span>` : ''}
                        <span>${this.title}</span>
                    </h2>
                </div>

                <!-- Sub-Header / Ricerca / App Selector -->
                ${searchHtml}

                <!-- Contenuto Principale -->
                <div id="sidebar-main-content" class="sidebar-content flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                    ${contentHtml}
                </div>

                <!-- Footer (Opzionale) -->
                ${footerHtml}
            </div>
        `;
    }
}

