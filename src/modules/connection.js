import { removeLeadingNumbers, logMessage } from "./utils";

let isPageHidden = false;

// 监听页面可见性变化
document.addEventListener('visibilitychange', function() {
    isPageHidden = document.hidden;
    if (isPageHidden) {
        clearProjectiles();
        clearEffects();
    }
});

export function hookWS() {
    const dataProperty = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
    const oriGet = dataProperty.get;

    dataProperty.get = hookedGet;
    Object.defineProperty(MessageEvent.prototype, "data", dataProperty);

    function hookedGet() {
        const socket = this.currentTarget;
        if (!(socket instanceof WebSocket)) {
            return oriGet.call(this);
        }
        if (socket.url.indexOf("api.aring.cc") <= -1) {
            return oriGet.call(this);
        }

        const message = oriGet.call(this);
        Object.defineProperty(this, "data", { value: message }); // Anti-loop

        try {
            return handleMessage(message);
        } catch (error) {
            console.log("Error in handleMessage:", error);
            return message;
        }
    }
}

const messageHandlers = [];

function handleMessage(message) {
    let obj;
    try {
        obj = JSON.parse(removeLeadingNumbers(message));
    } catch (error) {
        return message;
    }

    for (let { regex, handler } of messageHandlers) {
        if (regex.test(message)) {
            try {
                obj = handler(obj) || obj;
            } catch (error) {
                logMessage(`Error in handler for ${obj.cmd}:`, error);
            }
        }
    }

    return message;
}

export function registMessageHandler(regex, handler) {
    messageHandlers.push({ regex, handler });
}

export function hookHTTP() {
    const originalFetch = window.fetch;
    
    window.fetch = function(...args) {
        const [url, options] = args;
        
        // Log request details for socket.io endpoints
        if (url && url.includes('api.aring.cc')) {
            // logMessage('Fetch request to socket.io: ' + JSON.stringify({
            //     url: url,
            //     method: options?.method || 'GET',
            //     body: options?.body,
            //     headers: options?.headers
            // }));
        }
        
        return originalFetch.apply(this, args).then(response => {
            if (response.url && response.url.includes('api.aring.cc')) {
                // Clone response to avoid consuming the stream
                const clonedResponse = response.clone();
                clonedResponse.text().then(data => {
                    // logMessage('Fetch response from socket.io: ' + JSON.stringify({
                    //     url: response.url,
                    //     status: response.status,
                    //     data: data
                    // }));
                    
                    // Handle Socket.IO polling messages
                    if (data) {
                        try {
                            handleSocketIOMessage(data);
                        } catch (error) {
                            // logMessage('Error handling Socket.IO message: ' + error);
                        }
                    }
                }).catch(error => {
                    // logMessage('Error reading fetch response: ' + error);
                });
            }
            return response;
        });
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._method = method;
        this._url = url;
        return originalXHROpen.call(this, method, url, ...args);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
        if (this._url && this._url.includes('api.aring.cc')) {
            // logMessage('XHR request to socket.io: ' + JSON.stringify({
            //     method: this._method,
            //     url: this._url,
            //     data: data
            // }));
            
            this.addEventListener('load', function() {
                // logMessage('XHR response from socket.io: ' + JSON.stringify({
                //     status: this.status,
                //     url: this._url,
                //     response: this.responseText
                // }));
                
                // Handle Socket.IO polling messages
                if (this.responseText) {
                    try {
                        handleSocketIOMessage(this.responseText);
                    } catch (error) {
                        // logMessage('Error handling Socket.IO message: ' + error);
                    }
                }
            });
            
            this.addEventListener('error', function() {
                // logMessage('XHR error for socket.io request: ' + this._url);
            });
        }
        return originalXHRSend.call(this, data);
    };
}

function handleSocketIOMessage(message) {
    // Socket.IO messages often start with packet type numbers (0, 1, 2, 3, 4, etc.)
    // 0 = open, 1 = close, 2 = ping, 3 = pong, 4 = message
    if (typeof message === 'string' && message.length > 0) {
        // logMessage('Processing Socket.IO message: ' + message);
        
        // Try to extract JSON payload from Socket.IO message
        const jsonMatch = message.match(/^\d*(.*)$/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                const jsonData = JSON.parse(jsonMatch[1]);
                // logMessage('Extracted JSON from Socket.IO message: ' + JSON.stringify(jsonData));
                
                // Process the message through existing handlers
                for (let { regex, handler } of messageHandlers) {
                    if (regex.test(message)) {
                        try {
                            handler(jsonData);
                        } catch (error) {
                            // logMessage('Error in Socket.IO handler: ' + error);
                        }
                    }
                }
            } catch (error) {
                // Not JSON, might be a simple message
                // logMessage('Non-JSON Socket.IO message: ' + message);
            }
        }
    }
}