
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
  function saveToLocalStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }
  function loadFromLocalStorage(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      return defaultValue;
    }
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
          logMessage(`Error in WS handler for ${obj.regex}:`);
          logMessage(error);
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

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  var check = function (it) {
    return it && it.Math == Math && it;
  };

  // https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
  var global$c =
    // eslint-disable-next-line es/no-global-this -- safe
    check(typeof globalThis == 'object' && globalThis) ||
    check(typeof window == 'object' && window) ||
    // eslint-disable-next-line no-restricted-globals -- safe
    check(typeof self == 'object' && self) ||
    check(typeof commonjsGlobal == 'object' && commonjsGlobal) ||
    // eslint-disable-next-line no-new-func -- fallback
    (function () { return this; })() || Function('return this')();

  var objectGetOwnPropertyDescriptor = {};

  var fails$8 = function (exec) {
    try {
      return !!exec();
    } catch (error) {
      return true;
    }
  };

  var fails$7 = fails$8;

  // Detect IE8's incomplete defineProperty implementation
  var descriptors = !fails$7(function () {
    // eslint-disable-next-line es/no-object-defineproperty -- required for testing
    return Object.defineProperty({}, 1, { get: function () { return 7; } })[1] != 7;
  });

  var objectPropertyIsEnumerable = {};

  var $propertyIsEnumerable = {}.propertyIsEnumerable;
  // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
  var getOwnPropertyDescriptor$1 = Object.getOwnPropertyDescriptor;

  // Nashorn ~ JDK8 bug
  var NASHORN_BUG = getOwnPropertyDescriptor$1 && !$propertyIsEnumerable.call({ 1: 2 }, 1);

  // `Object.prototype.propertyIsEnumerable` method implementation
  // https://tc39.es/ecma262/#sec-object.prototype.propertyisenumerable
  objectPropertyIsEnumerable.f = NASHORN_BUG ? function propertyIsEnumerable(V) {
    var descriptor = getOwnPropertyDescriptor$1(this, V);
    return !!descriptor && descriptor.enumerable;
  } : $propertyIsEnumerable;

  var createPropertyDescriptor$2 = function (bitmap, value) {
    return {
      enumerable: !(bitmap & 1),
      configurable: !(bitmap & 2),
      writable: !(bitmap & 4),
      value: value
    };
  };

  var toString = {}.toString;

  var classofRaw$1 = function (it) {
    return toString.call(it).slice(8, -1);
  };

  var fails$6 = fails$8;
  var classof$2 = classofRaw$1;

  var split = ''.split;

  // fallback for non-array-like ES3 and non-enumerable old V8 strings
  var indexedObject = fails$6(function () {
    // throws an error in rhino, see https://github.com/mozilla/rhino/issues/346
    // eslint-disable-next-line no-prototype-builtins -- safe
    return !Object('z').propertyIsEnumerable(0);
  }) ? function (it) {
    return classof$2(it) == 'String' ? split.call(it, '') : Object(it);
  } : Object;

  // `RequireObjectCoercible` abstract operation
  // https://tc39.es/ecma262/#sec-requireobjectcoercible
  var requireObjectCoercible$2 = function (it) {
    if (it == undefined) throw TypeError("Can't call method on " + it);
    return it;
  };

  // toObject with fallback for non-array-like ES3 strings
  var IndexedObject = indexedObject;
  var requireObjectCoercible$1 = requireObjectCoercible$2;

  var toIndexedObject$3 = function (it) {
    return IndexedObject(requireObjectCoercible$1(it));
  };

  // `IsCallable` abstract operation
  // https://tc39.es/ecma262/#sec-iscallable
  var isCallable$d = function (argument) {
    return typeof argument === 'function';
  };

  var isCallable$c = isCallable$d;

  var isObject$5 = function (it) {
    return typeof it === 'object' ? it !== null : isCallable$c(it);
  };

  var global$b = global$c;
  var isCallable$b = isCallable$d;

  var aFunction = function (argument) {
    return isCallable$b(argument) ? argument : undefined;
  };

  var getBuiltIn$4 = function (namespace, method) {
    return arguments.length < 2 ? aFunction(global$b[namespace]) : global$b[namespace] && global$b[namespace][method];
  };

  var getBuiltIn$3 = getBuiltIn$4;

  var engineUserAgent = getBuiltIn$3('navigator', 'userAgent') || '';

  var global$a = global$c;
  var userAgent = engineUserAgent;

  var process = global$a.process;
  var Deno = global$a.Deno;
  var versions = process && process.versions || Deno && Deno.version;
  var v8 = versions && versions.v8;
  var match, version;

  if (v8) {
    match = v8.split('.');
    version = match[0] < 4 ? 1 : match[0] + match[1];
  } else if (userAgent) {
    match = userAgent.match(/Edge\/(\d+)/);
    if (!match || match[1] >= 74) {
      match = userAgent.match(/Chrome\/(\d+)/);
      if (match) version = match[1];
    }
  }

  var engineV8Version = version && +version;

  /* eslint-disable es/no-symbol -- required for testing */

  var V8_VERSION = engineV8Version;
  var fails$5 = fails$8;

  // eslint-disable-next-line es/no-object-getownpropertysymbols -- required for testing
  var nativeSymbol = !!Object.getOwnPropertySymbols && !fails$5(function () {
    var symbol = Symbol();
    // Chrome 38 Symbol has incorrect toString conversion
    // `get-own-property-symbols` polyfill symbols converted to object are not Symbol instances
    return !String(symbol) || !(Object(symbol) instanceof Symbol) ||
      // Chrome 38-40 symbols are not inherited from DOM collections prototypes to instances
      !Symbol.sham && V8_VERSION && V8_VERSION < 41;
  });

  /* eslint-disable es/no-symbol -- required for testing */

  var NATIVE_SYMBOL$1 = nativeSymbol;

  var useSymbolAsUid = NATIVE_SYMBOL$1
    && !Symbol.sham
    && typeof Symbol.iterator == 'symbol';

  var isCallable$a = isCallable$d;
  var getBuiltIn$2 = getBuiltIn$4;
  var USE_SYMBOL_AS_UID$1 = useSymbolAsUid;

  var isSymbol$2 = USE_SYMBOL_AS_UID$1 ? function (it) {
    return typeof it == 'symbol';
  } : function (it) {
    var $Symbol = getBuiltIn$2('Symbol');
    return isCallable$a($Symbol) && Object(it) instanceof $Symbol;
  };

  var tryToString$1 = function (argument) {
    try {
      return String(argument);
    } catch (error) {
      return 'Object';
    }
  };

  var isCallable$9 = isCallable$d;
  var tryToString = tryToString$1;

  // `Assert: IsCallable(argument) is true`
  var aCallable$7 = function (argument) {
    if (isCallable$9(argument)) return argument;
    throw TypeError(tryToString(argument) + ' is not a function');
  };

  var aCallable$6 = aCallable$7;

  // `GetMethod` abstract operation
  // https://tc39.es/ecma262/#sec-getmethod
  var getMethod$4 = function (V, P) {
    var func = V[P];
    return func == null ? undefined : aCallable$6(func);
  };

  var isCallable$8 = isCallable$d;
  var isObject$4 = isObject$5;

  // `OrdinaryToPrimitive` abstract operation
  // https://tc39.es/ecma262/#sec-ordinarytoprimitive
  var ordinaryToPrimitive$1 = function (input, pref) {
    var fn, val;
    if (pref === 'string' && isCallable$8(fn = input.toString) && !isObject$4(val = fn.call(input))) return val;
    if (isCallable$8(fn = input.valueOf) && !isObject$4(val = fn.call(input))) return val;
    if (pref !== 'string' && isCallable$8(fn = input.toString) && !isObject$4(val = fn.call(input))) return val;
    throw TypeError("Can't convert object to primitive value");
  };

  var shared$3 = {exports: {}};

  var global$9 = global$c;

  var setGlobal$3 = function (key, value) {
    try {
      // eslint-disable-next-line es/no-object-defineproperty -- safe
      Object.defineProperty(global$9, key, { value: value, configurable: true, writable: true });
    } catch (error) {
      global$9[key] = value;
    } return value;
  };

  var global$8 = global$c;
  var setGlobal$2 = setGlobal$3;

  var SHARED = '__core-js_shared__';
  var store$3 = global$8[SHARED] || setGlobal$2(SHARED, {});

  var sharedStore = store$3;

  var store$2 = sharedStore;

  (shared$3.exports = function (key, value) {
    return store$2[key] || (store$2[key] = value !== undefined ? value : {});
  })('versions', []).push({
    version: '3.18.3',
    mode: 'global',
    copyright: '© 2021 Denis Pushkarev (zloirock.ru)'
  });

  var requireObjectCoercible = requireObjectCoercible$2;

  // `ToObject` abstract operation
  // https://tc39.es/ecma262/#sec-toobject
  var toObject$2 = function (argument) {
    return Object(requireObjectCoercible(argument));
  };

  var toObject$1 = toObject$2;

  var hasOwnProperty = {}.hasOwnProperty;

  // `HasOwnProperty` abstract operation
  // https://tc39.es/ecma262/#sec-hasownproperty
  var hasOwnProperty_1 = Object.hasOwn || function hasOwn(it, key) {
    return hasOwnProperty.call(toObject$1(it), key);
  };

  var id = 0;
  var postfix = Math.random();

  var uid$2 = function (key) {
    return 'Symbol(' + String(key === undefined ? '' : key) + ')_' + (++id + postfix).toString(36);
  };

  var global$7 = global$c;
  var shared$2 = shared$3.exports;
  var hasOwn$8 = hasOwnProperty_1;
  var uid$1 = uid$2;
  var NATIVE_SYMBOL = nativeSymbol;
  var USE_SYMBOL_AS_UID = useSymbolAsUid;

  var WellKnownSymbolsStore = shared$2('wks');
  var Symbol$1 = global$7.Symbol;
  var createWellKnownSymbol = USE_SYMBOL_AS_UID ? Symbol$1 : Symbol$1 && Symbol$1.withoutSetter || uid$1;

  var wellKnownSymbol$8 = function (name) {
    if (!hasOwn$8(WellKnownSymbolsStore, name) || !(NATIVE_SYMBOL || typeof WellKnownSymbolsStore[name] == 'string')) {
      if (NATIVE_SYMBOL && hasOwn$8(Symbol$1, name)) {
        WellKnownSymbolsStore[name] = Symbol$1[name];
      } else {
        WellKnownSymbolsStore[name] = createWellKnownSymbol('Symbol.' + name);
      }
    } return WellKnownSymbolsStore[name];
  };

  var isObject$3 = isObject$5;
  var isSymbol$1 = isSymbol$2;
  var getMethod$3 = getMethod$4;
  var ordinaryToPrimitive = ordinaryToPrimitive$1;
  var wellKnownSymbol$7 = wellKnownSymbol$8;

  var TO_PRIMITIVE = wellKnownSymbol$7('toPrimitive');

  // `ToPrimitive` abstract operation
  // https://tc39.es/ecma262/#sec-toprimitive
  var toPrimitive$1 = function (input, pref) {
    if (!isObject$3(input) || isSymbol$1(input)) return input;
    var exoticToPrim = getMethod$3(input, TO_PRIMITIVE);
    var result;
    if (exoticToPrim) {
      if (pref === undefined) pref = 'default';
      result = exoticToPrim.call(input, pref);
      if (!isObject$3(result) || isSymbol$1(result)) return result;
      throw TypeError("Can't convert object to primitive value");
    }
    if (pref === undefined) pref = 'number';
    return ordinaryToPrimitive(input, pref);
  };

  var toPrimitive = toPrimitive$1;
  var isSymbol = isSymbol$2;

  // `ToPropertyKey` abstract operation
  // https://tc39.es/ecma262/#sec-topropertykey
  var toPropertyKey$2 = function (argument) {
    var key = toPrimitive(argument, 'string');
    return isSymbol(key) ? key : String(key);
  };

  var global$6 = global$c;
  var isObject$2 = isObject$5;

  var document$1 = global$6.document;
  // typeof document.createElement is 'object' in old IE
  var EXISTS$1 = isObject$2(document$1) && isObject$2(document$1.createElement);

  var documentCreateElement$1 = function (it) {
    return EXISTS$1 ? document$1.createElement(it) : {};
  };

  var DESCRIPTORS$5 = descriptors;
  var fails$4 = fails$8;
  var createElement = documentCreateElement$1;

  // Thank's IE8 for his funny defineProperty
  var ie8DomDefine = !DESCRIPTORS$5 && !fails$4(function () {
    // eslint-disable-next-line es/no-object-defineproperty -- requied for testing
    return Object.defineProperty(createElement('div'), 'a', {
      get: function () { return 7; }
    }).a != 7;
  });

  var DESCRIPTORS$4 = descriptors;
  var propertyIsEnumerableModule = objectPropertyIsEnumerable;
  var createPropertyDescriptor$1 = createPropertyDescriptor$2;
  var toIndexedObject$2 = toIndexedObject$3;
  var toPropertyKey$1 = toPropertyKey$2;
  var hasOwn$7 = hasOwnProperty_1;
  var IE8_DOM_DEFINE$1 = ie8DomDefine;

  // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
  var $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

  // `Object.getOwnPropertyDescriptor` method
  // https://tc39.es/ecma262/#sec-object.getownpropertydescriptor
  objectGetOwnPropertyDescriptor.f = DESCRIPTORS$4 ? $getOwnPropertyDescriptor : function getOwnPropertyDescriptor(O, P) {
    O = toIndexedObject$2(O);
    P = toPropertyKey$1(P);
    if (IE8_DOM_DEFINE$1) try {
      return $getOwnPropertyDescriptor(O, P);
    } catch (error) { /* empty */ }
    if (hasOwn$7(O, P)) return createPropertyDescriptor$1(!propertyIsEnumerableModule.f.call(O, P), O[P]);
  };

  var objectDefineProperty = {};

  var isObject$1 = isObject$5;

  // `Assert: Type(argument) is Object`
  var anObject$d = function (argument) {
    if (isObject$1(argument)) return argument;
    throw TypeError(String(argument) + ' is not an object');
  };

  var DESCRIPTORS$3 = descriptors;
  var IE8_DOM_DEFINE = ie8DomDefine;
  var anObject$c = anObject$d;
  var toPropertyKey = toPropertyKey$2;

  // eslint-disable-next-line es/no-object-defineproperty -- safe
  var $defineProperty = Object.defineProperty;

  // `Object.defineProperty` method
  // https://tc39.es/ecma262/#sec-object.defineproperty
  objectDefineProperty.f = DESCRIPTORS$3 ? $defineProperty : function defineProperty(O, P, Attributes) {
    anObject$c(O);
    P = toPropertyKey(P);
    anObject$c(Attributes);
    if (IE8_DOM_DEFINE) try {
      return $defineProperty(O, P, Attributes);
    } catch (error) { /* empty */ }
    if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported');
    if ('value' in Attributes) O[P] = Attributes.value;
    return O;
  };

  var DESCRIPTORS$2 = descriptors;
  var definePropertyModule$2 = objectDefineProperty;
  var createPropertyDescriptor = createPropertyDescriptor$2;

  var createNonEnumerableProperty$5 = DESCRIPTORS$2 ? function (object, key, value) {
    return definePropertyModule$2.f(object, key, createPropertyDescriptor(1, value));
  } : function (object, key, value) {
    object[key] = value;
    return object;
  };

  var redefine$3 = {exports: {}};

  var isCallable$7 = isCallable$d;
  var store$1 = sharedStore;

  var functionToString = Function.toString;

  // this helper broken in `core-js@3.4.1-3.4.4`, so we can't use `shared` helper
  if (!isCallable$7(store$1.inspectSource)) {
    store$1.inspectSource = function (it) {
      return functionToString.call(it);
    };
  }

  var inspectSource$2 = store$1.inspectSource;

  var global$5 = global$c;
  var isCallable$6 = isCallable$d;
  var inspectSource$1 = inspectSource$2;

  var WeakMap$1 = global$5.WeakMap;

  var nativeWeakMap = isCallable$6(WeakMap$1) && /native code/.test(inspectSource$1(WeakMap$1));

  var shared$1 = shared$3.exports;
  var uid = uid$2;

  var keys = shared$1('keys');

  var sharedKey$3 = function (key) {
    return keys[key] || (keys[key] = uid(key));
  };

  var hiddenKeys$4 = {};

  var NATIVE_WEAK_MAP = nativeWeakMap;
  var global$4 = global$c;
  var isObject = isObject$5;
  var createNonEnumerableProperty$4 = createNonEnumerableProperty$5;
  var hasOwn$6 = hasOwnProperty_1;
  var shared = sharedStore;
  var sharedKey$2 = sharedKey$3;
  var hiddenKeys$3 = hiddenKeys$4;

  var OBJECT_ALREADY_INITIALIZED = 'Object already initialized';
  var WeakMap = global$4.WeakMap;
  var set, get, has;

  var enforce = function (it) {
    return has(it) ? get(it) : set(it, {});
  };

  var getterFor = function (TYPE) {
    return function (it) {
      var state;
      if (!isObject(it) || (state = get(it)).type !== TYPE) {
        throw TypeError('Incompatible receiver, ' + TYPE + ' required');
      } return state;
    };
  };

  if (NATIVE_WEAK_MAP || shared.state) {
    var store = shared.state || (shared.state = new WeakMap());
    var wmget = store.get;
    var wmhas = store.has;
    var wmset = store.set;
    set = function (it, metadata) {
      if (wmhas.call(store, it)) throw new TypeError(OBJECT_ALREADY_INITIALIZED);
      metadata.facade = it;
      wmset.call(store, it, metadata);
      return metadata;
    };
    get = function (it) {
      return wmget.call(store, it) || {};
    };
    has = function (it) {
      return wmhas.call(store, it);
    };
  } else {
    var STATE = sharedKey$2('state');
    hiddenKeys$3[STATE] = true;
    set = function (it, metadata) {
      if (hasOwn$6(it, STATE)) throw new TypeError(OBJECT_ALREADY_INITIALIZED);
      metadata.facade = it;
      createNonEnumerableProperty$4(it, STATE, metadata);
      return metadata;
    };
    get = function (it) {
      return hasOwn$6(it, STATE) ? it[STATE] : {};
    };
    has = function (it) {
      return hasOwn$6(it, STATE);
    };
  }

  var internalState = {
    set: set,
    get: get,
    has: has,
    enforce: enforce,
    getterFor: getterFor
  };

  var DESCRIPTORS$1 = descriptors;
  var hasOwn$5 = hasOwnProperty_1;

  var FunctionPrototype = Function.prototype;
  // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
  var getDescriptor = DESCRIPTORS$1 && Object.getOwnPropertyDescriptor;

  var EXISTS = hasOwn$5(FunctionPrototype, 'name');
  // additional protection from minified / mangled / dropped function names
  var PROPER = EXISTS && (function something() { /* empty */ }).name === 'something';
  var CONFIGURABLE = EXISTS && (!DESCRIPTORS$1 || (DESCRIPTORS$1 && getDescriptor(FunctionPrototype, 'name').configurable));

  var functionName = {
    EXISTS: EXISTS,
    PROPER: PROPER,
    CONFIGURABLE: CONFIGURABLE
  };

  var global$3 = global$c;
  var isCallable$5 = isCallable$d;
  var hasOwn$4 = hasOwnProperty_1;
  var createNonEnumerableProperty$3 = createNonEnumerableProperty$5;
  var setGlobal$1 = setGlobal$3;
  var inspectSource = inspectSource$2;
  var InternalStateModule$1 = internalState;
  var CONFIGURABLE_FUNCTION_NAME = functionName.CONFIGURABLE;

  var getInternalState$1 = InternalStateModule$1.get;
  var enforceInternalState = InternalStateModule$1.enforce;
  var TEMPLATE = String(String).split('String');

  (redefine$3.exports = function (O, key, value, options) {
    var unsafe = options ? !!options.unsafe : false;
    var simple = options ? !!options.enumerable : false;
    var noTargetGet = options ? !!options.noTargetGet : false;
    var name = options && options.name !== undefined ? options.name : key;
    var state;
    if (isCallable$5(value)) {
      if (String(name).slice(0, 7) === 'Symbol(') {
        name = '[' + String(name).replace(/^Symbol\(([^)]*)\)/, '$1') + ']';
      }
      if (!hasOwn$4(value, 'name') || (CONFIGURABLE_FUNCTION_NAME && value.name !== name)) {
        createNonEnumerableProperty$3(value, 'name', name);
      }
      state = enforceInternalState(value);
      if (!state.source) {
        state.source = TEMPLATE.join(typeof name == 'string' ? name : '');
      }
    }
    if (O === global$3) {
      if (simple) O[key] = value;
      else setGlobal$1(key, value);
      return;
    } else if (!unsafe) {
      delete O[key];
    } else if (!noTargetGet && O[key]) {
      simple = true;
    }
    if (simple) O[key] = value;
    else createNonEnumerableProperty$3(O, key, value);
  // add fake Function#toString for correct work wrapped methods / constructors with methods like LoDash isNative
  })(Function.prototype, 'toString', function toString() {
    return isCallable$5(this) && getInternalState$1(this).source || inspectSource(this);
  });

  var objectGetOwnPropertyNames = {};

  var ceil = Math.ceil;
  var floor = Math.floor;

  // `ToIntegerOrInfinity` abstract operation
  // https://tc39.es/ecma262/#sec-tointegerorinfinity
  var toIntegerOrInfinity$2 = function (argument) {
    var number = +argument;
    // eslint-disable-next-line no-self-compare -- safe
    return number !== number || number === 0 ? 0 : (number > 0 ? floor : ceil)(number);
  };

  var toIntegerOrInfinity$1 = toIntegerOrInfinity$2;

  var max = Math.max;
  var min$1 = Math.min;

  // Helper for a popular repeating case of the spec:
  // Let integer be ? ToInteger(index).
  // If integer < 0, let result be max((length + integer), 0); else let result be min(integer, length).
  var toAbsoluteIndex$1 = function (index, length) {
    var integer = toIntegerOrInfinity$1(index);
    return integer < 0 ? max(integer + length, 0) : min$1(integer, length);
  };

  var toIntegerOrInfinity = toIntegerOrInfinity$2;

  var min = Math.min;

  // `ToLength` abstract operation
  // https://tc39.es/ecma262/#sec-tolength
  var toLength$1 = function (argument) {
    return argument > 0 ? min(toIntegerOrInfinity(argument), 0x1FFFFFFFFFFFFF) : 0; // 2 ** 53 - 1 == 9007199254740991
  };

  var toLength = toLength$1;

  // `LengthOfArrayLike` abstract operation
  // https://tc39.es/ecma262/#sec-lengthofarraylike
  var lengthOfArrayLike$2 = function (obj) {
    return toLength(obj.length);
  };

  var toIndexedObject$1 = toIndexedObject$3;
  var toAbsoluteIndex = toAbsoluteIndex$1;
  var lengthOfArrayLike$1 = lengthOfArrayLike$2;

  // `Array.prototype.{ indexOf, includes }` methods implementation
  var createMethod = function (IS_INCLUDES) {
    return function ($this, el, fromIndex) {
      var O = toIndexedObject$1($this);
      var length = lengthOfArrayLike$1(O);
      var index = toAbsoluteIndex(fromIndex, length);
      var value;
      // Array#includes uses SameValueZero equality algorithm
      // eslint-disable-next-line no-self-compare -- NaN check
      if (IS_INCLUDES && el != el) while (length > index) {
        value = O[index++];
        // eslint-disable-next-line no-self-compare -- NaN check
        if (value != value) return true;
      // Array#indexOf ignores holes, Array#includes - not
      } else for (;length > index; index++) {
        if ((IS_INCLUDES || index in O) && O[index] === el) return IS_INCLUDES || index || 0;
      } return !IS_INCLUDES && -1;
    };
  };

  var arrayIncludes = {
    // `Array.prototype.includes` method
    // https://tc39.es/ecma262/#sec-array.prototype.includes
    includes: createMethod(true),
    // `Array.prototype.indexOf` method
    // https://tc39.es/ecma262/#sec-array.prototype.indexof
    indexOf: createMethod(false)
  };

  var hasOwn$3 = hasOwnProperty_1;
  var toIndexedObject = toIndexedObject$3;
  var indexOf = arrayIncludes.indexOf;
  var hiddenKeys$2 = hiddenKeys$4;

  var objectKeysInternal = function (object, names) {
    var O = toIndexedObject(object);
    var i = 0;
    var result = [];
    var key;
    for (key in O) !hasOwn$3(hiddenKeys$2, key) && hasOwn$3(O, key) && result.push(key);
    // Don't enum bug & hidden keys
    while (names.length > i) if (hasOwn$3(O, key = names[i++])) {
      ~indexOf(result, key) || result.push(key);
    }
    return result;
  };

  // IE8- don't enum bug keys
  var enumBugKeys$3 = [
    'constructor',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    'toString',
    'valueOf'
  ];

  var internalObjectKeys$1 = objectKeysInternal;
  var enumBugKeys$2 = enumBugKeys$3;

  var hiddenKeys$1 = enumBugKeys$2.concat('length', 'prototype');

  // `Object.getOwnPropertyNames` method
  // https://tc39.es/ecma262/#sec-object.getownpropertynames
  // eslint-disable-next-line es/no-object-getownpropertynames -- safe
  objectGetOwnPropertyNames.f = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
    return internalObjectKeys$1(O, hiddenKeys$1);
  };

  var objectGetOwnPropertySymbols = {};

  // eslint-disable-next-line es/no-object-getownpropertysymbols -- safe
  objectGetOwnPropertySymbols.f = Object.getOwnPropertySymbols;

  var getBuiltIn$1 = getBuiltIn$4;
  var getOwnPropertyNamesModule = objectGetOwnPropertyNames;
  var getOwnPropertySymbolsModule = objectGetOwnPropertySymbols;
  var anObject$b = anObject$d;

  // all object keys, includes non-enumerable and symbols
  var ownKeys$1 = getBuiltIn$1('Reflect', 'ownKeys') || function ownKeys(it) {
    var keys = getOwnPropertyNamesModule.f(anObject$b(it));
    var getOwnPropertySymbols = getOwnPropertySymbolsModule.f;
    return getOwnPropertySymbols ? keys.concat(getOwnPropertySymbols(it)) : keys;
  };

  var hasOwn$2 = hasOwnProperty_1;
  var ownKeys = ownKeys$1;
  var getOwnPropertyDescriptorModule = objectGetOwnPropertyDescriptor;
  var definePropertyModule$1 = objectDefineProperty;

  var copyConstructorProperties$1 = function (target, source) {
    var keys = ownKeys(source);
    var defineProperty = definePropertyModule$1.f;
    var getOwnPropertyDescriptor = getOwnPropertyDescriptorModule.f;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (!hasOwn$2(target, key)) defineProperty(target, key, getOwnPropertyDescriptor(source, key));
    }
  };

  var fails$3 = fails$8;
  var isCallable$4 = isCallable$d;

  var replacement = /#|\.prototype\./;

  var isForced$1 = function (feature, detection) {
    var value = data[normalize(feature)];
    return value == POLYFILL ? true
      : value == NATIVE ? false
      : isCallable$4(detection) ? fails$3(detection)
      : !!detection;
  };

  var normalize = isForced$1.normalize = function (string) {
    return String(string).replace(replacement, '.').toLowerCase();
  };

  var data = isForced$1.data = {};
  var NATIVE = isForced$1.NATIVE = 'N';
  var POLYFILL = isForced$1.POLYFILL = 'P';

  var isForced_1 = isForced$1;

  var global$2 = global$c;
  var getOwnPropertyDescriptor = objectGetOwnPropertyDescriptor.f;
  var createNonEnumerableProperty$2 = createNonEnumerableProperty$5;
  var redefine$2 = redefine$3.exports;
  var setGlobal = setGlobal$3;
  var copyConstructorProperties = copyConstructorProperties$1;
  var isForced = isForced_1;

  /*
    options.target      - name of the target object
    options.global      - target is the global object
    options.stat        - export as static methods of target
    options.proto       - export as prototype methods of target
    options.real        - real prototype method for the `pure` version
    options.forced      - export even if the native feature is available
    options.bind        - bind methods to the target, required for the `pure` version
    options.wrap        - wrap constructors to preventing global pollution, required for the `pure` version
    options.unsafe      - use the simple assignment of property instead of delete + defineProperty
    options.sham        - add a flag to not completely full polyfills
    options.enumerable  - export as enumerable property
    options.noTargetGet - prevent calling a getter on target
    options.name        - the .name of the function if it does not match the key
  */
  var _export = function (options, source) {
    var TARGET = options.target;
    var GLOBAL = options.global;
    var STATIC = options.stat;
    var FORCED, target, key, targetProperty, sourceProperty, descriptor;
    if (GLOBAL) {
      target = global$2;
    } else if (STATIC) {
      target = global$2[TARGET] || setGlobal(TARGET, {});
    } else {
      target = (global$2[TARGET] || {}).prototype;
    }
    if (target) for (key in source) {
      sourceProperty = source[key];
      if (options.noTargetGet) {
        descriptor = getOwnPropertyDescriptor(target, key);
        targetProperty = descriptor && descriptor.value;
      } else targetProperty = target[key];
      FORCED = isForced(GLOBAL ? key : TARGET + (STATIC ? '.' : '#') + key, options.forced);
      // contained in target
      if (!FORCED && targetProperty !== undefined) {
        if (typeof sourceProperty === typeof targetProperty) continue;
        copyConstructorProperties(sourceProperty, targetProperty);
      }
      // add a flag to not completely full polyfills
      if (options.sham || (targetProperty && targetProperty.sham)) {
        createNonEnumerableProperty$2(sourceProperty, 'sham', true);
      }
      // extend global
      redefine$2(target, key, sourceProperty, options);
    }
  };

  var anInstance$1 = function (it, Constructor, name) {
    if (it instanceof Constructor) return it;
    throw TypeError('Incorrect ' + (name ? name + ' ' : '') + 'invocation');
  };

  var internalObjectKeys = objectKeysInternal;
  var enumBugKeys$1 = enumBugKeys$3;

  // `Object.keys` method
  // https://tc39.es/ecma262/#sec-object.keys
  // eslint-disable-next-line es/no-object-keys -- safe
  var objectKeys$1 = Object.keys || function keys(O) {
    return internalObjectKeys(O, enumBugKeys$1);
  };

  var DESCRIPTORS = descriptors;
  var definePropertyModule = objectDefineProperty;
  var anObject$a = anObject$d;
  var objectKeys = objectKeys$1;

  // `Object.defineProperties` method
  // https://tc39.es/ecma262/#sec-object.defineproperties
  // eslint-disable-next-line es/no-object-defineproperties -- safe
  var objectDefineProperties = DESCRIPTORS ? Object.defineProperties : function defineProperties(O, Properties) {
    anObject$a(O);
    var keys = objectKeys(Properties);
    var length = keys.length;
    var index = 0;
    var key;
    while (length > index) definePropertyModule.f(O, key = keys[index++], Properties[key]);
    return O;
  };

  var getBuiltIn = getBuiltIn$4;

  var html$1 = getBuiltIn('document', 'documentElement');

  /* global ActiveXObject -- old IE, WSH */

  var anObject$9 = anObject$d;
  var defineProperties = objectDefineProperties;
  var enumBugKeys = enumBugKeys$3;
  var hiddenKeys = hiddenKeys$4;
  var html = html$1;
  var documentCreateElement = documentCreateElement$1;
  var sharedKey$1 = sharedKey$3;

  var GT = '>';
  var LT = '<';
  var PROTOTYPE = 'prototype';
  var SCRIPT = 'script';
  var IE_PROTO$1 = sharedKey$1('IE_PROTO');

  var EmptyConstructor = function () { /* empty */ };

  var scriptTag = function (content) {
    return LT + SCRIPT + GT + content + LT + '/' + SCRIPT + GT;
  };

  // Create object with fake `null` prototype: use ActiveX Object with cleared prototype
  var NullProtoObjectViaActiveX = function (activeXDocument) {
    activeXDocument.write(scriptTag(''));
    activeXDocument.close();
    var temp = activeXDocument.parentWindow.Object;
    activeXDocument = null; // avoid memory leak
    return temp;
  };

  // Create object with fake `null` prototype: use iframe Object with cleared prototype
  var NullProtoObjectViaIFrame = function () {
    // Thrash, waste and sodomy: IE GC bug
    var iframe = documentCreateElement('iframe');
    var JS = 'java' + SCRIPT + ':';
    var iframeDocument;
    iframe.style.display = 'none';
    html.appendChild(iframe);
    // https://github.com/zloirock/core-js/issues/475
    iframe.src = String(JS);
    iframeDocument = iframe.contentWindow.document;
    iframeDocument.open();
    iframeDocument.write(scriptTag('document.F=Object'));
    iframeDocument.close();
    return iframeDocument.F;
  };

  // Check for document.domain and active x support
  // No need to use active x approach when document.domain is not set
  // see https://github.com/es-shims/es5-shim/issues/150
  // variation of https://github.com/kitcambridge/es5-shim/commit/4f738ac066346
  // avoid IE GC bug
  var activeXDocument;
  var NullProtoObject = function () {
    try {
      activeXDocument = new ActiveXObject('htmlfile');
    } catch (error) { /* ignore */ }
    NullProtoObject = typeof document != 'undefined'
      ? document.domain && activeXDocument
        ? NullProtoObjectViaActiveX(activeXDocument) // old IE
        : NullProtoObjectViaIFrame()
      : NullProtoObjectViaActiveX(activeXDocument); // WSH
    var length = enumBugKeys.length;
    while (length--) delete NullProtoObject[PROTOTYPE][enumBugKeys[length]];
    return NullProtoObject();
  };

  hiddenKeys[IE_PROTO$1] = true;

  // `Object.create` method
  // https://tc39.es/ecma262/#sec-object.create
  var objectCreate = Object.create || function create(O, Properties) {
    var result;
    if (O !== null) {
      EmptyConstructor[PROTOTYPE] = anObject$9(O);
      result = new EmptyConstructor();
      EmptyConstructor[PROTOTYPE] = null;
      // add "__proto__" for Object.getPrototypeOf polyfill
      result[IE_PROTO$1] = O;
    } else result = NullProtoObject();
    return Properties === undefined ? result : defineProperties(result, Properties);
  };

  var fails$2 = fails$8;

  var correctPrototypeGetter = !fails$2(function () {
    function F() { /* empty */ }
    F.prototype.constructor = null;
    // eslint-disable-next-line es/no-object-getprototypeof -- required for testing
    return Object.getPrototypeOf(new F()) !== F.prototype;
  });

  var hasOwn$1 = hasOwnProperty_1;
  var isCallable$3 = isCallable$d;
  var toObject = toObject$2;
  var sharedKey = sharedKey$3;
  var CORRECT_PROTOTYPE_GETTER = correctPrototypeGetter;

  var IE_PROTO = sharedKey('IE_PROTO');
  var ObjectPrototype = Object.prototype;

  // `Object.getPrototypeOf` method
  // https://tc39.es/ecma262/#sec-object.getprototypeof
  // eslint-disable-next-line es/no-object-getprototypeof -- safe
  var objectGetPrototypeOf = CORRECT_PROTOTYPE_GETTER ? Object.getPrototypeOf : function (O) {
    var object = toObject(O);
    if (hasOwn$1(object, IE_PROTO)) return object[IE_PROTO];
    var constructor = object.constructor;
    if (isCallable$3(constructor) && object instanceof constructor) {
      return constructor.prototype;
    } return object instanceof Object ? ObjectPrototype : null;
  };

  var fails$1 = fails$8;
  var isCallable$2 = isCallable$d;
  var getPrototypeOf = objectGetPrototypeOf;
  var redefine$1 = redefine$3.exports;
  var wellKnownSymbol$6 = wellKnownSymbol$8;

  var ITERATOR$2 = wellKnownSymbol$6('iterator');
  var BUGGY_SAFARI_ITERATORS = false;

  // `%IteratorPrototype%` object
  // https://tc39.es/ecma262/#sec-%iteratorprototype%-object
  var IteratorPrototype$2, PrototypeOfArrayIteratorPrototype, arrayIterator;

  /* eslint-disable es/no-array-prototype-keys -- safe */
  if ([].keys) {
    arrayIterator = [].keys();
    // Safari 8 has buggy iterators w/o `next`
    if (!('next' in arrayIterator)) BUGGY_SAFARI_ITERATORS = true;
    else {
      PrototypeOfArrayIteratorPrototype = getPrototypeOf(getPrototypeOf(arrayIterator));
      if (PrototypeOfArrayIteratorPrototype !== Object.prototype) IteratorPrototype$2 = PrototypeOfArrayIteratorPrototype;
    }
  }

  var NEW_ITERATOR_PROTOTYPE = IteratorPrototype$2 == undefined || fails$1(function () {
    var test = {};
    // FF44- legacy iterators case
    return IteratorPrototype$2[ITERATOR$2].call(test) !== test;
  });

  if (NEW_ITERATOR_PROTOTYPE) IteratorPrototype$2 = {};

  // `%IteratorPrototype%[@@iterator]()` method
  // https://tc39.es/ecma262/#sec-%iteratorprototype%-@@iterator
  if (!isCallable$2(IteratorPrototype$2[ITERATOR$2])) {
    redefine$1(IteratorPrototype$2, ITERATOR$2, function () {
      return this;
    });
  }

  var iteratorsCore = {
    IteratorPrototype: IteratorPrototype$2,
    BUGGY_SAFARI_ITERATORS: BUGGY_SAFARI_ITERATORS
  };

  // https://github.com/tc39/proposal-iterator-helpers
  var $$4 = _export;
  var global$1 = global$c;
  var anInstance = anInstance$1;
  var isCallable$1 = isCallable$d;
  var createNonEnumerableProperty$1 = createNonEnumerableProperty$5;
  var fails = fails$8;
  var hasOwn = hasOwnProperty_1;
  var wellKnownSymbol$5 = wellKnownSymbol$8;
  var IteratorPrototype$1 = iteratorsCore.IteratorPrototype;

  var TO_STRING_TAG$3 = wellKnownSymbol$5('toStringTag');

  var NativeIterator = global$1.Iterator;

  // FF56- have non-standard global helper `Iterator`
  var FORCED = !isCallable$1(NativeIterator)
    || NativeIterator.prototype !== IteratorPrototype$1
    // FF44- non-standard `Iterator` passes previous tests
    || !fails(function () { NativeIterator({}); });

  var IteratorConstructor = function Iterator() {
    anInstance(this, IteratorConstructor);
  };

  if (!hasOwn(IteratorPrototype$1, TO_STRING_TAG$3)) {
    createNonEnumerableProperty$1(IteratorPrototype$1, TO_STRING_TAG$3, 'Iterator');
  }

  if (FORCED || !hasOwn(IteratorPrototype$1, 'constructor') || IteratorPrototype$1.constructor === Object) {
    createNonEnumerableProperty$1(IteratorPrototype$1, 'constructor', IteratorConstructor);
  }

  IteratorConstructor.prototype = IteratorPrototype$1;

  $$4({ global: true, forced: FORCED }, {
    Iterator: IteratorConstructor
  });

  var iterators = {};

  var wellKnownSymbol$4 = wellKnownSymbol$8;
  var Iterators$1 = iterators;

  var ITERATOR$1 = wellKnownSymbol$4('iterator');
  var ArrayPrototype = Array.prototype;

  // check on default Array iterator
  var isArrayIteratorMethod$1 = function (it) {
    return it !== undefined && (Iterators$1.Array === it || ArrayPrototype[ITERATOR$1] === it);
  };

  var aCallable$5 = aCallable$7;

  // optional / simple context binding
  var functionBindContext = function (fn, that, length) {
    aCallable$5(fn);
    if (that === undefined) return fn;
    switch (length) {
      case 0: return function () {
        return fn.call(that);
      };
      case 1: return function (a) {
        return fn.call(that, a);
      };
      case 2: return function (a, b) {
        return fn.call(that, a, b);
      };
      case 3: return function (a, b, c) {
        return fn.call(that, a, b, c);
      };
    }
    return function (/* ...args */) {
      return fn.apply(that, arguments);
    };
  };

  var wellKnownSymbol$3 = wellKnownSymbol$8;

  var TO_STRING_TAG$2 = wellKnownSymbol$3('toStringTag');
  var test = {};

  test[TO_STRING_TAG$2] = 'z';

  var toStringTagSupport = String(test) === '[object z]';

  var TO_STRING_TAG_SUPPORT = toStringTagSupport;
  var isCallable = isCallable$d;
  var classofRaw = classofRaw$1;
  var wellKnownSymbol$2 = wellKnownSymbol$8;

  var TO_STRING_TAG$1 = wellKnownSymbol$2('toStringTag');
  // ES3 wrong here
  var CORRECT_ARGUMENTS = classofRaw(function () { return arguments; }()) == 'Arguments';

  // fallback for IE11 Script Access Denied error
  var tryGet = function (it, key) {
    try {
      return it[key];
    } catch (error) { /* empty */ }
  };

  // getting tag from ES6+ `Object.prototype.toString`
  var classof$1 = TO_STRING_TAG_SUPPORT ? classofRaw : function (it) {
    var O, tag, result;
    return it === undefined ? 'Undefined' : it === null ? 'Null'
      // @@toStringTag case
      : typeof (tag = tryGet(O = Object(it), TO_STRING_TAG$1)) == 'string' ? tag
      // builtinTag case
      : CORRECT_ARGUMENTS ? classofRaw(O)
      // ES3 arguments fallback
      : (result = classofRaw(O)) == 'Object' && isCallable(O.callee) ? 'Arguments' : result;
  };

  var classof = classof$1;
  var getMethod$2 = getMethod$4;
  var Iterators = iterators;
  var wellKnownSymbol$1 = wellKnownSymbol$8;

  var ITERATOR = wellKnownSymbol$1('iterator');

  var getIteratorMethod$2 = function (it) {
    if (it != undefined) return getMethod$2(it, ITERATOR)
      || getMethod$2(it, '@@iterator')
      || Iterators[classof(it)];
  };

  var aCallable$4 = aCallable$7;
  var anObject$8 = anObject$d;
  var getIteratorMethod$1 = getIteratorMethod$2;

  var getIterator$1 = function (argument, usingIterator) {
    var iteratorMethod = arguments.length < 2 ? getIteratorMethod$1(argument) : usingIterator;
    if (aCallable$4(iteratorMethod)) return anObject$8(iteratorMethod.call(argument));
    throw TypeError(String(argument) + ' is not iterable');
  };

  var anObject$7 = anObject$d;
  var getMethod$1 = getMethod$4;

  var iteratorClose$2 = function (iterator, kind, value) {
    var innerResult, innerError;
    anObject$7(iterator);
    try {
      innerResult = getMethod$1(iterator, 'return');
      if (!innerResult) {
        if (kind === 'throw') throw value;
        return value;
      }
      innerResult = innerResult.call(iterator);
    } catch (error) {
      innerError = true;
      innerResult = error;
    }
    if (kind === 'throw') throw value;
    if (innerError) throw innerResult;
    anObject$7(innerResult);
    return value;
  };

  var anObject$6 = anObject$d;
  var isArrayIteratorMethod = isArrayIteratorMethod$1;
  var lengthOfArrayLike = lengthOfArrayLike$2;
  var bind = functionBindContext;
  var getIterator = getIterator$1;
  var getIteratorMethod = getIteratorMethod$2;
  var iteratorClose$1 = iteratorClose$2;

  var Result = function (stopped, result) {
    this.stopped = stopped;
    this.result = result;
  };

  var iterate$2 = function (iterable, unboundFunction, options) {
    var that = options && options.that;
    var AS_ENTRIES = !!(options && options.AS_ENTRIES);
    var IS_ITERATOR = !!(options && options.IS_ITERATOR);
    var INTERRUPTED = !!(options && options.INTERRUPTED);
    var fn = bind(unboundFunction, that, 1 + AS_ENTRIES + INTERRUPTED);
    var iterator, iterFn, index, length, result, next, step;

    var stop = function (condition) {
      if (iterator) iteratorClose$1(iterator, 'normal', condition);
      return new Result(true, condition);
    };

    var callFn = function (value) {
      if (AS_ENTRIES) {
        anObject$6(value);
        return INTERRUPTED ? fn(value[0], value[1], stop) : fn(value[0], value[1]);
      } return INTERRUPTED ? fn(value, stop) : fn(value);
    };

    if (IS_ITERATOR) {
      iterator = iterable;
    } else {
      iterFn = getIteratorMethod(iterable);
      if (!iterFn) throw TypeError(String(iterable) + ' is not iterable');
      // optimisation for array iterators
      if (isArrayIteratorMethod(iterFn)) {
        for (index = 0, length = lengthOfArrayLike(iterable); length > index; index++) {
          result = callFn(iterable[index]);
          if (result && result instanceof Result) return result;
        } return new Result(false);
      }
      iterator = getIterator(iterable, iterFn);
    }

    next = iterator.next;
    while (!(step = next.call(iterator)).done) {
      try {
        result = callFn(step.value);
      } catch (error) {
        iteratorClose$1(iterator, 'throw', error);
      }
      if (typeof result == 'object' && result && result instanceof Result) return result;
    } return new Result(false);
  };

  // https://github.com/tc39/proposal-iterator-helpers
  var $$3 = _export;
  var iterate$1 = iterate$2;
  var aCallable$3 = aCallable$7;
  var anObject$5 = anObject$d;

  $$3({ target: 'Iterator', proto: true, real: true }, {
    find: function find(fn) {
      anObject$5(this);
      aCallable$3(fn);
      return iterate$1(this, function (value, stop) {
        if (fn(value)) return stop(value);
      }, { IS_ITERATOR: true, INTERRUPTED: true }).result;
    }
  });

  // https://github.com/tc39/proposal-iterator-helpers
  var $$2 = _export;
  var iterate = iterate$2;
  var anObject$4 = anObject$d;

  $$2({ target: 'Iterator', proto: true, real: true }, {
    forEach: function forEach(fn) {
      iterate(anObject$4(this), fn, { IS_ITERATOR: true });
    }
  });

  var redefine = redefine$3.exports;

  var redefineAll$1 = function (target, src, options) {
    for (var key in src) redefine(target, key, src[key], options);
    return target;
  };

  var aCallable$2 = aCallable$7;
  var anObject$3 = anObject$d;
  var create = objectCreate;
  var createNonEnumerableProperty = createNonEnumerableProperty$5;
  var redefineAll = redefineAll$1;
  var wellKnownSymbol = wellKnownSymbol$8;
  var InternalStateModule = internalState;
  var getMethod = getMethod$4;
  var IteratorPrototype = iteratorsCore.IteratorPrototype;

  var setInternalState = InternalStateModule.set;
  var getInternalState = InternalStateModule.get;

  var TO_STRING_TAG = wellKnownSymbol('toStringTag');

  var iteratorCreateProxy = function (nextHandler, IS_ITERATOR) {
    var IteratorProxy = function Iterator(state) {
      state.next = aCallable$2(state.iterator.next);
      state.done = false;
      state.ignoreArg = !IS_ITERATOR;
      setInternalState(this, state);
    };

    IteratorProxy.prototype = redefineAll(create(IteratorPrototype), {
      next: function next(arg) {
        var state = getInternalState(this);
        var args = arguments.length ? [state.ignoreArg ? undefined : arg] : IS_ITERATOR ? [] : [undefined];
        state.ignoreArg = false;
        var result = state.done ? undefined : nextHandler.call(state, args);
        return { done: state.done, value: result };
      },
      'return': function (value) {
        var state = getInternalState(this);
        var iterator = state.iterator;
        state.done = true;
        var $$return = getMethod(iterator, 'return');
        return { done: true, value: $$return ? anObject$3($$return.call(iterator, value)).value : value };
      },
      'throw': function (value) {
        var state = getInternalState(this);
        var iterator = state.iterator;
        state.done = true;
        var $$throw = getMethod(iterator, 'throw');
        if ($$throw) return $$throw.call(iterator, value);
        throw value;
      }
    });

    if (!IS_ITERATOR) {
      createNonEnumerableProperty(IteratorProxy.prototype, TO_STRING_TAG, 'Generator');
    }

    return IteratorProxy;
  };

  var anObject$2 = anObject$d;
  var iteratorClose = iteratorClose$2;

  // call something on iterator step with safe closing on error
  var callWithSafeIterationClosing$2 = function (iterator, fn, value, ENTRIES) {
    try {
      return ENTRIES ? fn(anObject$2(value)[0], value[1]) : fn(value);
    } catch (error) {
      iteratorClose(iterator, 'throw', error);
    }
  };

  // https://github.com/tc39/proposal-iterator-helpers
  var $$1 = _export;
  var aCallable$1 = aCallable$7;
  var anObject$1 = anObject$d;
  var createIteratorProxy$1 = iteratorCreateProxy;
  var callWithSafeIterationClosing$1 = callWithSafeIterationClosing$2;

  var IteratorProxy$1 = createIteratorProxy$1(function (args) {
    var iterator = this.iterator;
    var result = anObject$1(this.next.apply(iterator, args));
    var done = this.done = !!result.done;
    if (!done) return callWithSafeIterationClosing$1(iterator, this.mapper, result.value);
  });

  $$1({ target: 'Iterator', proto: true, real: true }, {
    map: function map(mapper) {
      return new IteratorProxy$1({
        iterator: anObject$1(this),
        mapper: aCallable$1(mapper)
      });
    }
  });

  const equipmentsData = loadFromLocalStorage("equipmentsData", {});
  registHTTPRequestHandler(/awakening-of-war-soul-ol\/socket\.io/, /.*/, /^430.+/, res => {
    Object.assign(equipmentsData, res[0].data);
    logMessage(`Equipments Data Updated, total ${Object.keys(equipmentsData).length} items`);
    saveToLocalStorage("equipmentsData", equipmentsData);
    return res;
  });
  const runeData = loadFromLocalStorage("runeData", {});
  registMessageHandler(/^431\[/, obj => {
    Object.assign(runeData, obj[0].data);
    logMessage(`Rune Data Updated, total ${Object.keys(runeData.runeCollection).length} runes`);
    saveToLocalStorage("runeData", runeData);
    return obj;
  });
  const starAttrMap = {
    1: stat => {
      stat.atk += 2;
    },
    // 攻击 + 2
    2: stat => {
      stat.atksp += 1;
    },
    // 攻击速度 + 1%
    3: stat => {
      stat.crt += 2;
    },
    // 暴击率 + 2%
    4: stat => {
      stat.crtd += 6;
    },
    // 暴击伤害 + 6%
    5: stat => {
      stat.heat += 3;
    },
    // 破防 + 3
    6: stat => {
      stat.hr += 1;
    } // 命中率 + 1%
  };
  const equipmentEnhanceMap = {
    'weapon': (stat, level) => {
      stat.atk += equipmentEnhanceTable.atk[level] || 0;
    },
    'helmet': (stat, level) => {
      stat.heat += equipmentEnhanceTable.heat[level] || 0;
    },
    'armor': (stat, level) => {
      stat.hr += equipmentEnhanceTable.rate[level] || 0;
    },
    'shoes': (stat, level) => {
      stat.atksp += equipmentEnhanceTable.rate[level] || 0;
    },
    'jewelry': (stat, level) => {
      stat.crt += equipmentEnhanceTable.rate[level] || 0;
      stat.crtd += equipmentEnhanceTable.crtd[level] || 0;
    }
  };
  const equipmentEnhanceTable = {
    atk: {
      1: 2,
      2: 3,
      3: 4,
      4: 6,
      5: 8,
      6: 10,
      7: 12,
      8: 14,
      9: 17,
      10: 21,
      11: 24,
      12: 27,
      13: 30,
      14: 33,
      15: 36,
      16: 36,
      17: 36,
      18: 36
    },
    heat: {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 6,
      6: 7,
      7: 9,
      8: 11,
      9: 13,
      10: 16,
      11: 18,
      12: 20,
      13: 22,
      14: 24,
      15: 26,
      16: 26,
      17: 26,
      18: 26
    },
    rate: {
      1: .4,
      2: .8,
      3: 1.2,
      4: 1.8,
      5: 2.4,
      6: 3.2,
      7: 4,
      8: 4.5,
      9: 5,
      10: 6,
      11: 6.5,
      12: 7,
      13: 7.5,
      14: 8,
      15: 8.5,
      16: 8.5,
      17: 8.5,
      18: 8.5
    },
    crtd: {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5.5,
      6: 7,
      7: 8.5,
      8: 10,
      9: 12,
      10: 13.5,
      11: 15,
      12: 16.5,
      13: 18,
      14: 19.5,
      15: 21,
      16: 21,
      17: 21,
      18: 21
    }
  };

  const characterInfo = {};

  // Update character info
  registMessageHandler(/^434\[/, obj => {
    if (!obj[0].data.itemList) {
      return obj;
    }
    Object.assign(characterInfo, obj[0].data);
    logMessage(`Character Info Updated ${characterInfo.id}`);
    setTimeout(() => {
      const parsed = parseCharacterEquipment();
      characterInfo.parsed = parsed;
      logMessage(`Character Equipment Parsed:`);
      logMessage(parsed);
      const attrPanel = document.querySelector(".user-attrs");
      let dpsEle = document.getElementById("wst-dps");
      if (!dpsEle) {
        dpsEle = document.createElement("div");
        dpsEle.id = "wst-dps";
        dpsEle.style.fontSize = "14px";
        attrPanel.insertBefore(dpsEle, attrPanel.firstElementChild?.nextElementSibling || attrPanel.firstElementChild);
      }
      dpsEle.innerText = `裸DPS估算: ${parsed.stats.dpsRaw.toFixed(0)}`;
    }, 1000);
    return obj;
  });

  // See user info
  registMessageHandler(/^4324\[/, obj => {
    logMessage(`Other Character Info Updated:`);
    logMessage(obj);
    return obj;
  });
  function parseCharacterEquipment() {
    const weaponList = characterInfo.equippedList || {};
    Object.entries(weaponList).forEach(([key, value]) => {
      const item = characterInfo.itemList.find(item => item.id === value);
      item.origin = equipmentsData[item.equipId];
      weaponList[key] = item;
    });
    const fightPet = (characterInfo.petList || []).find(pet => pet.id == characterInfo.fightPetId);
    const runeList = (characterInfo.runeEquippedList || []).map(rune => {
      rune = characterInfo.runeList.find(item => item.id === rune);
      rune.origin = runeData.runeCollection[rune.runeId];
      return rune;
    });
    const stats = {
      atk: 100,
      // 攻击
      atksp: 100,
      // 攻击速度
      crt: 0,
      // 暴击率
      crtd: 150,
      // 暴击伤害
      heat: 0,
      // 破防
      hr: 100,
      // 命中率
      voidDef: 0,
      // 抗魔
      ad: 0,
      // 全伤害加成

      waterDa: 0,
      fireDa: 0,
      windDa: 0,
      soilDa: 0,
      swiftness: 0,
      // 轻灵：攻速乘子
      swiftnessRune: 0,
      split: 1,
      // 分裂攻击次数期望
      splitRune: 0,
      chasing: 0,
      // 追击：攻击追加
      chasingRune: 0,
      heavyInjury: 0,
      // 重创：暴击追加
      heavyInjuryRune: 0,
      thump: 0,
      // 重击期望：概率额外伤害
      break: 0,
      // 破阵：攻击力追加
      sharp: 0,
      // 锋利：攻击时附加伤害
      tearInjury: 0 // 裂创：暴击时额外真实伤害
    };

    // 装备基础属性
    Object.entries(weaponList).forEach(([weaponType, weapon]) => {
      for (let starType of weapon.starAttrs || []) {
        starAttrMap[starType](stats);
      }
      // 升级属性加成
      equipmentEnhanceMap[weaponType](stats, Math.min(weapon.reinforcedLevel, 15));
      // +15后全伤害加成
      stats.ad += Math.max(weapon.reinforcedLevel - 15, 0) * 0.2;
      // 基础装备属性
      Object.entries(weapon.origin.attrs.basic).forEach(([attr, val]) => {
        stats[attr] += val;
      });
      // 附魔属性
      if (weapon.enchantAttr) {
        stats.voidDef += weapon.enchantAttr[0] * 10;
        stats.ad += weapon.enchantAttr[1];
      }
      // 暗金属性
      Object.entries(weapon?.darkGoldAttrs?.basic || {}).forEach(([attr, val]) => {
        stats[attr] += val;
      });
    });

    // 符石
    for (let rune of runeList) {
      // 符石基础属性
      const typeFactor = characterInfo.soulType == rune.origin.soulType ? 1.2 : 1.0;
      Object.entries(rune.attrs.basic).forEach(([attr, val]) => {
        // 系数
        const p = runeData.runeBasicFactor[attr] || 1.0;
        stats[attr] += val * p * typeFactor;
      });
      // 符石特殊属性
      for (let effect of rune.attrs?.special || []) {
        const key = `${effect.key}Rune`;
        const p = runeData.runeSpecialFactor[effect.key] || {};
        if (stats[key] !== undefined) {
          // TODO: 更多词条支持
          if (effect.data.extraRate) {
            stats[key] += effect.data.extraRate * (p?.extraRate || 1.0) * typeFactor;
          } else if (effect.data.extraValue) {
            stats[key] += effect.data.extraValue * (p?.extraValue || 1.0) * typeFactor;
          }
        }
      }
    }

    // 宠物基础属性
    Object.entries(fightPet?.fightAttrs || {}).forEach(([attr, val]) => {
      // 系数
      // const p = runeData.runeBasicFactor[attr] || 1.0;
      const p = 1.0;
      stats[attr] += val * p;
    });

    // 武器特效
    Object.entries(weaponList).forEach(([weaponType, weapon]) => {
      for (let effect of weapon.origin?.attrs?.special || []) {
        if (stats[effect.key] !== undefined) {
          const runeKey = `${effect.key}Rune`;
          // TODO: 更多词条支持
          if (effect.key === 'split') {
            const splitRate = effect.data.rate * (1 + stats.splitRune) / 100;
            stats.split = stats.split + splitRate * effect.data.value;
          } else if (effect.key === 'thump') {
            stats.thump = stats.thump + effect.data.rate / 100 * effect.data.value;
          } else if (effect.key === 'swiftness') {
            stats.swiftness += effect.data.value - 1 + stats.swiftnessRune;
          } else if (runeKey in stats) {
            stats[effect.key] += effect.data.value + stats[runeKey];
          } else if (effect.data.value) {
            stats[effect.key] += effect.data.value;
          } else if (effect.data.multiplier) {
            stats[effect.key] += effect.data.multiplier;
          }
        }
      }
    });

    // 最终攻击力计算
    stats.finalAtk = stats.atk * (1 + stats.break / 100);
    // 最终攻速计算
    stats.finalAtksp = (stats.atksp / 100 - 1) * (1 + stats.swiftness) + 1;
    // 拟合公式
    stats.actualAtksp = (38.097 * stats.finalAtksp ** 2 + 123.3 * stats.finalAtksp + 32.018) / 180;
    stats.dpsRaw = stats.actualAtksp * Math.min(stats.hr / 100, 1) * (stats.atk * Math.max(1 - stats.crt / 100, 0) + stats.crtd / 100 * stats.atk * Math.min(stats.crt / 100, 1) + stats.split * stats.chasing + stats.split * stats.heavyInjury * Math.min(stats.crt / 100, 1) + stats.split * stats.thump + stats.split * stats.tearInjury) * (1 + stats.sharp / 100) * (1 + stats.ad / 100);
    return {
      weaponList,
      fightPet,
      runeList,
      stats
    };
  }

  // https://github.com/tc39/proposal-iterator-helpers
  var $ = _export;
  var aCallable = aCallable$7;
  var anObject = anObject$d;
  var createIteratorProxy = iteratorCreateProxy;
  var callWithSafeIterationClosing = callWithSafeIterationClosing$2;

  var IteratorProxy = createIteratorProxy(function (args) {
    var iterator = this.iterator;
    var filterer = this.filterer;
    var next = this.next;
    var result, done, value;
    while (true) {
      result = anObject(next.apply(iterator, args));
      done = this.done = !!result.done;
      if (done) return;
      value = result.value;
      if (callWithSafeIterationClosing(iterator, filterer, value)) return value;
    }
  });

  $({ target: 'Iterator', proto: true, real: true }, {
    filter: function filter(filterer) {
      return new IteratorProxy({
        iterator: anObject(this),
        filterer: aCallable(filterer)
      });
    }
  });

  // 判断战斗时间内是否能打过
  let maxTime = 0;
  setInterval(() => {
    const dungeonPage = document.querySelector('.dungeon-page');
    let fightPage = dungeonPage.querySelector('.person-fight');
    if (fightPage.style.display === 'none') {
      fightPage = dungeonPage.querySelector('.team-fight');
    }
    if (fightPage.style.display !== 'none') {
      const timerEls = fightPage?.querySelectorAll('.fight-over-timer');
      const timerEl = timerEls[timerEls.length - 1];
      const timeLeft = parseFightTime(timerEl.innerText);
      if (maxTime === 0 && timeLeft > 30) {
        maxTime = 180;
      } else if (maxTime === 0 && timeLeft > 10) {
        maxTime = 30;
      }
      const timeLeftPercent = timeLeft / maxTime;
      const hpEl = fightPage.querySelector('.el-progress-bar__innerText');
      const hpLeftPercent = parseFloat(hpEl.innerText.replace(' %', '')) / 100;
      let diffEl = timerEl.parentElement.querySelector('.time-diff-indicator');
      if (!diffEl) {
        diffEl = document.createElement('div');
        diffEl.className = 'time-diff-indicator';
        diffEl.style.fontSize = '12px';
        diffEl.style.textAlign = 'center';
        timerEl.parentElement.appendChild(diffEl);
      }
      if (timeLeftPercent < hpLeftPercent - 0.02) {
        diffEl.style.backgroundColor = 'red';
      } else if (timeLeftPercent < hpLeftPercent + 0.01) {
        diffEl.style.backgroundColor = 'orange';
      } else if (timeLeftPercent < hpLeftPercent + 0.03) {
        diffEl.style.backgroundColor = 'yellow';
      } else {
        diffEl.style.backgroundColor = 'green';
      }
      diffEl.innerText = `(${((timeLeftPercent - hpLeftPercent) * 100).toFixed(2)}%)`;
    } else {
      maxTime = 0;
    }
  }, 1000);
  function parseFightTime(timeStr) {
    const [minutes, seconds] = timeStr.split(' : ').map(num => parseInt(num, 10));
    return minutes * 60 + seconds;
  }

  // Actual attack speed calculation
  const atkList = [];
  registMessageHandler(/^42\["fightRes/, obj => {
    const atkInfoList = obj[1].atkInfoList;
    atkList.push({
      atk: atkInfoList,
      timestamp: Date.now()
    });
    if (atkList.length > 500) {
      atkList.shift();
    }
  });
  setInterval(() => {
    const fightPage = document.querySelector('.fight-page');
    if (fightPage.style.display === 'none' || atkList.length < 1) {
      return;
    }
    const totalAtk = atkList.reduce((sum, atkInfo) => sum + atkInfo.atk.length, 0);
    const avgBasicAtkSpd = atkList.length / ((atkList[atkList.length - 1].timestamp - atkList[0].timestamp) / 1000);
    const avgAtkSpd = totalAtk / ((atkList[atkList.length - 1].timestamp - atkList[0].timestamp) / 1000);
    const fightUserList = document.querySelector('.fight-user-list');
    const hitAccuracy = atkList.reduce((sum, atkInfo) => {
      const unhitCount = atkInfo.atk.filter(atk => atk.unHit).length;
      return sum + (atkInfo.atk.length > 0 ? atkInfo.atk.length - unhitCount : 0);
    }, 0) / totalAtk;
    const criticalRate = atkList.reduce((sum, atkInfo) => {
      const criticalNum = atkInfo.atk.filter(atk => atk.trigger.includes('暴击')).length;
      return sum + (atkInfo.atk.length > 0 ? criticalNum : 0);
    }, 0) / totalAtk;
    let atkEl = document.querySelector('.actual-atk-speed');
    if (!atkEl) {
      atkEl = document.createElement('div');
      atkEl.className = 'actual-atk-speed';
      fightUserList.appendChild(atkEl);
    }
    atkEl.style.fontSize = '8px';
    atkEl.innerText = `实际攻速: ${avgAtkSpd.toFixed(3)}(${avgBasicAtkSpd.toFixed(3)}) 次/秒`;
    atkEl.appendChild(document.createElement('br'));
    atkEl.innerText += `命中率: ${(hitAccuracy * 100).toFixed(2)}% 暴击率: ${(criticalRate * 100).toFixed(2)}%`;
  }, 1000);

  hookWS();
  hookHTTP();
  logMessage("WarSoul-Tools loaded.");

})();
