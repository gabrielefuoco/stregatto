// cat_client.js
export class CatClient {
    constructor(url = 'ws://localhost:1865/ws/default') {
        this.url = url;
        this.ws = null;
        this.mcpWs = null;
        this.handlers = {
            'chat_token': [],
            'chat': [],
            'error': [],
            'notification': [],
            'mcp_event': []
        };
        this.isConnected = false;
        this.messageId = 1;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                this.isConnected = true;
                console.log('Connected to Cheshire Cat');
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const type = data.type;
                    if (this.handlers[type]) {
                        this.handlers[type].forEach(cb => cb(data));
                    }
                } catch (e) {
                    console.error("Error parsing WS message:", e);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket Error:', error);
                if (!this.isConnected) reject(error);
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                console.log('Disconnected from Cheshire Cat');
                // Reconnect logic could go here
            };
        });
    }

    connectMCP(mcpUrl = 'ws://localhost:1865/mcp_client/ws/mcp-events') {
        return new Promise((resolve, reject) => {
            this.mcpWs = new WebSocket(mcpUrl);

            this.mcpWs.onopen = () => {
                console.log('Connected to MCP Events channel');
                resolve();
            };

            this.mcpWs.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.type) {
                        if (this.handlers['mcp_event']) {
                            this.handlers['mcp_event'].forEach(cb => cb(data));
                        }
                    }
                } catch (e) {
                    console.error("Error parsing MCP WS message:", e);
                }
            };

            this.mcpWs.onerror = (error) => {
                console.error('MCP WebSocket Error:', error);
                reject(error);
            };
        });
    }

    on(event, callback) {
        if (this.handlers[event]) {
            this.handlers[event].push(callback);
        }
    }

    send(text) {
        if (!this.isConnected) {
            console.error('Cannot send message: Not connected');
            return;
        }
        
        const message = {
            text: text
        };
        
        this.ws.send(JSON.stringify(message));
    }
}
