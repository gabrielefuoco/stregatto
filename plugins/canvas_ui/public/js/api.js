// api.js - Cheshire Cat REST & SSE API Helper
import { getSession } from './auth.js';
const API_BASE = '';

export class CatAPI {
    static async fetch(endpoint, options = {}) {
        const session = await getSession();
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
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
        const res = await this.fetch(url);
        // /chats returns Page[ChatSelect] { items: [...], cursor: "" }
        if (res && Array.isArray(res.items)) {
            return res.items;
        }
        return Array.isArray(res) ? res : [];
    }

    static async getChat(chatId) {
        return this.fetch(`/chats/${chatId}`);
    }

    static async createChat(name = "Nuova Chat") {
        return this.fetch('/chats', { 
            method: 'POST',
            body: JSON.stringify({ name, messages: [], context: {} })
        });
    }

    static async deleteChat(chatId) {
        return this.fetch(`/chats/${chatId}`, { method: 'DELETE' });
    }

    static async uploadFile(file) {
        const url = `${API_BASE}/uploads`;
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                body: formData
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
        const session = await getSession();
        const url = `${API_BASE}/agents/${agentSlug}/message`;
        const headers = { 
            'Content-Type': 'application/json',
            ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        };
        
        const messages = Array.isArray(messagesPayload)
            ? messagesPayload
            : (typeof messagesPayload === 'string'
                ? [{ role: 'user', content: [{ type: 'text', text: messagesPayload }] }]
                : [messagesPayload]);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    messages: messages,
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
                
                buffer = lines[lines.length - 1];

                for (let i = 0; i < lines.length - 1; i++) {
                    let cleaned = lines[i].replace(/^(data:|event:)\s*/gm, "").trim();
                    if (cleaned) {
                        try {
                            const event = JSON.parse(cleaned);
                            onEvent(event);
                        } catch (e) {
                            console.error("[api.js] Error parsing SSE JSON:", e, cleaned);
                        }
                    }
                }
            }
            
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
        const res = await this.fetch('/agents');
        return Array.isArray(res) ? res : (res?.agents || []);
    }
    
    // --- MODELS ---
    static async getModels() {
        try {
            const settingsRes = await this.getSettings();
            const settings = Array.isArray(settingsRes) ? settingsRes : (settingsRes?.settings || []);
            
            for (const setting of settings) {
                const schemaProps = setting.schema?.properties || {};
                if (schemaProps.default_llm) {
                    const propSchema = schemaProps.default_llm;
                    const enums = propSchema.enum || (propSchema.anyOf && propSchema.anyOf.find(a => a.enum)?.enum);
                    if (Array.isArray(enums) && enums.length > 0) {
                        return enums.map(modelId => ({
                            id: modelId,
                            name: modelId
                        }));
                    }
                }
            }
        } catch (e) {
            console.warn("Could not fetch models from Core Settings:", e);
        }

        // Fallback if settings query fails
        try {
            const res = await this.fetch('/llms');
            if (Array.isArray(res) && res.length > 0) return res;
        } catch (e) {}

        return [
            { id: "gpt-4o", name: "GPT-4o" },
            { id: "gpt-4o-mini", name: "GPT-4o Mini" }
        ];
    }
    
    // --- SETTINGS ---
    static async getSettings() {
        const res = await this.fetch('/settings');
        return Array.isArray(res) ? res : (res?.settings || []);
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
        const res = await this.fetch('/plugins');
        return Array.isArray(res) ? res : (res?.installed || []);
    }

    static async togglePlugin(pluginId) {
        return this.fetch(`/plugins/${pluginId}/toggle`, { method: 'PUT' });
    }
}
