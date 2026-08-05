// i18n.js
const dictionaries = {
    en: {
        "title": "Antigravity Canvas",
        "chat_placeholder": "Type your message to the agent...",
        "btn_send": "Send",
        "btn_theme": "Toggle Theme",
        "btn_lang": "IT",
        "empty_chat": "No messages yet. Say hello!",
        "canvas_title": "Code Canvas",
        "canvas_empty": "Code blocks will appear here."
    },
    it: {
        "title": "Canvas Antigravity",
        "chat_placeholder": "Scrivi il tuo messaggio all'agente...",
        "btn_send": "Invia",
        "btn_theme": "Cambia Tema",
        "btn_lang": "EN",
        "empty_chat": "Nessun messaggio. Saluta il gatto!",
        "canvas_title": "Canvas del Codice",
        "canvas_empty": "I blocchi di codice appariranno qui."
    }
};

let currentLang = 'it'; // Default language

export function setLanguage(lang) {
    if (dictionaries[lang]) {
        currentLang = lang;
        translatePage();
    }
}

export function getLanguage() {
    return currentLang;
}

export function t(key) {
    return dictionaries[currentLang][key] || key;
}

export function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        
        // Handle placeholders specially
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = t(key);
        } else {
            el.textContent = t(key);
        }
    });
}
