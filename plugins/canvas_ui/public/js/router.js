// router.js
const CACHE_BUSTER = '?v=' + new Date().getTime();

async function importView(path) {
    const module = await import(path + CACHE_BUSTER);
    return module;
}

const appContainer = document.getElementById('app-container');

// Map hashes to route definitions
const routes = {
    '#chat': { module: './view_chat.js', func: 'renderChatView' },
    '#plugins': { module: './view_plugins.js', func: 'renderPluginsView' },
    '#settings': { module: './view_settings.js', func: 'renderSettingsView' }
};

async function handleRoute() {
    let hash = window.location.hash;
    if (!routes[hash]) {
        // Default route
        window.location.hash = '#chat';
        return;
    }

    // Update Navigation highlighting
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === hash) {
            link.classList.add('text-[var(--accent-color)]');
            link.classList.remove('text-[var(--text-secondary)]');
        } else {
            link.classList.remove('text-[var(--accent-color)]');
            link.classList.add('text-[var(--text-secondary)]');
        }
    });

    // Clear Container
    appContainer.innerHTML = '';
    
    // Render the new view
    try {
        const routeDef = routes[hash];
        const module = await importView(routeDef.module);
        const renderFunc = module[routeDef.func];
        const viewElement = await renderFunc();
        appContainer.appendChild(viewElement);

        // Re-initialize icons in the newly added DOM
        if (window.lucide) {
            window.lucide.createIcons();
        }
    } catch (e) {
        console.error(e);
        appContainer.innerHTML = `<div class="p-8 text-red-500 font-mono text-sm whitespace-pre-wrap"><h1>Frontend Error</h1>${e.message}\n${e.stack}</div>`;
    }
}

// Global UI Handlers
function setupGlobalHandlers() {
    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
        btnTheme.addEventListener('click', () => {
            const root = document.documentElement;
            const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', newTheme);
        });
    }

    const btnGlobalToggle = document.getElementById('btn-global-sidebar-toggle');
    if (btnGlobalToggle) {
        btnGlobalToggle.addEventListener('click', () => {
            const historyPanel = document.getElementById('history-panel');
            if (historyPanel) {
                if (historyPanel.classList.contains('hidden')) {
                    historyPanel.classList.remove('hidden');
                    historyPanel.classList.add('flex');
                } else {
                    historyPanel.classList.add('hidden');
                    historyPanel.classList.remove('flex');
                }
            }
        });
    }
}

function initApp() {
    setupGlobalHandlers();
    handleRoute();
}

// Start router
window.addEventListener('hashchange', handleRoute);
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
