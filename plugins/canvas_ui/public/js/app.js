// app.js
import { CatClient } from './cat_client.js';
import { setLanguage, getLanguage, translatePage } from './i18n.js';

// CodeMirror imports (Zero-Build via esm.sh)
import { EditorState } from "https://esm.sh/@codemirror/state";
import { EditorView, keymap } from "https://esm.sh/@codemirror/view";
import { defaultKeymap } from "https://esm.sh/@codemirror/commands";
import { javascript } from "https://esm.sh/@codemirror/lang-javascript";
import { python } from "https://esm.sh/@codemirror/lang-python";
import { oneDark } from "https://esm.sh/@codemirror/theme-one-dark";
import { basicSetup } from "https://esm.sh/codemirror";

// DOM Elements
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const messagesContainer = document.getElementById('messages-container');
const emptyState = document.getElementById('empty-state');
const btnTheme = document.getElementById('btn-theme');
const btnLang = document.getElementById('btn-lang');
const canvasPanel = document.getElementById('canvas-panel');
const btnCloseCanvas = document.getElementById('btn-close-canvas');
const editorHost = document.getElementById('editor-host');
const editorEmpty = document.getElementById('editor-empty');

// State
let cat = new CatClient();
let editorView = null;
let currentCode = "";

// Initialize
function init() {
    translatePage();
    setupEventListeners();
    initCodeMirror();
    
    // Connect to Cheshire Cat
    cat.connect().catch(err => console.error("Failed to connect", err));
    
    // Listen to Cat events
    cat.on('chat', handleAgentMessage);
    cat.on('error', (err) => appendMessage('System', 'Error: ' + (err.error || 'Unknown error'), true));
}

// UI Event Listeners
function setupEventListeners() {
    // Theme Toggle
    btnTheme.addEventListener('click', () => {
        const root = document.documentElement;
        const newTheme = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', newTheme);
    });

    // Language Toggle
    btnLang.addEventListener('click', () => {
        const newLang = getLanguage() === 'it' ? 'en' : 'it';
        setLanguage(newLang);
        btnLang.textContent = newLang.toUpperCase();
    });

    // Chat form submit
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage('User', text, false);
        cat.send(text);
        
        chatInput.value = '';
        chatInput.style.height = 'auto'; // reset height
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Enter to send (Shift+Enter for newline)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });

    // Mobile Canvas Close
    if(btnCloseCanvas) {
        btnCloseCanvas.addEventListener('click', () => {
            canvasPanel.classList.add('translate-x-full');
            setTimeout(() => {
                canvasPanel.classList.add('hidden');
                canvasPanel.classList.remove('flex');
            }, 300);
        });
    }
}

function initCodeMirror() {
    let state = EditorState.create({
        doc: "",
        extensions: [
            basicSetup,
            keymap.of(defaultKeymap),
            javascript(),
            oneDark
        ]
    });

    editorView = new EditorView({
        state,
        parent: editorHost
    });
}

function updateCanvas(code) {
    if (!editorView) return;
    
    // Show Canvas on mobile if hidden
    canvasPanel.classList.remove('hidden');
    canvasPanel.classList.add('flex');
    setTimeout(() => canvasPanel.classList.remove('translate-x-full'), 10);

    editorEmpty.classList.add('hidden');
    editorHost.classList.remove('hidden');

    const transaction = editorView.state.update({
        changes: {from: 0, to: editorView.state.doc.length, insert: code}
    });
    editorView.dispatch(transaction);
}

function appendMessage(sender, text, isError = false) {
    if (emptyState) emptyState.style.display = 'none';

    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col max-w-[85%] ${sender === 'User' ? 'self-end' : 'self-start'}`;
    
    const bubble = document.createElement('div');
    bubble.className = `p-4 rounded-xl shadow-sm ${sender === 'User' ? 'rounded-br-none' : 'rounded-bl-none'} ${isError ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'markdown-body'}`;
    
    if (sender === 'User') {
        bubble.style.backgroundColor = 'var(--msg-user)';
        bubble.textContent = text; // Plain text for user
    } else {
        bubble.style.backgroundColor = 'var(--msg-agent)';
        
        // Very basic extraction of the first markdown code block for the Canvas
        const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/;
        const match = text.match(codeBlockRegex);
        if (match && match[1]) {
            updateCanvas(match[1]);
        }
        
        // Parse markdown safely
        const rawHtml = marked.parse(text);
        bubble.innerHTML = DOMPurify.sanitize(rawHtml, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'class', 'width', 'height'] });
    }

    const label = document.createElement('span');
    label.className = `text-xs mt-1 text-[var(--text-secondary)] ${sender === 'User' ? 'text-right' : 'text-left'}`;
    label.textContent = sender;

    msgDiv.appendChild(bubble);
    msgDiv.appendChild(label);
    messagesContainer.appendChild(msgDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleAgentMessage(data) {
    // The Cat sends 'chat' events with the final message in data.text
    appendMessage('Cat', data.text || data.content || JSON.stringify(data));
}

// Start
document.addEventListener('DOMContentLoaded', init);
