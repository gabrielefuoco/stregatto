// api.js
const API_BASE = '';

export class CatAPI {
    static async fetch(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        try {
            const response = await fetch(url, { credentials: 'include', ...options, headers });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error: ${response.status} - ${text}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Fetch error on ${endpoint}:`, error);
            throw error;
        }
    }

    // --- CHATS ---
    static async getChats(search = '') {
        const url = search ? `/chats?search=${encodeURIComponent(search)}` : '/chats';
        return this.fetch(url);
    }

    static async getChat(chatId) {
        return this.fetch(`/chats/${chatId}`);
    }

    static async uploadFile(file) {
        const url = `${API_BASE}/uploads`;
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                body: formData // No Content-Type, fetch sets it automatically with boundary for FormData
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Upload Error: ${response.status} - ${text}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Upload failed:", error);
            throw error;
        }
    }

    static async createChat() {
        return this.fetch('/chats', { method: 'POST' });
    }
    
    // Send a message via REST (no streaming)
    static async sendMessage(text, agentSlug = 'default') {
        return this.fetch(`/agents/${agentSlug}/message`, {
            method: 'POST',
            body: JSON.stringify({
                messages: [{ 
                    role: 'user', 
                    content: [{ type: "text", text: text }] 
                }],
                stream: false
            })
        });
    }

    // Send a message and stream the response via SSE
    static async streamMessage(messagesPayload, agentSlug = 'default', onEvent) {
        const url = `${API_BASE}/agents/${agentSlug}/message`;
        const headers = { 'Content-Type': 'application/json' };
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    messages: Array.isArray(messagesPayload) ? messagesPayload : [{ role: 'user', content: [{ type: "text", text: messagesPayload }] }],
                    stream: true
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                
                // Keep the last (possibly partial) line in the buffer
                buffer = lines[lines.length - 1];

                for (let i = 0; i < lines.length - 1; i++) {
                    let cleaned = lines[i].replace(/^(data:|event:)\s*/gm, "").trim();
                    if (cleaned) {
                        try {
                            const event = JSON.parse(cleaned);
                            console.log("[api.js] Parsed SSE event:", event.type, event);
                            onEvent(event);
                        } catch (e) {
                            console.error("[api.js] Error parsing SSE JSON:", e, cleaned);
                        }
                    }
                }
            }
            // Flush any remaining buffer
            if (buffer.trim()) {
                let cleaned = buffer.replace(/^(data:|event:)\s*/gm, "").trim();
                if (cleaned) {
                    try {
                        onEvent(JSON.parse(cleaned));
                    } catch(e) {}
                }
            }
        } catch (error) {
            console.error("Streaming error:", error);
            throw error;
        }
    }
    
    // --- AGENTS ---
    static async getAgents() {
        return this.fetch('/agents');
    }
    
    // --- SETTINGS ---
    static async getSettings() {
        return this.fetch('/settings');
    }

    static async getSetting(settingId) {
        return this.fetch(`/settings/${settingId}`);
    }

    static async updateSetting(settingId, payload) {
        return this.fetch(`/settings/${settingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }

    // --- PLUGINS ---
    static async getPlugins() {
        return this.fetch('/plugins');
    }

    static async togglePlugin(pluginId) {
        return this.fetch(`/plugins/${pluginId}/toggle`, { method: 'PUT' });
    }
}
