// router.js - App Navigation & Route Handler
import { CatAPI } from './api.js';
import { getSession } from './auth.js';

const CACHE_BUSTER = '?v=' + new Date().getTime();

async function importView(path) {
    return await import(path + CACHE_BUSTER);
}

const appContainer = document.getElementById('app-container');

// Map hashes to route definitions
const routes = {
    '#login': { module: './view_login.js', func: 'renderLoginView' },
    '#register': { module: './view_register.js', func: 'renderRegisterView' },
    '#chat': { module: './view_chat.js', func: 'renderChatView' },
    '#agents': { module: './view_agents.js', func: 'renderAgentsView' },
    '#history': { module: './view_history.js', func: 'renderHistoryView' },
    '#plugins': { module: './view_plugins.js', func: 'renderPluginsView' },
    '#settings': { module: './view_settings.js', func: 'renderSettingsView' }
};

export async function loadRecentSidebarChats() {
    const container = document.getElementById('recent-chats-list');
    if (!container) return;

    try {
        const chats = await CatAPI.getChats();
        if (!chats || chats.length === 0) {
            container.innerHTML = `<span class="px-md py-xs text-xs text-secondary italic">Nessuna chat recente</span>`;
            return;
        }

        // Show max 5 recent chats
        const recent = Array.isArray(chats) ? chats.slice(0, 5) : [];
        container.innerHTML = recent.map(chat => {
            const title = chat.name || chat.title || chat.id || 'Chat';
            const chatId = chat.id || chat.chat_id;
            return `
                <a href="#chat?id=${encodeURIComponent(chatId)}" 
                   class="px-md py-xs text-left text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors truncate font-label-md text-label-md block"
                   title="${title}">
                    ${title}
                </a>
            `;
        }).join('');
    } catch (err) {
        console.warn("Error loading recent chats:", err);
        container.innerHTML = `<span class="px-md py-xs text-xs text-secondary italic">Nessuna chat recente</span>`;
    }
}

async function handleRoute() {
    let rawHash = window.location.hash || '#chat';
    let baseHash = rawHash.split('?')[0];

    const session = await getSession();
    const localToken = localStorage.getItem('stregatto_auth_token');
    const isAuthenticated = !!(session || localToken);
    const leftSidebar = document.getElementById('left-sidebar');

    const isPublicRoute = (baseHash === '#login' || baseHash === '#register');

    if (!isAuthenticated && !isPublicRoute) {
        window.location.hash = '#login';
        return;
    }

    if (isAuthenticated && isPublicRoute) {
        window.location.hash = '#chat';
        return;
    }

    if (leftSidebar) {
        if (!isAuthenticated) {
            leftSidebar.style.display = 'none'; // Hide sidebar on login page
        } else {
            leftSidebar.style.display = '';
        }
    }

    if (!routes[baseHash]) {
        window.location.hash = session ? '#chat' : '#login';
        return;
    }

    // Update Navigation highlighting in Left Sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkHash = link.getAttribute('href')?.split('?')[0];
        if (linkHash === baseHash) {
            link.classList.add('bg-surface-variant', 'border-on-surface', 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]', 'text-on-surface');
            link.classList.remove('text-on-surface-variant', 'border-transparent');
        } else {
            link.classList.remove('bg-surface-variant', 'border-on-surface', 'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]', 'text-on-surface');
            link.classList.add('text-on-surface-variant', 'border-transparent');
        }
    });

    // Clear main container and render view
    appContainer.innerHTML = '';
    
    try {
        const routeDef = routes[baseHash];
        const module = await importView(routeDef.module);
        const renderFunc = module[routeDef.func];
        const viewElement = await renderFunc();
        
        // Anti-race-condition: check if hash changed while we were fetching/rendering
        if (window.location.hash.split('?')[0] === baseHash) {
            appContainer.innerHTML = '';
            appContainer.appendChild(viewElement);
        }
    } catch (e) {
        console.error("Router error:", e);
        if (window.location.hash.split('?')[0] === baseHash) {
            appContainer.innerHTML = `
                <div class="p-lg text-error font-mono text-sm border-2 border-on-surface m-lg bg-surface-container-lowest shadow-hard">
                    <h1 class="font-headline-md font-bold mb-sm">Errore Frontend</h1>
                    <p>${e.message}</p>
                    <pre class="mt-md p-sm bg-surface-container overflow-x-auto">${e.stack}</pre>
                </div>
            `;
        }
    }

    // Refresh recent sidebar chats list
    loadRecentSidebarChats();
}

function setupGlobalHandlers() {
    const leftSidebar = document.getElementById('left-sidebar');
    const leftSidebarToggle = document.getElementById('left-sidebar-toggle');
    const leftResizer = document.getElementById('left-sidebar-resizer');

    // Restore saved left sidebar width
    const savedLeftWidth = localStorage.getItem('stregatto_left_sidebar_width');
    if (savedLeftWidth && leftSidebar && leftSidebar.classList.contains('sidebar-expanded')) {
        leftSidebar.style.width = savedLeftWidth;
    }

    if (leftSidebarToggle && leftSidebar) {
        leftSidebarToggle.addEventListener('click', () => {
            const isCollapsing = leftSidebar.classList.contains('sidebar-expanded');
            leftSidebar.classList.toggle('sidebar-expanded');
            leftSidebar.classList.toggle('sidebar-collapsed');

            const texts = leftSidebar.querySelectorAll('.sidebar-text');
            texts.forEach(text => text.classList.toggle('hidden'));

            if (isCollapsing) {
                leftSidebar.style.width = '';
            } else {
                const w = localStorage.getItem('stregatto_left_sidebar_width');
                if (w) leftSidebar.style.width = w;
            }
        });
    }

    // Resizable Left Sidebar drag handle
    if (leftResizer && leftSidebar) {
        let isResizing = false;

        leftResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (leftSidebar.classList.contains('sidebar-collapsed')) return;
            isResizing = true;
            leftSidebar.classList.remove('sidebar-transition');
            document.body.classList.add('select-none');
            document.body.style.cursor = 'col-resize';
        });

        window.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newWidth = e.clientX - leftSidebar.getBoundingClientRect().left;
            if (newWidth < 180) newWidth = 180;
            if (newWidth > Math.min(600, window.innerWidth * 0.45)) newWidth = Math.min(600, window.innerWidth * 0.45);
            leftSidebar.style.width = `${newWidth}px`;
            localStorage.setItem('stregatto_left_sidebar_width', `${newWidth}px`);
        });

        window.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                leftSidebar.classList.add('sidebar-transition');
                document.body.classList.remove('select-none');
                document.body.style.cursor = '';
            }
        });
    }

    // Mouse movement listener for Blueprint Dot Grid spotlight effect
    window.addEventListener('mousemove', (e) => {
        const blueprints = document.querySelectorAll('.bg-blueprint');
        blueprints.forEach(bp => {
            const rect = bp.getBoundingClientRect();
            bp.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            bp.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        });
    }, { passive: true });

    // "New Chat" button handler - force reload/re-render even if already on #chat
    const btnNewChat = document.getElementById('nav-btn-new-chat');
    if (btnNewChat) {
        btnNewChat.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.location.hash === '#chat') {
                handleRoute();
            } else {
                window.location.hash = '#chat';
            }
        });
    }
}

export function initApp() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    // Setup Logout Button
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const { signOut } = await import('./auth.js');
            await signOut();
            // AuthStateChange listener handles redirection
        });
    }

    setupGlobalHandlers();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
