
// ==UserScript==
// @name           WarSoul-Tools
// @namespace      WarSoul-Tools
// @version        0.1.0
// @author         BKN46
// @description    WarSoul实用工具
// @icon           https://www.milkywayidle.com/favicon.svg
// @include        https://aring.cc/awakening-of-war-soul-ol/
// @match          https://aring.cc/awakening-of-war-soul-ol/*
// @license        GPL-3.0
// ==/UserScript==
(function () {
  'use strict';

  function removeLeadingNumbers(str) {
    return str.replace(/^\d+/, '');
  }
  function logMessage(message) {
    console.log("[WarSoul-Tools]", message);
  }

  // 监听页面可见性变化
  document.addEventListener('visibilitychange', function () {
  });
  function hookWS() {
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
      Object.defineProperty(this, "data", {
        value: message
      }); // Anti-loop

      try {
        return handleMessage(message);
      } catch (error) {
        console.log("Error in handleMessage:", error);
        return message;
      }
    }
  }
  const messageHandlers = [];
  const pendingRequests = new Map(); // 存储待处理的请求

  function handleMessage(message) {
    let obj;
    try {
      obj = JSON.parse(removeLeadingNumbers(message));
    } catch (error) {
      return message;
    }
    for (let {
      regex,
      handler
    } of messageHandlers) {
      if (regex.test(message)) {
        try {
          obj = handler(obj) || obj;
        } catch (error) {
          logMessage(`Error in handler for ${obj.cmd}:`);
        }
      }
    }
    return message;
  }
  function registMessageHandler(regex, handler) {
    messageHandlers.push({
      regex,
      handler
    });
  }
  function hookHTTP() {
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      const [url, options] = args;
      const requestId = generateRequestId();

      // Log request details for socket.io endpoints
      if (url && url.includes('api.aring.cc')) {
        // 存储请求信息
        pendingRequests.set(requestId, {
          url: url,
          method: options?.method || 'GET',
          body: options?.body,
          headers: options?.headers,
          timestamp: Date.now(),
          type: 'fetch'
        });
      }
      return originalFetch.apply(this, args).then(response => {
        if (response.url && response.url.includes('api.aring.cc')) {
          // Clone response to avoid consuming the stream
          const clonedResponse = response.clone();
          clonedResponse.text().then(data => {
            // Handle Socket.IO polling messages
            if (data) {
              try {
                const requestInfo = pendingRequests.get(requestId);
                handleSocketIOMessage(data, requestInfo);
                // 清理已处理的请求
                pendingRequests.delete(requestId);
              } catch (error) {
                // logMessage('Error handling Socket.IO message: ' + error);
              }
            }
          }).catch(error => {
            // logMessage('Error reading fetch response: ' + error);
            pendingRequests.delete(requestId);
          });
        }
        return response;
      });
    };
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...args) {
      this._method = method;
      this._url = url;
      return originalXHROpen.call(this, method, url, ...args);
    };
    XMLHttpRequest.prototype.send = function (data) {
      const requestId = generateRequestId();
      this._requestId = requestId;
      if (this._url && this._url.includes('api.aring.cc')) {
        // 存储请求信息
        pendingRequests.set(requestId, {
          url: this._url,
          method: this._method,
          body: data,
          timestamp: Date.now(),
          type: 'xhr'
        });
        this.addEventListener('load', function () {
          // Handle Socket.IO polling messages
          if (this.responseText) {
            try {
              const requestInfo = pendingRequests.get(requestId);
              handleSocketIOMessage(this.responseText, requestInfo);
              pendingRequests.delete(requestId);
            } catch (error) {
              logMessage('Error handling http message: ' + error);
            }
          }
        });
        this.addEventListener('error', function () {
          pendingRequests.delete(requestId);
        });
      }
      return originalXHRSend.call(this, data);
    };
  }
  function handleSocketIOMessage(message, requestInfo = null) {
    // Socket.IO messages often start with packet type numbers (0, 1, 2, 3, 4, etc.)
    // 0 = open, 1 = close, 2 = ping, 3 = pong, 4 = message
    if (typeof message === 'string' && message.length > 0) {
      // Try to extract JSON payload from Socket.IO message
      const jsonMatch = message.match(/^\d*(.*)$/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          // Process the message through existing handlers
          for (let {
            urlRegex,
            bodyRegex,
            resBodyRegex,
            handler
          } of httpRequestHandlers) {
            // if ((jsonMatch[1] || '').includes('面甲')) {
            //     debugger;
            // }
            if (urlRegex.test(requestInfo?.url || '') && bodyRegex.test(requestInfo?.body || '') && resBodyRegex.test(message || '')) {
              try {
                handler(jsonData);
              } catch (error) {
                logMessage(`Error in http handler: [${handler}] ${requestInfo?.body} ${error}`);
              }
            }
          }
        } catch (error) {}
      }
    }
  }
  const httpRequestHandlers = [];
  function registHTTPRequestHandler(urlRegex, bodyRegex, resBodyRegex, handler) {
    httpRequestHandlers.push({
      urlRegex,
      bodyRegex,
      resBodyRegex,
      handler
    });
  }

  // 生成唯一的请求ID
  function generateRequestId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // 清理超时的请求记录
  setInterval(() => {
    const now = Date.now();
    for (let [id, request] of pendingRequests.entries()) {
      if (now - request.timestamp > 30000) {
        // 30秒超时
        pendingRequests.delete(id);
      }
    }
  }, 10000); // 每10秒清理一次

  const equipmentsData = {};
  registHTTPRequestHandler(/awakening-of-war-soul-ol\/socket\.io/, /.*/, /^430.+/, res => {
    Object.assign(equipmentsData, res[0].data);
    logMessage(`Equipments Data Updated, total ${Object.keys(equipmentsData).length} items`);
    return res;
  });

  const characterInfo = {};
  registMessageHandler(/^434/, obj => {
    Object.assign(characterInfo, obj[0].data);
    logMessage(`Character Info Updated ${characterInfo.id}`);
    return obj;
  });

  hookWS();
  hookHTTP();
  logMessage("WarSoul-Tools loaded.");

})();
