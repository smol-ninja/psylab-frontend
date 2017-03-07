"no use strict";
;(function(window) {
if (typeof window.window != "undefined" && window.document) {
    return;
}

window.console = function() {
    var msgs = Array.prototype.slice.call(arguments, 0);
    postMessage({type: "log", data: msgs});
};
window.console.error =
window.console.warn = 
window.console.log =
window.console.trace = window.console;

window.window = window;
window.ace = window;

window.onerror = function(message, file, line, col, err) {
    console.error("Worker " + (err ? err.stack : message));
};

window.normalizeModule = function(parentId, moduleName) {
    if (moduleName.indexOf("!") !== -1) {
        var chunks = moduleName.split("!");
        return window.normalizeModule(parentId, chunks[0]) + "!" + window.normalizeModule(parentId, chunks[1]);
    }
    if (moduleName.charAt(0) == ".") {
        var base = parentId.split("/").slice(0, -1).join("/");
        moduleName = (base ? base + "/" : "") + moduleName;
        
        while(moduleName.indexOf(".") !== -1 && previous != moduleName) {
            var previous = moduleName;
            moduleName = moduleName.replace(/^\.\//, "").replace(/\/\.\//, "/").replace(/[^\/]+\/\.\.\//, "");
        }
    }
    
    return moduleName;
};

window.require = function(parentId, id) {
    if (!id) {
        id = parentId;
        parentId = null;
    }
    if (!id.charAt)
        throw new Error("worker.js require() accepts only (parentId, id) as arguments");

    id = window.normalizeModule(parentId, id);

    var module = window.require.modules[id];
    if (module) {
        if (!module.initialized) {
            module.initialized = true;
            module.exports = module.factory().exports;
        }
        return module.exports;
    }
    
    var chunks = id.split("/");
    if (!window.require.tlns)
        return console.log("unable to load " + id);
    chunks[0] = window.require.tlns[chunks[0]] || chunks[0];
    var path = chunks.join("/") + ".js";
    
    window.require.id = id;
    importScripts(path);
    return window.require(parentId, id);
};
window.require.modules = {};
window.require.tlns = {};

window.define = function(id, deps, factory) {
    if (arguments.length == 2) {
        factory = deps;
        if (typeof id != "string") {
            deps = id;
            id = window.require.id;
        }
    } else if (arguments.length == 1) {
        factory = id;
        deps = [];
        id = window.require.id;
    }

    if (!deps.length)
        deps = ['require', 'exports', 'module'];

    if (id.indexOf("text!") === 0) 
        return;
    
    var req = function(childId) {
        return window.require(id, childId);
    };

    window.require.modules[id] = {
        exports: {},
        factory: function() {
            var module = this;
            var returnExports = factory.apply(this, deps.map(function(dep) {
              switch(dep) {
                  case 'require': return req;
                  case 'exports': return module.exports;
                  case 'module':  return module;
                  default:        return req(dep);
              }
            }));
            if (returnExports)
                module.exports = returnExports;
            return module;
        }
    };
};
window.define.amd = {};

window.initBaseUrls  = function initBaseUrls(topLevelNamespaces) {
    require.tlns = topLevelNamespaces;
};

window.initSender = function initSender() {

    var EventEmitter = window.require("ace/lib/event_emitter").EventEmitter;
    var oop = window.require("ace/lib/oop");
    
    var Sender = function() {};
    
    (function() {
        
        oop.implement(this, EventEmitter);
                
        this.callback = function(data, callbackId) {
            postMessage({
                type: "call",
                id: callbackId,
                data: data
            });
        };
    
        this.emit = function(name, data) {
            postMessage({
                type: "event",
                name: name,
                data: data
            });
        };
        
    }).call(Sender.prototype);
    
    return new Sender();
};

var main = window.main = null;
var sender = window.sender = null;

window.onmessage = function(e) {
    var msg = e.data;
    if (msg.command) {
        if (main[msg.command])
            main[msg.command].apply(main, msg.args);
        else
            throw new Error("Unknown command:" + msg.command);
    }
    else if (msg.init) {        
        initBaseUrls(msg.tlns);
        require("ace/lib/es5-shim");
        sender = window.sender = initSender();
        var clazz = require(msg.module)[msg.classname];
        main = window.main = new clazz(sender);
    } 
    else if (msg.event && sender) {
        sender._signal(msg.event, msg.data);
    }
};
})(this);// https://github.com/kriskowal/es5-shim

define('ace/lib/es5-shim', ['require', 'exports', 'module' ], function(require, exports, module) {

function Empty() {}

if (!Function.prototype.bind) {
    Function.prototype.bind = function bind(that) { // .length is 1
        var target = this;
        if (typeof target != "function") {
            throw new TypeError("Function.prototype.bind called on incompatible " + target);
        }
        var args = slice.call(arguments, 1); // for normal call
        var bound = function () {

            if (this instanceof bound) {

                var result = target.apply(
                    this,
                    args.concat(slice.call(arguments))
                );
                if (Object(result) === result) {
                    return result;
                }
                return this;

            } else {
                return target.apply(
                    that,
                    args.concat(slice.call(arguments))
                );

            }

        };
        if(target.prototype) {
            Empty.prototype = target.prototype;
            bound.prototype = new Empty();
            Empty.prototype = null;
        }
        return bound;
    };
}
var call = Function.prototype.call;
var prototypeOfArray = Array.prototype;
var prototypeOfObject = Object.prototype;
var slice = prototypeOfArray.slice;
var _toString = call.bind(prototypeOfObject.toString);
var owns = call.bind(prototypeOfObject.hasOwnProperty);
var defineGetter;
var defineSetter;
var lookupGetter;
var lookupSetter;
var supportsAccessors;
if ((supportsAccessors = owns(prototypeOfObject, "__defineGetter__"))) {
    defineGetter = call.bind(prototypeOfObject.__defineGetter__);
    defineSetter = call.bind(prototypeOfObject.__defineSetter__);
    lookupGetter = call.bind(prototypeOfObject.__lookupGetter__);
    lookupSetter = call.bind(prototypeOfObject.__lookupSetter__);
}
if ([1,2].splice(0).length != 2) {
    if(function() { // test IE < 9 to splice bug - see issue #138
        function makeArray(l) {
            var a = new Array(l+2);
            a[0] = a[1] = 0;
            return a;
        }
        var array = [], lengthBefore;
        
        array.splice.apply(array, makeArray(20));
        array.splice.apply(array, makeArray(26));

        lengthBefore = array.length; //46
        array.splice(5, 0, "XXX"); // add one element

        lengthBefore + 1 == array.length

        if (lengthBefore + 1 == array.length) {
            return true;// has right splice implementation without bugs
        }
    }()) {//IE 6/7
        var array_splice = Array.prototype.splice;
        Array.prototype.splice = function(start, deleteCount) {
            if (!arguments.length) {
                return [];
            } else {
                return array_splice.apply(this, [
                    start === void 0 ? 0 : start,
                    deleteCount === void 0 ? (this.length - start) : deleteCount
                ].concat(slice.call(arguments, 2)))
            }
        };
    } else {//IE8
        Array.prototype.splice = function(pos, removeCount){
            var length = this.length;
            if (pos > 0) {
                if (pos > length)
                    pos = length;
            } else if (pos == void 0) {
                pos = 0;
            } else if (pos < 0) {
                pos = Math.max(length + pos, 0);
            }

            if (!(pos+removeCount < length))
                removeCount = length - pos;

            var removed = this.slice(pos, pos+removeCount);
            var insert = slice.call(arguments, 2);
            var add = insert.length;            
            if (pos === length) {
                if (add) {
                    this.push.apply(this, insert);
                }
            } else {
                var remove = Math.min(removeCount, length - pos);
                var tailOldPos = pos + remove;
                var tailNewPos = tailOldPos + add - remove;
                var tailCount = length - tailOldPos;
                var lengthAfterRemove = length - remove;

                if (tailNewPos < tailOldPos) { // case A
                    for (var i = 0; i < tailCount; ++i) {
                        this[tailNewPos+i] = this[tailOldPos+i];
                    }
                } else if (tailNewPos > tailOldPos) { // case B
                    for (i = tailCount; i--; ) {
                        this[tailNewPos+i] = this[tailOldPos+i];
                    }
                } // else, add == remove (nothing to do)

                if (add && pos === lengthAfterRemove) {
                    this.length = lengthAfterRemove; // truncate array
                    this.push.apply(this, insert);
                } else {
                    this.length = lengthAfterRemove + add; // reserves space
                    for (i = 0; i < add; ++i) {
                        this[pos+i] = insert[i];
                    }
                }
            }
            return removed;
        };
    }
}
if (!Array.isArray) {
    Array.isArray = function isArray(obj) {
        return _toString(obj) == "[object Array]";
    };
}
var boxedString = Object("a"),
    splitString = boxedString[0] != "a" || !(0 in boxedString);

if (!Array.prototype.forEach) {
    Array.prototype.forEach = function forEach(fun /*, thisp*/) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            thisp = arguments[1],
            i = -1,
            length = self.length >>> 0;
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(); // TODO message
        }

        while (++i < length) {
            if (i in self) {
                fun.call(thisp, self[i], i, object);
            }
        }
    };
}
if (!Array.prototype.map) {
    Array.prototype.map = function map(fun /*, thisp*/) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0,
            result = Array(length),
            thisp = arguments[1];
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self)
                result[i] = fun.call(thisp, self[i], i, object);
        }
        return result;
    };
}
if (!Array.prototype.filter) {
    Array.prototype.filter = function filter(fun /*, thisp */) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                    object,
            length = self.length >>> 0,
            result = [],
            value,
            thisp = arguments[1];
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self) {
                value = self[i];
                if (fun.call(thisp, value, i, object)) {
                    result.push(value);
                }
            }
        }
        return result;
    };
}
if (!Array.prototype.every) {
    Array.prototype.every = function every(fun /*, thisp */) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0,
            thisp = arguments[1];
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self && !fun.call(thisp, self[i], i, object)) {
                return false;
            }
        }
        return true;
    };
}
if (!Array.prototype.some) {
    Array.prototype.some = function some(fun /*, thisp */) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0,
            thisp = arguments[1];
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }

        for (var i = 0; i < length; i++) {
            if (i in self && fun.call(thisp, self[i], i, object)) {
                return true;
            }
        }
        return false;
    };
}
if (!Array.prototype.reduce) {
    Array.prototype.reduce = function reduce(fun /*, initial*/) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0;
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }
        if (!length && arguments.length == 1) {
            throw new TypeError("reduce of empty array with no initial value");
        }

        var i = 0;
        var result;
        if (arguments.length >= 2) {
            result = arguments[1];
        } else {
            do {
                if (i in self) {
                    result = self[i++];
                    break;
                }
                if (++i >= length) {
                    throw new TypeError("reduce of empty array with no initial value");
                }
            } while (true);
        }

        for (; i < length; i++) {
            if (i in self) {
                result = fun.call(void 0, result, self[i], i, object);
            }
        }

        return result;
    };
}
if (!Array.prototype.reduceRight) {
    Array.prototype.reduceRight = function reduceRight(fun /*, initial*/) {
        var object = toObject(this),
            self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object,
            length = self.length >>> 0;
        if (_toString(fun) != "[object Function]") {
            throw new TypeError(fun + " is not a function");
        }
        if (!length && arguments.length == 1) {
            throw new TypeError("reduceRight of empty array with no initial value");
        }

        var result, i = length - 1;
        if (arguments.length >= 2) {
            result = arguments[1];
        } else {
            do {
                if (i in self) {
                    result = self[i--];
                    break;
                }
                if (--i < 0) {
                    throw new TypeError("reduceRight of empty array with no initial value");
                }
            } while (true);
        }

        do {
            if (i in this) {
                result = fun.call(void 0, result, self[i], i, object);
            }
        } while (i--);

        return result;
    };
}
if (!Array.prototype.indexOf || ([0, 1].indexOf(1, 2) != -1)) {
    Array.prototype.indexOf = function indexOf(sought /*, fromIndex */ ) {
        var self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                toObject(this),
            length = self.length >>> 0;

        if (!length) {
            return -1;
        }

        var i = 0;
        if (arguments.length > 1) {
            i = toInteger(arguments[1]);
        }
        i = i >= 0 ? i : Math.max(0, length + i);
        for (; i < length; i++) {
            if (i in self && self[i] === sought) {
                return i;
            }
        }
        return -1;
    };
}
if (!Array.prototype.lastIndexOf || ([0, 1].lastIndexOf(0, -3) != -1)) {
    Array.prototype.lastIndexOf = function lastIndexOf(sought /*, fromIndex */) {
        var self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                toObject(this),
            length = self.length >>> 0;

        if (!length) {
            return -1;
        }
        var i = length - 1;
        if (arguments.length > 1) {
            i = Math.min(i, toInteger(arguments[1]));
        }
        i = i >= 0 ? i : length - Math.abs(i);
        for (; i >= 0; i--) {
            if (i in self && sought === self[i]) {
                return i;
            }
        }
        return -1;
    };
}
if (!Object.getPrototypeOf) {
    Object.getPrototypeOf = function getPrototypeOf(object) {
        return object.__proto__ || (
            object.constructor ?
            object.constructor.prototype :
            prototypeOfObject
        );
    };
}
if (!Object.getOwnPropertyDescriptor) {
    var ERR_NON_OBJECT = "Object.getOwnPropertyDescriptor called on a " +
                         "non-object: ";
    Object.getOwnPropertyDescriptor = function getOwnPropertyDescriptor(object, property) {
        if ((typeof object != "object" && typeof object != "function") || object === null)
            throw new TypeError(ERR_NON_OBJECT + object);
        if (!owns(object, property))
            return;

        var descriptor, getter, setter;
        descriptor =  { enumerable: true, configurable: true };
        if (supportsAccessors) {
            var prototype = object.__proto__;
            object.__proto__ = prototypeOfObject;

            var getter = lookupGetter(object, property);
            var setter = lookupSetter(object, property);
            object.__proto__ = prototype;

            if (getter || setter) {
                if (getter) descriptor.get = getter;
                if (setter) descriptor.set = setter;
                return descriptor;
            }
        }
        descriptor.value = object[property];
        return descriptor;
    };
}
if (!Object.getOwnPropertyNames) {
    Object.getOwnPropertyNames = function getOwnPropertyNames(object) {
        return Object.keys(object);
    };
}
if (!Object.create) {
    var createEmpty;
    if (Object.prototype.__proto__ === null) {
        createEmpty = function () {
            return { "__proto__": null };
        };
    } else {
        createEmpty = function () {
            var empty = {};
            for (var i in empty)
                empty[i] = null;
            empty.constructor =
            empty.hasOwnProperty =
            empty.propertyIsEnumerable =
            empty.isPrototypeOf =
            empty.toLocaleString =
            empty.toString =
            empty.valueOf =
            empty.__proto__ = null;
            return empty;
        }
    }

    Object.create = function create(prototype, properties) {
        var object;
        if (prototype === null) {
            object = createEmpty();
        } else {
            if (typeof prototype != "object")
                throw new TypeError("typeof prototype["+(typeof prototype)+"] != 'object'");
            var Type = function () {};
            Type.prototype = prototype;
            object = new Type();
            object.__proto__ = prototype;
        }
        if (properties !== void 0)
            Object.defineProperties(object, properties);
        return object;
    };
}

function doesDefinePropertyWork(object) {
    try {
        Object.defineProperty(object, "sentinel", {});
        return "sentinel" in object;
    } catch (exception) {
    }
}
if (Object.defineProperty) {
    var definePropertyWorksOnObject = doesDefinePropertyWork({});
    var definePropertyWorksOnDom = typeof document == "undefined" ||
        doesDefinePropertyWork(document.createElement("div"));
    if (!definePropertyWorksOnObject || !definePropertyWorksOnDom) {
        var definePropertyFallback = Object.defineProperty;
    }
}

if (!Object.defineProperty || definePropertyFallback) {
    var ERR_NON_OBJECT_DESCRIPTOR = "Property description must be an object: ";
    var ERR_NON_OBJECT_TARGET = "Object.defineProperty called on non-object: "
    var ERR_ACCESSORS_NOT_SUPPORTED = "getters & setters can not be defined " +
                                      "on this javascript engine";

    Object.defineProperty = function defineProperty(object, property, descriptor) {
        if ((typeof object != "object" && typeof object != "function") || object === null)
            throw new TypeError(ERR_NON_OBJECT_TARGET + object);
        if ((typeof descriptor != "object" && typeof descriptor != "function") || descriptor === null)
            throw new TypeError(ERR_NON_OBJECT_DESCRIPTOR + descriptor);
        if (definePropertyFallback) {
            try {
                return definePropertyFallback.call(Object, object, property, descriptor);
            } catch (exception) {
            }
        }
        if (owns(descriptor, "value")) {

            if (supportsAccessors && (lookupGetter(object, property) ||
                                      lookupSetter(object, property)))
            {
                var prototype = object.__proto__;
                object.__proto__ = prototypeOfObject;
                delete object[property];
                object[property] = descriptor.value;
                object.__proto__ = prototype;
            } else {
                object[property] = descriptor.value;
            }
        } else {
            if (!supportsAccessors)
                throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
            if (owns(descriptor, "get"))
                defineGetter(object, property, descriptor.get);
            if (owns(descriptor, "set"))
                defineSetter(object, property, descriptor.set);
        }

        return object;
    };
}
if (!Object.defineProperties) {
    Object.defineProperties = function defineProperties(object, properties) {
        for (var property in properties) {
            if (owns(properties, property))
                Object.defineProperty(object, property, properties[property]);
        }
        return object;
    };
}
if (!Object.seal) {
    Object.seal = function seal(object) {
        return object;
    };
}
if (!Object.freeze) {
    Object.freeze = function freeze(object) {
        return object;
    };
}
try {
    Object.freeze(function () {});
} catch (exception) {
    Object.freeze = (function freeze(freezeObject) {
        return function freeze(object) {
            if (typeof object == "function") {
                return object;
            } else {
                return freezeObject(object);
            }
        };
    })(Object.freeze);
}
if (!Object.preventExtensions) {
    Object.preventExtensions = function preventExtensions(object) {
        return object;
    };
}
if (!Object.isSealed) {
    Object.isSealed = function isSealed(object) {
        return false;
    };
}
if (!Object.isFrozen) {
    Object.isFrozen = function isFrozen(object) {
        return false;
    };
}
if (!Object.isExtensible) {
    Object.isExtensible = function isExtensible(object) {
        if (Object(object) === object) {
            throw new TypeError(); // TODO message
        }
        var name = '';
        while (owns(object, name)) {
            name += '?';
        }
        object[name] = true;
        var returnValue = owns(object, name);
        delete object[name];
        return returnValue;
    };
}
if (!Object.keys) {
    var hasDontEnumBug = true,
        dontEnums = [
            "toString",
            "toLocaleString",
            "valueOf",
            "hasOwnProperty",
            "isPrototypeOf",
            "propertyIsEnumerable",
            "constructor"
        ],
        dontEnumsLength = dontEnums.length;

    for (var key in {"toString": null}) {
        hasDontEnumBug = false;
    }

    Object.keys = function keys(object) {

        if (
            (typeof object != "object" && typeof object != "function") ||
            object === null
        ) {
            throw new TypeError("Object.keys called on a non-object");
        }

        var keys = [];
        for (var name in object) {
            if (owns(object, name)) {
                keys.push(name);
            }
        }

        if (hasDontEnumBug) {
            for (var i = 0, ii = dontEnumsLength; i < ii; i++) {
                var dontEnum = dontEnums[i];
                if (owns(object, dontEnum)) {
                    keys.push(dontEnum);
                }
            }
        }
        return keys;
    };

}
if (!Date.now) {
    Date.now = function now() {
        return new Date().getTime();
    };
}
var ws = "\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003" +
    "\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028" +
    "\u2029\uFEFF";
if (!String.prototype.trim || ws.trim()) {
    ws = "[" + ws + "]";
    var trimBeginRegexp = new RegExp("^" + ws + ws + "*"),
        trimEndRegexp = new RegExp(ws + ws + "*$");
    String.prototype.trim = function trim() {
        return String(this).replace(trimBeginRegexp, "").replace(trimEndRegexp, "");
    };
}

function toInteger(n) {
    n = +n;
    if (n !== n) { // isNaN
        n = 0;
    } else if (n !== 0 && n !== (1/0) && n !== -(1/0)) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
    }
    return n;
}

function isPrimitive(input) {
    var type = typeof input;
    return (
        input === null ||
        type === "undefined" ||
        type === "boolean" ||
        type === "number" ||
        type === "string"
    );
}

function toPrimitive(input) {
    var val, valueOf, toString;
    if (isPrimitive(input)) {
        return input;
    }
    valueOf = input.valueOf;
    if (typeof valueOf === "function") {
        val = valueOf.call(input);
        if (isPrimitive(val)) {
            return val;
        }
    }
    toString = input.toString;
    if (typeof toString === "function") {
        val = toString.call(input);
        if (isPrimitive(val)) {
            return val;
        }
    }
    throw new TypeError();
}
var toObject = function (o) {
    if (o == null) { // this matches both null and undefined
        throw new TypeError("can't convert "+o+" to object");
    }
    return Object(o);
};

});

define('ace/mode/python_worker', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/worker/mirror', 'ace/mode/python/skulpt'], function(require, exports, module) {


var oop = require("../lib/oop");
var Mirror = require("../worker/mirror").Mirror;
var Sk = require("./python/skulpt").Sk;

var PythonWorker = exports.PythonWorker = function(sender) {
    Mirror.call(this, sender);
    this.setTimeout(500);
};

oop.inherits(PythonWorker, Mirror);

(function() {

    this.onUpdate = function() {
        var value = this.doc.getValue();
        var errors = [];
        try {
            Sk.parse('', value);
        } catch(e) {
            var message;
            if (e instanceof Sk.builtin.IndentationError)
                message = 'IndentationError: ' + e.args.v[0].v;
            else if (e instanceof Sk.builtin.ParseError) // it should be SyntaxError
                message = 'SyntaxError: invalid syntax';
            else
                throw e;
            errors.push({
                row: e.lineno - 1,
                column: e.colno == '<unknown>' ? null : e.colno,
                text: message,
                type: "error"
            });
        }

        if (errors.length) {
            this.sender.emit("error", errors);
        } else {
            this.sender.emit("ok");
        }
    };

}).call(PythonWorker.prototype);

});

define('ace/lib/oop', ['require', 'exports', 'module' ], function(require, exports, module) {


exports.inherits = function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });
};

exports.mixin = function(obj, mixin) {
    for (var key in mixin) {
        obj[key] = mixin[key];
    }
    return obj;
};

exports.implement = function(proto, mixin) {
    exports.mixin(proto, mixin);
};

});
define('ace/worker/mirror', ['require', 'exports', 'module' , 'ace/document', 'ace/lib/lang'], function(require, exports, module) {


var Document = require("../document").Document;
var lang = require("../lib/lang");
    
var Mirror = exports.Mirror = function(sender) {
    this.sender = sender;
    var doc = this.doc = new Document("");
    
    var deferredUpdate = this.deferredUpdate = lang.delayedCall(this.onUpdate.bind(this));
    
    var _self = this;
    sender.on("change", function(e) {
        doc.applyDeltas(e.data);
        if (_self.$timeout)
            return deferredUpdate.schedule(_self.$timeout);
        _self.onUpdate();
    });
};

(function() {
    
    this.$timeout = 500;
    
    this.setTimeout = function(timeout) {
        this.$timeout = timeout;
    };
    
    this.setValue = function(value) {
        this.doc.setValue(value);
        this.deferredUpdate.schedule(this.$timeout);
    };
    
    this.getValue = function(callbackId) {
        this.sender.callback(this.doc.getValue(), callbackId);
    };
    
    this.onUpdate = function() {
    };
    
    this.isPending = function() {
        return this.deferredUpdate.isPending();
    };
    
}).call(Mirror.prototype);

});

define('ace/document', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/lib/event_emitter', 'ace/range', 'ace/anchor'], function(require, exports, module) {


var oop = require("./lib/oop");
var EventEmitter = require("./lib/event_emitter").EventEmitter;
var Range = require("./range").Range;
var Anchor = require("./anchor").Anchor;

var Document = function(text) {
    this.$lines = [];
    if (text.length === 0) {
        this.$lines = [""];
    } else if (Array.isArray(text)) {
        this._insertLines(0, text);
    } else {
        this.insert({row: 0, column:0}, text);
    }
};

(function() {

    oop.implement(this, EventEmitter);
    this.setValue = function(text) {
        var len = this.getLength();
        this.remove(new Range(0, 0, len, this.getLine(len-1).length));
        this.insert({row: 0, column:0}, text);
    };
    this.getValue = function() {
        return this.getAllLines().join(this.getNewLineCharacter());
    };
    this.createAnchor = function(row, column) {
        return new Anchor(this, row, column);
    };
    if ("aaa".split(/a/).length === 0)
        this.$split = function(text) {
            return text.replace(/\r\n|\r/g, "\n").split("\n");
        };
    else
        this.$split = function(text) {
            return text.split(/\r\n|\r|\n/);
        };


    this.$detectNewLine = function(text) {
        var match = text.match(/^.*?(\r\n|\r|\n)/m);
        this.$autoNewLine = match ? match[1] : "\n";
        this._signal("changeNewLineMode");
    };
    this.getNewLineCharacter = function() {
        switch (this.$newLineMode) {
          case "windows":
            return "\r\n";
          case "unix":
            return "\n";
          default:
            return this.$autoNewLine || "\n";
        }
    };

    this.$autoNewLine = "";
    this.$newLineMode = "auto";
    this.setNewLineMode = function(newLineMode) {
        if (this.$newLineMode === newLineMode)
            return;

        this.$newLineMode = newLineMode;
        this._signal("changeNewLineMode");
    };
    this.getNewLineMode = function() {
        return this.$newLineMode;
    };
    this.isNewLine = function(text) {
        return (text == "\r\n" || text == "\r" || text == "\n");
    };
    this.getLine = function(row) {
        return this.$lines[row] || "";
    };
    this.getLines = function(firstRow, lastRow) {
        return this.$lines.slice(firstRow, lastRow + 1);
    };
    this.getAllLines = function() {
        return this.getLines(0, this.getLength());
    };
    this.getLength = function() {
        return this.$lines.length;
    };
    this.getTextRange = function(range) {
        if (range.start.row == range.end.row) {
            return this.getLine(range.start.row)
                .substring(range.start.column, range.end.column);
        }
        var lines = this.getLines(range.start.row, range.end.row);
        lines[0] = (lines[0] || "").substring(range.start.column);
        var l = lines.length - 1;
        if (range.end.row - range.start.row == l)
            lines[l] = lines[l].substring(0, range.end.column);
        return lines.join(this.getNewLineCharacter());
    };

    this.$clipPosition = function(position) {
        var length = this.getLength();
        if (position.row >= length) {
            position.row = Math.max(0, length - 1);
            position.column = this.getLine(length-1).length;
        } else if (position.row < 0)
            position.row = 0;
        return position;
    };
    this.insert = function(position, text) {
        if (!text || text.length === 0)
            return position;

        position = this.$clipPosition(position);
        if (this.getLength() <= 1)
            this.$detectNewLine(text);

        var lines = this.$split(text);
        var firstLine = lines.splice(0, 1)[0];
        var lastLine = lines.length == 0 ? null : lines.splice(lines.length - 1, 1)[0];

        position = this.insertInLine(position, firstLine);
        if (lastLine !== null) {
            position = this.insertNewLine(position); // terminate first line
            position = this._insertLines(position.row, lines);
            position = this.insertInLine(position, lastLine || "");
        }
        return position;
    };
    this.insertLines = function(row, lines) {
        if (row >= this.getLength())
            return this.insert({row: row, column: 0}, "\n" + lines.join("\n"));
        return this._insertLines(Math.max(row, 0), lines);
    };
    this._insertLines = function(row, lines) {
        if (lines.length == 0)
            return {row: row, column: 0};
        while (lines.length > 0xF000) {
            var end = this._insertLines(row, lines.slice(0, 0xF000));
            lines = lines.slice(0xF000);
            row = end.row;
        }

        var args = [row, 0];
        args.push.apply(args, lines);
        this.$lines.splice.apply(this.$lines, args);

        var range = new Range(row, 0, row + lines.length, 0);
        var delta = {
            action: "insertLines",
            range: range,
            lines: lines
        };
        this._signal("change", { data: delta });
        return range.end;
    };
    this.insertNewLine = function(position) {
        position = this.$clipPosition(position);
        var line = this.$lines[position.row] || "";

        this.$lines[position.row] = line.substring(0, position.column);
        this.$lines.splice(position.row + 1, 0, line.substring(position.column, line.length));

        var end = {
            row : position.row + 1,
            column : 0
        };

        var delta = {
            action: "insertText",
            range: Range.fromPoints(position, end),
            text: this.getNewLineCharacter()
        };
        this._signal("change", { data: delta });

        return end;
    };
    this.insertInLine = function(position, text) {
        if (text.length == 0)
            return position;

        var line = this.$lines[position.row] || "";

        this.$lines[position.row] = line.substring(0, position.column) + text
                + line.substring(position.column);

        var end = {
            row : position.row,
            column : position.column + text.length
        };

        var delta = {
            action: "insertText",
            range: Range.fromPoints(position, end),
            text: text
        };
        this._signal("change", { data: delta });

        return end;
    };
    this.remove = function(range) {
        if (!(range instanceof Range))
            range = Range.fromPoints(range.start, range.end);
        range.start = this.$clipPosition(range.start);
        range.end = this.$clipPosition(range.end);

        if (range.isEmpty())
            return range.start;

        var firstRow = range.start.row;
        var lastRow = range.end.row;

        if (range.isMultiLine()) {
            var firstFullRow = range.start.column == 0 ? firstRow : firstRow + 1;
            var lastFullRow = lastRow - 1;

            if (range.end.column > 0)
                this.removeInLine(lastRow, 0, range.end.column);

            if (lastFullRow >= firstFullRow)
                this._removeLines(firstFullRow, lastFullRow);

            if (firstFullRow != firstRow) {
                this.removeInLine(firstRow, range.start.column, this.getLine(firstRow).length);
                this.removeNewLine(range.start.row);
            }
        }
        else {
            this.removeInLine(firstRow, range.start.column, range.end.column);
        }
        return range.start;
    };
    this.removeInLine = function(row, startColumn, endColumn) {
        if (startColumn == endColumn)
            return;

        var range = new Range(row, startColumn, row, endColumn);
        var line = this.getLine(row);
        var removed = line.substring(startColumn, endColumn);
        var newLine = line.substring(0, startColumn) + line.substring(endColumn, line.length);
        this.$lines.splice(row, 1, newLine);

        var delta = {
            action: "removeText",
            range: range,
            text: removed
        };
        this._signal("change", { data: delta });
        return range.start;
    };
    this.removeLines = function(firstRow, lastRow) {
        if (firstRow < 0 || lastRow >= this.getLength())
            return this.remove(new Range(firstRow, 0, lastRow + 1, 0));
        return this._removeLines(firstRow, lastRow);
    };

    this._removeLines = function(firstRow, lastRow) {
        var range = new Range(firstRow, 0, lastRow + 1, 0);
        var removed = this.$lines.splice(firstRow, lastRow - firstRow + 1);

        var delta = {
            action: "removeLines",
            range: range,
            nl: this.getNewLineCharacter(),
            lines: removed
        };
        this._signal("change", { data: delta });
        return removed;
    };
    this.removeNewLine = function(row) {
        var firstLine = this.getLine(row);
        var secondLine = this.getLine(row+1);

        var range = new Range(row, firstLine.length, row+1, 0);
        var line = firstLine + secondLine;

        this.$lines.splice(row, 2, line);

        var delta = {
            action: "removeText",
            range: range,
            text: this.getNewLineCharacter()
        };
        this._signal("change", { data: delta });
    };
    this.replace = function(range, text) {
        if (!(range instanceof Range))
            range = Range.fromPoints(range.start, range.end);
        if (text.length == 0 && range.isEmpty())
            return range.start;
        if (text == this.getTextRange(range))
            return range.end;

        this.remove(range);
        if (text) {
            var end = this.insert(range.start, text);
        }
        else {
            end = range.start;
        }

        return end;
    };
    this.applyDeltas = function(deltas) {
        for (var i=0; i<deltas.length; i++) {
            var delta = deltas[i];
            var range = Range.fromPoints(delta.range.start, delta.range.end);

            if (delta.action == "insertLines")
                this.insertLines(range.start.row, delta.lines);
            else if (delta.action == "insertText")
                this.insert(range.start, delta.text);
            else if (delta.action == "removeLines")
                this._removeLines(range.start.row, range.end.row - 1);
            else if (delta.action == "removeText")
                this.remove(range);
        }
    };
    this.revertDeltas = function(deltas) {
        for (var i=deltas.length-1; i>=0; i--) {
            var delta = deltas[i];

            var range = Range.fromPoints(delta.range.start, delta.range.end);

            if (delta.action == "insertLines")
                this._removeLines(range.start.row, range.end.row - 1);
            else if (delta.action == "insertText")
                this.remove(range);
            else if (delta.action == "removeLines")
                this._insertLines(range.start.row, delta.lines);
            else if (delta.action == "removeText")
                this.insert(range.start, delta.text);
        }
    };
    this.indexToPosition = function(index, startRow) {
        var lines = this.$lines || this.getAllLines();
        var newlineLength = this.getNewLineCharacter().length;
        for (var i = startRow || 0, l = lines.length; i < l; i++) {
            index -= lines[i].length + newlineLength;
            if (index < 0)
                return {row: i, column: index + lines[i].length + newlineLength};
        }
        return {row: l-1, column: lines[l-1].length};
    };
    this.positionToIndex = function(pos, startRow) {
        var lines = this.$lines || this.getAllLines();
        var newlineLength = this.getNewLineCharacter().length;
        var index = 0;
        var row = Math.min(pos.row, lines.length);
        for (var i = startRow || 0; i < row; ++i)
            index += lines[i].length + newlineLength;

        return index + pos.column;
    };

}).call(Document.prototype);

exports.Document = Document;
});

define('ace/lib/event_emitter', ['require', 'exports', 'module' ], function(require, exports, module) {


var EventEmitter = {};
var stopPropagation = function() { this.propagationStopped = true; };
var preventDefault = function() { this.defaultPrevented = true; };

EventEmitter._emit =
EventEmitter._dispatchEvent = function(eventName, e) {
    this._eventRegistry || (this._eventRegistry = {});
    this._defaultHandlers || (this._defaultHandlers = {});

    var listeners = this._eventRegistry[eventName] || [];
    var defaultHandler = this._defaultHandlers[eventName];
    if (!listeners.length && !defaultHandler)
        return;

    if (typeof e != "object" || !e)
        e = {};

    if (!e.type)
        e.type = eventName;
    if (!e.stopPropagation)
        e.stopPropagation = stopPropagation;
    if (!e.preventDefault)
        e.preventDefault = preventDefault;

    listeners = listeners.slice();
    for (var i=0; i<listeners.length; i++) {
        listeners[i](e, this);
        if (e.propagationStopped)
            break;
    }
    
    if (defaultHandler && !e.defaultPrevented)
        return defaultHandler(e, this);
};


EventEmitter._signal = function(eventName, e) {
    var listeners = (this._eventRegistry || {})[eventName];
    if (!listeners)
        return;
    listeners = listeners.slice();
    for (var i=0; i<listeners.length; i++)
        listeners[i](e, this);
};

EventEmitter.once = function(eventName, callback) {
    var _self = this;
    callback && this.addEventListener(eventName, function newCallback() {
        _self.removeEventListener(eventName, newCallback);
        callback.apply(null, arguments);
    });
};


EventEmitter.setDefaultHandler = function(eventName, callback) {
    var handlers = this._defaultHandlers
    if (!handlers)
        handlers = this._defaultHandlers = {_disabled_: {}};
    
    if (handlers[eventName]) {
        var old = handlers[eventName];
        var disabled = handlers._disabled_[eventName];
        if (!disabled)
            handlers._disabled_[eventName] = disabled = [];
        disabled.push(old);
        var i = disabled.indexOf(callback);
        if (i != -1) 
            disabled.splice(i, 1);
    }
    handlers[eventName] = callback;
};
EventEmitter.removeDefaultHandler = function(eventName, callback) {
    var handlers = this._defaultHandlers
    if (!handlers)
        return;
    var disabled = handlers._disabled_[eventName];
    
    if (handlers[eventName] == callback) {
        var old = handlers[eventName];
        if (disabled)
            this.setDefaultHandler(eventName, disabled.pop());
    } else if (disabled) {
        var i = disabled.indexOf(callback);
        if (i != -1)
            disabled.splice(i, 1);
    }
};

EventEmitter.on =
EventEmitter.addEventListener = function(eventName, callback, capturing) {
    this._eventRegistry = this._eventRegistry || {};

    var listeners = this._eventRegistry[eventName];
    if (!listeners)
        listeners = this._eventRegistry[eventName] = [];

    if (listeners.indexOf(callback) == -1)
        listeners[capturing ? "unshift" : "push"](callback);
    return callback;
};

EventEmitter.off =
EventEmitter.removeListener =
EventEmitter.removeEventListener = function(eventName, callback) {
    this._eventRegistry = this._eventRegistry || {};

    var listeners = this._eventRegistry[eventName];
    if (!listeners)
        return;

    var index = listeners.indexOf(callback);
    if (index !== -1)
        listeners.splice(index, 1);
};

EventEmitter.removeAllListeners = function(eventName) {
    if (this._eventRegistry) this._eventRegistry[eventName] = [];
};

exports.EventEmitter = EventEmitter;

});

define('ace/range', ['require', 'exports', 'module' ], function(require, exports, module) {

var comparePoints = function(p1, p2) {
    return p1.row - p2.row || p1.column - p2.column;
};
var Range = function(startRow, startColumn, endRow, endColumn) {
    this.start = {
        row: startRow,
        column: startColumn
    };

    this.end = {
        row: endRow,
        column: endColumn
    };
};

(function() {
    this.isEqual = function(range) {
        return this.start.row === range.start.row &&
            this.end.row === range.end.row &&
            this.start.column === range.start.column &&
            this.end.column === range.end.column;
    };
    this.toString = function() {
        return ("Range: [" + this.start.row + "/" + this.start.column +
            "] -> [" + this.end.row + "/" + this.end.column + "]");
    };

    this.contains = function(row, column) {
        return this.compare(row, column) == 0;
    };
    this.compareRange = function(range) {
        var cmp,
            end = range.end,
            start = range.start;

        cmp = this.compare(end.row, end.column);
        if (cmp == 1) {
            cmp = this.compare(start.row, start.column);
            if (cmp == 1) {
                return 2;
            } else if (cmp == 0) {
                return 1;
            } else {
                return 0;
            }
        } else if (cmp == -1) {
            return -2;
        } else {
            cmp = this.compare(start.row, start.column);
            if (cmp == -1) {
                return -1;
            } else if (cmp == 1) {
                return 42;
            } else {
                return 0;
            }
        }
    };
    this.comparePoint = function(p) {
        return this.compare(p.row, p.column);
    };
    this.containsRange = function(range) {
        return this.comparePoint(range.start) == 0 && this.comparePoint(range.end) == 0;
    };
    this.intersects = function(range) {
        var cmp = this.compareRange(range);
        return (cmp == -1 || cmp == 0 || cmp == 1);
    };
    this.isEnd = function(row, column) {
        return this.end.row == row && this.end.column == column;
    };
    this.isStart = function(row, column) {
        return this.start.row == row && this.start.column == column;
    };
    this.setStart = function(row, column) {
        if (typeof row == "object") {
            this.start.column = row.column;
            this.start.row = row.row;
        } else {
            this.start.row = row;
            this.start.column = column;
        }
    };
    this.setEnd = function(row, column) {
        if (typeof row == "object") {
            this.end.column = row.column;
            this.end.row = row.row;
        } else {
            this.end.row = row;
            this.end.column = column;
        }
    };
    this.inside = function(row, column) {
        if (this.compare(row, column) == 0) {
            if (this.isEnd(row, column) || this.isStart(row, column)) {
                return false;
            } else {
                return true;
            }
        }
        return false;
    };
    this.insideStart = function(row, column) {
        if (this.compare(row, column) == 0) {
            if (this.isEnd(row, column)) {
                return false;
            } else {
                return true;
            }
        }
        return false;
    };
    this.insideEnd = function(row, column) {
        if (this.compare(row, column) == 0) {
            if (this.isStart(row, column)) {
                return false;
            } else {
                return true;
            }
        }
        return false;
    };
    this.compare = function(row, column) {
        if (!this.isMultiLine()) {
            if (row === this.start.row) {
                return column < this.start.column ? -1 : (column > this.end.column ? 1 : 0);
            };
        }

        if (row < this.start.row)
            return -1;

        if (row > this.end.row)
            return 1;

        if (this.start.row === row)
            return column >= this.start.column ? 0 : -1;

        if (this.end.row === row)
            return column <= this.end.column ? 0 : 1;

        return 0;
    };
    this.compareStart = function(row, column) {
        if (this.start.row == row && this.start.column == column) {
            return -1;
        } else {
            return this.compare(row, column);
        }
    };
    this.compareEnd = function(row, column) {
        if (this.end.row == row && this.end.column == column) {
            return 1;
        } else {
            return this.compare(row, column);
        }
    };
    this.compareInside = function(row, column) {
        if (this.end.row == row && this.end.column == column) {
            return 1;
        } else if (this.start.row == row && this.start.column == column) {
            return -1;
        } else {
            return this.compare(row, column);
        }
    };
    this.clipRows = function(firstRow, lastRow) {
        if (this.end.row > lastRow)
            var end = {row: lastRow + 1, column: 0};
        else if (this.end.row < firstRow)
            var end = {row: firstRow, column: 0};

        if (this.start.row > lastRow)
            var start = {row: lastRow + 1, column: 0};
        else if (this.start.row < firstRow)
            var start = {row: firstRow, column: 0};

        return Range.fromPoints(start || this.start, end || this.end);
    };
    this.extend = function(row, column) {
        var cmp = this.compare(row, column);

        if (cmp == 0)
            return this;
        else if (cmp == -1)
            var start = {row: row, column: column};
        else
            var end = {row: row, column: column};

        return Range.fromPoints(start || this.start, end || this.end);
    };

    this.isEmpty = function() {
        return (this.start.row === this.end.row && this.start.column === this.end.column);
    };
    this.isMultiLine = function() {
        return (this.start.row !== this.end.row);
    };
    this.clone = function() {
        return Range.fromPoints(this.start, this.end);
    };
    this.collapseRows = function() {
        if (this.end.column == 0)
            return new Range(this.start.row, 0, Math.max(this.start.row, this.end.row-1), 0)
        else
            return new Range(this.start.row, 0, this.end.row, 0)
    };
    this.toScreenRange = function(session) {
        var screenPosStart = session.documentToScreenPosition(this.start);
        var screenPosEnd = session.documentToScreenPosition(this.end);

        return new Range(
            screenPosStart.row, screenPosStart.column,
            screenPosEnd.row, screenPosEnd.column
        );
    };
    this.moveBy = function(row, column) {
        this.start.row += row;
        this.start.column += column;
        this.end.row += row;
        this.end.column += column;
    };

}).call(Range.prototype);
Range.fromPoints = function(start, end) {
    return new Range(start.row, start.column, end.row, end.column);
};
Range.comparePoints = comparePoints;

Range.comparePoints = function(p1, p2) {
    return p1.row - p2.row || p1.column - p2.column;
};


exports.Range = Range;
});

define('ace/anchor', ['require', 'exports', 'module' , 'ace/lib/oop', 'ace/lib/event_emitter'], function(require, exports, module) {


var oop = require("./lib/oop");
var EventEmitter = require("./lib/event_emitter").EventEmitter;

var Anchor = exports.Anchor = function(doc, row, column) {
    this.$onChange = this.onChange.bind(this);
    this.attach(doc);
    
    if (typeof column == "undefined")
        this.setPosition(row.row, row.column);
    else
        this.setPosition(row, column);
};

(function() {

    oop.implement(this, EventEmitter);
    this.getPosition = function() {
        return this.$clipPositionToDocument(this.row, this.column);
    };
    this.getDocument = function() {
        return this.document;
    };
    this.$insertRight = false;
    this.onChange = function(e) {
        var delta = e.data;
        var range = delta.range;

        if (range.start.row == range.end.row && range.start.row != this.row)
            return;

        if (range.start.row > this.row)
            return;

        if (range.start.row == this.row && range.start.column > this.column)
            return;

        var row = this.row;
        var column = this.column;
        var start = range.start;
        var end = range.end;

        if (delta.action === "insertText") {
            if (start.row === row && start.column <= column) {
                if (start.column === column && this.$insertRight) {
                } else if (start.row === end.row) {
                    column += end.column - start.column;
                } else {
                    column -= start.column;
                    row += end.row - start.row;
                }
            } else if (start.row !== end.row && start.row < row) {
                row += end.row - start.row;
            }
        } else if (delta.action === "insertLines") {
            if (start.row === row && column === 0 && this.$insertRight) {
            }
            else if (start.row <= row) {
                row += end.row - start.row;
            }
        } else if (delta.action === "removeText") {
            if (start.row === row && start.column < column) {
                if (end.column >= column)
                    column = start.column;
                else
                    column = Math.max(0, column - (end.column - start.column));

            } else if (start.row !== end.row && start.row < row) {
                if (end.row === row)
                    column = Math.max(0, column - end.column) + start.column;
                row -= (end.row - start.row);
            } else if (end.row === row) {
                row -= end.row - start.row;
                column = Math.max(0, column - end.column) + start.column;
            }
        } else if (delta.action == "removeLines") {
            if (start.row <= row) {
                if (end.row <= row)
                    row -= end.row - start.row;
                else {
                    row = start.row;
                    column = 0;
                }
            }
        }

        this.setPosition(row, column, true);
    };
    this.setPosition = function(row, column, noClip) {
        var pos;
        if (noClip) {
            pos = {
                row: row,
                column: column
            };
        } else {
            pos = this.$clipPositionToDocument(row, column);
        }

        if (this.row == pos.row && this.column == pos.column)
            return;

        var old = {
            row: this.row,
            column: this.column
        };

        this.row = pos.row;
        this.column = pos.column;
        this._signal("change", {
            old: old,
            value: pos
        });
    };
    this.detach = function() {
        this.document.removeEventListener("change", this.$onChange);
    };
    this.attach = function(doc) {
        this.document = doc || this.document;
        this.document.on("change", this.$onChange);
    };
    this.$clipPositionToDocument = function(row, column) {
        var pos = {};

        if (row >= this.document.getLength()) {
            pos.row = Math.max(0, this.document.getLength() - 1);
            pos.column = this.document.getLine(pos.row).length;
        }
        else if (row < 0) {
            pos.row = 0;
            pos.column = 0;
        }
        else {
            pos.row = row;
            pos.column = Math.min(this.document.getLine(pos.row).length, Math.max(0, column));
        }

        if (column < 0)
            pos.column = 0;

        return pos;
    };

}).call(Anchor.prototype);

});

define('ace/lib/lang', ['require', 'exports', 'module' ], function(require, exports, module) {


exports.last = function(a) {
    return a[a.length - 1];
};

exports.stringReverse = function(string) {
    return string.split("").reverse().join("");
};

exports.stringRepeat = function (string, count) {
    var result = '';
    while (count > 0) {
        if (count & 1)
            result += string;

        if (count >>= 1)
            string += string;
    }
    return result;
};

var trimBeginRegexp = /^\s\s*/;
var trimEndRegexp = /\s\s*$/;

exports.stringTrimLeft = function (string) {
    return string.replace(trimBeginRegexp, '');
};

exports.stringTrimRight = function (string) {
    return string.replace(trimEndRegexp, '');
};

exports.copyObject = function(obj) {
    var copy = {};
    for (var key in obj) {
        copy[key] = obj[key];
    }
    return copy;
};

exports.copyArray = function(array){
    var copy = [];
    for (var i=0, l=array.length; i<l; i++) {
        if (array[i] && typeof array[i] == "object")
            copy[i] = this.copyObject( array[i] );
        else 
            copy[i] = array[i];
    }
    return copy;
};

exports.deepCopy = function (obj) {
    if (typeof obj !== "object" || !obj)
        return obj;
    var cons = obj.constructor;
    if (cons === RegExp)
        return obj;
    
    var copy = cons();
    for (var key in obj) {
        if (typeof obj[key] === "object") {
            copy[key] = exports.deepCopy(obj[key]);
        } else {
            copy[key] = obj[key];
        }
    }
    return copy;
};

exports.arrayToMap = function(arr) {
    var map = {};
    for (var i=0; i<arr.length; i++) {
        map[arr[i]] = 1;
    }
    return map;

};

exports.createMap = function(props) {
    var map = Object.create(null);
    for (var i in props) {
        map[i] = props[i];
    }
    return map;
};
exports.arrayRemove = function(array, value) {
  for (var i = 0; i <= array.length; i++) {
    if (value === array[i]) {
      array.splice(i, 1);
    }
  }
};

exports.escapeRegExp = function(str) {
    return str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
};

exports.escapeHTML = function(str) {
    return str.replace(/&/g, "&#38;").replace(/"/g, "&#34;").replace(/'/g, "&#39;").replace(/</g, "&#60;");
};

exports.getMatchOffsets = function(string, regExp) {
    var matches = [];

    string.replace(regExp, function(str) {
        matches.push({
            offset: arguments[arguments.length-2],
            length: str.length
        });
    });

    return matches;
};
exports.deferredCall = function(fcn) {

    var timer = null;
    var callback = function() {
        timer = null;
        fcn();
    };

    var deferred = function(timeout) {
        deferred.cancel();
        timer = setTimeout(callback, timeout || 0);
        return deferred;
    };

    deferred.schedule = deferred;

    deferred.call = function() {
        this.cancel();
        fcn();
        return deferred;
    };

    deferred.cancel = function() {
        clearTimeout(timer);
        timer = null;
        return deferred;
    };
    
    deferred.isPending = function() {
        return timer;
    };

    return deferred;
};


exports.delayedCall = function(fcn, defaultTimeout) {
    var timer = null;
    var callback = function() {
        timer = null;
        fcn();
    };

    var _self = function(timeout) {
        if (timer == null)
            timer = setTimeout(callback, timeout || defaultTimeout);
    };

    _self.delay = function(timeout) {
        timer && clearTimeout(timer);
        timer = setTimeout(callback, timeout || defaultTimeout);
    };
    _self.schedule = _self;

    _self.call = function() {
        this.cancel();
        fcn();
    };

    _self.cancel = function() {
        timer && clearTimeout(timer);
        timer = null;
    };

    _self.isPending = function() {
        return timer;
    };

    return _self;
};
});
define('ace/mode/python/skulpt', ['require', 'exports', 'module' ], function(require, exports, module) {

(function(){var COMPILED=!0,goog=goog||{};goog.global=this;goog.exportPath_=function(a,b,c){a=a.split(".");c=c||goog.global;a[0]in c||!c.execScript||c.execScript("var "+a[0]);for(var d;a.length&&(d=a.shift());)a.length||void 0===b?c=c[d]?c[d]:c[d]={}:c[d]=b};goog.define=function(a,b){var c=b;COMPILED||goog.global.CLOSURE_DEFINES&&Object.prototype.hasOwnProperty.call(goog.global.CLOSURE_DEFINES,a)&&(c=goog.global.CLOSURE_DEFINES[a]);goog.exportPath_(a,c)};goog.DEBUG=!1;goog.LOCALE="en";goog.TRUSTED_SITE=!0;
goog.provide=function(a){if(!COMPILED){if(goog.isProvided_(a))throw Error('Namespace "'+a+'" already declared.');delete goog.implicitNamespaces_[a];for(var b=a;(b=b.substring(0,b.lastIndexOf(".")))&&!goog.getObjectByName(b);)goog.implicitNamespaces_[b]=!0}goog.exportPath_(a)};goog.setTestOnly=function(a){if(COMPILED&&!goog.DEBUG)throw a=a||"",Error("Importing test-only code into non-debug environment"+a?": "+a:".");};
COMPILED||(goog.isProvided_=function(a){return!goog.implicitNamespaces_[a]&&!!goog.getObjectByName(a)},goog.implicitNamespaces_={});goog.getObjectByName=function(a,b){for(var c=a.split("."),d=b||goog.global,e;e=c.shift();)if(goog.isDefAndNotNull(d[e]))d=d[e];else return null;return d};goog.globalize=function(a,b){var c=b||goog.global,d;for(d in a)c[d]=a[d]};
goog.addDependency=function(a,b,c){if(goog.DEPENDENCIES_ENABLED){var d;a=a.replace(/\\/g,"/");for(var e=goog.dependencies_,f=0;d=b[f];f++)e.nameToPath[d]=a,a in e.pathToNames||(e.pathToNames[a]={}),e.pathToNames[a][d]=!0;for(d=0;b=c[d];d++)a in e.requires||(e.requires[a]={}),e.requires[a][b]=!0}};goog.ENABLE_DEBUG_LOADER=!0;
goog.require=function(a){if(!COMPILED&&!goog.isProvided_(a)){if(goog.ENABLE_DEBUG_LOADER){var b=goog.getPathFromDeps_(a);if(b){goog.included_[b]=!0;goog.writeScripts_();return}}a="goog.require could not find: "+a;goog.global.console&&goog.global.console.error(a);throw Error(a);}};goog.basePath="";goog.nullFunction=function(){};goog.identityFunction=function(a,b){return a};goog.abstractMethod=function(){throw Error("unimplemented abstract method");};
goog.addSingletonGetter=function(a){a.getInstance=function(){if(a.instance_)return a.instance_;goog.DEBUG&&(goog.instantiatedSingletons_[goog.instantiatedSingletons_.length]=a);return a.instance_=new a}};goog.instantiatedSingletons_=[];goog.DEPENDENCIES_ENABLED=!COMPILED&&goog.ENABLE_DEBUG_LOADER;
goog.DEPENDENCIES_ENABLED&&(goog.included_={},goog.dependencies_={pathToNames:{},nameToPath:{},requires:{},visited:{},written:{}},goog.inHtmlDocument_=function(){var a=goog.global.document;return"undefined"!=typeof a&&"write"in a},goog.findBasePath_=function(){if(goog.global.CLOSURE_BASE_PATH)goog.basePath=goog.global.CLOSURE_BASE_PATH;else if(goog.inHtmlDocument_())for(var a=goog.global.document.getElementsByTagName("script"),b=a.length-1;0<=b;--b){var c=a[b].src,d=c.lastIndexOf("?"),d=-1==d?c.length:
d;if("base.js"==c.substr(d-7,7)){goog.basePath=c.substr(0,d-7);break}}},goog.importScript_=function(a){var b=goog.global.CLOSURE_IMPORT_SCRIPT||goog.writeScriptTag_;!goog.dependencies_.written[a]&&b(a)&&(goog.dependencies_.written[a]=!0)},goog.writeScriptTag_=function(a){if(goog.inHtmlDocument_()){var b=goog.global.document;if("complete"==b.readyState){if(/\bdeps.js$/.test(a))return!1;throw Error('Cannot write "'+a+'" after document load');}b.write('<script type="text/javascript" src="'+a+'">\x3c/script>');
return!0}return!1},goog.writeScripts_=function(){function a(e){if(!(e in d.written)){if(!(e in d.visited)&&(d.visited[e]=!0,e in d.requires))for(var g in d.requires[e])if(!goog.isProvided_(g))if(g in d.nameToPath)a(d.nameToPath[g]);else throw Error("Undefined nameToPath for "+g);e in c||(c[e]=!0,b.push(e))}}var b=[],c={},d=goog.dependencies_,e;for(e in goog.included_)d.written[e]||a(e);for(e=0;e<b.length;e++)if(b[e])goog.importScript_(goog.basePath+b[e]);else throw Error("Undefined script input");
},goog.getPathFromDeps_=function(a){return a in goog.dependencies_.nameToPath?goog.dependencies_.nameToPath[a]:null},goog.findBasePath_(),goog.global.CLOSURE_NO_DEPS||goog.importScript_(goog.basePath+"deps.js"));
goog.typeOf=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";
else if("function"==b&&"undefined"==typeof a.call)return"object";return b};goog.isDef=function(a){return void 0!==a};goog.isNull=function(a){return null===a};goog.isDefAndNotNull=function(a){return null!=a};goog.isArray=function(a){return"array"==goog.typeOf(a)};goog.isArrayLike=function(a){var b=goog.typeOf(a);return"array"==b||"object"==b&&"number"==typeof a.length};goog.isDateLike=function(a){return goog.isObject(a)&&"function"==typeof a.getFullYear};goog.isString=function(a){return"string"==typeof a};
goog.isBoolean=function(a){return"boolean"==typeof a};goog.isNumber=function(a){return"number"==typeof a};goog.isFunction=function(a){return"function"==goog.typeOf(a)};goog.isObject=function(a){var b=typeof a;return"object"==b&&null!=a||"function"==b};goog.getUid=function(a){return a[goog.UID_PROPERTY_]||(a[goog.UID_PROPERTY_]=++goog.uidCounter_)};goog.removeUid=function(a){"removeAttribute"in a&&a.removeAttribute(goog.UID_PROPERTY_);try{delete a[goog.UID_PROPERTY_]}catch(b){}};
goog.UID_PROPERTY_="closure_uid_"+(1E9*Math.random()>>>0);goog.uidCounter_=0;goog.getHashCode=goog.getUid;goog.removeHashCode=goog.removeUid;goog.cloneObject=function(a){var b=goog.typeOf(a);if("object"==b||"array"==b){if(a.clone)return a.clone();var b="array"==b?[]:{},c;for(c in a)b[c]=goog.cloneObject(a[c]);return b}return a};goog.bindNative_=function(a,b,c){return a.call.apply(a.bind,arguments)};
goog.bindJs_=function(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}};goog.bind=function(a,b,c){Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?goog.bind=goog.bindNative_:goog.bind=goog.bindJs_;return goog.bind.apply(null,arguments)};
goog.partial=function(a,b){var c=Array.prototype.slice.call(arguments,1);return function(){var b=Array.prototype.slice.call(arguments);b.unshift.apply(b,c);return a.apply(this,b)}};goog.mixin=function(a,b){for(var c in b)a[c]=b[c]};goog.now=goog.TRUSTED_SITE&&Date.now||function(){return+new Date};
goog.globalEval=function(a){if(goog.global.execScript)goog.global.execScript(a,"JavaScript");else if(goog.global.eval)if(null==goog.evalWorksForGlobals_&&(goog.global.eval("var _et_ = 1;"),"undefined"!=typeof goog.global._et_?(delete goog.global._et_,goog.evalWorksForGlobals_=!0):goog.evalWorksForGlobals_=!1),goog.evalWorksForGlobals_)goog.global.eval(a);else{var b=goog.global.document,c=b.createElement("script");c.type="text/javascript";c.defer=!1;c.appendChild(b.createTextNode(a));b.body.appendChild(c);
b.body.removeChild(c)}else throw Error("goog.globalEval not available");};goog.evalWorksForGlobals_=null;goog.getCssName=function(a,b){var c=function(a){return goog.cssNameMapping_[a]||a},d=function(a){a=a.split("-");for(var b=[],d=0;d<a.length;d++)b.push(c(a[d]));return b.join("-")},d=goog.cssNameMapping_?"BY_WHOLE"==goog.cssNameMappingStyle_?c:d:function(a){return a};return b?a+"-"+d(b):d(a)};goog.setCssNameMapping=function(a,b){goog.cssNameMapping_=a;goog.cssNameMappingStyle_=b};
!COMPILED&&goog.global.CLOSURE_CSS_NAME_MAPPING&&(goog.cssNameMapping_=goog.global.CLOSURE_CSS_NAME_MAPPING);goog.getMsg=function(a,b){var c=b||{},d;for(d in c){var e=(""+c[d]).replace(/\$/g,"$$$$");a=a.replace(RegExp("\\{\\$"+d+"\\}","gi"),e)}return a};goog.getMsgWithFallback=function(a,b){return a};goog.exportSymbol=function(a,b,c){goog.exportPath_(a,b,c)};goog.exportProperty=function(a,b,c){a[b]=c};
goog.inherits=function(a,b){function c(){}c.prototype=b.prototype;a.superClass_=b.prototype;a.prototype=new c;a.prototype.constructor=a};
goog.base=function(a,b,c){var d=arguments.callee.caller;if(goog.DEBUG&&!d)throw Error("arguments.caller not defined.  goog.base() expects not to be running in strict mode. See http://www.ecma-international.org/ecma-262/5.1/#sec-C");if(d.superClass_)return d.superClass_.constructor.apply(a,Array.prototype.slice.call(arguments,1));for(var e=Array.prototype.slice.call(arguments,2),f=!1,g=a.constructor;g;g=g.superClass_&&g.superClass_.constructor)if(g.prototype[b]===d)f=!0;else if(f)return g.prototype[b].apply(a,
e);if(a[b]===d)return a.constructor.prototype[b].apply(a,e);throw Error("goog.base called from a method of one name to a method of a different name");};goog.scope=function(a){a.call(goog.global)};goog.string={};goog.string.Unicode={NBSP:"\u00a0"};goog.string.startsWith=function(a,b){return 0==a.lastIndexOf(b,0)};goog.string.endsWith=function(a,b){var c=a.length-b.length;return 0<=c&&a.indexOf(b,c)==c};goog.string.caseInsensitiveStartsWith=function(a,b){return 0==goog.string.caseInsensitiveCompare(b,a.substr(0,b.length))};goog.string.caseInsensitiveEndsWith=function(a,b){return 0==goog.string.caseInsensitiveCompare(b,a.substr(a.length-b.length,b.length))};
goog.string.caseInsensitiveEquals=function(a,b){return a.toLowerCase()==b.toLowerCase()};goog.string.subs=function(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")};goog.string.collapseWhitespace=function(a){return a.replace(/[\s\xa0]+/g," ").replace(/^\s+|\s+$/g,"")};goog.string.isEmpty=function(a){return/^[\s\xa0]*$/.test(a)};goog.string.isEmptySafe=function(a){return goog.string.isEmpty(goog.string.makeSafe(a))};
goog.string.isBreakingWhitespace=function(a){return!/[^\t\n\r ]/.test(a)};goog.string.isAlpha=function(a){return!/[^a-zA-Z]/.test(a)};goog.string.isNumeric=function(a){return!/[^0-9]/.test(a)};goog.string.isAlphaNumeric=function(a){return!/[^a-zA-Z0-9]/.test(a)};goog.string.isSpace=function(a){return" "==a};goog.string.isUnicodeChar=function(a){return 1==a.length&&" "<=a&&"~">=a||"\u0080"<=a&&"\ufffd">=a};goog.string.stripNewlines=function(a){return a.replace(/(\r\n|\r|\n)+/g," ")};
goog.string.canonicalizeNewlines=function(a){return a.replace(/(\r\n|\r|\n)/g,"\n")};goog.string.normalizeWhitespace=function(a){return a.replace(/\xa0|\s/g," ")};goog.string.normalizeSpaces=function(a){return a.replace(/\xa0|[ \t]+/g," ")};goog.string.collapseBreakingSpaces=function(a){return a.replace(/[\t\r\n ]+/g," ").replace(/^[\t\r\n ]+|[\t\r\n ]+$/g,"")};goog.string.trim=function(a){return a.replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")};
goog.string.trimLeft=function(a){return a.replace(/^[\s\xa0]+/,"")};goog.string.trimRight=function(a){return a.replace(/[\s\xa0]+$/,"")};goog.string.caseInsensitiveCompare=function(a,b){var c=String(a).toLowerCase(),d=String(b).toLowerCase();return c<d?-1:c==d?0:1};goog.string.numerateCompareRegExp_=/(\.\d+)|(\d+)|(\D+)/g;
goog.string.numerateCompare=function(a,b){if(a==b)return 0;if(!a)return-1;if(!b)return 1;for(var c=a.toLowerCase().match(goog.string.numerateCompareRegExp_),d=b.toLowerCase().match(goog.string.numerateCompareRegExp_),e=Math.min(c.length,d.length),f=0;f<e;f++){var g=c[f],h=d[f];if(g!=h)return c=parseInt(g,10),!isNaN(c)&&(d=parseInt(h,10),!isNaN(d)&&c-d)?c-d:g<h?-1:1}return c.length!=d.length?c.length-d.length:a<b?-1:1};goog.string.urlEncode=function(a){return encodeURIComponent(String(a))};
goog.string.urlDecode=function(a){return decodeURIComponent(a.replace(/\+/g," "))};goog.string.newLineToBr=function(a,b){return a.replace(/(\r\n|\r|\n)/g,b?"<br />":"<br>")};
goog.string.htmlEscape=function(a,b){if(b)return a.replace(goog.string.amperRe_,"&amp;").replace(goog.string.ltRe_,"&lt;").replace(goog.string.gtRe_,"&gt;").replace(goog.string.quotRe_,"&quot;");if(!goog.string.allRe_.test(a))return a;-1!=a.indexOf("&")&&(a=a.replace(goog.string.amperRe_,"&amp;"));-1!=a.indexOf("<")&&(a=a.replace(goog.string.ltRe_,"&lt;"));-1!=a.indexOf(">")&&(a=a.replace(goog.string.gtRe_,"&gt;"));-1!=a.indexOf('"')&&(a=a.replace(goog.string.quotRe_,"&quot;"));return a};
goog.string.amperRe_=/&/g;goog.string.ltRe_=/</g;goog.string.gtRe_=/>/g;goog.string.quotRe_=/\"/g;goog.string.allRe_=/[&<>\"]/;goog.string.unescapeEntities=function(a){return goog.string.contains(a,"&")?"document"in goog.global?goog.string.unescapeEntitiesUsingDom_(a):goog.string.unescapePureXmlEntities_(a):a};
goog.string.unescapeEntitiesUsingDom_=function(a){var b={"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"'},c=document.createElement("div");return a.replace(goog.string.HTML_ENTITY_PATTERN_,function(a,e){var f=b[a];if(f)return f;if("#"==e.charAt(0)){var g=Number("0"+e.substr(1));isNaN(g)||(f=String.fromCharCode(g))}f||(c.innerHTML=a+" ",f=c.firstChild.nodeValue.slice(0,-1));return b[a]=f})};
goog.string.unescapePureXmlEntities_=function(a){return a.replace(/&([^;]+);/g,function(a,c){switch(c){case "amp":return"&";case "lt":return"<";case "gt":return">";case "quot":return'"';default:if("#"==c.charAt(0)){var d=Number("0"+c.substr(1));if(!isNaN(d))return String.fromCharCode(d)}return a}})};goog.string.HTML_ENTITY_PATTERN_=/&([^;\s<&]+);?/g;goog.string.whitespaceEscape=function(a,b){return goog.string.newLineToBr(a.replace(/  /g," &#160;"),b)};
goog.string.stripQuotes=function(a,b){for(var c=b.length,d=0;d<c;d++){var e=1==c?b:b.charAt(d);if(a.charAt(0)==e&&a.charAt(a.length-1)==e)return a.substring(1,a.length-1)}return a};goog.string.truncate=function(a,b,c){c&&(a=goog.string.unescapeEntities(a));a.length>b&&(a=a.substring(0,b-3)+"...");c&&(a=goog.string.htmlEscape(a));return a};
goog.string.truncateMiddle=function(a,b,c,d){c&&(a=goog.string.unescapeEntities(a));if(d&&a.length>b){d>b&&(d=b);var e=a.length-d;a=a.substring(0,b-d)+"..."+a.substring(e)}else a.length>b&&(d=Math.floor(b/2),e=a.length-d,a=a.substring(0,d+b%2)+"..."+a.substring(e));c&&(a=goog.string.htmlEscape(a));return a};goog.string.specialEscapeChars_={"\x00":"\\0","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\x0B",'"':'\\"',"\\":"\\\\"};goog.string.jsEscapeCache_={"'":"\\'"};
goog.string.quote=function(a){a=String(a);if(a.quote)return a.quote();for(var b=['"'],c=0;c<a.length;c++){var d=a.charAt(c),e=d.charCodeAt(0);b[c+1]=goog.string.specialEscapeChars_[d]||(31<e&&127>e?d:goog.string.escapeChar(d))}b.push('"');return b.join("")};goog.string.escapeString=function(a){for(var b=[],c=0;c<a.length;c++)b[c]=goog.string.escapeChar(a.charAt(c));return b.join("")};
goog.string.escapeChar=function(a){if(a in goog.string.jsEscapeCache_)return goog.string.jsEscapeCache_[a];if(a in goog.string.specialEscapeChars_)return goog.string.jsEscapeCache_[a]=goog.string.specialEscapeChars_[a];var b=a,c=a.charCodeAt(0);if(31<c&&127>c)b=a;else{if(256>c){if(b="\\x",16>c||256<c)b+="0"}else b="\\u",4096>c&&(b+="0");b+=c.toString(16).toUpperCase()}return goog.string.jsEscapeCache_[a]=b};goog.string.toMap=function(a){for(var b={},c=0;c<a.length;c++)b[a.charAt(c)]=!0;return b};
goog.string.contains=function(a,b){return-1!=a.indexOf(b)};goog.string.countOf=function(a,b){return a&&b?a.split(b).length-1:0};goog.string.removeAt=function(a,b,c){var d=a;0<=b&&(b<a.length&&0<c)&&(d=a.substr(0,b)+a.substr(b+c,a.length-b-c));return d};goog.string.remove=function(a,b){var c=RegExp(goog.string.regExpEscape(b),"");return a.replace(c,"")};goog.string.removeAll=function(a,b){var c=RegExp(goog.string.regExpEscape(b),"g");return a.replace(c,"")};
goog.string.regExpEscape=function(a){return String(a).replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g,"\\$1").replace(/\x08/g,"\\x08")};goog.string.repeat=function(a,b){return Array(b+1).join(a)};goog.string.padNumber=function(a,b,c){a=goog.isDef(c)?a.toFixed(c):String(a);c=a.indexOf(".");-1==c&&(c=a.length);return goog.string.repeat("0",Math.max(0,b-c))+a};goog.string.makeSafe=function(a){return null==a?"":String(a)};goog.string.buildString=function(a){return Array.prototype.join.call(arguments,"")};
goog.string.getRandomString=function(){return Math.floor(2147483648*Math.random()).toString(36)+Math.abs(Math.floor(2147483648*Math.random())^goog.now()).toString(36)};
goog.string.compareVersions=function(a,b){for(var c=0,d=goog.string.trim(String(a)).split("."),e=goog.string.trim(String(b)).split("."),f=Math.max(d.length,e.length),g=0;0==c&&g<f;g++){var h=d[g]||"",k=e[g]||"",l=RegExp("(\\d*)(\\D*)","g"),m=RegExp("(\\d*)(\\D*)","g");do{var n=l.exec(h)||["","",""],p=m.exec(k)||["","",""];if(0==n[0].length&&0==p[0].length)break;var c=0==n[1].length?0:parseInt(n[1],10),q=0==p[1].length?0:parseInt(p[1],10),c=goog.string.compareElements_(c,q)||goog.string.compareElements_(0==
n[2].length,0==p[2].length)||goog.string.compareElements_(n[2],p[2])}while(0==c)}return c};goog.string.compareElements_=function(a,b){return a<b?-1:a>b?1:0};goog.string.HASHCODE_MAX_=4294967296;goog.string.hashCode=function(a){for(var b=0,c=0;c<a.length;++c)b=31*b+a.charCodeAt(c),b%=goog.string.HASHCODE_MAX_;return b};goog.string.uniqueStringCounter_=2147483648*Math.random()|0;goog.string.createUniqueString=function(){return"goog_"+goog.string.uniqueStringCounter_++};
goog.string.toNumber=function(a){var b=Number(a);return 0==b&&goog.string.isEmpty(a)?NaN:b};goog.string.isLowerCamelCase=function(a){return/^[a-z]+([A-Z][a-z]*)*$/.test(a)};goog.string.isUpperCamelCase=function(a){return/^([A-Z][a-z]*)+$/.test(a)};goog.string.toCamelCase=function(a){return String(a).replace(/\-([a-z])/g,function(a,c){return c.toUpperCase()})};goog.string.toSelectorCase=function(a){return String(a).replace(/([A-Z])/g,"-$1").toLowerCase()};
goog.string.toTitleCase=function(a,b){var c=goog.isString(b)?goog.string.regExpEscape(b):"\\s";return a.replace(RegExp("(^"+(c?"|["+c+"]+":"")+")([a-z])","g"),function(a,b,c){return b+c.toUpperCase()})};goog.string.parseInt=function(a){isFinite(a)&&(a=String(a));return goog.isString(a)?/^\s*-?0x/i.test(a)?parseInt(a,16):parseInt(a,10):NaN};goog.string.splitLimit=function(a,b,c){a=a.split(b);for(var d=[];0<c&&a.length;)d.push(a.shift()),c--;a.length&&d.push(a.join(b));return d};goog.debug={};goog.debug.Error=function(a){Error.captureStackTrace?Error.captureStackTrace(this,goog.debug.Error):this.stack=Error().stack||"";a&&(this.message=String(a))};goog.inherits(goog.debug.Error,Error);goog.debug.Error.prototype.name="CustomError";goog.asserts={};goog.asserts.ENABLE_ASSERTS=goog.DEBUG;goog.asserts.AssertionError=function(a,b){b.unshift(a);goog.debug.Error.call(this,goog.string.subs.apply(null,b));b.shift();this.messagePattern=a};goog.inherits(goog.asserts.AssertionError,goog.debug.Error);goog.asserts.AssertionError.prototype.name="AssertionError";goog.asserts.doAssertFailure_=function(a,b,c,d){var e="Assertion failed";if(c)var e=e+(": "+c),f=d;else a&&(e+=": "+a,f=b);throw new goog.asserts.AssertionError(""+e,f||[]);};
goog.asserts.assert=function(a,b,c){goog.asserts.ENABLE_ASSERTS&&!a&&goog.asserts.doAssertFailure_("",null,b,Array.prototype.slice.call(arguments,2));return a};goog.asserts.fail=function(a,b){if(goog.asserts.ENABLE_ASSERTS)throw new goog.asserts.AssertionError("Failure"+(a?": "+a:""),Array.prototype.slice.call(arguments,1));};
goog.asserts.assertNumber=function(a,b,c){goog.asserts.ENABLE_ASSERTS&&!goog.isNumber(a)&&goog.asserts.doAssertFailure_("Expected number but got %s: %s.",[goog.typeOf(a),a],b,Array.prototype.slice.call(arguments,2));return a};goog.asserts.assertString=function(a,b,c){goog.asserts.ENABLE_ASSERTS&&!goog.isString(a)&&goog.asserts.doAssertFailure_("Expected string but got %s: %s.",[goog.typeOf(a),a],b,Array.prototype.slice.call(arguments,2));return a};
goog.asserts.assertFunction=function(a,b,c){goog.asserts.ENABLE_ASSERTS&&!goog.isFunction(a)&&goog.asserts.doAssertFailure_("Expected function but got %s: %s.",[goog.typeOf(a),a],b,Array.prototype.slice.call(arguments,2));return a};goog.asserts.assertObject=function(a,b,c){goog.asserts.ENABLE_ASSERTS&&!goog.isObject(a)&&goog.asserts.doAssertFailure_("Expected object but got %s: %s.",[goog.typeOf(a),a],b,Array.prototype.slice.call(arguments,2));return a};
goog.asserts.assertArray=function(a,b,c){goog.asserts.ENABLE_ASSERTS&&!goog.isArray(a)&&goog.asserts.doAssertFailure_("Expected array but got %s: %s.",[goog.typeOf(a),a],b,Array.prototype.slice.call(arguments,2));return a};goog.asserts.assertBoolean=function(a,b,c){goog.asserts.ENABLE_ASSERTS&&!goog.isBoolean(a)&&goog.asserts.doAssertFailure_("Expected boolean but got %s: %s.",[goog.typeOf(a),a],b,Array.prototype.slice.call(arguments,2));return a};
goog.asserts.assertInstanceof=function(a,b,c,d){!goog.asserts.ENABLE_ASSERTS||a instanceof b||goog.asserts.doAssertFailure_("instanceof check failed.",null,c,Array.prototype.slice.call(arguments,3));return a};goog.asserts.assertObjectPrototypeIsIntact=function(){for(var a in Object.prototype)goog.asserts.fail(a+" should not be enumerable in Object.prototype.")};var Sk=Sk||{};
Sk.configure=function(a){Sk.output=a.output||Sk.output;goog.asserts.assert("function"===typeof Sk.output);Sk.debugout=a.debugout||Sk.debugout;goog.asserts.assert("function"===typeof Sk.debugout);Sk.read=a.read||Sk.read;goog.asserts.assert("function"===typeof Sk.read);Sk.timeoutMsg=a.timeoutMsg||Sk.timeoutMsg;goog.asserts.assert("function"===typeof Sk.timeoutMsg);goog.exportSymbol("Sk.timeoutMsg",Sk.timeoutMsg);Sk.sysargv=a.sysargv||Sk.sysargv;goog.asserts.assert(goog.isArrayLike(Sk.sysargv));Sk.python3=
a.python3||Sk.python3;goog.asserts.assert("boolean"===typeof Sk.python3);Sk.inputfun=a.inputfun||Sk.inputfun;goog.asserts.assert("function"===typeof Sk.inputfun);Sk.throwSystemExit=a.systemexit||!1;goog.asserts.assert("boolean"===typeof Sk.throwSystemExit);a.syspath&&(Sk.syspath=a.syspath,goog.asserts.assert(goog.isArrayLike(Sk.syspath)),Sk.realsyspath=void 0,Sk.sysmodules=new Sk.builtin.dict([]));Sk.misceval.softspace_=!1};goog.exportSymbol("Sk.configure",Sk.configure);Sk.timeoutMsg=function(){return"Program exceeded run time limit."};
goog.exportSymbol("Sk.timeoutMsg",Sk.timeoutMsg);Sk.output=function(a){};Sk.read=function(a){throw"Sk.read has not been implemented";};Sk.sysargv=[];Sk.getSysArgv=function(){return Sk.sysargv};goog.exportSymbol("Sk.getSysArgv",Sk.getSysArgv);Sk.syspath=[];Sk.inBrowser=void 0!==goog.global.document;Sk.debugout=function(a){};
(function(){void 0!==goog.global.write?Sk.output=goog.global.write:void 0!==goog.global.console&&void 0!==goog.global.console.log?Sk.output=function(a){goog.global.console.log(a)}:void 0!==goog.global.print&&(Sk.output=goog.global.print);void 0!==goog.global.print&&(Sk.debugout=goog.global.print)})();Sk.inBrowser||(goog.global.CLOSURE_IMPORT_SCRIPT=function(a){goog.global.eval(goog.global.read("support/closure-library/closure/goog/"+a));return!0});Sk.python3=!1;Sk.inputfun=function(a){return prompt(a)};
goog.exportSymbol("Sk.python3",Sk.python3);goog.exportSymbol("Sk.inputfun",Sk.inputfun);Sk.builtin={};
Sk.builtin.range=function(a,b,c){var d=[],e;Sk.builtin.pyCheckArgs("range",arguments,1,3);Sk.builtin.pyCheckType("start","integer",Sk.builtin.checkInt(a));void 0!==b&&Sk.builtin.pyCheckType("stop","integer",Sk.builtin.checkInt(b));void 0!==c&&Sk.builtin.pyCheckType("step","integer",Sk.builtin.checkInt(c));a=Sk.builtin.asnum$(a);b=Sk.builtin.asnum$(b);c=Sk.builtin.asnum$(c);void 0===b&&void 0===c?(b=a,a=0,c=1):void 0===c&&(c=1);if(0===c)throw new Sk.builtin.ValueError("range() step argument must not be zero");if(0<
c)for(e=a;e<b;e+=c)d.push(new Sk.builtin.nmber(e,Sk.builtin.nmber.int$));else for(e=a;e>b;e+=c)d.push(new Sk.builtin.nmber(e,Sk.builtin.nmber.int$));return new Sk.builtin.list(d)};
Sk.builtin.asnum$=function(a){return void 0===a||null===a?a:a.constructor===Sk.builtin.none?null:a.constructor===Sk.builtin.bool?a.v?1:0:"number"===typeof a?a:"string"===typeof a?a:a.constructor===Sk.builtin.nmber?a.v:a.constructor===Sk.builtin.lng?a.cantBeInt()?a.str$(10,!0):a.toInt$():a.constructor===Sk.builtin.biginteger?0<a.trueCompare(new Sk.builtin.biginteger(Sk.builtin.lng.threshold$))||0>a.trueCompare(new Sk.builtin.biginteger(-Sk.builtin.lng.threshold$))?a.toString():a.intValue():a};
goog.exportSymbol("Sk.builtin.asnum$",Sk.builtin.asnum$);Sk.builtin.assk$=function(a,b){return new Sk.builtin.nmber(a,b)};goog.exportSymbol("Sk.builtin.assk$",Sk.builtin.assk$);
Sk.builtin.asnum$nofloat=function(a){if(void 0===a||null===a)return a;if(a.constructor===Sk.builtin.none)return null;if(a.constructor===Sk.builtin.bool)return a.v?1:0;"number"===typeof a&&(a=a.toString());a.constructor===Sk.builtin.nmber&&(a=a.v.toString());a.constructor===Sk.builtin.lng&&(a=a.str$(10,!0));a.constructor===Sk.builtin.biginteger&&(a=a.toString());if(0>a.indexOf(".")&&0>a.indexOf("e")&&0>a.indexOf("E"))return a;var b=0,c;0<=a.indexOf("e")?(c=a.substr(0,a.indexOf("e")),b=a.substr(a.indexOf("e")+
1)):0<=a.indexOf("E")?(c=a.substr(0,a.indexOf("e")),b=a.substr(a.indexOf("E")+1)):c=a;b=parseInt(b,10);a=c.indexOf(".");if(0>a){if(0<=b){for(;0<b--;)c+="0";return c}return c.length>-b?c.substr(0,c.length+b):0}c=0==a?c.substr(1):a<c.length?c.substr(0,a)+c.substr(a+1):c.substr(0,a);for(a+=b;a>c.length;)c+="0";return c=0>=a?0:c.substr(0,a)};goog.exportSymbol("Sk.builtin.asnum$nofloat",Sk.builtin.asnum$nofloat);
Sk.builtin.round=function(a,b){var c;Sk.builtin.pyCheckArgs("round",arguments,1,2);if(!Sk.builtin.checkNumber(a))throw new Sk.builtin.TypeError("a float is required");if(void 0!==b&&!Sk.misceval.isIndex(b))throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(b)+"' object cannot be interpreted as an index");void 0===b&&(b=0);a=Sk.builtin.asnum$(a);b=Sk.misceval.asIndex(b);c=Math.pow(10,b);c=Math.round(a*c)/c;return new Sk.builtin.nmber(c,Sk.builtin.nmber.float$)};
Sk.builtin.len=function(a){Sk.builtin.pyCheckArgs("len",arguments,1,1);if(a.sq$length)return new Sk.builtin.nmber(a.sq$length(),Sk.builtin.nmber.int$);if(a.mp$length)return new Sk.builtin.nmber(a.mp$length(),Sk.builtin.nmber.int$);if(a.tp$length)return new Sk.builtin.nmber(a.tp$length(),Sk.builtin.nmber.int$);throw new Sk.builtin.TypeError("object of type '"+Sk.abstr.typeName(a)+"' has no len()");};
Sk.builtin.min=function(){Sk.builtin.pyCheckArgs("min",arguments,1);arguments=Sk.misceval.arrayFromArguments(arguments);for(var a=arguments[0],b=1;b<arguments.length;++b)Sk.misceval.richCompareBool(arguments[b],a,"Lt")&&(a=arguments[b]);return a};Sk.builtin.max=function(){Sk.builtin.pyCheckArgs("max",arguments,1);arguments=Sk.misceval.arrayFromArguments(arguments);for(var a=arguments[0],b=1;b<arguments.length;++b)Sk.misceval.richCompareBool(arguments[b],a,"Gt")&&(a=arguments[b]);return a};
Sk.builtin.any=function(a){var b,c;Sk.builtin.pyCheckArgs("any",arguments,1);if(!Sk.builtin.checkIterable(a))throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(a)+"' object is not iterable");b=a.tp$iter();for(c=b.tp$iternext();void 0!==c;c=b.tp$iternext())if(Sk.misceval.isTrue(c))return!0;return!1};
Sk.builtin.all=function(a){var b,c;Sk.builtin.pyCheckArgs("all",arguments,1);if(!Sk.builtin.checkIterable(a))throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(a)+"' object is not iterable");b=a.tp$iter();for(c=b.tp$iternext();void 0!==c;c=b.tp$iternext())if(!Sk.misceval.isTrue(c))return!1;return!0};
Sk.builtin.sum=function(a,b){var c,d,e,f;Sk.builtin.pyCheckArgs("sum",arguments,1,2);Sk.builtin.pyCheckType("iter","iterable",Sk.builtin.checkIterable(a));if(void 0!==b&&Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("sum() can't sum strings [use ''.join(seq) instead]");c=void 0===b?new Sk.builtin.nmber(0,Sk.builtin.nmber.int$):b;d=a.tp$iter();for(e=d.tp$iternext();void 0!==e;e=d.tp$iternext())if(e.skType===Sk.builtin.nmber.float$?(f=!0,c.skType!==Sk.builtin.nmber.float$&&(c=new Sk.builtin.nmber(Sk.builtin.asnum$(c),
Sk.builtin.nmber.float$))):e instanceof Sk.builtin.lng&&(f||c instanceof Sk.builtin.lng||(c=new Sk.builtin.lng(c))),void 0!==c.nb$add(e))c=c.nb$add(e);else throw new Sk.builtin.TypeError("unsupported operand type(s) for +: '"+Sk.abstr.typeName(c)+"' and '"+Sk.abstr.typeName(e)+"'");return c};
Sk.builtin.zip=function(){if(0===arguments.length)return new Sk.builtin.list([]);for(var a=[],b=0;b<arguments.length;b++)if(arguments[b].tp$iter)a.push(arguments[b].tp$iter());else throw"TypeError: argument "+b+" must support iteration";for(var c=[],d=!1;!d;){for(var e=[],b=0;b<arguments.length;b++){var f=a[b].tp$iternext();if(void 0===f){d=!0;break}e.push(f)}d||c.push(new Sk.builtin.tuple(e))}return new Sk.builtin.list(c)};
Sk.builtin.abs=function(a){Sk.builtin.pyCheckArgs("abs",arguments,1,1);Sk.builtin.pyCheckType("x","number",Sk.builtin.checkNumber(a));return new Sk.builtin.nmber(Math.abs(Sk.builtin.asnum$(a)),a.skType)};
Sk.builtin.ord=function(a){Sk.builtin.pyCheckArgs("ord",arguments,1,1);if(!Sk.builtin.checkString(a))throw new Sk.builtin.TypeError("ord() expected a string of length 1, but "+Sk.abstr.typeName(a)+" found");if(1!==a.v.length)throw new Sk.builtin.TypeError("ord() expected a character, but string of length "+a.v.length+" found");return new Sk.builtin.nmber(a.v.charCodeAt(0),Sk.builtin.nmber.int$)};
Sk.builtin.chr=function(a){Sk.builtin.pyCheckArgs("chr",arguments,1,1);if(!Sk.builtin.checkInt(a))throw new Sk.builtin.TypeError("an integer is required");a=Sk.builtin.asnum$(a);if(0>a||255<a)throw new Sk.builtin.ValueError("chr() arg not in range(256)");return new Sk.builtin.str(String.fromCharCode(a))};
Sk.builtin.int2str_=function(a,b,c){var d="";if(a instanceof Sk.builtin.lng){var e="";2!==b&&(e="L");d=a.str$(b,!1);return a.nb$isnegative()?new Sk.builtin.str("-"+c+d+e):new Sk.builtin.str(c+d+e)}a=Sk.misceval.asIndex(a);d=a.toString(b);return 0>a?new Sk.builtin.str("-"+c+d.slice(1)):new Sk.builtin.str(c+d)};
Sk.builtin.hex=function(a){Sk.builtin.pyCheckArgs("hex",arguments,1,1);if(!Sk.misceval.isIndex(a))throw new Sk.builtin.TypeError("hex() argument can't be converted to hex");return Sk.builtin.int2str_(a,16,"0x")};Sk.builtin.oct=function(a){Sk.builtin.pyCheckArgs("oct",arguments,1,1);if(!Sk.misceval.isIndex(a))throw new Sk.builtin.TypeError("oct() argument can't be converted to hex");return Sk.builtin.int2str_(a,8,"0")};
Sk.builtin.bin=function(a){Sk.builtin.pyCheckArgs("bin",arguments,1,1);if(!Sk.misceval.isIndex(a))throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(a)+"' object can't be interpreted as an index");return Sk.builtin.int2str_(a,2,"0b")};
Sk.builtin.dir=function(a){Sk.builtin.pyCheckArgs("dir",arguments,1,1);var b=function(a){var b=null;if(-1!==["__bases__","__mro__","__class__"].indexOf(a))return null;-1!==a.indexOf("$")?b=Sk.builtin.dir.slotNameToRichName(a):"_"!==a.charAt(a.length-1)?b=a:"_"===a.charAt(0)&&(b=a);return b},c=[],d,e,f,g,h;for(d in a.constructor.prototype)(e=b(d))&&c.push(new Sk.builtin.str(e));if(a.$d)if(a.$d.tp$iter)for(f=a.$d.tp$iter(),d=f.tp$iternext();void 0!==d;d=f.tp$iternext())e=new Sk.builtin.str(d),(e=b(e.v))&&
c.push(new Sk.builtin.str(e));else for(e in a.$d)c.push(new Sk.builtin.str(e));if(f=a.tp$mro)for(f=a.tp$mro,d=0;d<f.v.length;++d)for(h in g=f.v[d],g)g.hasOwnProperty(h)&&(e=b(h))&&c.push(new Sk.builtin.str(e));c.sort(function(a,b){return(a.v>b.v)-(a.v<b.v)});return new Sk.builtin.list(c.filter(function(a,b,c){return a!==c[b+1]}))};Sk.builtin.dir.slotNameToRichName=function(a){};Sk.builtin.repr=function(a){Sk.builtin.pyCheckArgs("repr",arguments,1,1);return Sk.misceval.objectRepr(a)};
Sk.builtin.open=function(a,b,c){Sk.builtin.pyCheckArgs("open",arguments,1,3);void 0===b&&(b=new Sk.builtin.str("r"));if("r"!==b.v&&"rb"!==b.v)throw"todo; haven't implemented non-read opens";return new Sk.builtin.file(a,b,c)};
Sk.builtin.isinstance=function(a,b){Sk.builtin.pyCheckArgs("isinstance",arguments,2,2);if(!(Sk.builtin.checkClass(b)||b instanceof Sk.builtin.tuple))throw new Sk.builtin.TypeError("isinstance() arg 2 must be a class, type, or tuple of classes and types");if(b===Sk.builtin.int_.prototype.ob$type)return"number"===a.tp$name&&a.skType===Sk.builtin.nmber.int$;if(b===Sk.builtin.float_.prototype.ob$type)return"number"===a.tp$name&&a.skType===Sk.builtin.nmber.float$;if(b===Sk.builtin.none.prototype.ob$type)return a instanceof
Sk.builtin.none;if(a.ob$type===b)return!0;if(b instanceof Sk.builtin.tuple){for(var c=0;c<b.v.length;++c)if(Sk.builtin.isinstance(a,b.v[c]))return!0;return!1}var d=function(a,b){if(a===b)return!0;if(void 0===a.$d)return!1;for(var c=a.$d.mp$subscript(Sk.builtin.type.basesStr_),h=0;h<c.v.length;++h)if(d(c.v[h],b))return!0;return!1};return d(a.ob$type,b)};Sk.builtin.hashCount=0;
Sk.builtin.hash=function(a){Sk.builtin.pyCheckArgs("hash",arguments,1,1);if(a instanceof Object&&void 0!==a.tp$hash){if(a.$savedHash_)return a.$savedHash_;a.$savedHash_=a.tp$hash();return a.$savedHash_}return a instanceof Object&&void 0!==a.__hash__?Sk.misceval.callsim(a.__hash__,a):a instanceof Sk.builtin.bool?a.v?1:0:a instanceof Sk.builtin.none?0:a instanceof Object?(void 0===a.__id&&(Sk.builtin.hashCount+=1,a.__id=Sk.builtin.hashCount),a.__id):"number"===typeof a?a:null===a?0:!0===a?1:!1===a?
0:typeof a+" "+String(a)};Sk.builtin.getattr=function(a,b,c){Sk.builtin.pyCheckArgs("getattr",arguments,2,3);if(!Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("attribute name must be string");var d=a.tp$getattr(b.v);if(void 0===d){if(void 0!==c)return c;throw new Sk.builtin.AttributeError("'"+Sk.abstr.typeName(a)+"' object has no attribute '"+b.v+"'");}return d};Sk.builtin.raw_input=function(a,b,c){a=Sk.inputfun(a.v);return new Sk.builtin.str(a)};
Sk.builtin.input=function(a,b,c){a=Sk.inputfun(a.v);return new Sk.builtin.str(a)};Sk.builtin.jseval=function(a){goog.global.eval(a)};Sk.builtin.jsmillis=function(){return(new Date).valueOf()};Sk.builtin.superbi=function(){throw new Sk.builtin.NotImplementedError("super is not yet implemented, please report your use case as a github issue.");};Sk.builtin.eval_=function(){throw new Sk.builtin.NotImplementedError("eval is not yet implemented");};
Sk.builtin.map=function(a,b){Sk.builtin.pyCheckArgs("map",arguments,2);a instanceof Sk.builtin.none&&(a={func_code:function(a){return a}});if(2<arguments.length){var c=[],d=Array.prototype.slice.apply(arguments).slice(1),e;for(e in d){if(void 0===d[e].tp$iter){var f=parseInt(e,10)+2;throw new Sk.builtin.TypeError("argument "+f+" to map() must support iteration");}d[e]=d[e].tp$iter()}for(;;){var g=[],h=0;for(e in d)f=d[e].tp$iternext(),void 0===f?(g.push(Sk.builtin.none.none$),h++):g.push(f);if(h!==
d.length)c.push(g);else break}b=new Sk.builtin.list(c)}if(void 0===b.tp$iter)throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(b)+"' object is not iterable");c=[];d=b.tp$iter();for(f=d.tp$iternext();void 0!==f;)f instanceof Array||(f=[f]),c.push(a.func_code.apply(this,f)),f=d.tp$iternext();return new Sk.builtin.list(c)};
Sk.builtin.reduce=function(a,b,c){Sk.builtin.pyCheckArgs("reduce",arguments,2,3);var d=b.tp$iter();if(void 0===c&&(c=d.tp$iternext(),void 0===c))throw new Sk.builtin.TypeError("reduce() of empty sequence with no initial value");for(var e=c,f=d.tp$iternext();void 0!==f;)e=a.func_code(e,f),f=d.tp$iternext();return e};
Sk.builtin.filter=function(a,b){Sk.builtin.pyCheckArgs("filter",arguments,2,2);if(void 0===b.tp$iter)throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(b)+"' object is not iterable");a instanceof Sk.builtin.none&&(a={func_code:function(a){return Sk.builtin.bool(a)}});var c=function(){return[]},d=function(a,b){a.push(b);return a},e=function(a){return new Sk.builtin.list(a)};b.__class__===Sk.builtin.str?(c=function(){return new Sk.builtin.str("")},d=function(a,b){return a.sq$concat(b)},e=function(a){return a}):
b.__class__===Sk.builtin.tuple&&(e=function(a){return new Sk.builtin.tuple(a)});var f=b.tp$iter(),g=f.tp$iternext(),c=c();if(void 0===g)return e(c);for(;void 0!==g;)Sk.misceval.isTrue(a.func_code(g))&&(c=d(c,g)),g=f.tp$iternext();return e(c)};
Sk.builtin.hasattr=function(a,b){Sk.builtin.pyCheckArgs("hasattr",arguments,2,2);if(!Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("hasattr(): attribute name must be string");if(a.tp$getattr)return a.tp$getattr(b.v)?!0:!1;throw new Sk.builtin.AttributeError("Object has no tp$getattr method");};
Sk.builtin.pow=function(a,b,c){Sk.builtin.pyCheckArgs("pow",arguments,2,3);var d=Sk.builtin.asnum$(a),e=Sk.builtin.asnum$(b);Sk.builtin.asnum$(c);if(!Sk.builtin.checkNumber(a)||!Sk.builtin.checkNumber(b)){if(void 0===c)throw new Sk.builtin.TypeError("unsupported operand type(s) for pow(): '"+Sk.abstr.typeName(a)+"' and '"+Sk.abstr.typeName(b)+"'");throw new Sk.builtin.TypeError("unsupported operand type(s) for pow(): '"+Sk.abstr.typeName(a)+"', '"+Sk.abstr.typeName(b)+"', '"+Sk.abstr.typeName(c)+
"'");}if(0>d&&b.skType===Sk.builtin.nmber.float$)throw new Sk.builtin.ValueError("negative number cannot be raised to a fractional power");if(void 0===c)return d=Math.pow(d,e),a.skType===Sk.builtin.nmber.float$||b.skType===Sk.builtin.nmber.float$||0>e?new Sk.builtin.nmber(d,Sk.builtin.nmber.float$):a instanceof Sk.builtin.lng||b instanceof Sk.builtin.lng?new Sk.builtin.lng(d):new Sk.builtin.nmber(d,Sk.builtin.nmber.int$);if(!Sk.builtin.checkInt(a)||!Sk.builtin.checkInt(b)||!Sk.builtin.checkInt(c))throw new Sk.builtin.TypeError("pow() 3rd argument not allowed unless all arguments are integers");
if(0>e)throw new Sk.builtin.TypeError("pow() 2nd argument cannot be negative when 3rd argument specified");return a instanceof Sk.builtin.lng||(b instanceof Sk.builtin.lng||c instanceof Sk.builtin.lng)||Infinity===Math.pow(d,e)?(a=new Sk.builtin.lng(a),a.nb$power(b,c)):(new Sk.builtin.nmber(Math.pow(d,e),Sk.builtin.nmber.int$)).nb$remainder(c)};Sk.builtin.quit=function(a){a=(new Sk.builtin.str(a)).v;throw new Sk.builtin.SystemExit(a);};
Sk.builtin.sorted=function(a,b,c,d){var e;if(void 0===c||c instanceof Sk.builtin.none)b instanceof Sk.builtin.none||void 0===b||(e=b),a=new Sk.builtin.list(a);else{e=b instanceof Sk.builtin.none?{func_code:function(a,b){return Sk.misceval.richCompareBool(a[0],b[0],"Lt")?new Sk.builtin.nmber(-1,Sk.builtin.nmber.int$):new Sk.builtin.nmber(0,Sk.builtin.nmber.int$)}}:{func_code:function(a,c){return b.func_code(a[0],c[0])}};a=a.tp$iter();for(var f=a.tp$iternext(),g=[];void 0!==f;)g.push([c.func_code(f),
f]),f=a.tp$iternext();a=new Sk.builtin.list(g)}void 0!==e?a.list_sort_(a,e):a.list_sort_(a);d&&a.list_reverse_(a);if(void 0!==c&&!(c instanceof Sk.builtin.none)){a=a.tp$iter();f=a.tp$iternext();for(g=[];void 0!==f;)g.push(f[1]),f=a.tp$iternext();a=new Sk.builtin.list(g)}return a};Sk.builtin.bytearray=function(){throw new Sk.builtin.NotImplementedError("bytearray is not yet implemented");};Sk.builtin.callable=function(){throw new Sk.builtin.NotImplementedError("callable is not yet implemented");};
Sk.builtin.complex=function(){throw new Sk.builtin.NotImplementedError("complex is not yet implemented");};Sk.builtin.delattr=function(){throw new Sk.builtin.NotImplementedError("delattr is not yet implemented");};Sk.builtin.divmod=function(){throw new Sk.builtin.NotImplementedError("divmod is not yet implemented");};Sk.builtin.execfile=function(){throw new Sk.builtin.NotImplementedError("execfile is not yet implemented");};
Sk.builtin.format=function(){throw new Sk.builtin.NotImplementedError("format is not yet implemented");};Sk.builtin.frozenset=function(){throw new Sk.builtin.NotImplementedError("frozenset is not yet implemented");};Sk.builtin.globals=function(){throw new Sk.builtin.NotImplementedError("globals is not yet implemented");};Sk.builtin.help=function(){throw new Sk.builtin.NotImplementedError("help is not yet implemented");};
Sk.builtin.issubclass=function(){throw new Sk.builtin.NotImplementedError("issubclass is not yet implemented");};Sk.builtin.iter=function(){throw new Sk.builtin.NotImplementedError("iter is not yet implemented");};Sk.builtin.locals=function(){throw new Sk.builtin.NotImplementedError("locals is not yet implemented");};Sk.builtin.memoryview=function(){throw new Sk.builtin.NotImplementedError("memoryview is not yet implemented");};
Sk.builtin.next_=function(){throw new Sk.builtin.NotImplementedError("next is not yet implemented");};Sk.builtin.property=function(){throw new Sk.builtin.NotImplementedError("property is not yet implemented");};Sk.builtin.reload=function(){throw new Sk.builtin.NotImplementedError("reload is not yet implemented");};Sk.builtin.reversed=function(){throw new Sk.builtin.NotImplementedError("reversed is not yet implemented");};
Sk.builtin.unichr=function(){throw new Sk.builtin.NotImplementedError("unichr is not yet implemented");};Sk.builtin.vars=function(){throw new Sk.builtin.NotImplementedError("vars is not yet implemented");};Sk.builtin.xrange=Sk.builtin.range;Sk.builtin.apply_=function(){throw new Sk.builtin.NotImplementedError("apply is not yet implemented");};Sk.builtin.buffer=function(){throw new Sk.builtin.NotImplementedError("buffer is not yet implemented");};
Sk.builtin.coerce=function(){throw new Sk.builtin.NotImplementedError("coerce is not yet implemented");};Sk.builtin.intern=function(){throw new Sk.builtin.NotImplementedError("intern is not yet implemented");};Sk.builtin.Exception=function(a){a=Array.prototype.slice.call(arguments);for(var b=0;b<a.length;++b)"string"===typeof a[b]&&(a[b]=new Sk.builtin.str(a[b]));this.args=new Sk.builtin.tuple(a);Sk.currFilename?this.filename=Sk.currFilename:3<=this.args.sq$length()?this.filename=this.args.v[1].v?this.args.v[1].v:"<unknown>":this.filename="<unknown>";3<=this.args.sq$length()?this.lineno=this.args.v[2]:this.lineno=0<Sk.currLineNo?Sk.currLineNo:"<unknown>";this.colno=0<Sk.currColNo?Sk.currColNo:"<unknown>"};
Sk.builtin.Exception.prototype.tp$name="Exception";Sk.builtin.Exception.prototype.tp$str=function(){var a;a=""+this.tp$name;this.args&&(a+=": "+(0<this.args.v.length?this.args.v[0].v:""));a+=" on line "+this.lineno;if(4<this.args.v.length){a+="\n"+this.args.v[4].v+"\n";for(var b=0;b<this.args.v[3];++b)a+=" ";a+="^\n"}return new Sk.builtin.str(a)};Sk.builtin.Exception.prototype.toString=function(){return this.tp$str().v};goog.exportSymbol("Sk.builtin.Exception",Sk.builtin.Exception);
Sk.builtin.AssertionError=function(a){if(!(this instanceof Sk.builtin.AssertionError)){var b=Object.create(Sk.builtin.AssertionError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.AssertionError,Sk.builtin.Exception);Sk.builtin.AssertionError.prototype.tp$name="AssertionError";goog.exportSymbol("Sk.builtin.AssertionError",Sk.builtin.AssertionError);
Sk.builtin.AttributeError=function(a){if(!(this instanceof Sk.builtin.AttributeError)){var b=Object.create(Sk.builtin.AttributeError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.AttributeError,Sk.builtin.Exception);Sk.builtin.AttributeError.prototype.tp$name="AttributeError";
Sk.builtin.ImportError=function(a){if(!(this instanceof Sk.builtin.ImportError)){var b=Object.create(Sk.builtin.ImportError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.ImportError,Sk.builtin.Exception);Sk.builtin.ImportError.prototype.tp$name="ImportError";
Sk.builtin.IndentationError=function(a){if(!(this instanceof Sk.builtin.IndentationError)){var b=Object.create(Sk.builtin.IndentationError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.IndentationError,Sk.builtin.Exception);Sk.builtin.IndentationError.prototype.tp$name="IndentationError";
Sk.builtin.IndexError=function(a){if(!(this instanceof Sk.builtin.IndexError)){var b=Object.create(Sk.builtin.IndexError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.IndexError,Sk.builtin.Exception);Sk.builtin.IndexError.prototype.tp$name="IndexError";
Sk.builtin.KeyError=function(a){if(!(this instanceof Sk.builtin.KeyError)){var b=Object.create(Sk.builtin.KeyError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.KeyError,Sk.builtin.Exception);Sk.builtin.KeyError.prototype.tp$name="KeyError";
Sk.builtin.NameError=function(a){if(!(this instanceof Sk.builtin.NameError)){var b=Object.create(Sk.builtin.NameError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.NameError,Sk.builtin.Exception);Sk.builtin.NameError.prototype.tp$name="NameError";
Sk.builtin.OverflowError=function(a){if(!(this instanceof Sk.builtin.OverflowError)){var b=Object.create(Sk.builtin.OverflowError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.OverflowError,Sk.builtin.Exception);Sk.builtin.OverflowError.prototype.tp$name="OverflowError";
Sk.builtin.ParseError=function(a){if(!(this instanceof Sk.builtin.ParseError)){var b=Object.create(Sk.builtin.ParseError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.ParseError,Sk.builtin.Exception);Sk.builtin.ParseError.prototype.tp$name="ParseError";
Sk.builtin.SystemExit=function(a){if(!(this instanceof Sk.builtin.SystemExit)){var b=Object.create(Sk.builtin.SystemExit.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.SystemExit,Sk.builtin.Exception);Sk.builtin.SystemExit.prototype.tp$name="SystemExit";goog.exportSymbol("Sk.builtin.SystemExit",Sk.builtin.SystemExit);
Sk.builtin.SyntaxError=function(a){if(!(this instanceof Sk.builtin.SyntaxError)){var b=Object.create(Sk.builtin.SyntaxError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.SyntaxError,Sk.builtin.Exception);Sk.builtin.SyntaxError.prototype.tp$name="SyntaxError";
Sk.builtin.TokenError=function(a){if(!(this instanceof Sk.builtin.TokenError)){var b=Object.create(Sk.builtin.TokenError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.TokenError,Sk.builtin.Exception);Sk.builtin.TokenError.prototype.tp$name="TokenError";
Sk.builtin.TypeError=function(a){if(!(this instanceof Sk.builtin.TypeError)){var b=Object.create(Sk.builtin.TypeError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.TypeError,Sk.builtin.Exception);Sk.builtin.TypeError.prototype.tp$name="TypeError";goog.exportSymbol("Sk.builtin.TypeError",Sk.builtin.TypeError);
Sk.builtin.ValueError=function(a){if(!(this instanceof Sk.builtin.ValueError)){var b=Object.create(Sk.builtin.ValueError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.ValueError,Sk.builtin.Exception);Sk.builtin.ValueError.prototype.tp$name="ValueError";goog.exportSymbol("Sk.builtin.ValueError",Sk.builtin.ValueError);
Sk.builtin.ZeroDivisionError=function(a){if(!(this instanceof Sk.builtin.ZeroDivisionError)){var b=Object.create(Sk.builtin.ZeroDivisionError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.ZeroDivisionError,Sk.builtin.Exception);Sk.builtin.ZeroDivisionError.prototype.tp$name="ZeroDivisionError";
Sk.builtin.TimeLimitError=function(a){if(!(this instanceof Sk.builtin.TimeLimitError)){var b=Object.create(Sk.builtin.TimeLimitError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.TimeLimitError,Sk.builtin.Exception);Sk.builtin.TimeLimitError.prototype.tp$name="TimeLimitError";goog.exportSymbol("Sk.builtin.TimeLimitError",Sk.builtin.TimeLimitError);
Sk.builtin.IOError=function(a){if(!(this instanceof Sk.builtin.IOError)){var b=Object.create(Sk.builtin.IOError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.IOError,Sk.builtin.Exception);Sk.builtin.IOError.prototype.tp$name="IOError";goog.exportSymbol("Sk.builtin.IOError",Sk.builtin.IOError);
Sk.builtin.NotImplementedError=function(a){if(!(this instanceof Sk.builtin.NotImplementedError)){var b=Object.create(Sk.builtin.NotImplementedError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.NotImplementedError,Sk.builtin.Exception);Sk.builtin.NotImplementedError.prototype.tp$name="NotImplementedError";goog.exportSymbol("Sk.builtin.NotImplementedError",Sk.builtin.NotImplementedError);
Sk.builtin.NegativePowerError=function(a){if(!(this instanceof Sk.builtin.NegativePowerError)){var b=Object.create(Sk.builtin.NegativePowerError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.NegativePowerError,Sk.builtin.Exception);Sk.builtin.NegativePowerError.prototype.tp$name="NegativePowerError";goog.exportSymbol("Sk.builtin.NegativePowerError",Sk.builtin.NegativePowerError);
Sk.builtin.OperationError=function(a){if(!(this instanceof Sk.builtin.OperationError)){var b=Object.create(Sk.builtin.OperationError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.OperationError,Sk.builtin.Exception);Sk.builtin.OperationError.prototype.tp$name="OperationError";goog.exportSymbol("Sk.builtin.OperationError",Sk.builtin.OperationError);
Sk.builtin.SystemError=function(a){if(!(this instanceof Sk.builtin.SystemError)){var b=Object.create(Sk.builtin.SystemError.prototype);b.constructor.apply(b,arguments);return b}Sk.builtin.Exception.apply(this,arguments)};goog.inherits(Sk.builtin.SystemError,Sk.builtin.Exception);Sk.builtin.SystemError.prototype.tp$name="SystemError";goog.exportSymbol("Sk.builtin.SystemError",Sk.builtin.SystemError);Sk.currLineNo=-1;Sk.currColNo=-1;Sk.currFilename="";goog.exportSymbol("Sk",Sk);
goog.exportProperty(Sk,"currLineNo",Sk.currLineNo);goog.exportProperty(Sk,"currColNo",Sk.currColNo);goog.exportProperty(Sk,"currFilename",Sk.currFilename);Sk.builtin.type=function(a,b,c){if(void 0===b&&void 0===c)return a.constructor===Sk.builtin.nmber?a.skType===Sk.builtin.nmber.int$?Sk.builtin.int_.prototype.ob$type:Sk.builtin.float_.prototype.ob$type:a.ob$type;var d=function(a,b,c,e){if(!(this instanceof d))return new d(a,b,c,e);e=e||[];this.$d=new Sk.builtin.dict([]);var l=Sk.builtin.type.typeLookup(this.ob$type,"__init__");void 0!==l&&(e.unshift(this),Sk.misceval.apply(l,a,b,c,e));return this},e;for(e in c)d.prototype[e]=c[e],d[e]=c[e];d.__class__=
d;d.sk$klass=!0;d.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;d.prototype.tp$setattr=Sk.builtin.object.prototype.GenericSetAttr;d.prototype.tp$descr_get=function(){goog.asserts.fail("in type tp$descr_get")};d.prototype.$r=function(){var b=this.tp$getattr("__repr__");if(void 0!==b)return Sk.misceval.apply(b,void 0,void 0,void 0,[]);var b=c.__module__,d="";b&&(d=b.v+".");return new Sk.builtin.str("<"+d+a+" object>")};d.prototype.tp$str=function(){var a=this.tp$getattr("__str__");
return void 0!==a?Sk.misceval.apply(a,void 0,void 0,void 0,[]):this.$r()};d.prototype.tp$length=function(){var a=this.tp$getattr("__len__");if(void 0!==a)return Sk.misceval.apply(a,void 0,void 0,void 0,[]);a=Sk.abstr.typeName(this);throw new Sk.builtin.AttributeError(a+" instance has no attribute '__len__'");};d.prototype.tp$call=function(a,b){var c=this.tp$getattr("__call__");if(c)return Sk.misceval.apply(c,void 0,void 0,b,a);throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(this)+"' object is not callable");
};d.prototype.tp$iter=function(){var a=this.tp$getattr("__iter__"),b=Sk.abstr.typeName(this);if(a)return Sk.misceval.callsim(a);throw new Sk.builtin.TypeError("'"+b+"' object is not iterable");};d.prototype.tp$iternext=function(){var a=this.tp$getattr("next");goog.asserts.assert(void 0!==a,"iter() should have caught this");return Sk.misceval.callsim(a)};d.prototype.tp$getitem=function(a){var b=this.tp$getattr("__getitem__");if(void 0!==b)return Sk.misceval.apply(b,void 0,void 0,void 0,[a]);throw new Sk.builtin.TypeError("'"+
Sk.abstr.typeName(this)+"' object does not support indexing");};d.prototype.tp$setitem=function(a,b){var c=this.tp$getattr("__setitem__");if(void 0!==c)return Sk.misceval.apply(c,void 0,void 0,void 0,[a,b]);throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(this)+"' object does not support item assignment");};d.prototype.tp$name=a;b&&(d.$d=new Sk.builtin.dict([]),d.$d.mp$ass_subscript(Sk.builtin.type.basesStr_,new Sk.builtin.tuple(b)),b=Sk.builtin.type.buildMRO(d),d.$d.mp$ass_subscript(Sk.builtin.type.mroStr_,
b),d.tp$mro=b);d.prototype.ob$type=d;Sk.builtin.type.makeIntoTypeObj(a,d);d.tp$setattr=Sk.builtin.type.prototype.tp$setattr;return d};Sk.builtin.type.makeTypeObj=function(a,b){Sk.builtin.type.makeIntoTypeObj(a,b);return b};
Sk.builtin.type.makeIntoTypeObj=function(a,b){goog.asserts.assert(void 0!==a);goog.asserts.assert(void 0!==b);b.ob$type=Sk.builtin.type;b.tp$name=a;b.$r=function(){var a=b.__module__,d="";a&&(d=a.v+".");var e="class";a||b.sk$klass||(e="type");return new Sk.builtin.str("<"+e+" '"+d+b.tp$name+"'>")};b.tp$str=void 0;b.tp$getattr=Sk.builtin.type.prototype.tp$getattr;b.tp$setattr=Sk.builtin.object.prototype.GenericSetAttr;b.tp$richcompare=Sk.builtin.type.prototype.tp$richcompare;b.sk$type=!0;return b};
Sk.builtin.type.ob$type=Sk.builtin.type;Sk.builtin.type.tp$name="type";Sk.builtin.type.$r=function(){return new Sk.builtin.str("<type 'type'>")};Sk.builtin.type.prototype.tp$getattr=function(a){var b=Sk.builtin.type.typeLookup(this,a),c;void 0!==b&&(null!==b&&void 0!==b.ob$type)&&(c=b.ob$type.tp$descr_get);if(this.$d&&(a=this.$d.mp$lookup(new Sk.builtin.str(a)),void 0!==a))return a;if(c)return c.call(b,null,this);if(void 0!==b)return b};Sk.builtin.type.prototype.tp$setattr=function(a,b){this[a]=b};
Sk.builtin.type.typeLookup=function(a,b){var c=a.tp$mro,d=new Sk.builtin.str(b),e,f;if(!c)return a.prototype[b];for(f=0;f<c.v.length;++f){e=c.v[f];if(e.hasOwnProperty(b))return e[b];e=e.$d.mp$lookup(d);if(void 0!==e)return e}};
Sk.builtin.type.mroMerge_=function(a){for(var b=[];;){for(var c=0;c<a.length;++c){var d=a[c];if(0!==d.length)break}if(c===a.length)return b;for(var e=[],c=0;c<a.length;++c)if(d=a[c],0!==d.length){var d=d[0],f=0;a:for(;f<a.length;++f)for(var g=a[f],h=1;h<g.length;++h)if(g[h]===d)break a;f===a.length&&e.push(d)}if(0===e.length)throw new Sk.builtin.TypeError("Inconsistent precedences in type hierarchy");e=e[0];b.push(e);for(c=0;c<a.length;++c)d=a[c],0<d.length&&d[0]===e&&d.splice(0,1)}};
Sk.builtin.type.buildMRO_=function(a){var b=[[a]];a=a.$d.mp$subscript(Sk.builtin.type.basesStr_);for(var c=0;c<a.v.length;++c)b.push(Sk.builtin.type.buildMRO_(a.v[c]));for(var d=[],c=0;c<a.v.length;++c)d.push(a.v[c]);b.push(d);return Sk.builtin.type.mroMerge_(b)};Sk.builtin.type.buildMRO=function(a){return new Sk.builtin.tuple(Sk.builtin.type.buildMRO_(a))};
Sk.builtin.type.prototype.tp$richcompare=function(a,b){if(a.ob$type==Sk.builtin.type&&this.$r&&a.$r){var c=this.$r(),d=a.$r();return c.tp$richcompare(d,b)}};Sk.builtin.object=function(){if(!(this instanceof Sk.builtin.object))return new Sk.builtin.object;this.$d=new Sk.builtin.dict([]);return this};
Sk.builtin.object.prototype.GenericGetAttr=function(a){goog.asserts.assert("string"===typeof a);var b=this.ob$type;goog.asserts.assert(void 0!==b,"object has no ob$type!");var b=Sk.builtin.type.typeLookup(b,a),c;void 0!==b&&(null!==b&&void 0!==b.ob$type)&&(c=b.ob$type.tp$descr_get);if(this.$d){var d;if(this.$d.mp$lookup)d=this.$d.mp$lookup(new Sk.builtin.str(a));else if(this.$d.mp$subscript)try{d=this.$d.mp$subscript(new Sk.builtin.str(a))}catch(e){d=void 0}else"object"===typeof this.$d&&(d=this.$d[a]);
if(void 0!==d)return d}if(c)return c.call(b,this,this.ob$type);if(void 0!==b)return b};goog.exportSymbol("Sk.builtin.object.prototype.GenericGetAttr",Sk.builtin.object.prototype.GenericGetAttr);Sk.builtin.object.prototype.GenericSetAttr=function(a,b){goog.asserts.assert("string"===typeof a);this.$d.mp$ass_subscript?this.$d.mp$ass_subscript(new Sk.builtin.str(a),b):"object"===typeof this.$d&&(this.$d[a]=b)};goog.exportSymbol("Sk.builtin.object.prototype.GenericSetAttr",Sk.builtin.object.prototype.GenericSetAttr);
Sk.builtin.object.prototype.HashNotImplemented=function(){throw new Sk.builtin.TypeError("unhashable type: '"+Sk.abstr.typeName(this)+"'");};Sk.builtin.object.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;Sk.builtin.object.prototype.tp$setattr=Sk.builtin.object.prototype.GenericSetAttr;Sk.builtin.object.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("object",Sk.builtin.object);Sk.builtin.none=function(){};
Sk.builtin.none.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("NoneType",Sk.builtin.none);Sk.builtin.none.prototype.tp$name="NoneType";Sk.builtin.none.none$=Object.create(Sk.builtin.none.prototype,{v:{value:null,enumerable:!0}});goog.exportSymbol("Sk.builtin.none",Sk.builtin.none);Sk.builtin.bool=function(a){Sk.builtin.pyCheckArgs("bool",arguments,1);return Sk.misceval.isTrue(a)?Sk.builtin.bool.true$:Sk.builtin.bool.false$};Sk.builtin.bool.prototype.tp$name="bool";Sk.builtin.bool.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("bool",Sk.builtin.bool);Sk.builtin.bool.prototype.$r=function(){return this.v?new Sk.builtin.str("True"):new Sk.builtin.str("False")};Sk.builtin.bool.true$=Object.create(Sk.builtin.bool.prototype,{v:{value:!0,enumerable:!0}});
Sk.builtin.bool.false$=Object.create(Sk.builtin.bool.prototype,{v:{value:!1,enumerable:!0}});goog.exportSymbol("Sk.builtin.bool",Sk.builtin.bool);Sk.builtin.pyCheckArgs=function(a,b,c,d,e,f){b=b.length;var g="";void 0===d&&(d=Infinity);e&&(b-=1);f&&(b-=1);if(b<c||b>d)throw g=(c===d?a+"() takes exactly "+c+" arguments":b<c?a+"() takes at least "+c+" arguments":a+"() takes at most "+d+" arguments")+(" ("+b+" given)"),new Sk.builtin.TypeError(g);};goog.exportSymbol("Sk.builtin.pyCheckArgs",Sk.builtin.pyCheckArgs);Sk.builtin.pyCheckType=function(a,b,c){if(!c)throw new Sk.builtin.TypeError(a+" must be a "+b);};
goog.exportSymbol("Sk.builtin.pyCheckType",Sk.builtin.pyCheckType);Sk.builtin.checkSequence=function(a){return null!==a&&void 0!==a.mp$subscript};goog.exportSymbol("Sk.builtin.checkSequence",Sk.builtin.checkSequence);Sk.builtin.checkIterable=function(a){return null!==a&&void 0!==a.tp$iter};goog.exportSymbol("Sk.builtin.checkIterable",Sk.builtin.checkIterable);Sk.builtin.checkNumber=function(a){return null!==a&&("number"===typeof a||a instanceof Sk.builtin.nmber||a instanceof Sk.builtin.lng)};
goog.exportSymbol("Sk.builtin.checkNumber",Sk.builtin.checkNumber);Sk.builtin.checkInt=function(a){return null!==a&&("number"===typeof a&&a===(a|0)||a instanceof Sk.builtin.nmber&&a.skType===Sk.builtin.nmber.int$||a instanceof Sk.builtin.lng)};goog.exportSymbol("Sk.builtin.checkInt",Sk.builtin.checkInt);Sk.builtin.checkString=function(a){return null!==a&&a.__class__==Sk.builtin.str};goog.exportSymbol("Sk.builtin.checkString",Sk.builtin.checkString);
Sk.builtin.checkClass=function(a){return null!==a&&a.sk$type};goog.exportSymbol("Sk.builtin.checkClass",Sk.builtin.checkClass);Sk.builtin.checkBool=function(a){return a instanceof Sk.builtin.bool};goog.exportSymbol("Sk.builtin.checkBool",Sk.builtin.checkBool);Sk.builtin.checkFunction=function(a){return null!==a&&void 0!==a.tp$call};goog.exportSymbol("Sk.builtin.checkFunction",Sk.builtin.checkFunction);
Sk.builtin.func=function(a,b,c,d){this.func_code=a;this.func_globals=b||null;if(void 0!==d)for(var e in d)c[e]=d[e];this.func_closure=c;return this};goog.exportSymbol("Sk.builtin.func",Sk.builtin.func);Sk.builtin.func.prototype.tp$name="function";Sk.builtin.func.prototype.tp$descr_get=function(a,b){goog.asserts.assert(void 0!==a&&void 0!==b);return null==a?this:new Sk.builtin.method(this,a)};
Sk.builtin.func.prototype.tp$call=function(a,b){var c;this.func_closure&&a.push(this.func_closure);c=this.func_code.co_kwargs;var d=[];if(this.func_code.no_kw&&b)throw c=this.func_code&&this.func_code.co_name&&this.func_code.co_name.v||"<native JS>",new Sk.builtin.TypeError(c+"() takes no keyword arguments");if(b)for(var e=b.length,f=this.func_code.co_varnames,g=f&&f.length,h=0;h<e;h+=2){for(var k=0;k<g&&b[h]!==f[k];++k);if(f&&k!==g)a[k]=b[h+1];else if(c)d.push(new Sk.builtin.str(b[h])),d.push(b[h+
1]);else throw c=this.func_code&&this.func_code.co_name&&this.func_code.co_name.v||"<native JS>",new Sk.builtin.TypeError(c+"() got an unexpected keyword argument '"+b[h]+"'");}c&&a.unshift(d);return this.func_code.apply(this.func_globals,a)};Sk.builtin.func.prototype.tp$getattr=function(a){return this[a]};Sk.builtin.func.prototype.tp$setattr=function(a,b){this[a]=b};Sk.builtin.func.prototype.ob$type=Sk.builtin.type.makeTypeObj("function",new Sk.builtin.func(null,null));
Sk.builtin.func.prototype.$r=function(){return new Sk.builtin.str("<function "+(this.func_code&&this.func_code.co_name&&this.func_code.co_name.v||"<native JS>")+">")};Sk.nativejs={FN_ARGS:/^function\s*[^\(]*\(\s*([^\)]*)\)/m,FN_ARG_SPLIT:/,/,FN_ARG:/^\s*(_?)(\S+?)\1\s*$/,STRIP_COMMENTS:/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg,formalParameterList:function(a){var b=[];a=a.toString().replace(this.STRIP_COMMENTS,"").match(this.FN_ARGS)[1].split(this.FN_ARG_SPLIT);for(var c in a)a[c].replace(this.FN_ARG,function(a,c,f){b.push(f)});return b},func:function(a){a.co_name=new Sk.builtin.str(a.name);a.co_varnames=Sk.nativejs.formalParameterList(a);return new Sk.builtin.func(a)},
func_nokw:function(a){a.co_name=new Sk.builtin.str(a.name);a.co_varnames=Sk.nativejs.formalParameterList(a);a.no_kw=!0;return new Sk.builtin.func(a)}};goog.exportSymbol("Sk.nativejs.func",Sk.nativejs.func);goog.exportSymbol("Sk.nativejs.func_nokw",Sk.nativejs.func_nokw);Sk.builtin.method=function(a,b){this.im_func=a;this.im_self=b};goog.exportSymbol("Sk.builtin.method",Sk.builtin.method);
Sk.builtin.method.prototype.tp$call=function(a,b){goog.asserts.assert(this.im_self,"should just be a function, not a method since there's no self?");goog.asserts.assert(this.im_func instanceof Sk.builtin.func);a.unshift(this.im_self);if(b)for(var c=b.length,d=0;d<c;d+=2){for(var e=this.im_func.func_code.co_varnames,f=e&&e.length,g=0;g<f&&b[d]!==e[g];++g);a[g]=b[d+1]}return this.im_func.func_code.apply(this.im_func.func_globals,a)};
Sk.builtin.method.prototype.$r=function(){return new Sk.builtin.str("<bound method "+this.im_self.ob$type.tp$name+"."+(this.im_func.func_code&&this.im_func.func_code.co_name&&this.im_func.func_code.co_name.v||"<native JS>")+" of "+this.im_self.$r().v+">")};Sk.misceval={};Sk.misceval.isIndex=function(a){return null===a||a.constructor===Sk.builtin.lng||a.tp$index||!0===a||!1===a?!0:Sk.builtin.checkInt(a)};goog.exportSymbol("Sk.misceval.isIndex",Sk.misceval.isIndex);Sk.misceval.asIndex=function(a){if(Sk.misceval.isIndex(a)&&null!==a){if(!0===a)return 1;if(!1===a)return 0;if("number"===typeof a)return a;if(a.constructor===Sk.builtin.nmber)return a.v;if(a.constructor===Sk.builtin.lng)return a.tp$index();goog.asserts.fail("todo;")}};
Sk.misceval.applySlice=function(a,b,c){return a.sq$slice&&Sk.misceval.isIndex(b)&&Sk.misceval.isIndex(c)?(b=Sk.misceval.asIndex(b),void 0===b&&(b=0),c=Sk.misceval.asIndex(c),void 0===c&&(c=1E100),Sk.abstr.sequenceGetSlice(a,b,c)):Sk.abstr.objectGetItem(a,new Sk.builtin.slice(b,c,null))};goog.exportSymbol("Sk.misceval.applySlice",Sk.misceval.applySlice);
Sk.misceval.assignSlice=function(a,b,c,d){if(a.sq$ass_slice&&Sk.misceval.isIndex(b)&&Sk.misceval.isIndex(c))b=Sk.misceval.asIndex(b)||0,c=Sk.misceval.asIndex(c)||1E100,null===d?Sk.abstr.sequenceDelSlice(a,b,c):Sk.abstr.sequenceSetSlice(a,b,c,d);else return c=new Sk.builtin.slice(b,c),null===d?Sk.abstr.objectDelItem(a,c):Sk.abstr.objectSetItem(a,c,d)};goog.exportSymbol("Sk.misceval.assignSlice",Sk.misceval.assignSlice);
Sk.misceval.arrayFromArguments=function(a){if(1!=a.length)return a;var b=a[0];if(b instanceof Sk.builtin.set)b=b.tp$iter().$obj;else if(b instanceof Sk.builtin.dict)b=Sk.builtin.dict.prototype.keys.func_code(b);else if(b instanceof Sk.builtin.str){a=[];for(var b=b.tp$iter(),c=b.tp$iternext();void 0!==c;c=b.tp$iternext())a.push(c);return a}return b instanceof Sk.builtin.list||b instanceof Sk.builtin.tuple?b.v:a};goog.exportSymbol("Sk.misceval.arrayFromArguments",Sk.misceval.arrayFromArguments);
Sk.misceval.swappedOp_={Eq:"Eq",NotEq:"NotEq",Lt:"GtE",LtE:"Gt",Gt:"LtE",GtE:"Lt",Is:"IsNot",IsNot:"Is",In_:"NotIn",NotIn:"In_"};
Sk.misceval.richCompareBool=function(a,b,c){goog.asserts.assert(null!==a&&void 0!==a,"passed undefined or null parameter to Sk.misceval.richCompareBool");goog.asserts.assert(null!==b&&void 0!==b,"passed undefined or null parameter to Sk.misceval.richCompareBool");var d=new Sk.builtin.type(a),e=new Sk.builtin.type(b);if(d!==e&&("GtE"===c||"Gt"===c||"LtE"===c||"Lt"===c)){var f=[Sk.builtin.float_.prototype.ob$type,Sk.builtin.int_.prototype.ob$type,Sk.builtin.lng.prototype.ob$type,Sk.builtin.bool.prototype.ob$type],
g=[Sk.builtin.dict.prototype.ob$type,Sk.builtin.enumerate.prototype.ob$type,Sk.builtin.list.prototype.ob$type,Sk.builtin.str.prototype.ob$type,Sk.builtin.tuple.prototype.ob$type],h=f.indexOf(d),k=g.indexOf(d),f=f.indexOf(e),g=g.indexOf(e);if(d===Sk.builtin.none.prototype.ob$type)switch(c){case "Lt":return!0;case "LtE":return!0;case "Gt":return!1;case "GtE":return!1}if(e===Sk.builtin.none.prototype.ob$type)switch(c){case "Lt":return!1;case "LtE":return!1;case "Gt":return!0;case "GtE":return!0}if(-1!==
h&&-1!==g)switch(c){case "Lt":return!0;case "LtE":return!0;case "Gt":return!1;case "GtE":return!1}if(-1!==k&&-1!==f)switch(c){case "Lt":return!1;case "LtE":return!1;case "Gt":return!0;case "GtE":return!0}if(-1!==k&&-1!==g)switch(c){case "Lt":return k<g;case "LtE":return k<=g;case "Gt":return k>g;case "GtE":return k>=g}}if("Is"===c)return a instanceof Sk.builtin.nmber&&b instanceof Sk.builtin.nmber?0===a.numberCompare(b)&&a.skType===b.skType:a instanceof Sk.builtin.lng&&b instanceof Sk.builtin.lng?
0===a.longCompare(b):a===b;if("IsNot"===c)return a instanceof Sk.builtin.nmber&&b instanceof Sk.builtin.nmber?0!==a.numberCompare(b)||a.skType!==b.skType:a instanceof Sk.builtin.lng&&b instanceof Sk.builtin.lng?0!==a.longCompare(b):a!==b;if("In"===c)return Sk.abstr.sequenceContains(b,a);if("NotIn"===c)return!Sk.abstr.sequenceContains(b,a);var l;if(a.tp$richcompare&&void 0!==(l=a.tp$richcompare(b,c))||b.tp$richcompare&&void 0!==(l=b.tp$richcompare(a,Sk.misceval.swappedOp_[c])))return l;e={Eq:"__eq__",
NotEq:"__ne__",Gt:"__gt__",GtE:"__ge__",Lt:"__lt__",LtE:"__le__"};d=e[c];e=e[Sk.misceval.swappedOp_[c]];if(a[d])return Sk.misceval.callsim(a[d],a,b);if(b[e])return Sk.misceval.callsim(b[e],b,a);if(a.__cmp__){d=Sk.misceval.callsim(a.__cmp__,a,b);d=Sk.builtin.asnum$(d);if("Eq"===c)return 0===d;if("NotEq"===c)return 0!==d;if("Lt"===c)return 0>d;if("Gt"===c)return 0<d;if("LtE"===c)return 0>=d;if("GtE"===c)return 0<=d}if(b.__cmp__){d=Sk.misceval.callsim(b.__cmp__,b,a);d=Sk.builtin.asnum$(d);if("Eq"===
c)return 0===d;if("NotEq"===c)return 0!==d;if("Lt"===c)return 0<d;if("Gt"===c)return 0>d;if("LtE"===c)return 0<=d;if("GtE"===c)return 0>=d}if(a instanceof Sk.builtin.none&&b instanceof Sk.builtin.none||a instanceof Sk.builtin.bool&&b instanceof Sk.builtin.bool){if("Eq"===c)return a.v===b.v;if("NotEq"===c)return a.v!==b.v;if("Gt"===c)return a.v>b.v;if("GtE"===c)return a.v>=b.v;if("Lt"===c)return a.v<b.v;if("LtE"===c)return a.v<=b.v}if("Eq"===c)return a instanceof Sk.builtin.str&&b instanceof Sk.builtin.str?
a.v===b.v:a===b;if("NotEq"===c)return a instanceof Sk.builtin.str&&b instanceof Sk.builtin.str?a.v!==b.v:a!==b;a=Sk.abstr.typeName(a);b=Sk.abstr.typeName(b);throw new Sk.builtin.ValueError("don't know how to compare '"+a+"' and '"+b+"'");};goog.exportSymbol("Sk.misceval.richCompareBool",Sk.misceval.richCompareBool);
Sk.misceval.objectRepr=function(a){goog.asserts.assert(void 0!==a,"trying to repr undefined");return null===a||a instanceof Sk.builtin.none?new Sk.builtin.str("None"):!0===a?new Sk.builtin.str("True"):!1===a?new Sk.builtin.str("False"):"number"===typeof a?new Sk.builtin.str(""+a):a.$r?a.constructor===Sk.builtin.nmber?Infinity===a.v?new Sk.builtin.str("inf"):-Infinity===a.v?new Sk.builtin.str("-inf"):new Sk.builtin.str(""+a.v):a.$r():a.tp$name?new Sk.builtin.str("<"+a.tp$name+" object>"):new Sk.builtin.str("<unknown>")};
goog.exportSymbol("Sk.misceval.objectRepr",Sk.misceval.objectRepr);Sk.misceval.opAllowsEquality=function(a){switch(a){case "LtE":case "Eq":case "GtE":return!0}return!1};goog.exportSymbol("Sk.misceval.opAllowsEquality",Sk.misceval.opAllowsEquality);
Sk.misceval.isTrue=function(a){return!0===a?!0:!1===a||null===a||a.constructor===Sk.builtin.none?!1:a.constructor===Sk.builtin.bool?a.v:"number"===typeof a?0!==a:a instanceof Sk.builtin.lng?a.nb$nonzero():a.constructor===Sk.builtin.nmber?0!==a.v:a.mp$length?0!==a.mp$length():a.sq$length?0!==a.sq$length():!0};goog.exportSymbol("Sk.misceval.isTrue",Sk.misceval.isTrue);Sk.misceval.softspace_=!1;
Sk.misceval.print_=function(a){Sk.misceval.softspace_&&("\n"!==a&&Sk.output(" "),Sk.misceval.softspace_=!1);a=new Sk.builtin.str(a);Sk.output(a.v);if(0===a.v.length||"\n"!==a.v[a.v.length-1]&&"\t"!==a.v[a.v.length-1]&&"\r"!==a.v[a.v.length-1]||" "===a.v[a.v.length-1])Sk.misceval.softspace_=!0};goog.exportSymbol("Sk.misceval.print_",Sk.misceval.print_);
Sk.misceval.loadname=function(a,b){var c=b[a];if(void 0!==c)return c;c=Sk.builtins[a];if(void 0!==c)return c;a=a.replace("_$rw$","");a=a.replace("_$rn$","");throw new Sk.builtin.NameError("name '"+a+"' is not defined");};goog.exportSymbol("Sk.misceval.loadname",Sk.misceval.loadname);Sk.misceval.call=function(a,b,c,d,e){e=Array.prototype.slice.call(arguments,4);return Sk.misceval.apply(a,b,c,d,e)};goog.exportSymbol("Sk.misceval.call",Sk.misceval.call);
Sk.misceval.callsim=function(a,b){b=Array.prototype.slice.call(arguments,1);return Sk.misceval.apply(a,void 0,void 0,void 0,b)};goog.exportSymbol("Sk.misceval.callsim",Sk.misceval.callsim);
Sk.misceval.apply=function(a,b,c,d,e){if(null===a||a instanceof Sk.builtin.none)throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(a)+"' object is not callable");if("function"===typeof a){if(a.sk$klass)return a.apply(null,[b,c,d,e]);if(c){c=c.tp$iter();for(var f=c.tp$iternext();void 0!==f;f=c.tp$iternext())e.push(f)}b&&goog.asserts.fail("kwdict not implemented;");goog.asserts.assert(void 0===d||0===d.length);return a.apply(null,e)}var g=a.tp$call;if(void 0!==g){if(c)for(c=c.tp$iter(),f=c.tp$iternext();void 0!==
f;f=c.tp$iternext())e.push(f);b&&goog.asserts.fail("kwdict not implemented;");return g.call(a,e,d,b)}g=a.__call__;if(void 0!==g)return e.unshift(a),Sk.misceval.apply(g,d,e,b,c);throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(a)+"' object is not callable");};goog.exportSymbol("Sk.misceval.apply",Sk.misceval.apply);Sk.misceval.buildClass=function(a,b,c,d){var e=Sk.builtin.type,f={};b(a,f,[]);f.__module__=a.__name__;return Sk.misceval.callsim(e,c,d,f)};
goog.exportSymbol("Sk.misceval.buildClass",Sk.misceval.buildClass);Sk.abstr={};Sk.abstr.typeName=function(a){return a instanceof Sk.builtin.nmber?a.skType:void 0!==a.tp$name?a.tp$name:"<invalid type>"};Sk.abstr.binop_type_error=function(a,b,c){a=Sk.abstr.typeName(a);b=Sk.abstr.typeName(b);throw new Sk.builtin.TypeError("unsupported operand type(s) for "+c+": '"+a+"' and '"+b+"'");};
Sk.abstr.boNameToSlotFuncLhs_=function(a,b){if(null!==a)switch(b){case "Add":return a.nb$add?a.nb$add:a.__add__;case "Sub":return a.nb$subtract?a.nb$subtract:a.__sub__;case "Mult":return a.nb$multiply?a.nb$multiply:a.__mul__;case "Div":return a.nb$divide?a.nb$divide:a.__div__;case "FloorDiv":return a.nb$floor_divide?a.nb$floor_divide:a.__floordiv__;case "Mod":return a.nb$remainder?a.nb$remainder:a.__mod__;case "Pow":return a.nb$power?a.nb$power:a.__pow__;case "LShift":return a.nb$lshift?a.nb$lshift:
a.__lshift__;case "RShift":return a.nb$rshift?a.nb$rshift:a.__rshift__;case "BitAnd":return a.nb$and?a.nb$and:a.__and__;case "BitXor":return a.nb$xor?a.nb$xor:a.__xor__;case "BitOr":return a.nb$or?a.nb$or:a.__or__}};
Sk.abstr.boNameToSlotFuncRhs_=function(a,b){if(null!==a)switch(b){case "Add":return a.nb$add?a.nb$add:a.__radd__;case "Sub":return a.nb$subtract?a.nb$subtract:a.__rsub__;case "Mult":return a.nb$multiply?a.nb$multiply:a.__rmul__;case "Div":return a.nb$divide?a.nb$divide:a.__rdiv__;case "FloorDiv":return a.nb$floor_divide?a.nb$floor_divide:a.__rfloordiv__;case "Mod":return a.nb$remainder?a.nb$remainder:a.__rmod__;case "Pow":return a.nb$power?a.nb$power:a.__rpow__;case "LShift":return a.nb$lshift?a.nb$lshift:
a.__rlshift__;case "RShift":return a.nb$rshift?a.nb$rshift:a.__rrshift__;case "BitAnd":return a.nb$and?a.nb$and:a.__rand__;case "BitXor":return a.nb$xor?a.nb$xor:a.__rxor__;case "BitOr":return a.nb$or?a.nb$or:a.__ror__}};
Sk.abstr.iboNameToSlotFunc_=function(a,b){switch(b){case "Add":return a.nb$inplace_add?a.nb$inplace_add:a.__iadd__;case "Sub":return a.nb$inplace_subtract?a.nb$inplace_subtract:a.__isub__;case "Mult":return a.nb$inplace_multiply?a.nb$inplace_multiply:a.__imul__;case "Div":return a.nb$inplace_divide?a.nb$inplace_divide:a.__idiv__;case "FloorDiv":return a.nb$inplace_floor_divide?a.nb$inplace_floor_divide:a.__ifloordiv__;case "Mod":return a.nb$inplace_remainder;case "Pow":return a.nb$inplace_power;case "LShift":return a.nb$inplace_lshift?
a.nb$inplace_lshift:a.__ilshift__;case "RShift":return a.nb$inplace_rshift?a.nb$inplace_rshift:a.__irshift__;case "BitAnd":return a.nb$inplace_and;case "BitOr":return a.nb$inplace_or;case "BitXor":return a.nb$inplace_xor?a.nb$inplace_xor:a.__ixor__}};
Sk.abstr.binary_op_=function(a,b,c){var d;d=Sk.abstr.boNameToSlotFuncLhs_(a,c);if(void 0!==d&&(d=d.call?d.call(a,b):Sk.misceval.callsim(d,a,b),void 0!==d))return d;d=Sk.abstr.boNameToSlotFuncRhs_(b,c);if(void 0!==d&&(d=d.call?d.call(b,a):Sk.misceval.callsim(d,b,a),void 0!==d))return d;Sk.abstr.binop_type_error(a,b,c)};
Sk.abstr.binary_iop_=function(a,b,c){var d;d=Sk.abstr.iboNameToSlotFunc_(a,c);if(void 0!==d&&(d=d.call?d.call(a,b):Sk.misceval.callsim(d,a,b),void 0!==d))return d;d=Sk.abstr.iboNameToSlotFunc_(b,c);if(void 0!==d&&(d=d.call?d.call(b,a):Sk.misceval.callsim(d,b,a),void 0!==d))return d;Sk.abstr.binop_type_error(a,b,c)};
Sk.abstr.numOpAndPromote=function(a,b,c){if(null!==a&&null!==b){if("number"===typeof a&&"number"===typeof b)return c=c(a,b),(c>Sk.builtin.lng.threshold$||c<-Sk.builtin.lng.threshold$)&&Math.floor(c)===c?[Sk.builtin.lng.fromInt$(a),Sk.builtin.lng.fromInt$(b)]:c;if(void 0===a||void 0===b)throw new Sk.builtin.NameError("Undefined variable in expression");if(a.constructor===Sk.builtin.lng||a.constructor===Sk.builtin.nmber)return[a,b];if("number"===typeof a)return[new Sk.builtin.nmber(a,void 0),b]}};
Sk.abstr.boNumPromote_={Add:function(a,b){return a+b},Sub:function(a,b){return a-b},Mult:function(a,b){return a*b},Mod:function(a,b){if(0===b)throw new Sk.builtin.ZeroDivisionError("division or modulo by zero");var c=a%b;return 0>c*b?c+b:c},Div:function(a,b){if(0===b)throw new Sk.builtin.ZeroDivisionError("division or modulo by zero");return a/b},FloorDiv:function(a,b){if(0===b)throw new Sk.builtin.ZeroDivisionError("division or modulo by zero");return Math.floor(a/b)},Pow:Math.pow,BitAnd:function(a,
b){var c=a&b;0>c&&(c+=4294967296);return c},BitOr:function(a,b){var c=a|b;0>c&&(c+=4294967296);return c},BitXor:function(a,b){var c=a^b;0>c&&(c+=4294967296);return c},LShift:function(a,b){if(0>b)throw new Sk.builtin.ValueError("negative shift count");var c=a<<b;return c>a?c:a*Math.pow(2,b)},RShift:function(a,b){if(0>b)throw new Sk.builtin.ValueError("negative shift count");var c=a>>b;0<a&&0>c&&(c&=Math.pow(2,32-b)-1);return c}};
Sk.abstr.numberBinOp=function(a,b,c){var d=Sk.abstr.boNumPromote_[c];if(void 0!==d){d=Sk.abstr.numOpAndPromote(a,b,d);if("number"===typeof d)return d;if(void 0!==d&&d.constructor===Sk.builtin.nmber||void 0!==d&&d.constructor===Sk.builtin.lng)return d;void 0!==d&&(a=d[0],b=d[1])}return Sk.abstr.binary_op_(a,b,c)};goog.exportSymbol("Sk.abstr.numberBinOp",Sk.abstr.numberBinOp);
Sk.abstr.numberInplaceBinOp=function(a,b,c){var d=Sk.abstr.boNumPromote_[c];if(void 0!==d){d=Sk.abstr.numOpAndPromote(a,b,d);if("number"===typeof d)return d;if(void 0!==d&&d.constructor===Sk.builtin.nmber||void 0!==d&&d.constructor===Sk.builtin.lng)return d;void 0!==d&&(a=d[0],b=d[1])}return Sk.abstr.binary_iop_(a,b,c)};goog.exportSymbol("Sk.abstr.numberInplaceBinOp",Sk.abstr.numberInplaceBinOp);
Sk.abstr.numberUnaryOp=function(a,b){if("Not"===b)return Sk.misceval.isTrue(a)?Sk.builtin.bool.false$:Sk.builtin.bool.true$;if(a instanceof Sk.builtin.nmber||a instanceof Sk.builtin.bool){var c=Sk.builtin.asnum$(a);if("USub"===b)return new Sk.builtin.nmber(-c,c.skType);if("UAdd"===b)return new Sk.builtin.nmber(c,c.skType);if("Invert"===b)return new Sk.builtin.nmber(~c,c.skType)}else{if("USub"===b&&a.nb$negative)return a.nb$negative();if("UAdd"===b&&a.nb$positive)return a.nb$positive();if("Invert"===
b&&a.nb$invert)return a.nb$invert()}c=Sk.abstr.typeName(a);throw new Sk.builtin.TypeError("unsupported operand type for "+b+" '"+c+"'");};goog.exportSymbol("Sk.abstr.numberUnaryOp",Sk.abstr.numberUnaryOp);Sk.abstr.fixSeqIndex_=function(a,b){b=Sk.builtin.asnum$(b);0>b&&a.sq$length&&(b+=a.sq$length());return b};
Sk.abstr.sequenceContains=function(a,b){if(a.sq$contains)return a.sq$contains(b);var c=Sk.abstr.typeName(a);if(!a.tp$iter)throw new Sk.builtin.TypeError("argument of type '"+c+"' is not iterable");for(var c=a.tp$iter(),d=c.tp$iternext();void 0!==d;d=c.tp$iternext())if(Sk.misceval.richCompareBool(d,b,"Eq"))return!0;return!1};Sk.abstr.sequenceGetItem=function(a,b){goog.asserts.fail()};Sk.abstr.sequenceSetItem=function(a,b,c){goog.asserts.fail()};
Sk.abstr.sequenceDelItem=function(a,b){if(a.sq$del_item)b=Sk.abstr.fixSeqIndex_(a,b),a.sq$del_item(b);else{var c=Sk.abstr.typeName(a);throw new Sk.builtin.TypeError("'"+c+"' object does not support item deletion");}};Sk.abstr.sequenceRepeat=function(a,b,c){c=Sk.builtin.asnum$(c);if(void 0===Sk.misceval.asIndex(c))throw a=Sk.abstr.typeName(c),new Sk.builtin.TypeError("can't multiply sequence by non-int of type '"+a+"'");return a.call(b,c)};
Sk.abstr.sequenceGetSlice=function(a,b,c){if(a.sq$slice)return b=Sk.abstr.fixSeqIndex_(a,b),c=Sk.abstr.fixSeqIndex_(a,c),a.sq$slice(b,c);if(a.mp$subscript)return a.mp$subscript(new Sk.builtin.slice(b,c));a=Sk.abstr.typeName(a);throw new Sk.builtin.TypeError("'"+a+"' object is unsliceable");};
Sk.abstr.sequenceDelSlice=function(a,b,c){if(a.sq$del_slice)b=Sk.abstr.fixSeqIndex_(a,b),c=Sk.abstr.fixSeqIndex_(a,c),a.sq$del_slice(b,c);else throw a=Sk.abstr.typeName(a),new Sk.builtin.TypeError("'"+a+"' doesn't support slice deletion");};
Sk.abstr.sequenceSetSlice=function(a,b,c,d){if(a.sq$ass_slice)b=Sk.abstr.fixSeqIndex_(a,b),c=Sk.abstr.fixSeqIndex_(a,c),a.sq$ass_slice(b,c,d);else if(a.mp$ass_subscript)a.mp$ass_subscript(new Sk.builtin.slice(b,c),d);else throw a=Sk.abstr.typeName(a),new Sk.builtin.TypeError("'"+a+"' object doesn't support slice assignment");};
Sk.abstr.objectDelItem=function(a,b){if(null!==a){if(a.mp$del_subscript){a.mp$del_subscript(b);return}if(a.sq$ass_item){var c=Sk.misceval.asIndex(b);if(void 0===c)throw c=Sk.abstr.typeName(b),new Sk.builtin.TypeError("sequence index must be integer, not '"+c+"'");Sk.abstr.sequenceDelItem(a,c);return}}c=Sk.abstr.typeName(a);throw new Sk.builtin.TypeError("'"+c+"' object does not support item deletion");};goog.exportSymbol("Sk.abstr.objectDelItem",Sk.abstr.objectDelItem);
Sk.abstr.objectGetItem=function(a,b){if(null!==a){if(a.mp$subscript)return a.mp$subscript(b);if(Sk.misceval.isIndex(b)&&a.sq$item)return Sk.abstr.sequenceGetItem(a,Sk.misceval.asIndex(b));if(a.tp$getitem)return a.tp$getitem(b)}var c=Sk.abstr.typeName(a);throw new Sk.builtin.TypeError("'"+c+"' does not support indexing");};goog.exportSymbol("Sk.abstr.objectGetItem",Sk.abstr.objectGetItem);
Sk.abstr.objectSetItem=function(a,b,c){if(null!==a){if(a.mp$ass_subscript)return a.mp$ass_subscript(b,c);if(Sk.misceval.isIndex(b)&&a.sq$ass_item)return Sk.abstr.sequenceSetItem(a,Sk.misceval.asIndex(b),c);if(a.tp$setitem)return a.tp$setitem(b,c)}a=Sk.abstr.typeName(a);throw new Sk.builtin.TypeError("'"+a+"' does not support item assignment");};goog.exportSymbol("Sk.abstr.objectSetItem",Sk.abstr.objectSetItem);
Sk.abstr.gattr=function(a,b){var c=Sk.abstr.typeName(a);if(null===a)throw new Sk.builtin.AttributeError("'"+c+"' object has no attribute '"+b+"'");var d=void 0;a.__getattr__?d=Sk.misceval.callsim(a.__getattr__,a,b):void 0!==a.tp$getattr&&(d=a.tp$getattr(b));if(void 0===d)throw new Sk.builtin.AttributeError("'"+c+"' object has no attribute '"+b+"'");return d};goog.exportSymbol("Sk.abstr.gattr",Sk.abstr.gattr);
Sk.abstr.sattr=function(a,b,c){var d=Sk.abstr.typeName(a);if(null===a)throw new Sk.builtin.AttributeError("'"+d+"' object has no attribute '"+b+"'");if(a.__setattr__)Sk.misceval.callsim(a.__setattr__,a,b,c);else if(void 0!==a.tp$setattr)a.tp$setattr(b,c);else throw new Sk.builtin.AttributeError("'"+d+"' object has no attribute '"+b+"'");};goog.exportSymbol("Sk.abstr.sattr",Sk.abstr.sattr);
Sk.abstr.iter=function(a){if(a.tp$iter)return a.tp$iter();throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(a)+"' object is not iterable");};goog.exportSymbol("Sk.abstr.iter",Sk.abstr.iter);Sk.abstr.iternext=function(a){return a.tp$iternext()};goog.exportSymbol("Sk.abstr.iternext",Sk.abstr.iternext);Sk.mergeSort=function(a,b,c,d){Sk.quickSort(a,b,c,d)};Sk.quickSort=function(a,b,c,d){goog.asserts.assert(!c,"todo;");b||(b=Sk.mergeSort.stdCmp);var e=function(a,c,d,k){if(d-1>c){var l=c+Math.floor(Math.random()*(d-c)),m,n=a[l];m=a[l];a[l]=a[d-1];a[d-1]=m;var l=c,p;for(p=c;p<d-1;++p)m=k?Sk.misceval.callsim(b,n,a[p]):Sk.misceval.callsim(b,a[p],n),0>Sk.builtin.asnum$(m)&&(m=a[l],a[l]=a[p],a[p]=m,++l);m=a[d-1];a[d-1]=a[l];a[l]=m;e(a,c,l,k);e(a,l+1,d,k)}};e(a,0,a.length,d);return null};
Sk.mergeSort.stdCmp=new Sk.builtin.func(function(a,b){return Sk.misceval.richCompareBool(a,b,"Lt")?-1:0});Sk.builtin.list=function(a){if(!(this instanceof Sk.builtin.list))return new Sk.builtin.list(a);if(void 0===a)this.v=[];else if("[object Array]"===Object.prototype.toString.apply(a))this.v=a;else if(a.tp$iter){this.v=[];a=a.tp$iter();for(var b=a.tp$iternext();void 0!==b;b=a.tp$iternext())this.v.push(b)}else throw new Sk.builtin.ValueError("expecting Array or iterable");this.__class__=Sk.builtin.list;this.v=this.v;return this};
Sk.builtin.list.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("list",Sk.builtin.list);Sk.builtin.list.prototype.list_iter_=function(){var a={tp$iter:function(){return a},$obj:this,$index:0,tp$iternext:function(){return a.$index>=a.$obj.v.length?void 0:a.$obj.v[a.$index++]}};return a};
Sk.builtin.list.prototype.list_concat_=function(a){if(!a.__class__||a.__class__!=Sk.builtin.list)throw new Sk.builtin.TypeError("can only concatenate list to list");for(var b=this.v.slice(),c=0;c<a.v.length;++c)b.push(a.v[c]);return new Sk.builtin.list(b)};Sk.builtin.list.prototype.list_del_item_=function(a){a=Sk.builtin.asnum$(a);if(0>a||a>=this.v.length)throw new Sk.builtin.IndexError("list assignment index out of range");this.list_del_slice_(a,a+1)};
Sk.builtin.list.prototype.list_del_slice_=function(a,b){a=Sk.builtin.asnum$(a);b=Sk.builtin.asnum$(b);var c=[];c.unshift(b-a);c.unshift(a);this.v.splice.apply(this.v,c)};Sk.builtin.list.prototype.list_ass_item_=function(a,b){a=Sk.builtin.asnum$(a);if(0>a||a>=this.v.length)throw new Sk.builtin.IndexError("list assignment index out of range");this.v[a]=b};
Sk.builtin.list.prototype.list_ass_slice_=function(a,b,c){a=Sk.builtin.asnum$(a);b=Sk.builtin.asnum$(b);c=c.v.slice(0);c.unshift(b-a);c.unshift(a);this.v.splice.apply(this.v,c)};Sk.builtin.list.prototype.tp$name="list";Sk.builtin.list.prototype.$r=function(){for(var a=[],b=this.tp$iter(),c=b.tp$iternext();void 0!==c;c=b.tp$iternext())a.push(Sk.misceval.objectRepr(c).v);return new Sk.builtin.str("["+a.join(", ")+"]")};Sk.builtin.list.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;
Sk.builtin.list.prototype.tp$hash=Sk.builtin.object.prototype.HashNotImplemented;
Sk.builtin.list.prototype.tp$richcompare=function(a,b){if(this===a&&Sk.misceval.opAllowsEquality(b))return!0;if(!a.__class__||a.__class__!=Sk.builtin.list)return"Eq"===b?!1:"NotEq"===b?!0:!1;var c=this.v;a=a.v;var d=c.length,e=a.length,f;for(f=0;f<d&&f<e&&Sk.misceval.richCompareBool(c[f],a[f],"Eq");++f);if(f>=d||f>=e)switch(b){case "Lt":return d<e;case "LtE":return d<=e;case "Eq":return d===e;case "NotEq":return d!==e;case "Gt":return d>e;case "GtE":return d>=e;default:goog.asserts.fail()}return"Eq"===
b?!1:"NotEq"===b?!0:Sk.misceval.richCompareBool(c[f],a[f],b)};Sk.builtin.list.prototype.tp$iter=Sk.builtin.list.prototype.list_iter_;Sk.builtin.list.prototype.sq$length=function(){return this.v.length};Sk.builtin.list.prototype.sq$concat=Sk.builtin.list.prototype.list_concat_;Sk.builtin.list.prototype.nb$add=Sk.builtin.list.prototype.list_concat_;Sk.builtin.list.prototype.nb$inplace_add=Sk.builtin.list.prototype.list_concat_;
Sk.builtin.list.prototype.sq$repeat=function(a){a=Sk.builtin.asnum$(a);for(var b=[],c=0;c<a;++c)for(var d=0;d<this.v.length;++d)b.push(this.v[d]);return new Sk.builtin.list(b)};Sk.builtin.list.prototype.nb$multiply=Sk.builtin.list.prototype.sq$repeat;Sk.builtin.list.prototype.nb$inplace_multiply=Sk.builtin.list.prototype.sq$repeat;Sk.builtin.list.prototype.sq$ass_item=Sk.builtin.list.prototype.list_ass_item_;Sk.builtin.list.prototype.sq$del_item=Sk.builtin.list.prototype.list_del_item_;
Sk.builtin.list.prototype.sq$ass_slice=Sk.builtin.list.prototype.list_ass_slice_;Sk.builtin.list.prototype.sq$del_slice=Sk.builtin.list.prototype.list_del_slice_;
Sk.builtin.list.prototype.list_subscript_=function(a){if(Sk.misceval.isIndex(a)){var b=Sk.misceval.asIndex(a);if(void 0!==b){0>b&&(b=this.v.length+b);if(0>b||b>=this.v.length)throw new Sk.builtin.IndexError("list index out of range");return this.v[b]}}else if(a instanceof Sk.builtin.slice){var c=[];a.sssiter$(this,function(a,b){c.push(b.v[a])});return new Sk.builtin.list(c)}throw new Sk.builtin.TypeError("list indices must be integers, not "+Sk.abstr.typeName(a));};
Sk.builtin.list.prototype.list_ass_subscript_=function(a,b){if(Sk.misceval.isIndex(a)){var c=Sk.misceval.asIndex(a);if(void 0!==c){0>c&&(c=this.v.length+c);this.list_ass_item_(c,b);return}}else if(a instanceof Sk.builtin.slice){if(1===(null!==a.step?a.step:1))this.list_ass_slice_(a.start,a.stop,b);else{var d=[];a.sssiter$(this,function(a,b){d.push(a)});var e=0;if(d.length!==b.v.length)throw new Sk.builtin.ValueError("attempt to assign sequence of size "+b.v.length+" to extended slice of size "+d.length);
for(c=0;c<d.length;++c)this.v.splice(d[c],1,b.v[e]),e+=1}return}throw new Sk.builtin.TypeError("list indices must be integers, not "+Sk.abstr.typeName(a));};
Sk.builtin.list.prototype.list_del_subscript_=function(a){if(Sk.misceval.isIndex(a)){var b=Sk.misceval.asIndex(a);if(void 0!==b){0>b&&(b=this.v.length+b);this.list_del_item_(b);return}}else if(a instanceof Sk.builtin.slice){if(1===a.step)this.list_del_slice_(a.start,a.stop);else{var c=this,d=0,e=0<(null===a.step?1:a.step)?1:0;a.sssiter$(this,function(a,b){c.v.splice(a-d,1);d+=e})}return}throw new Sk.builtin.TypeError("list indices must be integers, not "+typeof a);};
Sk.builtin.list.prototype.mp$subscript=Sk.builtin.list.prototype.list_subscript_;Sk.builtin.list.prototype.mp$ass_subscript=Sk.builtin.list.prototype.list_ass_subscript_;Sk.builtin.list.prototype.mp$del_subscript=Sk.builtin.list.prototype.list_del_subscript_;Sk.builtin.list.prototype.__getitem__=new Sk.builtin.func(function(a,b){return Sk.builtin.list.prototype.list_subscript_.call(a,b)});
Sk.builtin.list.prototype.list_sort_=function(a,b,c,d){var e=void 0!==c&&null!==c,f=void 0!==b&&null!==b;void 0==d&&(d=!1);var g=new Sk.builtin.timSort(a);a.v=[];var h=new Sk.builtin.nmber(0,Sk.builtin.nmber.int$);if(e){g.lt=f?function(a,c){return Sk.misceval.richCompareBool(b.func_code(a[0],c[0]),h,"Lt")}:function(a,b){return Sk.misceval.richCompareBool(a[0],b[0],"Lt")};for(var k=0;k<g.listlength;k++){var f=g.list.v[k],l=c.func_code(f);g.list.v[k]=[l,f]}}else f&&(g.lt=function(a,c){return Sk.misceval.richCompareBool(b.func_code(a,
c),h,"Lt")});d&&g.list.list_reverse_(g.list);g.sort();d&&g.list.list_reverse_(g.list);if(e)for(c=0;c<g.listlength;c++)f=g.list.v[c][1],g.list.v[c]=f;c=0<a.sq$length();a.v=g.list.v;if(c)throw new Sk.builtin.OperationError("list modified during sort");return Sk.builtin.none.none$};Sk.builtin.list.prototype.list_reverse_=function(a){Sk.builtin.pyCheckArgs("reverse",arguments,1,1);for(var b=a.v,c=[],d=a.v.length-1;-1<d;--d)c.push(b[d]);a.v=c;return Sk.builtin.none.none$};
Sk.builtin.list.prototype.__iter__=new Sk.builtin.func(function(a){Sk.builtin.pyCheckArgs("__iter__",arguments,1,1);return a.list_iter_()});Sk.builtin.list.prototype.append=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("append",arguments,2,2);a.v.push(b);return Sk.builtin.none.none$});
Sk.builtin.list.prototype.insert=new Sk.builtin.func(function(a,b,c){Sk.builtin.pyCheckArgs("insert",arguments,3,3);if(!Sk.builtin.checkNumber(b))throw new Sk.builtin.TypeError("an integer is required");b=Sk.builtin.asnum$(b);0>b?b=0:b>a.v.length&&(b=a.v.length);a.v.splice(b,0,c);return Sk.builtin.none.none$});
Sk.builtin.list.prototype.extend=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("extend",arguments,2,2);if(!Sk.builtin.checkIterable(b))throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(b)+"' object is not iterable");if(a==b){for(var c=[],d=b.tp$iter(),e=d.tp$iternext();void 0!==e;e=d.tp$iternext())c.push(e);a.v.push.apply(a.v,c);return Sk.builtin.none.none$}d=b.tp$iter();for(e=d.tp$iternext();void 0!==e;e=d.tp$iternext())a.v.push(e);return Sk.builtin.none.none$});
Sk.builtin.list.prototype.pop=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("pop",arguments,1,2);void 0===b&&(b=a.v.length-1);if(!Sk.builtin.checkNumber(b))throw new Sk.builtin.TypeError("an integer is required");b=Sk.builtin.asnum$(b);if(0>b||b>=a.v.length)throw new Sk.builtin.IndexError("pop index out of range");var c=a.v[b];a.v.splice(b,1);return c});
Sk.builtin.list.prototype.remove=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("remove",arguments,2,2);var c=Sk.builtin.list.prototype.index.func_code(a,b);a.v.splice(Sk.builtin.asnum$(c),1);return Sk.builtin.none.none$});
Sk.builtin.list.prototype.index=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("index",arguments,2,2);for(var c=a.v.length,d=a.v,e=0;e<c;++e)if(Sk.misceval.richCompareBool(d[e],b,"Eq"))return Sk.builtin.assk$(e,Sk.builtin.nmber.int$);throw new Sk.builtin.ValueError("list.index(x): x not in list");});
Sk.builtin.list.prototype.count=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("count",arguments,2,2);for(var c=a.v.length,d=a.v,e=0,f=0;f<c;++f)Sk.misceval.richCompareBool(d[f],b,"Eq")&&(e+=1);return new Sk.builtin.nmber(e,Sk.builtin.nmber.int$)});Sk.builtin.list.prototype.reverse=new Sk.builtin.func(Sk.builtin.list.prototype.list_reverse_);Sk.builtin.list.prototype.sort=new Sk.builtin.func(Sk.builtin.list.prototype.list_sort_);
Sk.builtin.list.prototype.sort.func_code.co_varnames=["__self__","cmp","key","reverse"];goog.exportSymbol("Sk.builtin.list",Sk.builtin.list);var interned={};
Sk.builtin.str=function(a){void 0===a&&(a="");if(a instanceof Sk.builtin.str&&a!==Sk.builtin.str.prototype.ob$type)return a;if(!(this instanceof Sk.builtin.str))return new Sk.builtin.str(a);if(!0===a)a="True";else if(!1===a)a="False";else if(null===a||a instanceof Sk.builtin.none)a="None";else if(a instanceof Sk.builtin.bool)a=a.v?"True":"False";else if("number"===typeof a)a=a.toString(),"Infinity"===a?a="inf":"-Infinity"===a&&(a="-inf");else if("string"!==typeof a){if(void 0!==a.tp$str){a=a.tp$str();
if(!(a instanceof Sk.builtin.str))throw new Sk.builtin.ValueError("__str__ didn't return a str");return a}return Sk.misceval.objectRepr(a)}if(Object.prototype.hasOwnProperty.call(interned,"1"+a))return interned["1"+a];this.__class__=Sk.builtin.str;this.v=this.v=a;interned["1"+a]=this;return this};goog.exportSymbol("Sk.builtin.str",Sk.builtin.str);Sk.builtin.str.$emptystr=new Sk.builtin.str("");
Sk.builtin.str.prototype.mp$subscript=function(a){a=Sk.builtin.asnum$(a);if("number"===typeof a&&Math.floor(a)===a){0>a&&(a=this.v.length+a);if(0>a||a>=this.v.length)throw new Sk.builtin.IndexError("string index out of range");return new Sk.builtin.str(this.v.charAt(a))}if(a instanceof Sk.builtin.slice){var b="";a.sssiter$(this,function(a,d){0<=a&&a<d.v.length&&(b+=d.v.charAt(a))});return new Sk.builtin.str(b)}throw new Sk.builtin.TypeError("string indices must be numbers, not "+typeof a);};
Sk.builtin.str.prototype.sq$length=function(){return this.v.length};Sk.builtin.str.prototype.sq$concat=function(a){if(!a||!Sk.builtin.checkString(a))throw a=Sk.abstr.typeName(a),new Sk.builtin.TypeError("cannot concatenate 'str' and '"+a+"' objects");return new Sk.builtin.str(this.v+a.v)};Sk.builtin.str.prototype.nb$add=Sk.builtin.str.prototype.sq$concat;Sk.builtin.str.prototype.nb$inplace_add=Sk.builtin.str.prototype.sq$concat;
Sk.builtin.str.prototype.sq$repeat=function(a){a=Sk.builtin.asnum$(a);for(var b="",c=0;c<a;++c)b+=this.v;return new Sk.builtin.str(b)};Sk.builtin.str.prototype.nb$multiply=Sk.builtin.str.prototype.sq$repeat;Sk.builtin.str.prototype.nb$inplace_multiply=Sk.builtin.str.prototype.sq$repeat;Sk.builtin.str.prototype.sq$item=function(){goog.asserts.fail()};
Sk.builtin.str.prototype.sq$slice=function(a,b){a=Sk.builtin.asnum$(a);b=Sk.builtin.asnum$(b);0>a&&(a=0);return new Sk.builtin.str(this.v.substr(a,b-a))};Sk.builtin.str.prototype.sq$contains=function(a){if(void 0===a.v||a.v.constructor!=String)throw new Sk.builtin.TypeError("TypeError: 'In <string> requires string as left operand");return-1!=this.v.indexOf(a.v)?!0:!1};Sk.builtin.str.prototype.tp$name="str";Sk.builtin.str.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;
Sk.builtin.str.prototype.tp$iter=function(){var a={tp$iter:function(){return a},$obj:this,$index:0,tp$iternext:function(){return a.$index>=a.$obj.v.length?void 0:new Sk.builtin.str(a.$obj.v.substr(a.$index++,1))}};return a};
Sk.builtin.str.prototype.tp$richcompare=function(a,b){if(a instanceof Sk.builtin.str){if(this===a)switch(b){case "Eq":case "LtE":case "GtE":return!0;case "NotEq":case "Lt":case "Gt":return!1}var c=this.v.length,d=a.v.length,e=Math.min(c,d),f=0;if(0<e)for(var g=0;g<e;++g){if(this.v[g]!=a.v[g]){f=this.v[g].charCodeAt(0)-a.v[g].charCodeAt(0);break}}else f=0;0==f&&(f=c<d?-1:c>d?1:0);switch(b){case "Lt":return 0>f;case "LtE":return 0>=f;case "Eq":return 0==f;case "NotEq":return 0!=f;case "Gt":return 0<
f;case "GtE":return 0<=f;default:goog.asserts.fail()}}};Sk.builtin.str.prototype.$r=function(){var a="'";-1!==this.v.indexOf("'")&&-1===this.v.indexOf('"')&&(a='"');for(var b=this.v.length,c=a,d=0;d<b;++d){var e=this.v.charAt(d);e===a||"\\"===e?c+="\\"+e:"\t"===e?c+="\\t":"\n"===e?c+="\\n":"\r"===e?c+="\\r":" ">e||127<=e?(e=e.charCodeAt(0).toString(16),2>e.length&&(e="0"+e),c+="\\x"+e):c+=e}return new Sk.builtin.str(c+a)};
Sk.builtin.str.re_escape_=function(a){for(var b=[],c=/^[A-Za-z0-9]+$/,d=0;d<a.length;++d){var e=a.charAt(d);c.test(e)?b.push(e):"\\000"===e?b.push("\\000"):b.push("\\"+e)}return b.join("")};Sk.builtin.str.prototype.lower=new Sk.builtin.func(function(a){Sk.builtin.pyCheckArgs("lower",arguments,1,1);return new Sk.builtin.str(a.v.toLowerCase())});Sk.builtin.str.prototype.upper=new Sk.builtin.func(function(a){Sk.builtin.pyCheckArgs("upper",arguments,1,1);return new Sk.builtin.str(a.v.toUpperCase())});
Sk.builtin.str.prototype.capitalize=new Sk.builtin.func(function(a){Sk.builtin.pyCheckArgs("capitalize",arguments,1,1);var b=a.v,c,d;if(0===b.length)return new Sk.builtin.str("");c=b.charAt(0).toUpperCase();for(d=1;d<b.length;d++)c+=b.charAt(d).toLowerCase();return new Sk.builtin.str(c)});
Sk.builtin.str.prototype.join=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("join",arguments,2,2);Sk.builtin.pyCheckType("seq","iterable",Sk.builtin.checkIterable(b));for(var c=[],d=b.tp$iter(),e=d.tp$iternext();void 0!==e;e=d.tp$iternext()){if(e.constructor!==Sk.builtin.str)throw"TypeError: sequence item "+c.length+": expected string, "+typeof e+" found";c.push(e.v)}return new Sk.builtin.str(c.join(a.v))});
Sk.builtin.str.prototype.split=new Sk.builtin.func(function(a,b,c){Sk.builtin.pyCheckArgs("split",arguments,1,3);if(void 0===b||b instanceof Sk.builtin.none)b=null;if(null!==b&&!Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("expected a string");if(null!==b&&""===b.v)throw new Sk.builtin.ValueError("empty separator");if(void 0!==c&&!Sk.builtin.checkInt(c))throw new Sk.builtin.TypeError("an integer is required");c=Sk.builtin.asnum$(c);var d=/[\s]+/g,e=a.v;null===b?e=e.trimLeft():(d=b.v.replace(/([.*+?=|\\\/()\[\]\{\}^$])/g,
"\\$1"),d=RegExp(d,"g"));for(var f=[],g,h=0,k=0;null!=(g=d.exec(e))&&g.index!==d.lastIndex&&!(f.push(new Sk.builtin.str(e.substring(h,g.index))),h=d.lastIndex,k+=1,c&&k>=c););e=e.substring(h);(null!==b||0<e.length)&&f.push(new Sk.builtin.str(e));return new Sk.builtin.list(f)});
Sk.builtin.str.prototype.strip=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("strip",arguments,1,2);if(void 0!==b&&!Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("strip arg must be None or str");var c;void 0===b?c=/^\s+|\s+$/g:(c=Sk.builtin.str.re_escape_(b.v),c=RegExp("^["+c+"]+|["+c+"]+$","g"));return new Sk.builtin.str(a.v.replace(c,""))});
Sk.builtin.str.prototype.lstrip=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("lstrip",arguments,1,2);if(void 0!==b&&!Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("lstrip arg must be None or str");var c;void 0===b?c=/^\s+/g:(c=Sk.builtin.str.re_escape_(b.v),c=RegExp("^["+c+"]+","g"));return new Sk.builtin.str(a.v.replace(c,""))});
Sk.builtin.str.prototype.rstrip=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("rstrip",arguments,1,2);if(void 0!==b&&!Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("rstrip arg must be None or str");var c;void 0===b?c=/\s+$/g:(c=Sk.builtin.str.re_escape_(b.v),c=RegExp("["+c+"]+$","g"));return new Sk.builtin.str(a.v.replace(c,""))});
Sk.builtin.str.prototype.partition=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("partition",arguments,2,2);Sk.builtin.pyCheckType("sep","string",Sk.builtin.checkString(b));var c=new Sk.builtin.str(b),d=a.v.indexOf(c.v);return 0>d?new Sk.builtin.tuple([a,Sk.builtin.str.$emptystr,Sk.builtin.str.$emptystr]):new Sk.builtin.tuple([new Sk.builtin.str(a.v.substring(0,d)),c,new Sk.builtin.str(a.v.substring(d+c.v.length))])});
Sk.builtin.str.prototype.rpartition=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("rpartition",arguments,2,2);Sk.builtin.pyCheckType("sep","string",Sk.builtin.checkString(b));var c=new Sk.builtin.str(b),d=a.v.lastIndexOf(c.v);return 0>d?new Sk.builtin.tuple([Sk.builtin.str.$emptystr,Sk.builtin.str.$emptystr,a]):new Sk.builtin.tuple([new Sk.builtin.str(a.v.substring(0,d)),c,new Sk.builtin.str(a.v.substring(d+c.v.length))])});
Sk.builtin.str.prototype.count=new Sk.builtin.func(function(a,b,c,d){Sk.builtin.pyCheckArgs("count",arguments,2,4);if(!Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("expected a character buffer object");if(void 0!==c&&!Sk.builtin.checkInt(c))throw new Sk.builtin.TypeError("slice indices must be integers or None or have an __index__ method");if(void 0!==d&&!Sk.builtin.checkInt(d))throw new Sk.builtin.TypeError("slice indices must be integers or None or have an __index__ method");void 0===
c?c=0:(c=Sk.builtin.asnum$(c),c=0<=c?c:a.v.length+c);void 0===d?d=a.v.length:(d=Sk.builtin.asnum$(d),d=0<=d?d:a.v.length+d);var e=RegExp(b.v,"g");return(e=a.v.slice(c,d).match(e))?new Sk.builtin.nmber(e.length,Sk.builtin.nmber.int$):new Sk.builtin.nmber(0,Sk.builtin.nmber.int$)});
Sk.builtin.str.prototype.ljust=new Sk.builtin.func(function(a,b,c){Sk.builtin.pyCheckArgs("ljust",arguments,2,3);if(!Sk.builtin.checkInt(b))throw new Sk.builtin.TypeError("integer argument exepcted, got "+Sk.abstr.typeName(b));if(void 0!==c&&(!Sk.builtin.checkString(c)||1!==c.v.length))throw new Sk.builtin.TypeError("must be char, not "+Sk.abstr.typeName(c));c=void 0===c?" ":c.v;b=Sk.builtin.asnum$(b);if(a.v.length>=b)return a;var d=Array.prototype.join.call({length:Math.floor(b-a.v.length)+1},c);
return new Sk.builtin.str(a.v+d)});
Sk.builtin.str.prototype.rjust=new Sk.builtin.func(function(a,b,c){Sk.builtin.pyCheckArgs("rjust",arguments,2,3);if(!Sk.builtin.checkInt(b))throw new Sk.builtin.TypeError("integer argument exepcted, got "+Sk.abstr.typeName(b));if(void 0!==c&&(!Sk.builtin.checkString(c)||1!==c.v.length))throw new Sk.builtin.TypeError("must be char, not "+Sk.abstr.typeName(c));c=void 0===c?" ":c.v;b=Sk.builtin.asnum$(b);if(a.v.length>=b)return a;var d=Array.prototype.join.call({length:Math.floor(b-a.v.length)+1},c);
return new Sk.builtin.str(d+a.v)});
Sk.builtin.str.prototype.center=new Sk.builtin.func(function(a,b,c){Sk.builtin.pyCheckArgs("center",arguments,2,3);if(!Sk.builtin.checkInt(b))throw new Sk.builtin.TypeError("integer argument exepcted, got "+Sk.abstr.typeName(b));if(void 0!==c&&(!Sk.builtin.checkString(c)||1!==c.v.length))throw new Sk.builtin.TypeError("must be char, not "+Sk.abstr.typeName(c));c=void 0===c?" ":c.v;b=Sk.builtin.asnum$(b);if(a.v.length>=b)return a;var d=Array.prototype.join.call({length:Math.floor((b-a.v.length)/2)+
1},c),d=d+a.v+d;d.length<b&&(d+=c);return new Sk.builtin.str(d)});
Sk.builtin.str.prototype.find=new Sk.builtin.func(function(a,b,c,d){Sk.builtin.pyCheckArgs("find",arguments,2,4);if(!Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("expected a character buffer object");if(void 0!==c&&!Sk.builtin.checkInt(c))throw new Sk.builtin.TypeError("slice indices must be integers or None or have an __index__ method");if(void 0!==d&&!Sk.builtin.checkInt(d))throw new Sk.builtin.TypeError("slice indices must be integers or None or have an __index__ method");void 0===
c?c=0:(c=Sk.builtin.asnum$(c),c=0<=c?c:a.v.length+c);void 0===d?d=a.v.length:(d=Sk.builtin.asnum$(d),d=0<=d?d:a.v.length+d);var e=a.v.indexOf(b.v,c);return new Sk.builtin.nmber(e>=c&&e<d?e:-1,Sk.builtin.nmber.int$)});Sk.builtin.str.prototype.index=new Sk.builtin.func(function(a,b,c,d){Sk.builtin.pyCheckArgs("index",arguments,2,4);var e=Sk.misceval.callsim(a.find,a,b,c,d);if(-1===Sk.builtin.asnum$(e))throw new Sk.builtin.ValueError("substring not found");return e});
Sk.builtin.str.prototype.rfind=new Sk.builtin.func(function(a,b,c,d){Sk.builtin.pyCheckArgs("rfind",arguments,2,4);if(!Sk.builtin.checkString(b))throw new Sk.builtin.TypeError("expected a character buffer object");if(void 0!==c&&!Sk.builtin.checkInt(c))throw new Sk.builtin.TypeError("slice indices must be integers or None or have an __index__ method");if(void 0!==d&&!Sk.builtin.checkInt(d))throw new Sk.builtin.TypeError("slice indices must be integers or None or have an __index__ method");void 0===
c?c=0:(c=Sk.builtin.asnum$(c),c=0<=c?c:a.v.length+c);void 0===d?d=a.v.length:(d=Sk.builtin.asnum$(d),d=0<=d?d:a.v.length+d);var e=a.v.lastIndexOf(b.v,d),e=e!==d?e:a.v.lastIndexOf(b.v,d-1);return new Sk.builtin.nmber(e>=c&&e<d?e:-1,Sk.builtin.nmber.int$)});Sk.builtin.str.prototype.rindex=new Sk.builtin.func(function(a,b,c,d){Sk.builtin.pyCheckArgs("rindex",arguments,2,4);var e=Sk.misceval.callsim(a.rfind,a,b,c,d);if(-1===Sk.builtin.asnum$(e))throw new Sk.builtin.ValueError("substring not found");return e});
Sk.builtin.str.prototype.startswith=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("startswith",arguments,2,2);Sk.builtin.pyCheckType("tgt","string",Sk.builtin.checkString(b));return Sk.builtin.bool(0==a.v.indexOf(b.v))});Sk.builtin.str.prototype.endswith=new Sk.builtin.func(function(a,b){Sk.builtin.pyCheckArgs("endswith",arguments,2,2);Sk.builtin.pyCheckType("tgt","string",Sk.builtin.checkString(b));return Sk.builtin.bool(-1!==a.v.indexOf(b.v,a.v.length-b.v.length))});
Sk.builtin.str.prototype.replace=new Sk.builtin.func(function(a,b,c,d){Sk.builtin.pyCheckArgs("replace",arguments,3,4);Sk.builtin.pyCheckType("oldS","string",Sk.builtin.checkString(b));Sk.builtin.pyCheckType("newS","string",Sk.builtin.checkString(c));if(void 0!==d&&!Sk.builtin.checkInt(d))throw new Sk.builtin.TypeError("integer argument expected, got "+Sk.abstr.typeName(d));d=Sk.builtin.asnum$(d);var e=RegExp(Sk.builtin.str.re_escape_(b.v),"g");if(void 0===d||0>d)return new Sk.builtin.str(a.v.replace(e,
c.v));var f=0;return new Sk.builtin.str(a.v.replace(e,function(a){f++;return f<=d?c.v:a}))});Sk.builtin.str.prototype.isdigit=new Sk.builtin.func(function(a){Sk.builtin.pyCheckArgs("isdigit",arguments,1,1);if(0===a.v.length)return Sk.builtin.bool(!1);var b;for(b=0;b<a.v.length;b++){var c=a.v.charAt(b);if("0">c||"9"<c)return Sk.builtin.bool(!1)}return Sk.builtin.bool(!0)});Sk.builtin.str.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("str",Sk.builtin.str);
Sk.builtin.str.prototype.nb$remainder=function(a){a.constructor===Sk.builtin.tuple||void 0!==a.mp$subscript&&a.constructor!==Sk.builtin.str||(a=new Sk.builtin.tuple([a]));var b=0,c=this.v.replace(/%(\([a-zA-Z0-9]+\))?([#0 +\-]+)?(\*|[0-9]+)?(\.(\*|[0-9]+))?[hlL]?([diouxXeEfFgGcrs%])/g,function(c,e,f,g,h,k,l){g=Sk.builtin.asnum$(g);h=Sk.builtin.asnum$(h);var m;if(void 0===e||""===e)m=b++;var n=!1,p=!1,q=!1,r=!1,s=!1;f&&(-1!==f.indexOf("-")?p=!0:-1!==f.indexOf("0")&&(n=!0),-1!==f.indexOf("+")?r=!0:
-1!==f.indexOf(" ")&&(q=!0),s=-1!==f.indexOf("#"));h&&(h=parseInt(h.substr(1),10));f=function(a,b){b=Sk.builtin.asnum$(b);var c,d,e=!1;"number"===typeof a?(0>a&&(a=-a,e=!0),d=a.toString(b)):a instanceof Sk.builtin.nmber?(d=a.str$(b,!1),2<d.length&&".0"===d.substr(-2)&&(d=d.substr(0,d.length-2)),e=a.nb$isnegative()):a instanceof Sk.builtin.lng&&(d=a.str$(b,!1),e=a.nb$isnegative());goog.asserts.assert(void 0!==d,"unhandled number format");var f=!1;if(h)for(c=d.length;c<h;++c)d="0"+d,f=!0;c="";e?c="-":
r?c="+"+c:q&&(c=" "+c);s&&(16===b?c+="0x":8!==b||(f||"0"===d)||(c+="0"));return[c,d]};c=function(a){var b=a[0];a=a[1];var c;if(g)if(g=parseInt(g,10),c=a.length+b.length,n)for(;c<g;++c)a="0"+a;else if(p)for(;c<g;++c)a+=" ";else for(;c<g;++c)b=" "+b;return b+a};if(a.constructor===Sk.builtin.tuple)e=a.v[m];else if(void 0!==a.mp$subscript)e=e.substring(1,e.length-1),e=a.mp$subscript(new Sk.builtin.str(e));else throw new Sk.builtin.AttributeError(a.tp$name+" instance has no attribute 'mp$subscript'");
switch(l){case "d":case "i":return c(f(e,10));case "o":return c(f(e,8));case "x":return c(f(e,16));case "X":return c(f(e,16)).toUpperCase();case "f":case "F":case "e":case "E":case "g":case "G":e=Sk.builtin.asnum$(e);"string"===typeof e&&(e=Number(e));if(Infinity===e)return"inf";if(-Infinity===e)return"-inf";if(isNaN(e))return"nan";m=["toExponential","toFixed","toPrecision"]["efg".indexOf(l.toLowerCase())];if(void 0===h||""===h)if("e"===l||"E"===l)h=6;else if("f"===l||"F"===l)h=7;e=e[m](h);-1!=="EFG".indexOf(l)&&
(e=e.toUpperCase());return c(["",e]);case "c":if("number"===typeof e)return String.fromCharCode(e);if(e instanceof Sk.builtin.nmber)return String.fromCharCode(e.v);if(e instanceof Sk.builtin.lng)return String.fromCharCode(e.str$(10,!1)[0]);if(e.constructor===Sk.builtin.str)return e.v.substr(0,1);throw new Sk.builtin.TypeError("an integer is required");case "r":return l=Sk.builtin.repr(e),h?l.v.substr(0,h):l.v;case "s":return l=new Sk.builtin.str(e),h?l.v.substr(0,h):l.v;case "%":return"%"}});return new Sk.builtin.str(c)};Sk.builtin.tuple=function(a){if(!(this instanceof Sk.builtin.tuple))return new Sk.builtin.tuple(a);void 0===a&&(a=[]);if("[object Array]"===Object.prototype.toString.apply(a))this.v=a;else if(a.tp$iter){this.v=[];a=a.tp$iter();for(var b=a.tp$iternext();void 0!==b;b=a.tp$iternext())this.v.push(b)}else throw new Sk.builtin.ValueError("expecting Array or iterable");this.__class__=Sk.builtin.tuple;this.v=this.v;return this};Sk.builtin.tuple.prototype.tp$name="tuple";
Sk.builtin.tuple.prototype.$r=function(){if(0===this.v.length)return new Sk.builtin.str("()");for(var a=[],b=0;b<this.v.length;++b)a[b]=Sk.misceval.objectRepr(this.v[b]).v;a=a.join(", ");1===this.v.length&&(a+=",");return new Sk.builtin.str("("+a+")")};
Sk.builtin.tuple.prototype.mp$subscript=function(a){if(Sk.misceval.isIndex(a)){var b=Sk.misceval.asIndex(a);if(void 0!==b){0>b&&(b=this.v.length+b);if(0>b||b>=this.v.length)throw new Sk.builtin.IndexError("tuple index out of range");return this.v[b]}}else if(a instanceof Sk.builtin.slice){var c=[];a.sssiter$(this,function(a,b){c.push(b.v[a])});return new Sk.builtin.tuple(c)}throw new Sk.builtin.TypeError("tuple indices must be integers, not "+Sk.abstr.typeName(a));};
Sk.builtin.tuple.prototype.tp$hash=function(){for(var a=1000003,b=3430008,c=this.v.length,d=0;d<c;++d){var e=Sk.builtin.hash(this.v[d]);if(-1===e)return-1;b=(b^e)*a;a+=82520+c+c}b+=97531;-1===b&&(b=-2);return b};Sk.builtin.tuple.prototype.sq$repeat=function(a){a=Sk.builtin.asnum$(a);for(var b=[],c=0;c<a;++c)for(var d=0;d<this.v.length;++d)b.push(this.v[d]);return new Sk.builtin.tuple(b)};Sk.builtin.tuple.prototype.nb$multiply=Sk.builtin.tuple.prototype.sq$repeat;
Sk.builtin.tuple.prototype.nb$inplace_multiply=Sk.builtin.tuple.prototype.sq$repeat;Sk.builtin.tuple.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("tuple",Sk.builtin.tuple);Sk.builtin.tuple.prototype.tp$iter=function(){var a={tp$iter:function(){return a},$obj:this,$index:0,tp$iternext:function(){return a.$index>=a.$obj.v.length?void 0:a.$obj.v[a.$index++]}};return a};Sk.builtin.tuple.prototype.__iter__=new Sk.builtin.func(function(a){Sk.builtin.pyCheckArgs("__iter__",arguments,1,1);return a.tp$iter()});
Sk.builtin.tuple.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;
Sk.builtin.tuple.prototype.tp$richcompare=function(a,b){if(!a.__class__||a.__class__!=Sk.builtin.tuple)return"Eq"===b?!1:"NotEq"===b?!0:!1;var c=this.v;a=a.v;var d=c.length,e=a.length,f;for(f=0;f<d&&f<e&&Sk.misceval.richCompareBool(c[f],a[f],"Eq");++f);if(f>=d||f>=e)switch(b){case "Lt":return d<e;case "LtE":return d<=e;case "Eq":return d===e;case "NotEq":return d!==e;case "Gt":return d>e;case "GtE":return d>=e;default:goog.asserts.fail()}return"Eq"===b?!1:"NotEq"===b?!0:Sk.misceval.richCompareBool(c[f],
a[f],b)};Sk.builtin.tuple.prototype.sq$concat=function(a){return new Sk.builtin.tuple(this.v.concat(a.v))};Sk.builtin.tuple.prototype.nb$add=Sk.builtin.tuple.prototype.sq$concat;Sk.builtin.tuple.prototype.nb$inplace_add=Sk.builtin.tuple.prototype.sq$concat;Sk.builtin.tuple.prototype.sq$length=function(){return this.v.length};
Sk.builtin.tuple.prototype.index=new Sk.builtin.func(function(a,b){for(var c=a.v.length,d=a.v,e=0;e<c;++e)if(Sk.misceval.richCompareBool(d[e],b,"Eq"))return Sk.builtin.assk$(e,Sk.builtin.nmber.int$);throw new Sk.builtin.ValueError("tuple.index(x): x not in tuple");});Sk.builtin.tuple.prototype.count=new Sk.builtin.func(function(a,b){for(var c=a.v.length,d=a.v,e=0,f=0;f<c;++f)Sk.misceval.richCompareBool(d[f],b,"Eq")&&(e+=1);return new Sk.builtin.nmber(e,Sk.builtin.nmber.int$)});
goog.exportSymbol("Sk.builtin.tuple",Sk.builtin.tuple);Sk.builtin.dict=function(a){if(!(this instanceof Sk.builtin.dict))return new Sk.builtin.dict(a);void 0===a&&(a=[]);this.size=0;if("[object Array]"===Object.prototype.toString.apply(a))for(var b=0;b<a.length;b+=2)this.mp$ass_subscript(a[b],a[b+1]);else if(a instanceof Sk.builtin.dict)for(var c=a.tp$iter(),b=c.tp$iternext();void 0!==b;b=c.tp$iternext()){var d=a.mp$subscript(b);void 0===d&&(d=null);this.mp$ass_subscript(b,d)}else if(a.tp$iter)for(c=a.tp$iter(),b=c.tp$iternext();void 0!==b;b=c.tp$iternext())if(b.mp$subscript)this.mp$ass_subscript(b.mp$subscript(0),
b.mp$subscript(1));else throw new Sk.builtin.TypeError("element "+this.size+" is not a sequence");else throw new Sk.builtin.TypeError("object is not iterable");this.__class__=Sk.builtin.dict;return this};Sk.builtin.dict.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("dict",Sk.builtin.dict);var kf=Sk.builtin.hash;Sk.builtin.dict.prototype.key$lookup=function(a,b){var c,d,e;for(e=0;e<a.items.length;e++)if(c=a.items[e],d=Sk.misceval.richCompareBool(c.lhs,b,"Eq"))return c;return null};
Sk.builtin.dict.prototype.key$pop=function(a,b){var c,d,e;for(e=0;e<a.items.length;e++)if(c=a.items[e],d=Sk.misceval.richCompareBool(c.lhs,b,"Eq"))return a.items.splice(e,1),this.size-=1,c};Sk.builtin.dict.prototype.mp$lookup=function(a){var b=this[kf(a)];if(void 0!==b&&(a=this.key$lookup(b,a)))return a.rhs};Sk.builtin.dict.prototype.mp$subscript=function(a){var b=this.mp$lookup(a);if(void 0!==b)return b;a=new Sk.builtin.str(a);throw new Sk.builtin.KeyError(a.v);};
Sk.builtin.dict.prototype.sq$contains=function(a){return void 0!==this.mp$lookup(a)};Sk.builtin.dict.prototype.mp$ass_subscript=function(a,b){var c=kf(a),d=this[c];void 0===d?(d={$hash:c,items:[{lhs:a,rhs:b}]},this[c]=d,this.size+=1):(c=this.key$lookup(d,a))?c.rhs=b:(d.items.push({lhs:a,rhs:b}),this.size+=1)};Sk.builtin.dict.prototype.mp$del_subscript=function(a){var b=this[kf(a)];if(void 0!==b&&(b=this.key$pop(b,a),void 0!==b))return;a=new Sk.builtin.str(a);throw new Sk.builtin.KeyError(a.v);};
Sk.builtin.dict.prototype.tp$iter=function(){var a=[],b;for(b in this)if(this.hasOwnProperty(b)){var c=this[b];if(c&&void 0!==c.$hash)for(var d=0;d<c.items.length;d++)a.push(c.items[d].lhs)}var e={tp$iter:function(){return e},$obj:this,$index:0,$keys:a,tp$iternext:function(){return e.$index>=e.$keys.length?void 0:e.$keys[e.$index++]}};return e};Sk.builtin.dict.prototype.__iter__=new Sk.builtin.func(function(a){Sk.builtin.pyCheckArgs("__iter__",arguments,1,1);return a.tp$iter()});
Sk.builtin.dict.prototype.$r=function(){for(var a=[],b=this.tp$iter(),c=b.tp$iternext();void 0!==c;c=b.tp$iternext()){var d=this.mp$subscript(c);void 0===d&&(d=null);a.push(Sk.misceval.objectRepr(c).v+": "+Sk.misceval.objectRepr(d).v)}return new Sk.builtin.str("{"+a.join(", ")+"}")};Sk.builtin.dict.prototype.mp$length=function(){return this.size};Sk.builtin.dict.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;Sk.builtin.dict.prototype.tp$hash=Sk.builtin.object.prototype.HashNotImplemented;
Sk.builtin.dict.prototype.tp$richcompare=function(a,b){if(this===a&&Sk.misceval.opAllowsEquality(b))return!0;switch(b){case "Lt":return;case "LtE":return;case "Eq":break;case "NotEq":break;case "Gt":return;case "GtE":return;default:goog.asserts.fail()}if(!(a instanceof Sk.builtin.dict)||this.size!==a.size)return"Eq"===b?!1:!0;for(var c=this.tp$iter(),d=c.tp$iternext();void 0!==d;d=c.tp$iternext()){var e=this.mp$subscript(d),d=a.mp$subscript(d);if(!Sk.misceval.richCompareBool(e,d,"Eq"))return"Eq"===
b?!1:!0}return"Eq"===b?!0:!1};Sk.builtin.dict.prototype.get=new Sk.builtin.func(function(a,b,c){void 0===c&&(c=null);a=a.mp$lookup(b);void 0===a&&(a=c);return a});Sk.builtin.dict.prototype.has_key=new Sk.builtin.func(function(a,b){return Sk.builtin.bool(a.sq$contains(b))});Sk.builtin.dict.prototype.items=new Sk.builtin.func(function(a){for(var b=[],c=a.tp$iter(),d=c.tp$iternext();void 0!==d;d=c.tp$iternext()){var e=a.mp$subscript(d);void 0===e&&(e=null);b.push(new Sk.builtin.tuple([d,e]))}return new Sk.builtin.list(b)});
Sk.builtin.dict.prototype.keys=new Sk.builtin.func(function(a){var b=[];a=a.tp$iter();for(var c=a.tp$iternext();void 0!==c;c=a.tp$iternext())b.push(c);return new Sk.builtin.list(b)});Sk.builtin.dict.prototype.values=new Sk.builtin.func(function(a){for(var b=[],c=a.tp$iter(),d=c.tp$iternext();void 0!==d;d=c.tp$iternext())d=a.mp$subscript(d),void 0===d&&(d=null),b.push(d);return new Sk.builtin.list(b)});Sk.builtin.dict.prototype.tp$name="dict";goog.exportSymbol("Sk.builtin.dict",Sk.builtin.dict);Sk.builtin.biginteger=function(a,b,c){null!=a&&("number"==typeof a?this.fromNumber(a,b,c):null==b&&"string"!=typeof a?this.fromString(a,256):this.fromString(a,b))};Sk.builtin.biginteger.canary=0xdeadbeefcafe;Sk.builtin.biginteger.j_lm=15715070==(Sk.builtin.biginteger.canary&16777215);Sk.builtin.biginteger.nbi=function(){return new Sk.builtin.biginteger(null)};Sk.builtin.biginteger.prototype.am1=function(a,b,c,d,e,f){for(;0<=--f;){var g=b*this[a++]+c[d]+e;e=Math.floor(g/67108864);c[d++]=g&67108863}return e};
Sk.builtin.biginteger.prototype.am2=function(a,b,c,d,e,f){var g=b&32767;for(b>>=15;0<=--f;){var h=this[a]&32767,k=this[a++]>>15,l=b*h+k*g,h=g*h+((l&32767)<<15)+c[d]+(e&1073741823);e=(h>>>30)+(l>>>15)+b*k+(e>>>30);c[d++]=h&1073741823}return e};Sk.builtin.biginteger.prototype.am3=function(a,b,c,d,e,f){var g=b&16383;for(b>>=14;0<=--f;){var h=this[a]&16383,k=this[a++]>>14,l=b*h+k*g,h=g*h+((l&16383)<<14)+c[d]+e;e=(h>>28)+(l>>14)+b*k;c[d++]=h&268435455}return e};Sk.builtin.biginteger.prototype.am=Sk.builtin.biginteger.prototype.am3;
Sk.builtin.biginteger.dbits=28;Sk.builtin.biginteger.prototype.DB=Sk.builtin.biginteger.dbits;Sk.builtin.biginteger.prototype.DM=(1<<Sk.builtin.biginteger.dbits)-1;Sk.builtin.biginteger.prototype.DV=1<<Sk.builtin.biginteger.dbits;Sk.builtin.biginteger.BI_FP=52;Sk.builtin.biginteger.prototype.FV=Math.pow(2,Sk.builtin.biginteger.BI_FP);Sk.builtin.biginteger.prototype.F1=Sk.builtin.biginteger.BI_FP-Sk.builtin.biginteger.dbits;Sk.builtin.biginteger.prototype.F2=2*Sk.builtin.biginteger.dbits-Sk.builtin.biginteger.BI_FP;
Sk.builtin.biginteger.BI_RM="0123456789abcdefghijklmnopqrstuvwxyz";Sk.builtin.biginteger.BI_RC=[];var rr,vv;rr=48;for(vv=0;9>=vv;++vv)Sk.builtin.biginteger.BI_RC[rr++]=vv;rr=97;for(vv=10;36>vv;++vv)Sk.builtin.biginteger.BI_RC[rr++]=vv;rr=65;for(vv=10;36>vv;++vv)Sk.builtin.biginteger.BI_RC[rr++]=vv;Sk.builtin.biginteger.int2char=function(a){return Sk.builtin.biginteger.BI_RM.charAt(a)};Sk.builtin.biginteger.intAt=function(a,b){var c=Sk.builtin.biginteger.BI_RC[a.charCodeAt(b)];return null==c?-1:c};
Sk.builtin.biginteger.prototype.bnpCopyTo=function(a){for(var b=this.t-1;0<=b;--b)a[b]=this[b];a.t=this.t;a.s=this.s};Sk.builtin.biginteger.prototype.bnpFromInt=function(a){this.t=1;this.s=0>a?-1:0;0<a?this[0]=a:-1>a?this[0]=a+this.DV:this.t=0};Sk.builtin.biginteger.nbv=function(a){var b=new Sk.builtin.biginteger(null);b.bnpFromInt(a);return b};
Sk.builtin.biginteger.prototype.bnpFromString=function(a,b){var c;if(16==b)c=4;else if(8==b)c=3;else if(256==b)c=8;else if(2==b)c=1;else if(32==b)c=5;else if(4==b)c=2;else{this.fromRadix(a,b);return}this.s=this.t=0;for(var d=a.length,e=!1,f=0;0<=--d;){var g=8==c?a[d]&255:Sk.builtin.biginteger.intAt(a,d);0>g?"-"==a.charAt(d)&&(e=!0):(e=!1,0==f?this[this.t++]=g:f+c>this.DB?(this[this.t-1]|=(g&(1<<this.DB-f)-1)<<f,this[this.t++]=g>>this.DB-f):this[this.t-1]|=g<<f,f+=c,f>=this.DB&&(f-=this.DB))}8==c&&
0!=(a[0]&128)&&(this.s=-1,0<f&&(this[this.t-1]|=(1<<this.DB-f)-1<<f));this.clamp();e&&Sk.builtin.biginteger.ZERO.subTo(this,this)};Sk.builtin.biginteger.prototype.bnpClamp=function(){for(var a=this.s&this.DM;0<this.t&&this[this.t-1]==a;)--this.t};
Sk.builtin.biginteger.prototype.bnToString=function(a){if(0>this.s)return"-"+this.negate().toString(a);if(16==a)a=4;else if(8==a)a=3;else if(2==a)a=1;else if(32==a)a=5;else if(4==a)a=2;else return this.toRadix(a);var b=(1<<a)-1,c,d=!1,e="",f=this.t,g=this.DB-f*this.DB%a;if(0<f--)for(g<this.DB&&0<(c=this[f]>>g)&&(d=!0,e=Sk.builtin.biginteger.int2char(c));0<=f;)g<a?(c=(this[f]&(1<<g)-1)<<a-g,c|=this[--f]>>(g+=this.DB-a)):(c=this[f]>>(g-=a)&b,0>=g&&(g+=this.DB,--f)),0<c&&(d=!0),d&&(e+=Sk.builtin.biginteger.int2char(c));
return d?e:"0"};Sk.builtin.biginteger.prototype.bnNegate=function(){var a=Sk.builtin.biginteger.nbi();Sk.builtin.biginteger.ZERO.subTo(this,a);return a};Sk.builtin.biginteger.prototype.bnAbs=function(){return 0>this.s?this.negate():this};Sk.builtin.biginteger.prototype.bnCompareTo=function(a){var b=this.s-a.s;if(0!=b)return b;var c=this.t,b=c-a.t;if(0!=b)return 0>this.s?-b:b;for(;0<=--c;)if(0!=(b=this[c]-a[c]))return b;return 0};
Sk.builtin.biginteger.nbits=function(a){var b=1,c;0!=(c=a>>>16)&&(a=c,b+=16);0!=(c=a>>8)&&(a=c,b+=8);0!=(c=a>>4)&&(a=c,b+=4);0!=(c=a>>2)&&(a=c,b+=2);0!=a>>1&&(b+=1);return b};Sk.builtin.biginteger.prototype.bnBitLength=function(){return 0>=this.t?0:this.DB*(this.t-1)+Sk.builtin.biginteger.nbits(this[this.t-1]^this.s&this.DM)};Sk.builtin.biginteger.prototype.bnpDLShiftTo=function(a,b){var c;for(c=this.t-1;0<=c;--c)b[c+a]=this[c];for(c=a-1;0<=c;--c)b[c]=0;b.t=this.t+a;b.s=this.s};
Sk.builtin.biginteger.prototype.bnpDRShiftTo=function(a,b){for(var c=a;c<this.t;++c)b[c-a]=this[c];b.t=Math.max(this.t-a,0);b.s=this.s};Sk.builtin.biginteger.prototype.bnpLShiftTo=function(a,b){var c=a%this.DB,d=this.DB-c,e=(1<<d)-1,f=Math.floor(a/this.DB),g=this.s<<c&this.DM,h;for(h=this.t-1;0<=h;--h)b[h+f+1]=this[h]>>d|g,g=(this[h]&e)<<c;for(h=f-1;0<=h;--h)b[h]=0;b[f]=g;b.t=this.t+f+1;b.s=this.s;b.clamp()};
Sk.builtin.biginteger.prototype.bnpRShiftTo=function(a,b){b.s=this.s;var c=Math.floor(a/this.DB);if(c>=this.t)b.t=0;else{var d=a%this.DB,e=this.DB-d,f=(1<<d)-1;b[0]=this[c]>>d;for(var g=c+1;g<this.t;++g)b[g-c-1]|=(this[g]&f)<<e,b[g-c]=this[g]>>d;0<d&&(b[this.t-c-1]|=(this.s&f)<<e);b.t=this.t-c;b.clamp()}};
Sk.builtin.biginteger.prototype.bnpSubTo=function(a,b){for(var c=0,d=0,e=Math.min(a.t,this.t);c<e;)d+=this[c]-a[c],b[c++]=d&this.DM,d>>=this.DB;if(a.t<this.t){for(d-=a.s;c<this.t;)d+=this[c],b[c++]=d&this.DM,d>>=this.DB;d+=this.s}else{for(d+=this.s;c<a.t;)d-=a[c],b[c++]=d&this.DM,d>>=this.DB;d-=a.s}b.s=0>d?-1:0;-1>d?b[c++]=this.DV+d:0<d&&(b[c++]=d);b.t=c;b.clamp()};
Sk.builtin.biginteger.prototype.bnpMultiplyTo=function(a,b){var c=this.abs(),d=a.abs(),e=c.t;for(b.t=e+d.t;0<=--e;)b[e]=0;for(e=0;e<d.t;++e)b[e+c.t]=c.am(0,d[e],b,e,0,c.t);b.s=0;b.clamp();this.s!=a.s&&Sk.builtin.biginteger.ZERO.subTo(b,b)};
Sk.builtin.biginteger.prototype.bnpSquareTo=function(a){for(var b=this.abs(),c=a.t=2*b.t;0<=--c;)a[c]=0;for(c=0;c<b.t-1;++c){var d=b.am(c,b[c],a,2*c,0,1);(a[c+b.t]+=b.am(c+1,2*b[c],a,2*c+1,d,b.t-c-1))>=b.DV&&(a[c+b.t]-=b.DV,a[c+b.t+1]=1)}0<a.t&&(a[a.t-1]+=b.am(c,b[c],a,2*c,0,1));a.s=0;a.clamp()};
Sk.builtin.biginteger.prototype.bnpDivRemTo=function(a,b,c){var d=a.abs();if(!(0>=d.t)){var e=this.abs();if(e.t<d.t)null!=b&&b.fromInt(0),null!=c&&this.copyTo(c);else{null==c&&(c=Sk.builtin.biginteger.nbi());var f=Sk.builtin.biginteger.nbi(),g=this.s;a=a.s;var h=this.DB-Sk.builtin.biginteger.nbits(d[d.t-1]);0<h?(d.lShiftTo(h,f),e.lShiftTo(h,c)):(d.copyTo(f),e.copyTo(c));d=f.t;e=f[d-1];if(0!=e){var k=e*(1<<this.F1)+(1<d?f[d-2]>>this.F2:0),l=this.FV/k,k=(1<<this.F1)/k,m=1<<this.F2,n=c.t,p=n-d,q=null==
b?Sk.builtin.biginteger.nbi():b;f.dlShiftTo(p,q);0<=c.compareTo(q)&&(c[c.t++]=1,c.subTo(q,c));Sk.builtin.biginteger.ONE.dlShiftTo(d,q);for(q.subTo(f,f);f.t<d;)f[f.t++]=0;for(;0<=--p;){var r=c[--n]==e?this.DM:Math.floor(c[n]*l+(c[n-1]+m)*k);if((c[n]+=f.am(0,r,c,p,0,d))<r)for(f.dlShiftTo(p,q),c.subTo(q,c);c[n]<--r;)c.subTo(q,c)}null!=b&&(c.drShiftTo(d,b),g!=a&&Sk.builtin.biginteger.ZERO.subTo(b,b));c.t=d;c.clamp();0<h&&c.rShiftTo(h,c);0>g&&Sk.builtin.biginteger.ZERO.subTo(c,c)}}}};
Sk.builtin.biginteger.prototype.bnMod=function(a){var b=Sk.builtin.biginteger.nbi();this.abs().divRemTo(a,null,b);0>this.s&&0<b.compareTo(Sk.builtin.biginteger.ZERO)&&a.subTo(b,b);return b};Sk.builtin.biginteger.Classic=function(a){this.m=a};Sk.builtin.biginteger.prototype.cConvert=function(a){return 0>a.s||0<=a.compareTo(this.m)?a.mod(this.m):a};Sk.builtin.biginteger.prototype.cRevert=function(a){return a};Sk.builtin.biginteger.prototype.cReduce=function(a){a.divRemTo(this.m,null,a)};
Sk.builtin.biginteger.prototype.cMulTo=function(a,b,c){a.multiplyTo(b,c);this.reduce(c)};Sk.builtin.biginteger.prototype.cSqrTo=function(a,b){a.squareTo(b);this.reduce(b)};Sk.builtin.biginteger.Classic.prototype.convert=Sk.builtin.biginteger.prototype.cConvert;Sk.builtin.biginteger.Classic.prototype.revert=Sk.builtin.biginteger.prototype.cRevert;Sk.builtin.biginteger.Classic.prototype.reduce=Sk.builtin.biginteger.prototype.cReduce;Sk.builtin.biginteger.Classic.prototype.mulTo=Sk.builtin.biginteger.prototype.cMulTo;
Sk.builtin.biginteger.Classic.prototype.sqrTo=Sk.builtin.biginteger.prototype.cSqrTo;Sk.builtin.biginteger.prototype.bnpInvDigit=function(){if(1>this.t)return 0;var a=this[0];if(0==(a&1))return 0;var b=a&3,b=b*(2-(a&15)*b)&15,b=b*(2-(a&255)*b)&255,b=b*(2-((a&65535)*b&65535))&65535,b=b*(2-a*b%this.DV)%this.DV;return 0<b?this.DV-b:-b};Sk.builtin.biginteger.Montgomery=function(a){this.m=a;this.mp=a.invDigit();this.mpl=this.mp&32767;this.mph=this.mp>>15;this.um=(1<<a.DB-15)-1;this.mt2=2*a.t};
Sk.builtin.biginteger.prototype.montConvert=function(a){var b=Sk.builtin.biginteger.nbi();a.abs().dlShiftTo(this.m.t,b);b.divRemTo(this.m,null,b);0>a.s&&0<b.compareTo(Sk.builtin.biginteger.ZERO)&&this.m.subTo(b,b);return b};Sk.builtin.biginteger.prototype.montRevert=function(a){var b=Sk.builtin.biginteger.nbi();a.copyTo(b);this.reduce(b);return b};
Sk.builtin.biginteger.prototype.montReduce=function(a){for(;a.t<=this.mt2;)a[a.t++]=0;for(var b=0;b<this.m.t;++b){var c=a[b]&32767,d=c*this.mpl+((c*this.mph+(a[b]>>15)*this.mpl&this.um)<<15)&a.DM,c=b+this.m.t;for(a[c]+=this.m.am(0,d,a,b,0,this.m.t);a[c]>=a.DV;)a[c]-=a.DV,a[++c]++}a.clamp();a.drShiftTo(this.m.t,a);0<=a.compareTo(this.m)&&a.subTo(this.m,a)};Sk.builtin.biginteger.prototype.montSqrTo=function(a,b){a.squareTo(b);this.reduce(b)};
Sk.builtin.biginteger.prototype.montMulTo=function(a,b,c){a.multiplyTo(b,c);this.reduce(c)};Sk.builtin.biginteger.Montgomery.prototype.convert=Sk.builtin.biginteger.prototype.montConvert;Sk.builtin.biginteger.Montgomery.prototype.revert=Sk.builtin.biginteger.prototype.montRevert;Sk.builtin.biginteger.Montgomery.prototype.reduce=Sk.builtin.biginteger.prototype.montReduce;Sk.builtin.biginteger.Montgomery.prototype.mulTo=Sk.builtin.biginteger.prototype.montMulTo;
Sk.builtin.biginteger.Montgomery.prototype.sqrTo=Sk.builtin.biginteger.prototype.montSqrTo;Sk.builtin.biginteger.prototype.bnpIsEven=function(){return 0==(0<this.t?this[0]&1:this.s)};Sk.builtin.biginteger.prototype.bnpExp=function(a,b){if(4294967295<a||1>a)return Sk.builtin.biginteger.ONE;var c=Sk.builtin.biginteger.nbi(),d=Sk.builtin.biginteger.nbi(),e=b.convert(this),f=Sk.builtin.biginteger.nbits(a)-1;for(e.copyTo(c);0<=--f;)if(b.sqrTo(c,d),0<(a&1<<f))b.mulTo(d,e,c);else var g=c,c=d,d=g;return b.revert(c)};
Sk.builtin.biginteger.prototype.bnModPowInt=function(a,b){var c;c=256>a||b.isEven()?new Sk.builtin.biginteger.Classic(b):new Sk.builtin.biginteger.Montgomery(b);return this.exp(a,c)};Sk.builtin.biginteger.prototype.copyTo=Sk.builtin.biginteger.prototype.bnpCopyTo;Sk.builtin.biginteger.prototype.fromInt=Sk.builtin.biginteger.prototype.bnpFromInt;Sk.builtin.biginteger.prototype.fromString=Sk.builtin.biginteger.prototype.bnpFromString;Sk.builtin.biginteger.prototype.clamp=Sk.builtin.biginteger.prototype.bnpClamp;
Sk.builtin.biginteger.prototype.dlShiftTo=Sk.builtin.biginteger.prototype.bnpDLShiftTo;Sk.builtin.biginteger.prototype.drShiftTo=Sk.builtin.biginteger.prototype.bnpDRShiftTo;Sk.builtin.biginteger.prototype.lShiftTo=Sk.builtin.biginteger.prototype.bnpLShiftTo;Sk.builtin.biginteger.prototype.rShiftTo=Sk.builtin.biginteger.prototype.bnpRShiftTo;Sk.builtin.biginteger.prototype.subTo=Sk.builtin.biginteger.prototype.bnpSubTo;Sk.builtin.biginteger.prototype.multiplyTo=Sk.builtin.biginteger.prototype.bnpMultiplyTo;
Sk.builtin.biginteger.prototype.squareTo=Sk.builtin.biginteger.prototype.bnpSquareTo;Sk.builtin.biginteger.prototype.divRemTo=Sk.builtin.biginteger.prototype.bnpDivRemTo;Sk.builtin.biginteger.prototype.invDigit=Sk.builtin.biginteger.prototype.bnpInvDigit;Sk.builtin.biginteger.prototype.isEven=Sk.builtin.biginteger.prototype.bnpIsEven;Sk.builtin.biginteger.prototype.exp=Sk.builtin.biginteger.prototype.bnpExp;Sk.builtin.biginteger.prototype.toString=Sk.builtin.biginteger.prototype.bnToString;
Sk.builtin.biginteger.prototype.negate=Sk.builtin.biginteger.prototype.bnNegate;Sk.builtin.biginteger.prototype.abs=Sk.builtin.biginteger.prototype.bnAbs;Sk.builtin.biginteger.prototype.compareTo=Sk.builtin.biginteger.prototype.bnCompareTo;Sk.builtin.biginteger.prototype.bitLength=Sk.builtin.biginteger.prototype.bnBitLength;Sk.builtin.biginteger.prototype.mod=Sk.builtin.biginteger.prototype.bnMod;Sk.builtin.biginteger.prototype.modPowInt=Sk.builtin.biginteger.prototype.bnModPowInt;
Sk.builtin.biginteger.ZERO=Sk.builtin.biginteger.nbv(0);Sk.builtin.biginteger.ONE=Sk.builtin.biginteger.nbv(1);Sk.builtin.biginteger.prototype.bnClone=function(){var a=Sk.builtin.biginteger.nbi();this.copyTo(a);return a};Sk.builtin.biginteger.prototype.bnIntValue=function(){if(0>this.s){if(1==this.t)return this[0]-this.DV;if(0==this.t)return-1}else{if(1==this.t)return this[0];if(0==this.t)return 0}return(this[1]&(1<<32-this.DB)-1)<<this.DB|this[0]};
Sk.builtin.biginteger.prototype.bnByteValue=function(){return 0==this.t?this.s:this[0]<<24>>24};Sk.builtin.biginteger.prototype.bnShortValue=function(){return 0==this.t?this.s:this[0]<<16>>16};Sk.builtin.biginteger.prototype.bnpChunkSize=function(a){return Math.floor(Math.LN2*this.DB/Math.log(a))};Sk.builtin.biginteger.prototype.bnSigNum=function(){return 0>this.s?-1:0>=this.t||1==this.t&&0>=this[0]?0:1};
Sk.builtin.biginteger.prototype.bnpToRadix=function(a){null==a&&(a=10);if(0==this.signum()||2>a||36<a)return"0";var b=this.chunkSize(a),b=Math.pow(a,b),c=Sk.builtin.biginteger.nbv(b),d=Sk.builtin.biginteger.nbi(),e=Sk.builtin.biginteger.nbi(),f="";for(this.divRemTo(c,d,e);0<d.signum();)f=(b+e.intValue()).toString(a).substr(1)+f,d.divRemTo(c,d,e);return e.intValue().toString(a)+f};
Sk.builtin.biginteger.prototype.bnpFromRadix=function(a,b){this.fromInt(0);null==b&&(b=10);for(var c=this.chunkSize(b),d=Math.pow(b,c),e=!1,f=0,g=0,h=0;h<a.length;++h){var k=Sk.builtin.biginteger.intAt(a,h);if(0>k){if("-"==a.charAt(h)&&0==this.signum()&&(e=!0),"."==a.charAt(h))break}else g=b*g+k,++f>=c&&(this.dMultiply(d),this.dAddOffset(g,0),g=f=0)}0<f&&(this.dMultiply(Math.pow(b,f)),this.dAddOffset(g,0));e&&Sk.builtin.biginteger.ZERO.subTo(this,this)};
Sk.builtin.biginteger.prototype.bnpFromNumber=function(a,b,c){if("number"==typeof b)if(2>a)this.fromInt(1);else for(this.fromNumber(a,c),this.testBit(a-1)||this.bitwiseTo(Sk.builtin.biginteger.ONE.shiftLeft(a-1),Sk.builtin.biginteger.op_or,this),this.isEven()&&this.dAddOffset(1,0);!this.isProbablePrime(b);)this.dAddOffset(2,0),this.bitLength()>a&&this.subTo(Sk.builtin.biginteger.ONE.shiftLeft(a-1),this);this.fromString(a+"")};
Sk.builtin.biginteger.prototype.bnToByteArray=function(){var a=this.t,b=[];b[0]=this.s;var c=this.DB-a*this.DB%8,d,e=0;if(0<a--)for(c<this.DB&&(d=this[a]>>c)!=(this.s&this.DM)>>c&&(b[e++]=d|this.s<<this.DB-c);0<=a;)if(8>c?(d=(this[a]&(1<<c)-1)<<8-c,d|=this[--a]>>(c+=this.DB-8)):(d=this[a]>>(c-=8)&255,0>=c&&(c+=this.DB,--a)),0!=(d&128)&&(d|=-256),0==e&&(this.s&128)!=(d&128)&&++e,0<e||d!=this.s)b[e++]=d;return b};Sk.builtin.biginteger.prototype.bnEquals=function(a){return 0==this.compareTo(a)};
Sk.builtin.biginteger.prototype.bnMin=function(a){return 0>this.compareTo(a)?this:a};Sk.builtin.biginteger.prototype.bnMax=function(a){return 0<this.compareTo(a)?this:a};Sk.builtin.biginteger.prototype.bnpBitwiseTo=function(a,b,c){var d,e,f=Math.min(a.t,this.t);for(d=0;d<f;++d)c[d]=b(this[d],a[d]);if(a.t<this.t){e=a.s&this.DM;for(d=f;d<this.t;++d)c[d]=b(this[d],e);c.t=this.t}else{e=this.s&this.DM;for(d=f;d<a.t;++d)c[d]=b(e,a[d]);c.t=a.t}c.s=b(this.s,a.s);c.clamp()};
Sk.builtin.biginteger.op_and=function(a,b){return a&b};Sk.builtin.biginteger.prototype.bnAnd=function(a){var b=Sk.builtin.biginteger.nbi();this.bitwiseTo(a,Sk.builtin.biginteger.op_and,b);return b};Sk.builtin.biginteger.op_or=function(a,b){return a|b};Sk.builtin.biginteger.prototype.bnOr=function(a){var b=Sk.builtin.biginteger.nbi();this.bitwiseTo(a,Sk.builtin.biginteger.op_or,b);return b};Sk.builtin.biginteger.op_xor=function(a,b){return a^b};
Sk.builtin.biginteger.prototype.bnXor=function(a){var b=Sk.builtin.biginteger.nbi();this.bitwiseTo(a,Sk.builtin.biginteger.op_xor,b);return b};Sk.builtin.biginteger.op_andnot=function(a,b){return a&~b};Sk.builtin.biginteger.prototype.bnAndNot=function(a){var b=Sk.builtin.biginteger.nbi();this.bitwiseTo(a,Sk.builtin.biginteger.op_andnot,b);return b};Sk.builtin.biginteger.prototype.bnNot=function(){for(var a=Sk.builtin.biginteger.nbi(),b=0;b<this.t;++b)a[b]=this.DM&~this[b];a.t=this.t;a.s=~this.s;return a};
Sk.builtin.biginteger.prototype.bnShiftLeft=function(a){var b=Sk.builtin.biginteger.nbi();0>a?this.rShiftTo(-a,b):this.lShiftTo(a,b);return b};Sk.builtin.biginteger.prototype.bnShiftRight=function(a){var b=Sk.builtin.biginteger.nbi();0>a?this.lShiftTo(-a,b):this.rShiftTo(a,b);return b};Sk.builtin.biginteger.lbit=function(a){if(0==a)return-1;var b=0;0==(a&65535)&&(a>>=16,b+=16);0==(a&255)&&(a>>=8,b+=8);0==(a&15)&&(a>>=4,b+=4);0==(a&3)&&(a>>=2,b+=2);0==(a&1)&&++b;return b};
Sk.builtin.biginteger.prototype.bnGetLowestSetBit=function(){for(var a=0;a<this.t;++a)if(0!=this[a])return a*this.DB+Sk.builtin.biginteger.lbit(this[a]);return 0>this.s?this.t*this.DB:-1};Sk.builtin.biginteger.cbit=function(a){for(var b=0;0!=a;)a&=a-1,++b;return b};Sk.builtin.biginteger.prototype.bnBitCount=function(){for(var a=0,b=this.s&this.DM,c=0;c<this.t;++c)a+=Sk.builtin.biginteger.cbit(this[c]^b);return a};
Sk.builtin.biginteger.prototype.bnTestBit=function(a){var b=Math.floor(a/this.DB);return b>=this.t?0!=this.s:0!=(this[b]&1<<a%this.DB)};Sk.builtin.biginteger.prototype.bnpChangeBit=function(a,b){var c=Sk.builtin.biginteger.ONE.shiftLeft(a);this.bitwiseTo(c,b,c);return c};Sk.builtin.biginteger.prototype.bnSetBit=function(a){return this.changeBit(a,Sk.builtin.biginteger.op_or)};Sk.builtin.biginteger.prototype.bnClearBit=function(a){return this.changeBit(a,Sk.builtin.biginteger.op_andnot)};
Sk.builtin.biginteger.prototype.bnFlipBit=function(a){return this.changeBit(a,Sk.builtin.biginteger.op_xor)};Sk.builtin.biginteger.prototype.bnpAddTo=function(a,b){for(var c=0,d=0,e=Math.min(a.t,this.t);c<e;)d+=this[c]+a[c],b[c++]=d&this.DM,d>>=this.DB;if(a.t<this.t){for(d+=a.s;c<this.t;)d+=this[c],b[c++]=d&this.DM,d>>=this.DB;d+=this.s}else{for(d+=this.s;c<a.t;)d+=a[c],b[c++]=d&this.DM,d>>=this.DB;d+=a.s}b.s=0>d?-1:0;0<d?b[c++]=d:-1>d&&(b[c++]=this.DV+d);b.t=c;b.clamp()};
Sk.builtin.biginteger.prototype.bnAdd=function(a){var b=Sk.builtin.biginteger.nbi();this.addTo(a,b);return b};Sk.builtin.biginteger.prototype.bnSubtract=function(a){var b=Sk.builtin.biginteger.nbi();this.subTo(a,b);return b};Sk.builtin.biginteger.prototype.bnMultiply=function(a){var b=Sk.builtin.biginteger.nbi();this.multiplyTo(a,b);return b};Sk.builtin.biginteger.prototype.bnDivide=function(a){var b=Sk.builtin.biginteger.nbi();this.divRemTo(a,b,null);return b};
Sk.builtin.biginteger.prototype.bnRemainder=function(a){var b=Sk.builtin.biginteger.nbi();this.divRemTo(a,null,b);return b};Sk.builtin.biginteger.prototype.bnDivideAndRemainder=function(a){var b=Sk.builtin.biginteger.nbi(),c=Sk.builtin.biginteger.nbi();this.divRemTo(a,b,c);return[b,c]};Sk.builtin.biginteger.prototype.bnpDMultiply=function(a){this[this.t]=this.am(0,a-1,this,0,0,this.t);++this.t;this.clamp()};
Sk.builtin.biginteger.prototype.bnpDAddOffset=function(a,b){if(0!=a){for(;this.t<=b;)this[this.t++]=0;for(this[b]+=a;this[b]>=this.DV;)this[b]-=this.DV,++b>=this.t&&(this[this.t++]=0),++this[b]}};Sk.builtin.biginteger.NullExp=function(){};Sk.builtin.biginteger.prototype.nNop=function(a){return a};Sk.builtin.biginteger.prototype.nMulTo=function(a,b,c){a.multiplyTo(b,c)};Sk.builtin.biginteger.prototype.nSqrTo=function(a,b){a.squareTo(b)};Sk.builtin.biginteger.NullExp.prototype.convert=Sk.builtin.biginteger.prototype.nNop;
Sk.builtin.biginteger.NullExp.prototype.revert=Sk.builtin.biginteger.prototype.nNop;Sk.builtin.biginteger.NullExp.prototype.mulTo=Sk.builtin.biginteger.prototype.nMulTo;Sk.builtin.biginteger.NullExp.prototype.sqrTo=Sk.builtin.biginteger.prototype.nSqrTo;Sk.builtin.biginteger.prototype.bnPow=function(a){return this.exp(a,new Sk.builtin.biginteger.NullExp)};
Sk.builtin.biginteger.prototype.bnpMultiplyLowerTo=function(a,b,c){var d=Math.min(this.t+a.t,b);c.s=0;for(c.t=d;0<d;)c[--d]=0;var e;for(e=c.t-this.t;d<e;++d)c[d+this.t]=this.am(0,a[d],c,d,0,this.t);for(e=Math.min(a.t,b);d<e;++d)this.am(0,a[d],c,d,0,b-d);c.clamp()};Sk.builtin.biginteger.prototype.bnpMultiplyUpperTo=function(a,b,c){--b;var d=c.t=this.t+a.t-b;for(c.s=0;0<=--d;)c[d]=0;for(d=Math.max(b-this.t,0);d<a.t;++d)c[this.t+d-b]=this.am(b-d,a[d],c,0,0,this.t+d-b);c.clamp();c.drShiftTo(1,c)};
Sk.builtin.biginteger.Barrett=function(a){this.r2=Sk.builtin.biginteger.nbi();this.q3=Sk.builtin.biginteger.nbi();Sk.builtin.biginteger.ONE.dlShiftTo(2*a.t,this.r2);this.mu=this.r2.divide(a);this.m=a};Sk.builtin.biginteger.prototype.barrettConvert=function(a){if(0>a.s||a.t>2*this.m.t)return a.mod(this.m);if(0>a.compareTo(this.m))return a;var b=Sk.builtin.biginteger.nbi();a.copyTo(b);this.reduce(b);return b};Sk.builtin.biginteger.prototype.barrettRevert=function(a){return a};
Sk.builtin.biginteger.prototype.barrettReduce=function(a){a.drShiftTo(this.m.t-1,this.r2);a.t>this.m.t+1&&(a.t=this.m.t+1,a.clamp());this.mu.multiplyUpperTo(this.r2,this.m.t+1,this.q3);for(this.m.multiplyLowerTo(this.q3,this.m.t+1,this.r2);0>a.compareTo(this.r2);)a.dAddOffset(1,this.m.t+1);for(a.subTo(this.r2,a);0<=a.compareTo(this.m);)a.subTo(this.m,a)};Sk.builtin.biginteger.prototype.barrettSqrTo=function(a,b){a.squareTo(b);this.reduce(b)};
Sk.builtin.biginteger.prototype.barrettMulTo=function(a,b,c){a.multiplyTo(b,c);this.reduce(c)};Sk.builtin.biginteger.Barrett.prototype.convert=Sk.builtin.biginteger.prototype.barrettConvert;Sk.builtin.biginteger.Barrett.prototype.revert=Sk.builtin.biginteger.prototype.barrettRevert;Sk.builtin.biginteger.Barrett.prototype.reduce=Sk.builtin.biginteger.prototype.barrettReduce;Sk.builtin.biginteger.Barrett.prototype.mulTo=Sk.builtin.biginteger.prototype.barrettMulTo;
Sk.builtin.biginteger.Barrett.prototype.sqrTo=Sk.builtin.biginteger.prototype.barrettSqrTo;
Sk.builtin.biginteger.prototype.bnModPow=function(a,b){var c=a.bitLength(),d,e=Sk.builtin.biginteger.nbv(1),f;if(0>=c)return e;d=18>c?1:48>c?3:144>c?4:768>c?5:6;f=8>c?new Sk.builtin.biginteger.Classic(b):b.isEven()?new Sk.builtin.biginteger.Barrett(b):new Sk.builtin.biginteger.Montgomery(b);var g=[],h=3,k=d-1,l=(1<<d)-1;g[1]=f.convert(this);if(1<d)for(c=Sk.builtin.biginteger.nbi(),f.sqrTo(g[1],c);h<=l;)g[h]=Sk.builtin.biginteger.nbi(),f.mulTo(c,g[h-2],g[h]),h+=2;for(var m=a.t-1,n,p=!0,q=Sk.builtin.biginteger.nbi(),
c=Sk.builtin.biginteger.nbits(a[m])-1;0<=m;){c>=k?n=a[m]>>c-k&l:(n=(a[m]&(1<<c+1)-1)<<k-c,0<m&&(n|=a[m-1]>>this.DB+c-k));for(h=d;0==(n&1);)n>>=1,--h;0>(c-=h)&&(c+=this.DB,--m);if(p)g[n].copyTo(e),p=!1;else{for(;1<h;)f.sqrTo(e,q),f.sqrTo(q,e),h-=2;0<h?f.sqrTo(e,q):(h=e,e=q,q=h);f.mulTo(q,g[n],e)}for(;0<=m&&0==(a[m]&1<<c);)f.sqrTo(e,q),h=e,e=q,q=h,0>--c&&(c=this.DB-1,--m)}return f.revert(e)};
Sk.builtin.biginteger.prototype.bnGCD=function(a){var b=0>this.s?this.negate():this.clone();a=0>a.s?a.negate():a.clone();if(0>b.compareTo(a)){var c=b,b=a;a=c}var c=b.getLowestSetBit(),d=a.getLowestSetBit();if(0>d)return b;c<d&&(d=c);0<d&&(b.rShiftTo(d,b),a.rShiftTo(d,a));for(;0<b.signum();)0<(c=b.getLowestSetBit())&&b.rShiftTo(c,b),0<(c=a.getLowestSetBit())&&a.rShiftTo(c,a),0<=b.compareTo(a)?(b.subTo(a,b),b.rShiftTo(1,b)):(a.subTo(b,a),a.rShiftTo(1,a));0<d&&a.lShiftTo(d,a);return a};
Sk.builtin.biginteger.prototype.bnpModInt=function(a){if(0>=a)return 0;var b=this.DV%a,c=0>this.s?a-1:0;if(0<this.t)if(0==b)c=this[0]%a;else for(var d=this.t-1;0<=d;--d)c=(b*c+this[d])%a;return c};
Sk.builtin.biginteger.prototype.bnModInverse=function(a){var b=a.isEven();if(this.isEven()&&b||0==a.signum())return Sk.builtin.biginteger.ZERO;for(var c=a.clone(),d=this.clone(),e=Sk.builtin.biginteger.nbv(1),f=Sk.builtin.biginteger.nbv(0),g=Sk.builtin.biginteger.nbv(0),h=Sk.builtin.biginteger.nbv(1);0!=c.signum();){for(;c.isEven();)c.rShiftTo(1,c),b?(e.isEven()&&f.isEven()||(e.addTo(this,e),f.subTo(a,f)),e.rShiftTo(1,e)):f.isEven()||f.subTo(a,f),f.rShiftTo(1,f);for(;d.isEven();)d.rShiftTo(1,d),b?
(g.isEven()&&h.isEven()||(g.addTo(this,g),h.subTo(a,h)),g.rShiftTo(1,g)):h.isEven()||h.subTo(a,h),h.rShiftTo(1,h);0<=c.compareTo(d)?(c.subTo(d,c),b&&e.subTo(g,e),f.subTo(h,f)):(d.subTo(c,d),b&&g.subTo(e,g),h.subTo(f,h))}if(0!=d.compareTo(Sk.builtin.biginteger.ONE))return Sk.builtin.biginteger.ZERO;if(0<=h.compareTo(a))return h.subtract(a);if(0>h.signum())h.addTo(a,h);else return h;return 0>h.signum()?h.add(a):h};
Sk.builtin.biginteger.lowprimes=[2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509];
Sk.builtin.biginteger.lplim=67108864/Sk.builtin.biginteger.lowprimes[Sk.builtin.biginteger.lowprimes.length-1];
Sk.builtin.biginteger.prototype.bnIsProbablePrime=function(a){var b,c=this.abs();if(1==c.t&&c[0]<=Sk.builtin.biginteger.lowprimes[Sk.builtin.biginteger.lowprimes.length-1]){for(b=0;b<Sk.builtin.biginteger.lowprimes.length;++b)if(c[0]==Sk.builtin.biginteger.lowprimes[b])return!0;return!1}if(c.isEven())return!1;for(b=1;b<Sk.builtin.biginteger.lowprimes.length;){for(var d=Sk.builtin.biginteger.lowprimes[b],e=b+1;e<Sk.builtin.biginteger.lowprimes.length&&d<Sk.builtin.biginteger.lplim;)d*=Sk.builtin.biginteger.lowprimes[e++];
for(d=c.modInt(d);b<e;)if(0==d%Sk.builtin.biginteger.lowprimes[b++])return!1}return c.millerRabin(a)};
Sk.builtin.biginteger.prototype.bnpMillerRabin=function(a){var b=this.subtract(Sk.builtin.biginteger.ONE),c=b.getLowestSetBit();if(0>=c)return!1;var d=b.shiftRight(c);a=a+1>>1;a>Sk.builtin.biginteger.lowprimes.length&&(a=Sk.builtin.biginteger.lowprimes.length);for(var e=Sk.builtin.biginteger.nbi(),f=0;f<a;++f){e.fromInt(Sk.builtin.biginteger.lowprimes[f]);var g=e.modPow(d,this);if(0!=g.compareTo(Sk.builtin.biginteger.ONE)&&0!=g.compareTo(b)){for(var h=1;h++<c&&0!=g.compareTo(b);)if(g=g.modPowInt(2,
this),0==g.compareTo(Sk.builtin.biginteger.ONE))return!1;if(0!=g.compareTo(b))return!1}}return!0};Sk.builtin.biginteger.prototype.isnegative=function(){return 0>this.s};Sk.builtin.biginteger.prototype.ispositive=function(){return 0<=this.s};Sk.builtin.biginteger.prototype.trueCompare=function(a){return 0<=this.s&&0>a.s?1:0>this.s&&0<=a.s?-1:this.compare(a)};Sk.builtin.biginteger.prototype.chunkSize=Sk.builtin.biginteger.prototype.bnpChunkSize;Sk.builtin.biginteger.prototype.toRadix=Sk.builtin.biginteger.prototype.bnpToRadix;
Sk.builtin.biginteger.prototype.fromRadix=Sk.builtin.biginteger.prototype.bnpFromRadix;Sk.builtin.biginteger.prototype.fromNumber=Sk.builtin.biginteger.prototype.bnpFromNumber;Sk.builtin.biginteger.prototype.bitwiseTo=Sk.builtin.biginteger.prototype.bnpBitwiseTo;Sk.builtin.biginteger.prototype.changeBit=Sk.builtin.biginteger.prototype.bnpChangeBit;Sk.builtin.biginteger.prototype.addTo=Sk.builtin.biginteger.prototype.bnpAddTo;Sk.builtin.biginteger.prototype.dMultiply=Sk.builtin.biginteger.prototype.bnpDMultiply;
Sk.builtin.biginteger.prototype.dAddOffset=Sk.builtin.biginteger.prototype.bnpDAddOffset;Sk.builtin.biginteger.prototype.multiplyLowerTo=Sk.builtin.biginteger.prototype.bnpMultiplyLowerTo;Sk.builtin.biginteger.prototype.multiplyUpperTo=Sk.builtin.biginteger.prototype.bnpMultiplyUpperTo;Sk.builtin.biginteger.prototype.modInt=Sk.builtin.biginteger.prototype.bnpModInt;Sk.builtin.biginteger.prototype.millerRabin=Sk.builtin.biginteger.prototype.bnpMillerRabin;Sk.builtin.biginteger.prototype.clone=Sk.builtin.biginteger.prototype.bnClone;
Sk.builtin.biginteger.prototype.intValue=Sk.builtin.biginteger.prototype.bnIntValue;Sk.builtin.biginteger.prototype.byteValue=Sk.builtin.biginteger.prototype.bnByteValue;Sk.builtin.biginteger.prototype.shortValue=Sk.builtin.biginteger.prototype.bnShortValue;Sk.builtin.biginteger.prototype.signum=Sk.builtin.biginteger.prototype.bnSigNum;Sk.builtin.biginteger.prototype.toByteArray=Sk.builtin.biginteger.prototype.bnToByteArray;Sk.builtin.biginteger.prototype.equals=Sk.builtin.biginteger.prototype.bnEquals;
Sk.builtin.biginteger.prototype.compare=Sk.builtin.biginteger.prototype.compareTo;Sk.builtin.biginteger.prototype.min=Sk.builtin.biginteger.prototype.bnMin;Sk.builtin.biginteger.prototype.max=Sk.builtin.biginteger.prototype.bnMax;Sk.builtin.biginteger.prototype.and=Sk.builtin.biginteger.prototype.bnAnd;Sk.builtin.biginteger.prototype.or=Sk.builtin.biginteger.prototype.bnOr;Sk.builtin.biginteger.prototype.xor=Sk.builtin.biginteger.prototype.bnXor;Sk.builtin.biginteger.prototype.andNot=Sk.builtin.biginteger.prototype.bnAndNot;
Sk.builtin.biginteger.prototype.not=Sk.builtin.biginteger.prototype.bnNot;Sk.builtin.biginteger.prototype.shiftLeft=Sk.builtin.biginteger.prototype.bnShiftLeft;Sk.builtin.biginteger.prototype.shiftRight=Sk.builtin.biginteger.prototype.bnShiftRight;Sk.builtin.biginteger.prototype.getLowestSetBit=Sk.builtin.biginteger.prototype.bnGetLowestSetBit;Sk.builtin.biginteger.prototype.bitCount=Sk.builtin.biginteger.prototype.bnBitCount;Sk.builtin.biginteger.prototype.testBit=Sk.builtin.biginteger.prototype.bnTestBit;
Sk.builtin.biginteger.prototype.setBit=Sk.builtin.biginteger.prototype.bnSetBit;Sk.builtin.biginteger.prototype.clearBit=Sk.builtin.biginteger.prototype.bnClearBit;Sk.builtin.biginteger.prototype.flipBit=Sk.builtin.biginteger.prototype.bnFlipBit;Sk.builtin.biginteger.prototype.add=Sk.builtin.biginteger.prototype.bnAdd;Sk.builtin.biginteger.prototype.subtract=Sk.builtin.biginteger.prototype.bnSubtract;Sk.builtin.biginteger.prototype.multiply=Sk.builtin.biginteger.prototype.bnMultiply;
Sk.builtin.biginteger.prototype.divide=Sk.builtin.biginteger.prototype.bnDivide;Sk.builtin.biginteger.prototype.remainder=Sk.builtin.biginteger.prototype.bnRemainder;Sk.builtin.biginteger.prototype.divideAndRemainder=Sk.builtin.biginteger.prototype.bnDivideAndRemainder;Sk.builtin.biginteger.prototype.modPow=Sk.builtin.biginteger.prototype.bnModPow;Sk.builtin.biginteger.prototype.modInverse=Sk.builtin.biginteger.prototype.bnModInverse;Sk.builtin.biginteger.prototype.pow=Sk.builtin.biginteger.prototype.bnPow;
Sk.builtin.biginteger.prototype.gcd=Sk.builtin.biginteger.prototype.bnGCD;Sk.builtin.biginteger.prototype.isProbablePrime=Sk.builtin.biginteger.prototype.bnIsProbablePrime;Sk.builtin.nmber=function(a,b){if(!(this instanceof Sk.builtin.nmber))return new Sk.builtin.nmber(a,b);a instanceof Sk.builtin.str&&(a=a.v);if(a instanceof Sk.builtin.nmber)this.v=a.v,this.skType=a.skType;else if("number"===typeof a)if(this.v=a,void 0===b)this.skType=a>Sk.builtin.nmber.threshold$||a<-Sk.builtin.nmber.threshold$||0!=a%1?Sk.builtin.nmber.float$:Sk.builtin.nmber.int$;else{if(this.skType=b,b===Sk.builtin.nmber.int$&&(a>Sk.builtin.nmber.threshold$||a<-Sk.builtin.nmber.threshold$))return new Sk.builtin.lng(a)}else{if("string"===
typeof a){var c=Sk.numberFromStr(a);void 0!==b&&(c.skType=b);return b===Sk.builtin.nmber.int$&&(c.v>Sk.builtin.nmber.threshold$||c.v<-Sk.builtin.nmber.threshold$)?new Sk.builtin.lng(a):c}if(a instanceof Sk.builtin.lng)return Sk.numberFromStr(a.str$(10,!0));if(a instanceof Sk.builtin.biginteger){if(c=Sk.numberFromStr(a.toString()),void 0!==b&&(c.skType=b),b===Sk.builtin.nmber.int$&&(c.v>Sk.builtin.nmber.threshold$||c.v<-Sk.builtin.nmber.threshold$))return new Sk.builtin.lng(a)}else this.v=0,this.skType=
void 0===b?Sk.builtin.nmber.int$:b}return this};Sk.builtin.nmber.prototype.tp$index=function(){return this.v};Sk.builtin.nmber.prototype.tp$hash=function(){return this.v};Sk.builtin.nmber.prototype.tp$name="number";Sk.builtin.nmber.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("number",Sk.builtin.nmber);Sk.builtin.nmber.threshold$=Math.pow(2,53);Sk.builtin.nmber.float$="float";Sk.builtin.nmber.int$="int";Sk.builtin.nmber.fromInt$=function(a){return new Sk.builtin.nmber(a,void 0)};
Sk.numberFromStr=function(a){if("inf"==a)return new Sk.builtin.nmber(Infinity,void 0);if("-inf"==a)return new Sk.builtin.nmber(-Infinity,void 0);var b=new Sk.builtin.nmber(0,void 0);if(-1!==a.indexOf(".")||-1!==a.indexOf("e")||-1!==a.indexOf("E"))return b.v=parseFloat(a),b.skType=Sk.builtin.nmber.float$,b;var c=a;"-"===a.charAt(0)&&(c=a.substr(1));a="0"!==c.charAt(0)||"x"!==c.charAt(1)&&"X"!==c.charAt(1)?"0"!==c.charAt(0)||"b"!==c.charAt(1)&&"B"!==c.charAt(1)?"0"===c.charAt(0)?parseInt(a,8):parseInt(a,
10):parseInt(a,2):parseInt(a,16);b.v=a;b.skType=Sk.builtin.nmber.int$;return b};goog.exportSymbol("Sk.numberFromStr",Sk.numberFromStr);Sk.builtin.nmber.prototype.clone=function(){return new Sk.builtin.nmber(this,void 0)};Sk.builtin.nmber.prototype.toFixed=function(a){a=Sk.builtin.asnum$(a);return this.v.toFixed(a)};
Sk.builtin.nmber.prototype.nb$add=function(a){var b;"number"===typeof a&&(a=new Sk.builtin.nmber(a,void 0));if(a instanceof Sk.builtin.nmber){b=new Sk.builtin.nmber(this.v+a.v,void 0);if(this.skType===Sk.builtin.nmber.float$||a.skType===Sk.builtin.nmber.float$)b.skType=Sk.builtin.nmber.float$;else if(b.skType=Sk.builtin.nmber.int$,b.v>Sk.builtin.nmber.threshold$||b.v<-Sk.builtin.nmber.threshold$)b=(new Sk.builtin.lng(this.v)).nb$add(a.v);return b}if(a instanceof Sk.builtin.lng)return b=this.skType===
Sk.builtin.nmber.float$?new Sk.builtin.nmber(this.v+parseFloat(a.str$(10,!0)),Sk.builtin.nmber.float$):(new Sk.builtin.lng(this.v)).nb$add(a)};
Sk.builtin.nmber.prototype.nb$subtract=function(a){var b;"number"===typeof a&&(a=new Sk.builtin.nmber(a,void 0));if(a instanceof Sk.builtin.nmber){b=new Sk.builtin.nmber(this.v-a.v,void 0);if(this.skType===Sk.builtin.nmber.float$||a.skType===Sk.builtin.nmber.float$)b.skType=Sk.builtin.nmber.float$;else if(b.skType=Sk.builtin.nmber.int$,b.v>Sk.builtin.nmber.threshold$||b.v<-Sk.builtin.nmber.threshold$)b=(new Sk.builtin.lng(this.v)).nb$subtract(a.v);return b}if(a instanceof Sk.builtin.lng)return b=
this.skType===Sk.builtin.nmber.float$?new Sk.builtin.nmber(this.v-parseFloat(a.str$(10,!0)),Sk.builtin.nmber.float$):(new Sk.builtin.lng(this.v)).nb$subtract(a)};
Sk.builtin.nmber.prototype.nb$multiply=function(a){var b;"number"===typeof a&&(a=new Sk.builtin.nmber(a,void 0));if(a instanceof Sk.builtin.nmber){b=new Sk.builtin.nmber(this.v*a.v,void 0);if(this.skType===Sk.builtin.nmber.float$||a.skType===Sk.builtin.nmber.float$)b.skType=Sk.builtin.nmber.float$;else if(b.skType=Sk.builtin.nmber.int$,b.v>Sk.builtin.nmber.threshold$||b.v<-Sk.builtin.nmber.threshold$)b=(new Sk.builtin.lng(this.v)).nb$multiply(a.v);return b}if(a instanceof Sk.builtin.lng)return b=
this.skType===Sk.builtin.nmber.float$?new Sk.builtin.nmber(this.v*parseFloat(a.str$(10,!0)),Sk.builtin.nmber.float$):(new Sk.builtin.lng(this.v)).nb$multiply(a)};
Sk.builtin.nmber.prototype.nb$divide=function(a){var b;"number"===typeof a&&(a=new Sk.builtin.nmber(a,void 0));if(a instanceof Sk.builtin.nmber){if(0==a.v)throw new Sk.builtin.ZeroDivisionError("integer division or modulo by zero");if(Infinity===this.v)return Infinity===a.v||-Infinity===a.v?new Sk.builtin.nmber(NaN,Sk.builtin.nmber.float$):a.nb$isnegative()?new Sk.builtin.nmber(-Infinity,Sk.builtin.nmber.float$):new Sk.builtin.nmber(Infinity,Sk.builtin.nmber.float$);if(-Infinity===this.v)return Infinity===
a.v||-Infinity===a.v?new Sk.builtin.nmber(NaN,Sk.builtin.nmber.float$):a.nb$isnegative()?new Sk.builtin.nmber(Infinity,Sk.builtin.nmber.float$):new Sk.builtin.nmber(-Infinity,Sk.builtin.nmber.float$);b=new Sk.builtin.nmber(this.v/a.v,void 0);if(this.skType===Sk.builtin.nmber.float$||a.skType===Sk.builtin.nmber.float$||Sk.python3)b.skType=Sk.builtin.nmber.float$;else if(b.v=Math.floor(b.v),b.skType=Sk.builtin.nmber.int$,b.v>Sk.builtin.nmber.threshold$||b.v<-Sk.builtin.nmber.threshold$)b=(new Sk.builtin.lng(this.v)).nb$divide(a.v);
return b}if(a instanceof Sk.builtin.lng){if(0==a.longCompare(Sk.builtin.biginteger.ZERO))throw new Sk.builtin.ZeroDivisionError("integer division or modulo by zero");return Infinity===this.v?a.nb$isnegative()?new Sk.builtin.nmber(-Infinity,Sk.builtin.nmber.float$):new Sk.builtin.nmber(Infinity,Sk.builtin.nmber.float$):-Infinity===this.v?a.nb$isnegative()?new Sk.builtin.nmber(Infinity,Sk.builtin.nmber.float$):new Sk.builtin.nmber(-Infinity,Sk.builtin.nmber.float$):b=this.skType===Sk.builtin.nmber.float$?
new Sk.builtin.nmber(this.v/parseFloat(a.str$(10,!0)),Sk.builtin.nmber.float$):(new Sk.builtin.lng(this.v)).nb$divide(a)}};
Sk.builtin.nmber.prototype.nb$floor_divide=function(a){var b;"number"===typeof a&&(a=new Sk.builtin.nmber(a,void 0));if(Infinity===this.v||-Infinity===this.v)return new Sk.builtin.nmber(NaN,Sk.builtin.nmber.float$);if(a instanceof Sk.builtin.nmber){if(0==a.v)throw new Sk.builtin.ZeroDivisionError("integer division or modulo by zero");if(Infinity===a.v)return this.nb$isnegative()?new Sk.builtin.nmber(-1,Sk.builtin.nmber.float$):new Sk.builtin.nmber(0,Sk.builtin.nmber.float$);if(-Infinity===a.v)return this.nb$isnegative()||
!this.nb$nonzero()?new Sk.builtin.nmber(0,Sk.builtin.nmber.float$):new Sk.builtin.nmber(-1,Sk.builtin.nmber.float$);b=new Sk.builtin.nmber(Math.floor(this.v/a.v),void 0);if(this.skType===Sk.builtin.nmber.float$||a.skType===Sk.builtin.nmber.float$)b.skType=Sk.builtin.nmber.float$;else if(b.v=Math.floor(b.v),b.skType=Sk.builtin.nmber.int$,b.v>Sk.builtin.nmber.threshold$||b.v<-Sk.builtin.nmber.threshold$)b=(new Sk.builtin.lng(this.v)).nb$floor_divide(a.v);return b}if(a instanceof Sk.builtin.lng){if(0==
a.longCompare(Sk.builtin.biginteger.ZERO))throw new Sk.builtin.ZeroDivisionError("integer division or modulo by zero");this.skType===Sk.builtin.nmber.float$?(b=Math.floor(this.v/parseFloat(a.str$(10,!0))),b=new Sk.builtin.nmber(b,Sk.builtin.nmber.float$)):b=(new Sk.builtin.lng(this.v)).nb$floor_divide(a);return b}};
Sk.builtin.nmber.prototype.nb$remainder=function(a){var b;"number"===typeof a&&(a=new Sk.builtin.nmber(a,void 0));if(a instanceof Sk.builtin.nmber){if(0==a.v)throw new Sk.builtin.ZeroDivisionError("integer division or modulo by zero");if(0==this.v)return this.skType==Sk.builtin.nmber.float$||a.skType==Sk.builtin.nmber.float$?new Sk.builtin.nmber(0,Sk.builtin.nmber.float$):new Sk.builtin.nmber(0,Sk.builtin.nmber.int$);if(Infinity===a.v)return Infinity===this.v||-Infinity===this.v?new Sk.builtin.nmber(NaN,
Sk.builtin.nmber.float$):this.nb$ispositive()?new Sk.builtin.nmber(this.v,Sk.builtin.nmber.float$):new Sk.builtin.nmber(Infinity,Sk.builtin.nmber.float$);b=this.v%a.v;0>this.v?0<a.v&&0>b&&(b+=a.v):0>a.v&&0!=b&&(b+=a.v);if(this.skType===Sk.builtin.nmber.float$||a.skType===Sk.builtin.nmber.float$)b=new Sk.builtin.nmber(b,Sk.builtin.nmber.float$);else if(b=new Sk.builtin.nmber(b,Sk.builtin.nmber.int$),b.v>Sk.builtin.nmber.threshold$||b.v<-Sk.builtin.nmber.threshold$)b=(new Sk.builtin.lng(this.v)).nb$remainder(a.v);
return b}if(a instanceof Sk.builtin.lng){if(0==a.longCompare(Sk.builtin.biginteger.ZERO))throw new Sk.builtin.ZeroDivisionError("integer division or modulo by zero");if(0==this.v)return this.skType===Sk.builtin.nmber.int$?new Sk.builtin.lng(0):new Sk.builtin.nmber(0,this.skType);this.skType===Sk.builtin.nmber.float$?(a=parseFloat(a.str$(10,!0)),b=this.v%a,0>b?0<a&&0!=b&&(b+=a):0>a&&0!=b&&(b+=a),b=new Sk.builtin.nmber(b,Sk.builtin.nmber.float$)):b=(new Sk.builtin.lng(this.v)).nb$remainder(a);return b}};
Sk.builtin.nmber.prototype.nb$power=function(a){var b;"number"===typeof a&&(a=new Sk.builtin.nmber(a,void 0));if(a instanceof Sk.builtin.nmber){if(0>this.v&&0!=a.v%1)throw new Sk.builtin.NegativePowerError("cannot raise a negative number to a fractional power");if(0==this.v&&0>a.v)throw new Sk.builtin.NegativePowerError("cannot raise zero to a negative power");b=new Sk.builtin.nmber(Math.pow(this.v,a.v),void 0);if(this.skType===Sk.builtin.nmber.float$||a.skType===Sk.builtin.nmber.float$||0>a.v)b.skType=
Sk.builtin.nmber.float$;else if(b.v=Math.floor(b.v),b.skType=Sk.builtin.nmber.int$,b.v>Sk.builtin.nmber.threshold$||b.v<-Sk.builtin.nmber.threshold$)b=(new Sk.builtin.lng(this.v)).nb$power(a.v);if(Infinity===Math.abs(b.v)&&Infinity!==Math.abs(this.v)&&Infinity!==Math.abs(a.v))throw new Sk.builtin.OverflowError("Numerical result out of range");return b}if(a instanceof Sk.builtin.lng){if(0==this.v&&0>a.longCompare(Sk.builtin.biginteger.ZERO))throw new Sk.builtin.NegativePowerError("cannot raise zero to a negative power");
return b=this.skType===Sk.builtin.nmber.float$||a.nb$isnegative()?new Sk.builtin.nmber(Math.pow(this.v,parseFloat(a.str$(10,!0))),Sk.builtin.nmber.float$):(new Sk.builtin.lng(this.v)).nb$power(a)}};Sk.builtin.nmber.prototype.nb$and=function(a){a=Sk.builtin.asnum$(a);a&=this.v;void 0!==a&&0>a&&(a+=4294967296);if(void 0!==a)return new Sk.builtin.nmber(a,void 0)};
Sk.builtin.nmber.prototype.nb$or=function(a){a=Sk.builtin.asnum$(a);a|=this.v;void 0!==a&&0>a&&(a+=4294967296);if(void 0!==a)return new Sk.builtin.nmber(a,void 0)};Sk.builtin.nmber.prototype.nb$xor=function(a){a=Sk.builtin.asnum$(a);a^=this.v;void 0!==a&&0>a&&(a+=4294967296);if(void 0!==a)return new Sk.builtin.nmber(a,void 0)};
Sk.builtin.nmber.prototype.nb$lshift=function(a){var b;a=Sk.builtin.asnum$(a);if(void 0!==a){if(0>a)throw new Sk.builtin.ValueError("negative shift count");b=this.v<<a;if(b<=this.v)return Sk.builtin.lng.fromInt$(this.v).nb$lshift(a)}if(void 0!==b)return new Sk.builtin.nmber(b,this.skType)};
Sk.builtin.nmber.prototype.nb$rshift=function(a){var b;a=Sk.builtin.asnum$(a);if(void 0!==a){if(0>a)throw new Sk.builtin.ValueError("negative shift count");b=this.v>>a;0<this.v&&0>b&&(b&=Math.pow(2,32-a)-1)}if(void 0!==b)return new Sk.builtin.nmber(b,this.skType)};Sk.builtin.nmber.prototype.nb$inplace_add=Sk.builtin.nmber.prototype.nb$add;Sk.builtin.nmber.prototype.nb$inplace_subtract=Sk.builtin.nmber.prototype.nb$subtract;Sk.builtin.nmber.prototype.nb$inplace_multiply=Sk.builtin.nmber.prototype.nb$multiply;
Sk.builtin.nmber.prototype.nb$inplace_divide=Sk.builtin.nmber.prototype.nb$divide;Sk.builtin.nmber.prototype.nb$inplace_remainder=Sk.builtin.nmber.prototype.nb$remainder;Sk.builtin.nmber.prototype.nb$inplace_floor_divide=Sk.builtin.nmber.prototype.nb$floor_divide;Sk.builtin.nmber.prototype.nb$inplace_power=Sk.builtin.nmber.prototype.nb$power;Sk.builtin.nmber.prototype.nb$inplace_and=Sk.builtin.nmber.prototype.nb$and;Sk.builtin.nmber.prototype.nb$inplace_or=Sk.builtin.nmber.prototype.nb$or;
Sk.builtin.nmber.prototype.nb$inplace_xor=Sk.builtin.nmber.prototype.nb$xor;Sk.builtin.nmber.prototype.nb$inplace_lshift=Sk.builtin.nmber.prototype.nb$lshift;Sk.builtin.nmber.prototype.nb$inplace_rshift=Sk.builtin.nmber.prototype.nb$rshift;Sk.builtin.nmber.prototype.nb$negative=function(){return new Sk.builtin.nmber(-this.v,void 0)};Sk.builtin.nmber.prototype.nb$positive=function(){return this.clone()};Sk.builtin.nmber.prototype.nb$nonzero=function(){return 0!==this.v};
Sk.builtin.nmber.prototype.nb$isnegative=function(){return 0>this.v};Sk.builtin.nmber.prototype.nb$ispositive=function(){return 0<=this.v};
Sk.builtin.nmber.prototype.numberCompare=function(a){a instanceof Sk.builtin.bool&&(a=Sk.builtin.asnum$(a));a instanceof Sk.builtin.none&&(a=0);if("number"===typeof a)return this.v-a;if(a instanceof Sk.builtin.nmber)return Infinity==this.v&&Infinity==a.v||-Infinity==this.v&&-Infinity==a.v?0:this.v-a.v;if(a instanceof Sk.builtin.lng){if(this.skType===Sk.builtin.nmber.int$||0==this.v%1)return(new Sk.builtin.lng(this.v)).longCompare(a);a=this.nb$subtract(a);if(a instanceof Sk.builtin.nmber)return a.v;
if(a instanceof Sk.builtin.lng)return a.longCompare(Sk.builtin.biginteger.ZERO)}};Sk.builtin.nmber.prototype.__eq__=function(a,b){return 0==a.numberCompare(b)&&!(b instanceof Sk.builtin.none)};Sk.builtin.nmber.prototype.__ne__=function(a,b){return 0!=a.numberCompare(b)||b instanceof Sk.builtin.none};Sk.builtin.nmber.prototype.__lt__=function(a,b){return 0>a.numberCompare(b)};Sk.builtin.nmber.prototype.__le__=function(a,b){return 0>=a.numberCompare(b)};
Sk.builtin.nmber.prototype.__gt__=function(a,b){return 0<a.numberCompare(b)};Sk.builtin.nmber.prototype.__ge__=function(a,b){return 0<=a.numberCompare(b)};Sk.builtin.nmber.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;Sk.builtin.nmber.prototype.$r=function(){return new Sk.builtin.str(this.str$(10,!0))};Sk.builtin.nmber.prototype.tp$str=function(){return new Sk.builtin.str(this.str$(10,!0))};
Sk.builtin.nmber.prototype.str$=function(a,b){if(isNaN(this.v))return"nan";void 0===b&&(b=!0);if(Infinity==this.v)return"inf";if(-Infinity==this.v&&b)return"-inf";if(-Infinity==this.v&&!b)return"inf";var c=b?this.v:Math.abs(this.v),d;if(void 0===a||10===a)if(this.skType==Sk.builtin.nmber.float$){d=c.toPrecision(12);var e=d.indexOf("."),f=c.toString().slice(0,e),e=c.toString().slice(e);for(f.match(/^-?0$/)&&e.slice(1).match(/^0{4,}/)&&(d=12>d.length?c.toExponential():c.toExponential(11));"0"==d.charAt(d.length-
1)&&0>d.indexOf("e");)d=d.substring(0,d.length-1);"."==d.charAt(d.length-1)&&(d+="0");d=d.replace(/\.0+e/,"e","i");d=d.replace(/(e[-+])([1-9])$/,"$10$2");d=d.replace(/0+(e.*)/,"$1")}else d=c.toString();else d=c.toString(a);if(this.skType!==Sk.builtin.nmber.float$)return d;0>d.indexOf(".")&&(0>d.indexOf("E")&&0>d.indexOf("e"))&&(d+=".0");return d};goog.exportSymbol("Sk.builtin.nmber",Sk.builtin.nmber);Sk.builtin.lng=function(a,b){b=Sk.builtin.asnum$(b);if(!(this instanceof Sk.builtin.lng))return new Sk.builtin.lng(a,b);if(void 0===a)this.biginteger=new Sk.builtin.biginteger(0);else if(a instanceof Sk.builtin.lng)this.biginteger=a.biginteger.clone();else if(a instanceof Sk.builtin.biginteger)this.biginteger=a;else{if(a instanceof String)return Sk.longFromStr(a,b);if(a instanceof Sk.builtin.str)return Sk.longFromStr(a.v,b);if(void 0!==a&&!Sk.builtin.checkString(a)&&!Sk.builtin.checkNumber(a))if(!0===
a)a=1;else if(!1===a)a=0;else throw new Sk.builtin.TypeError("long() argument must be a string or a number, not '"+Sk.abstr.typeName(a)+"'");a=Sk.builtin.asnum$nofloat(a);this.biginteger=new Sk.builtin.biginteger(a)}return this};Sk.builtin.lng.prototype.tp$index=function(){return parseInt(this.str$(10,!0),10)};Sk.builtin.lng.prototype.tp$hash=function(){return this.tp$index()};Sk.builtin.lng.prototype.tp$name="long";Sk.builtin.lng.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("long",Sk.builtin.lng);
Sk.builtin.lng.threshold$=Math.pow(2,53);Sk.builtin.lng.MAX_INT$=new Sk.builtin.lng(Sk.builtin.lng.threshold$);Sk.builtin.lng.MIN_INT$=new Sk.builtin.lng(-Sk.builtin.lng.threshold$);Sk.builtin.lng.prototype.cantBeInt=function(){return 0<this.longCompare(Sk.builtin.lng.MAX_INT$)||0>this.longCompare(Sk.builtin.lng.MIN_INT$)};Sk.builtin.lng.fromInt$=function(a){return new Sk.builtin.lng(a)};
Sk.longFromStr=function(a,b){var c=Sk.str2number(a,b,function(a,b){return 10==b?new Sk.builtin.biginteger(a):new Sk.builtin.biginteger(a,b)},function(a){return a.negate()},"long");return new Sk.builtin.lng(c)};goog.exportSymbol("Sk.longFromStr",Sk.longFromStr);Sk.builtin.lng.prototype.toInt$=function(){return this.biginteger.intValue()};Sk.builtin.lng.prototype.clone=function(){return new Sk.builtin.lng(this)};
Sk.builtin.lng.prototype.nb$add=function(a){if(a instanceof Sk.builtin.nmber){if(a.skType===Sk.builtin.nmber.float$)return(new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$)).nb$add(a);a=new Sk.builtin.lng(a.v)}return a instanceof Sk.builtin.lng?new Sk.builtin.lng(this.biginteger.add(a.biginteger)):a instanceof Sk.builtin.biginteger?new Sk.builtin.lng(this.biginteger.add(a)):new Sk.builtin.lng(this.biginteger.add(new Sk.builtin.biginteger(a)))};
Sk.builtin.lng.prototype.nb$inplace_add=Sk.builtin.lng.prototype.nb$add;Sk.builtin.lng.prototype.nb$subtract=function(a){if(a instanceof Sk.builtin.nmber){if(a.skType===Sk.builtin.nmber.float$)return(new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$)).nb$subtract(a);a=new Sk.builtin.lng(a.v)}return a instanceof Sk.builtin.lng?new Sk.builtin.lng(this.biginteger.subtract(a.biginteger)):a instanceof Sk.builtin.biginteger?new Sk.builtin.lng(this.biginteger.subtract(a)):new Sk.builtin.lng(this.biginteger.subtract(new Sk.builtin.biginteger(a)))};
Sk.builtin.lng.prototype.nb$inplace_subtract=Sk.builtin.lng.prototype.nb$subtract;Sk.builtin.lng.prototype.nb$multiply=function(a){if(a instanceof Sk.builtin.nmber){if(a.skType===Sk.builtin.nmber.float$)return(new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$)).nb$multiply(a);a=new Sk.builtin.lng(a.v)}return a instanceof Sk.builtin.lng?new Sk.builtin.lng(this.biginteger.multiply(a.biginteger)):a instanceof Sk.builtin.biginteger?new Sk.builtin.lng(this.biginteger.multiply(a)):new Sk.builtin.lng(this.biginteger.multiply(new Sk.builtin.biginteger(a)))};
Sk.builtin.lng.prototype.nb$inplace_multiply=Sk.builtin.lng.prototype.nb$multiply;
Sk.builtin.lng.prototype.nb$divide=function(a){if(a instanceof Sk.builtin.nmber){if(a.skType===Sk.builtin.nmber.float$)return(new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$)).nb$divide(a);a=new Sk.builtin.lng(a.v)}a instanceof Sk.builtin.lng||(a=new Sk.builtin.lng(a));var b=this.nb$isnegative(),c=a.nb$isnegative();if(b&&!c||c&&!b){a=this.biginteger.divideAndRemainder(a.biginteger);if(0==a[1].trueCompare(Sk.builtin.biginteger.ZERO))return new Sk.builtin.lng(a[0]);a=a[0].subtract(Sk.builtin.biginteger.ONE);
return new Sk.builtin.lng(a)}return new Sk.builtin.lng(this.biginteger.divide(a.biginteger))};Sk.builtin.lng.prototype.nb$inplace_divide=Sk.builtin.lng.prototype.nb$divide;Sk.builtin.lng.prototype.nb$floor_divide=function(a){return a instanceof Sk.builtin.nmber&&a.skType===Sk.builtin.nmber.float$?(new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$)).nb$floor_divide(a):this.nb$divide(a)};Sk.builtin.lng.prototype.nb$inplace_floor_divide=Sk.builtin.lng.prototype.nb$floor_divide;
Sk.builtin.lng.prototype.nb$remainder=function(a){if(0===this.biginteger.trueCompare(Sk.builtin.biginteger.ZERO))return a instanceof Sk.builtin.nmber&&a.skType===Sk.builtin.nmber.float$?new Sk.builtin.nmber(0,Sk.builtin.nmber.float$):new Sk.builtin.lng(0);if(a instanceof Sk.builtin.nmber){if(a.skType===Sk.builtin.nmber.float$)return(new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$)).nb$remainder(a);a=new Sk.builtin.lng(a.v)}a instanceof Sk.builtin.lng||(a=new Sk.builtin.lng(a));var b=
new Sk.builtin.lng(this.biginteger.remainder(a.biginteger));this.nb$isnegative()?a.nb$ispositive()&&b.nb$nonzero()&&(b=b.nb$add(a).nb$remainder(a)):a.nb$isnegative()&&b.nb$nonzero()&&(b=b.nb$add(a));return b};Sk.builtin.lng.prototype.nb$inplace_remainder=Sk.builtin.lng.prototype.nb$remainder;
Sk.builtin.lng.prototype.nb$power=function(a,b){if(void 0!==b)return a=new Sk.builtin.biginteger(Sk.builtin.asnum$(a)),b=new Sk.builtin.biginteger(Sk.builtin.asnum$(b)),new Sk.builtin.lng(this.biginteger.modPowInt(a,b));if("number"===typeof a){if(0>a){var c=new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$);return c.nb$power(a)}return new Sk.builtin.lng(this.biginteger.pow(new Sk.builtin.biginteger(a)))}if(a instanceof Sk.builtin.nmber){if(a.skType===Sk.builtin.nmber.float$||0>a.v)return c=
new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$),c.nb$power(a);a=new Sk.builtin.lng(a.v)}return a instanceof Sk.builtin.lng?a.nb$isnegative()?(c=new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$),c.nb$power(a)):new Sk.builtin.lng(this.biginteger.pow(a.biginteger)):a instanceof Sk.builtin.biginteger?a.isnegative()?(c=new Sk.builtin.nmber(this.str$(10,!0),Sk.builtin.nmber.float$),c.nb$power(a)):new Sk.builtin.lng(this.biginteger.pow(a)):new Sk.builtin.lng(this.biginteger.pow(new Sk.builtin.biginteger(a)))};
Sk.builtin.lng.prototype.nb$inplace_power=Sk.builtin.lng.prototype.nb$power;
Sk.builtin.lng.prototype.nb$lshift=function(a){if(a instanceof Sk.builtin.lng){if(0>a.biginteger.signum())throw new Sk.builtin.ValueError("negative shift count");return new Sk.builtin.lng(this.biginteger.shiftLeft(a.biginteger))}if(a instanceof Sk.builtin.biginteger){if(0>a.signum())throw new Sk.builtin.ValueError("negative shift count");return new Sk.builtin.lng(this.biginteger.shiftLeft(a))}if(0>a)throw new Sk.builtin.ValueError("negative shift count");a=Sk.builtin.asnum$(a);return new Sk.builtin.lng(this.biginteger.shiftLeft(new Sk.builtin.biginteger(a)))};
Sk.builtin.lng.prototype.nb$inplace_lshift=Sk.builtin.lng.prototype.nb$lshift;
Sk.builtin.lng.prototype.nb$rshift=function(a){if(a instanceof Sk.builtin.lng){if(0>a.biginteger.signum())throw new Sk.builtin.ValueError("negative shift count");return new Sk.builtin.lng(this.biginteger.shiftRight(a.biginteger))}if(a instanceof Sk.builtin.biginteger){if(0>a.signum())throw new Sk.builtin.ValueError("negative shift count");return new Sk.builtin.lng(this.biginteger.shiftRight(a))}if(0>a)throw new Sk.builtin.ValueError("negative shift count");a=Sk.builtin.asnum$(a);return new Sk.builtin.lng(this.biginteger.shiftRight(new Sk.builtin.biginteger(a)))};
Sk.builtin.lng.prototype.nb$inplace_rshift=Sk.builtin.lng.prototype.nb$rshift;Sk.builtin.lng.prototype.nb$and=function(a){if(a instanceof Sk.builtin.lng)return new Sk.builtin.lng(this.biginteger.and(a.biginteger));if(a instanceof Sk.builtin.biginteger)return new Sk.builtin.lng(this.biginteger.and(a));a=Sk.builtin.asnum$(a);return new Sk.builtin.lng(this.biginteger.and(new Sk.builtin.biginteger(a)))};Sk.builtin.lng.prototype.nb$inplace_and=Sk.builtin.lng.prototype.nb$and;
Sk.builtin.lng.prototype.nb$or=function(a){if(a instanceof Sk.builtin.lng)return new Sk.builtin.lng(this.biginteger.or(a.biginteger));if(a instanceof Sk.builtin.biginteger)return new Sk.builtin.lng(this.biginteger.or(a));a=Sk.builtin.asnum$(a);return new Sk.builtin.lng(this.biginteger.or(new Sk.builtin.biginteger(a)))};Sk.builtin.lng.prototype.nb$inplace_or=Sk.builtin.lng.prototype.nb$or;
Sk.builtin.lng.prototype.nb$xor=function(a){if(a instanceof Sk.builtin.lng)return new Sk.builtin.lng(this.biginteger.xor(a.biginteger));if(a instanceof Sk.builtin.biginteger)return new Sk.builtin.lng(this.biginteger.xor(a));a=Sk.builtin.asnum$(a);return new Sk.builtin.lng(this.biginteger.xor(new Sk.builtin.biginteger(a)))};Sk.builtin.lng.prototype.nb$inplace_xor=Sk.builtin.lng.prototype.nb$xor;Sk.builtin.lng.prototype.nb$negative=function(){return new Sk.builtin.lng(this.biginteger.negate())};
Sk.builtin.lng.prototype.nb$positive=function(){return this.clone()};Sk.builtin.lng.prototype.nb$nonzero=function(){return 0!==this.biginteger.trueCompare(Sk.builtin.biginteger.ZERO)};Sk.builtin.lng.prototype.nb$isnegative=function(){return this.biginteger.isnegative()};Sk.builtin.lng.prototype.nb$ispositive=function(){return!this.biginteger.isnegative()};
Sk.builtin.lng.prototype.longCompare=function(a){"boolean"===typeof a&&(a=a?1:0);"number"===typeof a&&(a=new Sk.builtin.lng(a));return a instanceof Sk.builtin.nmber?a.skType===Sk.builtin.nmber.int$||0==a.v%1?(a=new Sk.builtin.lng(a.v),this.longCompare(a)):(new Sk.builtin.nmber(this,Sk.builtin.nmber.float$)).numberCompare(a):a instanceof Sk.builtin.lng?this.biginteger.subtract(a.biginteger):a instanceof Sk.builtin.biginteger?this.biginteger.subtract(a):this.biginteger.subtract(new Sk.builtin.biginteger(a))};
Sk.builtin.lng.prototype.__eq__=function(a,b){return 0==a.longCompare(b)&&!(b instanceof Sk.builtin.none)};Sk.builtin.lng.prototype.__ne__=function(a,b){return 0!=a.longCompare(b)||b instanceof Sk.builtin.none};Sk.builtin.lng.prototype.__lt__=function(a,b){return 0>a.longCompare(b)};Sk.builtin.lng.prototype.__le__=function(a,b){return 0>=a.longCompare(b)};Sk.builtin.lng.prototype.__gt__=function(a,b){return 0<a.longCompare(b)};Sk.builtin.lng.prototype.__ge__=function(a,b){return 0<=a.longCompare(b)};
Sk.builtin.lng.prototype.$r=function(){return new Sk.builtin.str(this.str$(10,!0)+"L")};Sk.builtin.lng.prototype.tp$str=function(){return new Sk.builtin.str(this.str$(10,!0))};Sk.builtin.lng.prototype.str$=function(a,b){void 0===b&&(b=!0);var c=b?this.biginteger:this.biginteger.abs();return void 0===a||10===a?c.toString():c.toString(a)};Sk.str2number=function(a,b,c,d,e){var f=a,g=!1;a=a.replace(/^\s+|\s+$/g,"");"-"==a.charAt(0)&&(g=!0,a=a.substring(1));"+"==a.charAt(0)&&(a=a.substring(1));void 0===b&&(b=10);if((2>b||36<b)&&0!=b)throw new Sk.builtin.ValueError(e+"() base must be >= 2 and <= 36");if("0x"==a.substring(0,2).toLowerCase()){if(16!=b&&0!=b)throw new Sk.builtin.ValueError("invalid literal for "+e+"() with base "+b+": '"+f+"'");a=a.substring(2);b=16}else if("0b"==a.substring(0,2).toLowerCase()){if(2!=b&&0!=b)throw new Sk.builtin.ValueError("invalid literal for "+
e+"() with base "+b+": '"+f+"'");a=a.substring(2);b=2}else if("0o"==a.substring(0,2).toLowerCase()){if(8!=b&&0!=b)throw new Sk.builtin.ValueError("invalid literal for "+e+"() with base "+b+": '"+f+"'");a=a.substring(2);b=8}else if("0"==a.charAt(0)){if("0"==a)return 0;if(8==b||0==b)b=8}0==b&&(b=10);if(0===a.length)throw new Sk.builtin.ValueError("invalid literal for "+e+"() with base "+b+": '"+f+"'");var h,k,l;for(h=0;h<a.length;h++)if(k=a.charCodeAt(h),l=b,48<=k&&57>=k?l=k-48:65<=k&&90>=k?l=k-65+
10:97<=k&&122>=k&&(l=k-97+10),l>=b)throw new Sk.builtin.ValueError("invalid literal for "+e+"() with base "+b+": '"+f+"'");l=c(a,b);g&&(l=d(l));return l};
Sk.builtin.int_=function(a,b){if(void 0!==a&&!Sk.builtin.checkString(a)&&!Sk.builtin.checkNumber(a))if(a instanceof Sk.builtin.bool)a=Sk.builtin.asnum$(a);else throw new Sk.builtin.TypeError("int() argument must be a string or a number, not '"+Sk.abstr.typeName(a)+"'");if(a instanceof Sk.builtin.str){b=Sk.builtin.asnum$(b);var c=Sk.str2number(a.v,b,parseInt,function(a){return-a},"int");return c>Sk.builtin.lng.threshold$||c<-Sk.builtin.lng.threshold$?new Sk.builtin.lng(a,b):new Sk.builtin.nmber(c,
Sk.builtin.nmber.int$)}if(void 0!==b)throw new Sk.builtin.TypeError("int() can't convert non-string with explicit base");if(a instanceof Sk.builtin.lng)return a.cantBeInt()?new Sk.builtin.lng(a):new Sk.builtin.nmber(a.toInt$(),Sk.builtin.nmber.int$);a=Sk.builtin.asnum$(a);return new Sk.builtin.nmber(a|0,Sk.builtin.nmber.int$)};Sk.builtin.int_.prototype.tp$name="int";Sk.builtin.int_.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("int",Sk.builtin.int_);Sk.builtin.float_=function(a){if(void 0===a)return new Sk.builtin.nmber(0,Sk.builtin.nmber.float$);if(a instanceof Sk.builtin.str){if(a.v.match(/^-inf$/i))a=-Infinity;else if(a.v.match(/^[+]?inf$/i))a=Infinity;else if(a.v.match(/^[-+]?nan$/i))a=NaN;else{if(isNaN(a.v))throw new Sk.builtin.ValueError("float: Argument: "+a.v+" is not number");a=parseFloat(a.v)}return new Sk.builtin.nmber(a,Sk.builtin.nmber.float$)}if("number"===typeof a||a instanceof Sk.builtin.nmber||a instanceof Sk.builtin.lng)return a=
Sk.builtin.asnum$(a),new Sk.builtin.nmber(a,Sk.builtin.nmber.float$);if(a instanceof Sk.builtin.bool)return a=Sk.builtin.asnum$(a),new Sk.builtin.nmber(a,Sk.builtin.nmber.float$);throw new Sk.builtin.TypeError("float() argument must be a string or a number");};Sk.builtin.float_.prototype.tp$name="float";Sk.builtin.float_.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("float",Sk.builtin.float_);Sk.builtin.slice=function(a,b,c){a=Sk.builtin.asnum$(a);b=Sk.builtin.asnum$(b);c=Sk.builtin.asnum$(c);if(!(this instanceof Sk.builtin.slice))return new Sk.builtin.slice(a,b,c);void 0===b&&void 0===c&&(b=a,a=null);a||(a=null);void 0===b&&(b=null);void 0===c&&(c=null);this.start=a;this.stop=b;this.step=c;if(null!==this.start&&!Sk.builtin.checkInt(this.start)||null!==this.stop&&!Sk.builtin.checkInt(this.stop)||null!==this.step&&!Sk.builtin.checkInt(this.step))throw new Sk.builtin.TypeError("slice indices must be integers or None");
return this};Sk.builtin.slice.prototype.tp$str=function(){var a=Sk.builtin.repr(this.start).v,b=Sk.builtin.repr(this.stop).v,c=Sk.builtin.repr(this.step).v;return new Sk.builtin.str("slice("+a+", "+b+", "+c+")")};
Sk.builtin.slice.prototype.indices=function(a){a=Sk.builtin.asnum$(a);var b=this.start,c=this.stop,d=this.step;null===d&&(d=1);0<d?(null===b&&(b=0),null===c&&(c=a),c>a&&(c=a),0>b&&(b=a+b,0>b&&(b=0)),0>c&&(c=a+c)):(null===b&&(b=a-1),b>=a&&(b=a-1),null===c?c=-1:0>c&&(c=a+c,0>c&&(c=-1)),0>b&&(b=a+b));return[b,c,d]};
Sk.builtin.slice.prototype.sssiter$=function(a,b){var c=Sk.builtin.asnum$(a),d=this.indices("number"===typeof c?c:a.v.length);if(0<d[2]){var e;for(e=d[0];e<d[1]&&!1!==b(e,c);e+=d[2]);}else for(e=d[0];e>d[1]&&!1!==b(e,c);e+=d[2]);};Sk.builtin.set=function(a){if(!(this instanceof Sk.builtin.set))return new Sk.builtin.set(a);"undefined"===typeof a&&(a=[]);this.set_reset_();a=(new Sk.builtin.list(a)).tp$iter();for(var b=a.tp$iternext();void 0!==b;b=a.tp$iternext())Sk.builtin.set.prototype.add.func_code(this,b);this.__class__=Sk.builtin.set;this.v=this.v;return this};Sk.builtin.set.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("set",Sk.builtin.set);Sk.builtin.set.prototype.set_iter_=function(){return Sk.builtin.dict.prototype.keys.func_code(this.v).tp$iter()};
Sk.builtin.set.prototype.set_reset_=function(){this.v=new Sk.builtin.dict([])};Sk.builtin.set.prototype.tp$name="set";Sk.builtin.set.prototype.$r=function(){for(var a=[],b=this.tp$iter(),c=b.tp$iternext();void 0!==c;c=b.tp$iternext())a.push(Sk.misceval.objectRepr(c).v);return new Sk.builtin.str("set(["+a.join(", ")+"])")};Sk.builtin.set.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;Sk.builtin.set.prototype.tp$hash=Sk.builtin.object.prototype.HashNotImplemented;
Sk.builtin.set.prototype.tp$richcompare=function(a,b){if(this===a&&Sk.misceval.opAllowsEquality(b))return!0;if(!a.__class__||a.__class__!=Sk.builtin.set)return"Eq"===b?!1:"NotEq"===b?!0:!1;var c=this.sq$length(),d=a.sq$length();if(d!==c){if("Eq"===b)return!1;if("NotEq"===b)return!0}var e=!1,f=!1;switch(b){case "Lt":case "LtE":case "Eq":case "NotEq":e=Sk.builtin.set.prototype.issubset.func_code(this,a);break;case "Gt":case "GtE":f=Sk.builtin.set.prototype.issuperset.func_code(this,a);break;default:goog.asserts.fail()}switch(b){case "Lt":return c<
d&&e;case "LtE":case "Eq":return e;case "NotEq":return!e;case "Gt":return c>d&&f;case "GtE":return f}};Sk.builtin.set.prototype.tp$iter=Sk.builtin.set.prototype.set_iter_;Sk.builtin.set.prototype.sq$length=function(){return this.v.mp$length()};Sk.builtin.set.prototype.isdisjoint=new Sk.builtin.func(function(a,b){for(var c=a.tp$iter(),d=c.tp$iternext();void 0!==d;d=c.tp$iternext())if(Sk.abstr.sequenceContains(b,d))return Sk.builtin.bool.false$;return Sk.builtin.bool.true$});
Sk.builtin.set.prototype.issubset=new Sk.builtin.func(function(a,b){var c=a.sq$length(),d=b.sq$length();if(c>d)return Sk.builtin.bool.false$;c=a.tp$iter();for(d=c.tp$iternext();void 0!==d;d=c.tp$iternext())if(!Sk.abstr.sequenceContains(b,d))return Sk.builtin.bool.false$;return Sk.builtin.bool.true$});Sk.builtin.set.prototype.issuperset=new Sk.builtin.func(function(a,b){return Sk.builtin.set.prototype.issubset.func_code(b,a)});
Sk.builtin.set.prototype.union=new Sk.builtin.func(function(a){for(var b=new Sk.builtin.set(a),c=1;c<arguments.length;c++)Sk.builtin.set.prototype.update.func_code(b,arguments[c]);return b});Sk.builtin.set.prototype.intersection=new Sk.builtin.func(function(a){var b=Sk.builtin.set.prototype.copy.func_code(a);arguments[0]=b;Sk.builtin.set.prototype.intersection_update.func_code.apply(null,arguments);return b});
Sk.builtin.set.prototype.difference=new Sk.builtin.func(function(a,b){var c=Sk.builtin.set.prototype.copy.func_code(a);arguments[0]=c;Sk.builtin.set.prototype.difference_update.func_code.apply(null,arguments);return c});
Sk.builtin.set.prototype.symmetric_difference=new Sk.builtin.func(function(a,b){for(var c=Sk.builtin.set.prototype.union.func_code(a,b),d=c.tp$iter(),e=d.tp$iternext();void 0!==e;e=d.tp$iternext())Sk.abstr.sequenceContains(a,e)&&Sk.abstr.sequenceContains(b,e)&&Sk.builtin.set.prototype.discard.func_code(c,e);return c});Sk.builtin.set.prototype.copy=new Sk.builtin.func(function(a){return new Sk.builtin.set(a)});
Sk.builtin.set.prototype.update=new Sk.builtin.func(function(a,b){for(var c=b.tp$iter(),d=c.tp$iternext();void 0!==d;d=c.tp$iternext())Sk.builtin.set.prototype.add.func_code(a,d);return Sk.builtin.none.none$});Sk.builtin.set.prototype.intersection_update=new Sk.builtin.func(function(a,b){for(var c=a.tp$iter(),d=c.tp$iternext();void 0!==d;d=c.tp$iternext())for(var e=1;e<arguments.length;e++)if(!Sk.abstr.sequenceContains(arguments[e],d)){Sk.builtin.set.prototype.discard.func_code(a,d);break}return Sk.builtin.none.none$});
Sk.builtin.set.prototype.difference_update=new Sk.builtin.func(function(a,b){for(var c=a.tp$iter(),d=c.tp$iternext();void 0!==d;d=c.tp$iternext())for(var e=1;e<arguments.length;e++)if(Sk.abstr.sequenceContains(arguments[e],d)){Sk.builtin.set.prototype.discard.func_code(a,d);break}return Sk.builtin.none.none$});
Sk.builtin.set.prototype.symmetric_difference_update=new Sk.builtin.func(function(a,b){var c=Sk.builtin.set.prototype.symmetric_difference.func_code(a,b);a.set_reset_();Sk.builtin.set.prototype.update.func_code(a,c);return Sk.builtin.none.none$});Sk.builtin.set.prototype.add=new Sk.builtin.func(function(a,b){a.v.mp$ass_subscript(b,!0);return Sk.builtin.none.none$});
Sk.builtin.set.prototype.discard=new Sk.builtin.func(function(a,b){if(void 0!==a.v.mp$lookup(b)){var c=Sk.builtin.hash,c=c(b);void 0!==a.v[c]&&(a.v.size-=1,delete a.v[c])}return Sk.builtin.none.none$});Sk.builtin.set.prototype.pop=new Sk.builtin.func(function(a){if(0===a.sq$length())throw new Sk.builtin.KeyError("pop from an empty set");var b=a.tp$iter().tp$iternext();Sk.builtin.set.prototype.discard.func_code(a,b);return b});
Sk.builtin.set.prototype.remove=new Sk.builtin.func(function(a,b){a.v.mp$del_subscript(b);return Sk.builtin.none.none$});goog.exportSymbol("Sk.builtin.set",Sk.builtin.set);Sk.builtin.module=function(){};goog.exportSymbol("Sk.builtin.module",Sk.builtin.module);Sk.builtin.module.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("module",Sk.builtin.module);Sk.builtin.module.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;Sk.builtin.module.prototype.tp$setattr=Sk.builtin.object.prototype.GenericSetAttr;Sk.builtin.generator=function(a,b,c,d,e){if(a){this.func_code=a;this.func_globals=b||null;this.gi$running=!1;this.gi$resumeat=0;this.gi$sentvalue=void 0;this.gi$locals={};if(0<c.length)for(b=0;b<a.co_varnames.length;++b)this.gi$locals[a.co_varnames[b]]=c[b];if(void 0!==e)for(var f in e)d[f]=e[f];this.func_closure=d;return this}};goog.exportSymbol("Sk.builtin.generator",Sk.builtin.generator);Sk.builtin.generator.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;
Sk.builtin.generator.prototype.tp$iter=function(){return this};Sk.builtin.generator.prototype.tp$iternext=function(a){this.gi$running=!0;void 0===a&&(a=null);this.gi$sentvalue=a;a=[this];this.func_closure&&a.push(this.func_closure);a=this.func_code.apply(this.func_globals,a);this.gi$running=!1;goog.asserts.assert(void 0!==a);if(null!==a)return this.gi$resumeat=a[0],a=a[1]};Sk.builtin.generator.prototype.next=new Sk.builtin.func(function(a){return a.tp$iternext()});
Sk.builtin.generator.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("generator",Sk.builtin.generator);Sk.builtin.generator.prototype.$r=function(){return new Sk.builtin.str("<generator object "+this.func_code.co_name.v+">")};Sk.builtin.generator.prototype.send=new Sk.builtin.func(function(a,b){return a.tp$iternext(b)});Sk.builtin.makeGenerator=function(a,b){var c=new Sk.builtin.generator(null,null,null);c.tp$iternext=a;for(var d in b)b.hasOwnProperty(d)&&(c[d]=b[d]);return c};
goog.exportSymbol("Sk.builtin.makeGenerator",Sk.builtin.makeGenerator);Sk.builtin.file=function(a,b,c){this.mode=b;this.name=a;this.closed=!1;if(Sk.inBrowser){b=document.getElementById(a.v);if(null==b)throw new Sk.builtin.IOError("[Errno 2] No such file or directory: '"+a.v+"'");"textarea"==b.nodeName.toLowerCase()?this.data$=b.value:this.data$=b.textContent}else this.data$=Sk.read(a.v);this.lineList=this.data$.split("\n");this.lineList=this.lineList.slice(0,-1);for(var d in this.lineList)this.lineList[d]+="\n";this.pos$=this.currentLine=0;this.__class__=Sk.builtin.file;
return this};Sk.builtin.file.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("file",Sk.builtin.file);Sk.builtin.file.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;Sk.builtin.file.prototype.$r=function(){return new Sk.builtin.str("<"+(this.closed?"closed":"open")+"file '"+this.name+"', mode '"+this.mode+"'>")};
Sk.builtin.file.prototype.tp$iter=function(){var a={tp$iter:function(){return a},$obj:this,$index:0,$lines:this.lineList,tp$iternext:function(){return a.$index>=a.$lines.length?void 0:new Sk.builtin.str(a.$lines[a.$index++])}};return a};Sk.builtin.file.prototype.close=new Sk.builtin.func(function(a){a.closed=!0});Sk.builtin.file.prototype.flush=new Sk.builtin.func(function(a){});Sk.builtin.file.prototype.fileno=new Sk.builtin.func(function(a){return 10});Sk.builtin.file.prototype.isatty=new Sk.builtin.func(function(a){return!1});
Sk.builtin.file.prototype.read=new Sk.builtin.func(function(a,b){if(a.closed)throw new Sk.builtin.ValueError("I/O operation on closed file");var c=a.data$.length;void 0===b&&(b=c);var d=new Sk.builtin.str(a.data$.substr(a.pos$,b));a.pos$+=b;a.pos$>=c&&(a.pos$=c);return d});Sk.builtin.file.prototype.readline=new Sk.builtin.func(function(a,b){var c="";a.currentLine<a.lineList.length&&(c=a.lineList[a.currentLine],a.currentLine++);return new Sk.builtin.str(c)});
Sk.builtin.file.prototype.readlines=new Sk.builtin.func(function(a,b){for(var c=[],d=a.currentLine;d<a.lineList.length;d++)c.push(new Sk.builtin.str(a.lineList[d]));return new Sk.builtin.list(c)});Sk.builtin.file.prototype.seek=new Sk.builtin.func(function(a,b,c){void 0===c&&(c=1);a.pos$=1==c?b:a.data$+b});Sk.builtin.file.prototype.tell=new Sk.builtin.func(function(a){return a.pos$});Sk.builtin.file.prototype.truncate=new Sk.builtin.func(function(a,b){goog.asserts.fail()});
Sk.builtin.file.prototype.write=new Sk.builtin.func(function(a,b){goog.asserts.fail()});goog.exportSymbol("Sk.builtin.file",Sk.builtin.file);Sk.ffi=Sk.ffi||{};
Sk.ffi.remapToPy=function(a){if("[object Array]"===Object.prototype.toString.call(a)){for(var b=[],c=0;c<a.length;++c)b.push(Sk.ffi.remapToPy(a[c]));return new Sk.builtin.list(b)}if("object"===typeof a){b=[];for(c in a)b.push(Sk.ffi.remapToPy(c)),b.push(Sk.ffi.remapToPy(a[c]));return new Sk.builtin.dict(b)}if("string"===typeof a)return new Sk.builtin.str(a);if("number"===typeof a)return new Sk.builtin.nmber(a,void 0);if("boolean"===typeof a)return a;goog.asserts.fail("unhandled remap type "+typeof a)};
goog.exportSymbol("Sk.ffi.remapToPy",Sk.ffi.remapToPy);
Sk.ffi.remapToJs=function(a){if(a instanceof Sk.builtin.dict){for(var b={},c=a.tp$iter(),d=c.tp$iternext();void 0!==d;d=c.tp$iternext()){var e=a.mp$subscript(d);void 0===e&&(e=null);d=Sk.ffi.remapToJs(d);b[d]=Sk.ffi.remapToJs(e)}return b}if(a instanceof Sk.builtin.list){b=[];for(c=0;c<a.v.length;++c)b.push(Sk.ffi.remapToJs(a.v[c]));return b}return a instanceof Sk.builtin.nmber?Sk.builtin.asnum$(a):a instanceof Sk.builtin.lng?Sk.builtin.asnum$(a):"number"===typeof a||"boolean"===typeof a?a:a.v};
goog.exportSymbol("Sk.ffi.remapToJs",Sk.ffi.remapToJs);Sk.ffi.callback=function(a){return void 0===a?a:function(){return Sk.misceval.apply(a,void 0,void 0,void 0,Array.prototype.slice.call(arguments,0))}};goog.exportSymbol("Sk.ffi.callback",Sk.ffi.callback);Sk.ffi.stdwrap=function(a,b){var c=new a;c.v=b;return c};goog.exportSymbol("Sk.ffi.stdwrap",Sk.ffi.stdwrap);
Sk.ffi.basicwrap=function(a){if(a instanceof Sk.builtin.nmber)return Sk.builtin.asnum$(a);if(a instanceof Sk.builtin.lng)return Sk.builtin.asnum$(a);if("number"===typeof a||"boolean"===typeof a)return a;if("string"===typeof a)return new Sk.builtin.str(a);goog.asserts.fail("unexpected type for basicwrap")};goog.exportSymbol("Sk.ffi.basicwrap",Sk.ffi.basicwrap);Sk.ffi.unwrapo=function(a){return void 0===a?void 0:a.v};goog.exportSymbol("Sk.ffi.unwrapo",Sk.ffi.unwrapo);
Sk.ffi.unwrapn=function(a){return null===a?null:a.v};goog.exportSymbol("Sk.ffi.unwrapn",Sk.ffi.unwrapn);Sk.builtin.enumerate=function(a,b){if(!(this instanceof Sk.builtin.enumerate))return new Sk.builtin.enumerate(a,b);Sk.builtin.pyCheckArgs("enumerate",arguments,1,2);if(!Sk.builtin.checkIterable(a))throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(a)+"' object is not iterable");if(void 0!==b)if(Sk.misceval.isIndex(b))b=Sk.misceval.asIndex(b);else throw new Sk.builtin.TypeError("'"+Sk.abstr.typeName(b)+"' object cannot be interpreted as an index");else b=0;var c=a.tp$iter();this.tp$iter=function(){return this};
this.$index=b;this.tp$iternext=function(){var a=c.tp$iternext();return void 0===a?void 0:new Sk.builtin.tuple([this.$index++,a])};this.__class__=Sk.builtin.enumerate;return this};Sk.builtin.enumerate.prototype.tp$name="enumerate";Sk.builtin.enumerate.prototype.ob$type=Sk.builtin.type.makeIntoTypeObj("enumerate",Sk.builtin.enumerate);Sk.builtin.enumerate.prototype.tp$getattr=Sk.builtin.object.prototype.GenericGetAttr;Sk.builtin.enumerate.prototype.__iter__=new Sk.builtin.func(function(a){return a.tp$iter()});
Sk.builtin.enumerate.prototype.next=new Sk.builtin.func(function(a){return a.tp$iternext()});Sk.Tokenizer=function(a,b,c){this.filename=a;this.callback=c;this.parenlev=this.lnum=0;this.continued=!1;this.namechars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";this.numchars="0123456789";this.contstr="";this.needcont=!1;this.contline=void 0;this.indents=[0];this.endprog=/.*/;this.strstart=[-1,-1];this.interactive=b;this.doneFunc=function(){for(var a=1;a<this.indents.length;++a)if(this.callback(Sk.Tokenizer.Tokens.T_DEDENT,"",[this.lnum,0],[this.lnum,0],""))return"done";return this.callback(Sk.Tokenizer.Tokens.T_ENDMARKER,
"",[this.lnum,0],[this.lnum,0],"")?"done":"failed"}};
Sk.Tokenizer.Tokens={T_ENDMARKER:0,T_NAME:1,T_NUMBER:2,T_STRING:3,T_NEWLINE:4,T_INDENT:5,T_DEDENT:6,T_LPAR:7,T_RPAR:8,T_LSQB:9,T_RSQB:10,T_COLON:11,T_COMMA:12,T_SEMI:13,T_PLUS:14,T_MINUS:15,T_STAR:16,T_SLASH:17,T_VBAR:18,T_AMPER:19,T_LESS:20,T_GREATER:21,T_EQUAL:22,T_DOT:23,T_PERCENT:24,T_BACKQUOTE:25,T_LBRACE:26,T_RBRACE:27,T_EQEQUAL:28,T_NOTEQUAL:29,T_LESSEQUAL:30,T_GREATEREQUAL:31,T_TILDE:32,T_CIRCUMFLEX:33,T_LEFTSHIFT:34,T_RIGHTSHIFT:35,T_DOUBLESTAR:36,T_PLUSEQUAL:37,T_MINEQUAL:38,T_STAREQUAL:39,
T_SLASHEQUAL:40,T_PERCENTEQUAL:41,T_AMPEREQUAL:42,T_VBAREQUAL:43,T_CIRCUMFLEXEQUAL:44,T_LEFTSHIFTEQUAL:45,T_RIGHTSHIFTEQUAL:46,T_DOUBLESTAREQUAL:47,T_DOUBLESLASH:48,T_DOUBLESLASHEQUAL:49,T_AT:50,T_OP:51,T_COMMENT:52,T_NL:53,T_RARROW:54,T_ERRORTOKEN:55,T_N_TOKENS:56,T_NT_OFFSET:256};function group(a){return"("+Array.prototype.slice.call(arguments).join("|")+")"}function any(a){return group.apply(null,arguments)+"*"}function maybe(a){return group.apply(null,arguments)+"?"}
var Whitespace="[ \\f\\t]*",Comment_="#[^\\r\\n]*",Ident="[a-zA-Z_]\\w*",Binnumber="0[bB][01]*",Hexnumber="0[xX][\\da-fA-F]*[lL]?",Octnumber="0[oO]?[0-7]*[lL]?",Decnumber="[1-9]\\d*[lL]?",Intnumber=group(Binnumber,Hexnumber,Octnumber,Decnumber),Exponent="[eE][-+]?\\d+",Pointfloat=group("\\d+\\.\\d*","\\.\\d+")+maybe(Exponent),Expfloat="\\d+"+Exponent,Floatnumber=group(Pointfloat,Expfloat),Imagnumber=group("\\d+[jJ]",Floatnumber+"[jJ]"),Number_=group(Imagnumber,Floatnumber,Intnumber),Single="^[^'\\\\]*(?:\\\\.[^'\\\\]*)*'",
Double_='^[^"\\\\]*(?:\\\\.[^"\\\\]*)*"',Single3="[^'\\\\]*(?:(?:\\\\.|'(?!''))[^'\\\\]*)*'''",Double3='[^"\\\\]*(?:(?:\\\\.|"(?!""))[^"\\\\]*)*"""',Triple=group("[ubUB]?[rR]?'''",'[ubUB]?[rR]?"""'),String_=group("[uU]?[rR]?'[^\\n'\\\\]*(?:\\\\.[^\\n'\\\\]*)*'",'[uU]?[rR]?"[^\\n"\\\\]*(?:\\\\.[^\\n"\\\\]*)*"'),Operator=group("\\*\\*=?",">>=?","<<=?","<>","!=","//=?","->","[+\\-*/%&|^=<>]=?","~"),Bracket="[\\][(){}]",Special=group("\\r?\\n","[:;.,`@]"),Funny=group(Operator,Bracket,Special),ContStr=
group("[uUbB]?[rR]?'[^\\n'\\\\]*(?:\\\\.[^\\n'\\\\]*)*"+group("'","\\\\\\r?\\n"),'[uUbB]?[rR]?"[^\\n"\\\\]*(?:\\\\.[^\\n"\\\\]*)*'+group('"',"\\\\\\r?\\n")),PseudoExtras=group("\\\\\\r?\\n",Comment_,Triple),PseudoToken="^"+group(PseudoExtras,Number_,Funny,ContStr,Ident),pseudoprog,single3prog,double3prog,endprogs={},triple_quoted={"'''":!0,'"""':!0,"r'''":!0,'r"""':!0,"R'''":!0,'R"""':!0,"u'''":!0,'u"""':!0,"U'''":!0,'U"""':!0,"b'''":!0,'b"""':!0,"B'''":!0,'B"""':!0,"ur'''":!0,'ur"""':!0,"Ur'''":!0,
'Ur"""':!0,"uR'''":!0,'uR"""':!0,"UR'''":!0,'UR"""':!0,"br'''":!0,'br"""':!0,"Br'''":!0,'Br"""':!0,"bR'''":!0,'bR"""':!0,"BR'''":!0,'BR"""':!0},single_quoted={"'":!0,'"':!0,"r'":!0,'r"':!0,"R'":!0,'R"':!0,"u'":!0,'u"':!0,"U'":!0,'U"':!0,"b'":!0,'b"':!0,"B'":!0,'B"':!0,"ur'":!0,'ur"':!0,"Ur'":!0,'Ur"':!0,"uR'":!0,'uR"':!0,"UR'":!0,'UR"':!0,"br'":!0,'br"':!0,"Br'":!0,'Br"':!0,"bR'":!0,'bR"':!0,"BR'":!0,'BR"':!0};(function(){for(var a in triple_quoted);for(a in single_quoted);})();var tabsize=8;
function contains(a,b){for(var c=a.length;c--;)if(a[c]===b)return!0;return!1}function rstrip(a,b){for(var c=a.length;0<c&&-1!==b.indexOf(a.charAt(c-1));--c);return a.substring(0,c)}
Sk.Tokenizer.prototype.generateTokens=function(a){var b,c,d,e,f,g=RegExp(PseudoToken);c=RegExp(Single3,"g");f=RegExp(Double3,"g");var h={"'":RegExp(Single,"g"),'"':RegExp(Double_,"g"),"'''":c,'"""':f,"r'''":c,'r"""':f,"u'''":c,'u"""':f,"b'''":c,'b"""':f,"ur'''":c,'ur"""':f,"br'''":c,'br"""':f,"R'''":c,'R"""':f,"U'''":c,'U"""':f,"B'''":c,'B"""':f,"uR'''":c,'uR"""':f,"Ur'''":c,'Ur"""':f,"UR'''":c,'UR"""':f,"bR'''":c,'bR"""':f,"Br'''":c,'Br"""':f,"BR'''":c,'BR"""':f,r:null,R:null,u:null,U:null,b:null,
B:null};a||(a="");this.lnum+=1;c=0;f=a.length;if(0<this.contstr.length){if(!a)throw new Sk.builtin.TokenError("EOF in multi-line string",this.filename,this.strstart[0],this.strstart[1],this.contline);this.endprog.lastIndex=0;if(b=this.endprog.test(a)){c=e=this.endprog.lastIndex;if(this.callback(Sk.Tokenizer.Tokens.T_STRING,this.contstr+a.substring(0,e),this.strstart,[this.lnum,e],this.contline+a))return"done";this.contstr="";this.needcont=!1;this.contline=void 0}else{if(this.needcont&&"\\\n"!==a.substring(a.length-
2)&&"\\\r\n"!==a.substring(a.length-3)){if(this.callback(Sk.Tokenizer.Tokens.T_ERRORTOKEN,this.contstr+a,this.strstart,[this.lnum,a.length],this.contline))return"done";this.contstr="";this.contline=void 0}else this.contstr+=a,this.contline+=a;return!1}}else if(0!==this.parenlev||this.continued){if(!a)throw new Sk.builtin.TokenError("EOF in multi-line statement",this.filename,this.lnum,0,a);this.continued=!1}else{if(!a)return this.doneFunc();for(d=0;c<f;){if(" "===a.charAt(c))d+=1;else if("\t"===a.charAt(c))d=
(d/tabsize+1)*tabsize;else if("\f"===a.charAt(c))d=0;else break;c+=1}if(c===f)return this.doneFunc();if(-1!=="#\r\n".indexOf(a.charAt(c))){if("#"===a.charAt(c))return g=rstrip(a.substring(c),"\r\n"),f=c+g.length,this.callback(Sk.Tokenizer.Tokens.T_COMMENT,g,[this.lnum,c],[this.lnum,c+g.length],a)||this.callback(Sk.Tokenizer.Tokens.T_NL,a.substring(f),[this.lnum,f],[this.lnum,a.length],a)?"done":!1;if(this.callback(Sk.Tokenizer.Tokens.T_NL,a.substring(c),[this.lnum,c],[this.lnum,a.length],a))return"done";
if(!this.interactive)return!1}if(d>this.indents[this.indents.length-1]&&(this.indents.push(d),this.callback(Sk.Tokenizer.Tokens.T_INDENT,a.substring(0,c),[this.lnum,0],[this.lnum,c],a)))return"done";for(;d<this.indents[this.indents.length-1];){if(!contains(this.indents,d))throw new Sk.builtin.IndentationError("unindent does not match any outer indentation level",this.filename,this.lnum,c,a);this.indents.splice(this.indents.length-1,1);if(this.callback(Sk.Tokenizer.Tokens.T_DEDENT,"",[this.lnum,c],
[this.lnum,c],a))return"done"}}for(;c<f;){for(d=a.charAt(c);" "===d||"\f"===d||"\t"===d;)c+=1,d=a.charAt(c);g.lastIndex=0;var k=g.exec(a.substring(c));if(k){d=c;e=d+k[1].length;k=[this.lnum,d];b=[this.lnum,e];c=e;e=a.substring(d,e);var l=a.charAt(d);if(-1!==this.numchars.indexOf(l)||"."===l&&"."!==e){if(this.callback(Sk.Tokenizer.Tokens.T_NUMBER,e,k,b,a))return"done"}else if("\r"===l||"\n"===l){if(d=Sk.Tokenizer.Tokens.T_NEWLINE,0<this.parenlev&&(d=Sk.Tokenizer.Tokens.T_NL),this.callback(d,e,k,b,
a))return"done"}else if("#"===l){if(this.callback(Sk.Tokenizer.Tokens.T_COMMENT,e,k,b,a))return"done"}else if(triple_quoted.hasOwnProperty(e))if(this.endprog=h[e],this.endprog.lastIndex=0,b=this.endprog.test(a.substring(c))){if(c=this.endprog.lastIndex+c,e=a.substring(d,c),this.callback(Sk.Tokenizer.Tokens.T_STRING,e,k,[this.lnum,c],a))return"done"}else{this.strstart=[this.lnum,d];this.contstr=a.substring(d);this.contline=a;break}else if(single_quoted.hasOwnProperty(l)||single_quoted.hasOwnProperty(e.substring(0,
2))||single_quoted.hasOwnProperty(e.substring(0,3)))if("\n"===e[e.length-1]){this.strstart=[this.lnum,d];this.endprog=h[l]||h[e[1]]||h[e[2]];this.contstr=a.substring(d);this.needcont=!0;this.contline=a;break}else{if(this.callback(Sk.Tokenizer.Tokens.T_STRING,e,k,b,a))return"done"}else if(-1!==this.namechars.indexOf(l)){if(this.callback(Sk.Tokenizer.Tokens.T_NAME,e,k,b,a))return"done"}else if("\\"===l){if(this.callback(Sk.Tokenizer.Tokens.T_NL,e,k,[this.lnum,c],a))return"done";this.continued=!0}else if(-1!==
"([{".indexOf(l)?this.parenlev+=1:-1!==")]}".indexOf(l)&&(this.parenlev-=1),this.callback(Sk.Tokenizer.Tokens.T_OP,e,k,b,a))return"done"}else{if(this.callback(Sk.Tokenizer.Tokens.T_ERRORTOKEN,a.charAt(c),[this.lnum,c],[this.lnum,c+1],a))return"done";c+=1}}return!1};
Sk.Tokenizer.tokenNames={0:"T_ENDMARKER",1:"T_NAME",2:"T_NUMBER",3:"T_STRING",4:"T_NEWLINE",5:"T_INDENT",6:"T_DEDENT",7:"T_LPAR",8:"T_RPAR",9:"T_LSQB",10:"T_RSQB",11:"T_COLON",12:"T_COMMA",13:"T_SEMI",14:"T_PLUS",15:"T_MINUS",16:"T_STAR",17:"T_SLASH",18:"T_VBAR",19:"T_AMPER",20:"T_LESS",21:"T_GREATER",22:"T_EQUAL",23:"T_DOT",24:"T_PERCENT",25:"T_BACKQUOTE",26:"T_LBRACE",27:"T_RBRACE",28:"T_EQEQUAL",29:"T_NOTEQUAL",30:"T_LESSEQUAL",31:"T_GREATEREQUAL",32:"T_TILDE",33:"T_CIRCUMFLEX",34:"T_LEFTSHIFT",
35:"T_RIGHTSHIFT",36:"T_DOUBLESTAR",37:"T_PLUSEQUAL",38:"T_MINEQUAL",39:"T_STAREQUAL",40:"T_SLASHEQUAL",41:"T_PERCENTEQUAL",42:"T_AMPEREQUAL",43:"T_VBAREQUAL",44:"T_CIRCUMFLEXEQUAL",45:"T_LEFTSHIFTEQUAL",46:"T_RIGHTSHIFTEQUAL",47:"T_DOUBLESTAREQUAL",48:"T_DOUBLESLASH",49:"T_DOUBLESLASHEQUAL",50:"T_AT",51:"T_OP",52:"T_COMMENT",53:"T_NL",54:"T_RARROW",55:"T_ERRORTOKEN",56:"T_N_TOKENS",256:"T_NT_OFFSET"};goog.exportSymbol("Sk.Tokenizer",Sk.Tokenizer);
goog.exportSymbol("Sk.Tokenizer.prototype.generateTokens",Sk.Tokenizer.prototype.generateTokens);goog.exportSymbol("Sk.Tokenizer.tokenNames",Sk.Tokenizer.tokenNames);Sk.OpMap={"(":Sk.Tokenizer.Tokens.T_LPAR,")":Sk.Tokenizer.Tokens.T_RPAR,"[":Sk.Tokenizer.Tokens.T_LSQB,"]":Sk.Tokenizer.Tokens.T_RSQB,":":Sk.Tokenizer.Tokens.T_COLON,",":Sk.Tokenizer.Tokens.T_COMMA,";":Sk.Tokenizer.Tokens.T_SEMI,"+":Sk.Tokenizer.Tokens.T_PLUS,"-":Sk.Tokenizer.Tokens.T_MINUS,"*":Sk.Tokenizer.Tokens.T_STAR,"/":Sk.Tokenizer.Tokens.T_SLASH,"|":Sk.Tokenizer.Tokens.T_VBAR,"&":Sk.Tokenizer.Tokens.T_AMPER,"<":Sk.Tokenizer.Tokens.T_LESS,">":Sk.Tokenizer.Tokens.T_GREATER,"=":Sk.Tokenizer.Tokens.T_EQUAL,
".":Sk.Tokenizer.Tokens.T_DOT,"%":Sk.Tokenizer.Tokens.T_PERCENT,"`":Sk.Tokenizer.Tokens.T_BACKQUOTE,"{":Sk.Tokenizer.Tokens.T_LBRACE,"}":Sk.Tokenizer.Tokens.T_RBRACE,"@":Sk.Tokenizer.Tokens.T_AT,"==":Sk.Tokenizer.Tokens.T_EQEQUAL,"!=":Sk.Tokenizer.Tokens.T_NOTEQUAL,"<>":Sk.Tokenizer.Tokens.T_NOTEQUAL,"<=":Sk.Tokenizer.Tokens.T_LESSEQUAL,">=":Sk.Tokenizer.Tokens.T_GREATEREQUAL,"~":Sk.Tokenizer.Tokens.T_TILDE,"^":Sk.Tokenizer.Tokens.T_CIRCUMFLEX,"<<":Sk.Tokenizer.Tokens.T_LEFTSHIFT,">>":Sk.Tokenizer.Tokens.T_RIGHTSHIFT,
"**":Sk.Tokenizer.Tokens.T_DOUBLESTAR,"+=":Sk.Tokenizer.Tokens.T_PLUSEQUAL,"-=":Sk.Tokenizer.Tokens.T_MINEQUAL,"*=":Sk.Tokenizer.Tokens.T_STAREQUAL,"/=":Sk.Tokenizer.Tokens.T_SLASHEQUAL,"%=":Sk.Tokenizer.Tokens.T_PERCENTEQUAL,"&=":Sk.Tokenizer.Tokens.T_AMPEREQUAL,"|=":Sk.Tokenizer.Tokens.T_VBAREQUAL,"^=":Sk.Tokenizer.Tokens.T_CIRCUMFLEXEQUAL,"<<=":Sk.Tokenizer.Tokens.T_LEFTSHIFTEQUAL,">>=":Sk.Tokenizer.Tokens.T_RIGHTSHIFTEQUAL,"**=":Sk.Tokenizer.Tokens.T_DOUBLESTAREQUAL,"//":Sk.Tokenizer.Tokens.T_DOUBLESLASH,
"//=":Sk.Tokenizer.Tokens.T_DOUBLESLASHEQUAL,"->":Sk.Tokenizer.Tokens.T_RARROW};
Sk.ParseTables={sym:{and_expr:257,and_test:258,arglist:259,argument:260,arith_expr:261,assert_stmt:262,atom:263,augassign:264,break_stmt:265,classdef:266,comp_op:267,comparison:268,compound_stmt:269,continue_stmt:270,decorated:271,decorator:272,decorators:273,del_stmt:274,dictmaker:275,dotted_as_name:276,dotted_as_names:277,dotted_name:278,encoding_decl:279,eval_input:280,except_clause:281,exec_stmt:282,expr:283,expr_stmt:284,exprlist:285,factor:286,file_input:287,flow_stmt:288,for_stmt:289,fpdef:290,
fplist:291,funcdef:292,gen_for:293,gen_if:294,gen_iter:295,global_stmt:296,if_stmt:297,import_as_name:298,import_as_names:299,import_from:300,import_name:301,import_stmt:302,lambdef:303,list_for:304,list_if:305,list_iter:306,listmaker:307,not_test:308,old_lambdef:309,old_test:310,or_test:311,parameters:312,pass_stmt:313,power:314,print_stmt:315,raise_stmt:316,return_stmt:317,shift_expr:318,simple_stmt:319,single_input:256,sliceop:320,small_stmt:321,stmt:322,subscript:323,subscriptlist:324,suite:325,
term:326,test:327,testlist:328,testlist1:329,testlist_gexp:330,testlist_safe:331,trailer:332,try_stmt:333,varargslist:334,while_stmt:335,with_stmt:336,with_var:337,xor_expr:338,yield_expr:339,yield_stmt:340},number2symbol:{256:"single_input",257:"and_expr",258:"and_test",259:"arglist",260:"argument",261:"arith_expr",262:"assert_stmt",263:"atom",264:"augassign",265:"break_stmt",266:"classdef",267:"comp_op",268:"comparison",269:"compound_stmt",270:"continue_stmt",271:"decorated",272:"decorator",273:"decorators",
274:"del_stmt",275:"dictmaker",276:"dotted_as_name",277:"dotted_as_names",278:"dotted_name",279:"encoding_decl",280:"eval_input",281:"except_clause",282:"exec_stmt",283:"expr",284:"expr_stmt",285:"exprlist",286:"factor",287:"file_input",288:"flow_stmt",289:"for_stmt",290:"fpdef",291:"fplist",292:"funcdef",293:"gen_for",294:"gen_if",295:"gen_iter",296:"global_stmt",297:"if_stmt",298:"import_as_name",299:"import_as_names",300:"import_from",301:"import_name",302:"import_stmt",303:"lambdef",304:"list_for",
305:"list_if",306:"list_iter",307:"listmaker",308:"not_test",309:"old_lambdef",310:"old_test",311:"or_test",312:"parameters",313:"pass_stmt",314:"power",315:"print_stmt",316:"raise_stmt",317:"return_stmt",318:"shift_expr",319:"simple_stmt",320:"sliceop",321:"small_stmt",322:"stmt",323:"subscript",324:"subscriptlist",325:"suite",326:"term",327:"test",328:"testlist",329:"testlist1",330:"testlist_gexp",331:"testlist_safe",332:"trailer",333:"try_stmt",334:"varargslist",335:"while_stmt",336:"with_stmt",
337:"with_var",338:"xor_expr",339:"yield_expr",340:"yield_stmt"},dfas:{256:[[[[1,1],[2,1],[3,2]],[[0,1]],[[2,1]]],{2:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1,11:1,12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,21:1,22:1,23:1,24:1,25:1,26:1,27:1,28:1,29:1,30:1,31:1,32:1,33:1,34:1,35:1,36:1}],257:[[[[37,1]],[[38,0],[0,1]]],{6:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],258:[[[[39,1]],[[40,0],[0,1]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],259:[[[[41,1],[42,2],[43,3]],[[44,4]],[[45,5],[0,2]],[[44,
6]],[[45,7],[0,4]],[[41,1],[42,2],[43,3],[0,5]],[[0,6]],[[42,4],[43,3]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1,41:1,43:1}],260:[[[[44,1]],[[46,2],[47,3],[0,1]],[[0,2]],[[44,2]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],261:[[[[48,1]],[[24,0],[35,0],[0,1]]],{6:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],262:[[[[19,1]],[[44,2]],[[45,3],[0,2]],[[44,4]],[[0,4]]],{19:1}],263:[[[[17,1],[8,2],[9,5],[28,4],[11,3],[13,6],[20,2]],[[17,1],[0,1]],[[0,2]],[[49,7],[50,2]],
[[51,2],[52,8],[53,8]],[[54,9],[55,2]],[[56,10]],[[50,2]],[[51,2]],[[55,2]],[[13,2]]],{8:1,9:1,11:1,13:1,17:1,20:1,28:1}],264:[[[[57,1],[58,1],[59,1],[60,1],[61,1],[62,1],[63,1],[64,1],[65,1],[66,1],[67,1],[68,1]],[[0,1]]],{57:1,58:1,59:1,60:1,61:1,62:1,63:1,64:1,65:1,66:1,67:1,68:1}],265:[[[[31,1]],[[0,1]]],{31:1}],266:[[[[10,1]],[[20,2]],[[69,3],[28,4]],[[70,5]],[[51,6],[71,7]],[[0,5]],[[69,3]],[[51,6]]],{10:1}],267:[[[[72,1],[73,1],[7,2],[74,1],[72,1],[75,1],[76,1],[77,3],[78,1],[79,1]],[[0,1]],
[[75,1]],[[7,1],[0,3]]],{7:1,72:1,73:1,74:1,75:1,76:1,77:1,78:1,79:1}],268:[[[[80,1]],[[81,0],[0,1]]],{6:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],269:[[[[82,1],[83,1],[84,1],[85,1],[86,1],[87,1],[88,1],[89,1]],[[0,1]]],{4:1,10:1,14:1,16:1,27:1,30:1,33:1,34:1}],270:[[[[32,1]],[[0,1]]],{32:1}],271:[[[[90,1]],[[88,2],[85,2]],[[0,2]]],{33:1}],272:[[[[33,1]],[[91,2]],[[28,4],[2,3]],[[0,3]],[[51,5],[92,6]],[[2,3]],[[51,5]]],{33:1}],273:[[[[93,1]],[[93,1],[0,1]]],{33:1}],274:[[[[21,1]],[[94,2]],[[0,
2]]],{21:1}],275:[[[[44,1]],[[69,2]],[[44,3]],[[45,4],[0,3]],[[44,1],[0,4]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],276:[[[[91,1]],[[95,2],[0,1]],[[20,3]],[[0,3]]],{20:1}],277:[[[[96,1]],[[45,0],[0,1]]],{20:1}],278:[[[[20,1]],[[97,0],[0,1]]],{20:1}],279:[[[[20,1]],[[0,1]]],{20:1}],280:[[[[71,1]],[[2,1],[98,2]],[[0,2]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],281:[[[[99,1]],[[44,2],[0,1]],[[95,3],[45,3],[0,2]],[[44,4]],[[0,4]]],{99:1}],282:[[[[15,1]],[[80,2]],
[[75,3],[0,2]],[[44,4]],[[45,5],[0,4]],[[44,6]],[[0,6]]],{15:1}],283:[[[[100,1]],[[101,0],[0,1]]],{6:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],284:[[[[71,1]],[[102,2],[47,3],[0,1]],[[71,4],[53,4]],[[71,5],[53,5]],[[0,4]],[[47,3],[0,5]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],285:[[[[80,1]],[[45,2],[0,1]],[[80,1],[0,2]]],{6:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],286:[[[[103,2],[24,1],[6,1],[35,1]],[[104,2]],[[0,2]]],{6:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],
287:[[[[2,0],[98,1],[105,0]],[[0,1]]],{2:1,4:1,5:1,6:1,7:1,8:1,9:1,10:1,11:1,12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,21:1,22:1,23:1,24:1,25:1,26:1,27:1,28:1,29:1,30:1,31:1,32:1,33:1,34:1,35:1,36:1,98:1}],288:[[[[106,1],[107,1],[108,1],[109,1],[110,1]],[[0,1]]],{5:1,18:1,25:1,31:1,32:1}],289:[[[[27,1]],[[94,2]],[[75,3]],[[71,4]],[[69,5]],[[70,6]],[[111,7],[0,6]],[[69,8]],[[70,9]],[[0,9]]],{27:1}],290:[[[[28,1],[20,2]],[[112,3]],[[0,2]],[[51,2]]],{20:1,28:1}],291:[[[[113,1]],[[45,2],[0,1]],[[113,
1],[0,2]]],{20:1,28:1}],292:[[[[4,1]],[[20,2]],[[114,3]],[[69,4]],[[70,5]],[[0,5]]],{4:1}],293:[[[[27,1]],[[94,2]],[[75,3]],[[115,4]],[[116,5],[0,4]],[[0,5]]],{27:1}],294:[[[[30,1]],[[117,2]],[[116,3],[0,2]],[[0,3]]],{30:1}],295:[[[[46,1],[118,1]],[[0,1]]],{27:1,30:1}],296:[[[[26,1]],[[20,2]],[[45,1],[0,2]]],{26:1}],297:[[[[30,1]],[[44,2]],[[69,3]],[[70,4]],[[111,5],[119,1],[0,4]],[[69,6]],[[70,7]],[[0,7]]],{30:1}],298:[[[[20,1]],[[95,2],[0,1]],[[20,3]],[[0,3]]],{20:1}],299:[[[[120,1]],[[45,2],[0,
1]],[[120,1],[0,2]]],{20:1}],300:[[[[29,1]],[[91,2],[97,3]],[[23,4]],[[91,2],[23,4],[97,3]],[[121,5],[41,5],[28,6]],[[0,5]],[[121,7]],[[51,5]]],{29:1}],301:[[[[23,1]],[[122,2]],[[0,2]]],{23:1}],302:[[[[123,1],[124,1]],[[0,1]]],{23:1,29:1}],303:[[[[36,1]],[[69,2],[125,3]],[[44,4]],[[69,2]],[[0,4]]],{36:1}],304:[[[[27,1]],[[94,2]],[[75,3]],[[126,4]],[[127,5],[0,4]],[[0,5]]],{27:1}],305:[[[[30,1]],[[117,2]],[[127,3],[0,2]],[[0,3]]],{30:1}],306:[[[[128,1],[129,1]],[[0,1]]],{27:1,30:1}],307:[[[[44,1]],
[[128,2],[45,3],[0,1]],[[0,2]],[[44,4],[0,3]],[[45,3],[0,4]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],308:[[[[7,1],[130,2]],[[39,2]],[[0,2]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],309:[[[[36,1]],[[69,2],[125,3]],[[117,4]],[[69,2]],[[0,4]]],{36:1}],310:[[[[131,1],[115,1]],[[0,1]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],311:[[[[132,1]],[[133,0],[0,1]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],312:[[[[28,1]],[[51,2],[125,3]],[[0,2]],
[[51,2]]],{28:1}],313:[[[[22,1]],[[0,1]]],{22:1}],314:[[[[134,1]],[[135,1],[43,2],[0,1]],[[104,3]],[[0,3]]],{8:1,9:1,11:1,13:1,17:1,20:1,28:1}],315:[[[[12,1]],[[44,2],[136,3],[0,1]],[[45,4],[0,2]],[[44,5]],[[44,2],[0,4]],[[45,6],[0,5]],[[44,7]],[[45,8],[0,7]],[[44,7],[0,8]]],{12:1}],316:[[[[5,1]],[[44,2],[0,1]],[[45,3],[0,2]],[[44,4]],[[45,5],[0,4]],[[44,6]],[[0,6]]],{5:1}],317:[[[[18,1]],[[71,2],[0,1]],[[0,2]]],{18:1}],318:[[[[137,1]],[[136,0],[138,0],[0,1]]],{6:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,
28:1,35:1}],319:[[[[139,1]],[[2,2],[140,3]],[[0,2]],[[139,1],[2,2]]],{5:1,6:1,7:1,8:1,9:1,11:1,12:1,13:1,15:1,17:1,18:1,19:1,20:1,21:1,22:1,23:1,24:1,25:1,26:1,28:1,29:1,31:1,32:1,35:1,36:1}],320:[[[[69,1]],[[44,2],[0,1]],[[0,2]]],{69:1}],321:[[[[141,1],[142,1],[143,1],[144,1],[145,1],[146,1],[147,1],[148,1],[149,1]],[[0,1]]],{5:1,6:1,7:1,8:1,9:1,11:1,12:1,13:1,15:1,17:1,18:1,19:1,20:1,21:1,22:1,23:1,24:1,25:1,26:1,28:1,29:1,31:1,32:1,35:1,36:1}],322:[[[[1,1],[3,1]],[[0,1]]],{4:1,5:1,6:1,7:1,8:1,
9:1,10:1,11:1,12:1,13:1,14:1,15:1,16:1,17:1,18:1,19:1,20:1,21:1,22:1,23:1,24:1,25:1,26:1,27:1,28:1,29:1,30:1,31:1,32:1,33:1,34:1,35:1,36:1}],323:[[[[44,1],[69,2],[97,3]],[[69,2],[0,1]],[[44,4],[150,5],[0,2]],[[97,6]],[[150,5],[0,4]],[[0,5]],[[97,5]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1,69:1,97:1}],324:[[[[151,1]],[[45,2],[0,1]],[[151,1],[0,2]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1,69:1,97:1}],325:[[[[1,1],[2,2]],[[0,1]],[[152,3]],[[105,4]],[[153,1],[105,4]]],
{2:1,5:1,6:1,7:1,8:1,9:1,11:1,12:1,13:1,15:1,17:1,18:1,19:1,20:1,21:1,22:1,23:1,24:1,25:1,26:1,28:1,29:1,31:1,32:1,35:1,36:1}],326:[[[[104,1]],[[154,0],[41,0],[155,0],[156,0],[0,1]]],{6:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],327:[[[[115,1],[157,2]],[[30,3],[0,1]],[[0,2]],[[115,4]],[[111,5]],[[44,2]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],328:[[[[44,1]],[[45,2],[0,1]],[[44,1],[0,2]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],329:[[[[44,1]],[[45,0],[0,1]]],
{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],330:[[[[44,1]],[[46,2],[45,3],[0,1]],[[0,2]],[[44,4],[0,3]],[[45,3],[0,4]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],331:[[[[117,1]],[[45,2],[0,1]],[[117,3]],[[45,4],[0,3]],[[117,3],[0,4]]],{6:1,7:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1,36:1}],332:[[[[28,1],[97,2],[11,3]],[[51,4],[92,5]],[[20,4]],[[158,6]],[[0,4]],[[51,4]],[[50,4]]],{11:1,28:1,97:1}],333:[[[[14,1]],[[69,2]],[[70,3]],[[159,4],[160,5]],[[69,6]],[[69,7]],
[[70,8]],[[70,9]],[[159,4],[111,10],[160,5],[0,8]],[[0,9]],[[69,11]],[[70,12]],[[160,5],[0,12]]],{14:1}],334:[[[[41,1],[113,2],[43,3]],[[20,4]],[[47,5],[45,6],[0,2]],[[20,7]],[[45,8],[0,4]],[[44,9]],[[41,1],[113,2],[43,3],[0,6]],[[0,7]],[[43,3]],[[45,6],[0,9]]],{20:1,28:1,41:1,43:1}],335:[[[[16,1]],[[44,2]],[[69,3]],[[70,4]],[[111,5],[0,4]],[[69,6]],[[70,7]],[[0,7]]],{16:1}],336:[[[[34,1]],[[44,2]],[[69,3],[161,4]],[[70,5]],[[69,3]],[[0,5]]],{34:1}],337:[[[[95,1]],[[80,2]],[[0,2]]],{95:1}],338:[[[[162,
1]],[[163,0],[0,1]]],{6:1,8:1,9:1,11:1,13:1,17:1,20:1,24:1,28:1,35:1}],339:[[[[25,1]],[[71,2],[0,1]],[[0,2]]],{25:1}],340:[[[[53,1]],[[0,1]]],{25:1}]},states:[[[[1,1],[2,1],[3,2]],[[0,1]],[[2,1]]],[[[37,1]],[[38,0],[0,1]]],[[[39,1]],[[40,0],[0,1]]],[[[41,1],[42,2],[43,3]],[[44,4]],[[45,5],[0,2]],[[44,6]],[[45,7],[0,4]],[[41,1],[42,2],[43,3],[0,5]],[[0,6]],[[42,4],[43,3]]],[[[44,1]],[[46,2],[47,3],[0,1]],[[0,2]],[[44,2]]],[[[48,1]],[[24,0],[35,0],[0,1]]],[[[19,1]],[[44,2]],[[45,3],[0,2]],[[44,4]],
[[0,4]]],[[[17,1],[8,2],[9,5],[28,4],[11,3],[13,6],[20,2]],[[17,1],[0,1]],[[0,2]],[[49,7],[50,2]],[[51,2],[52,8],[53,8]],[[54,9],[55,2]],[[56,10]],[[50,2]],[[51,2]],[[55,2]],[[13,2]]],[[[57,1],[58,1],[59,1],[60,1],[61,1],[62,1],[63,1],[64,1],[65,1],[66,1],[67,1],[68,1]],[[0,1]]],[[[31,1]],[[0,1]]],[[[10,1]],[[20,2]],[[69,3],[28,4]],[[70,5]],[[51,6],[71,7]],[[0,5]],[[69,3]],[[51,6]]],[[[72,1],[73,1],[7,2],[74,1],[72,1],[75,1],[76,1],[77,3],[78,1],[79,1]],[[0,1]],[[75,1]],[[7,1],[0,3]]],[[[80,1]],[[81,
0],[0,1]]],[[[82,1],[83,1],[84,1],[85,1],[86,1],[87,1],[88,1],[89,1]],[[0,1]]],[[[32,1]],[[0,1]]],[[[90,1]],[[88,2],[85,2]],[[0,2]]],[[[33,1]],[[91,2]],[[28,4],[2,3]],[[0,3]],[[51,5],[92,6]],[[2,3]],[[51,5]]],[[[93,1]],[[93,1],[0,1]]],[[[21,1]],[[94,2]],[[0,2]]],[[[44,1]],[[69,2]],[[44,3]],[[45,4],[0,3]],[[44,1],[0,4]]],[[[91,1]],[[95,2],[0,1]],[[20,3]],[[0,3]]],[[[96,1]],[[45,0],[0,1]]],[[[20,1]],[[97,0],[0,1]]],[[[20,1]],[[0,1]]],[[[71,1]],[[2,1],[98,2]],[[0,2]]],[[[99,1]],[[44,2],[0,1]],[[95,3],
[45,3],[0,2]],[[44,4]],[[0,4]]],[[[15,1]],[[80,2]],[[75,3],[0,2]],[[44,4]],[[45,5],[0,4]],[[44,6]],[[0,6]]],[[[100,1]],[[101,0],[0,1]]],[[[71,1]],[[102,2],[47,3],[0,1]],[[71,4],[53,4]],[[71,5],[53,5]],[[0,4]],[[47,3],[0,5]]],[[[80,1]],[[45,2],[0,1]],[[80,1],[0,2]]],[[[103,2],[24,1],[6,1],[35,1]],[[104,2]],[[0,2]]],[[[2,0],[98,1],[105,0]],[[0,1]]],[[[106,1],[107,1],[108,1],[109,1],[110,1]],[[0,1]]],[[[27,1]],[[94,2]],[[75,3]],[[71,4]],[[69,5]],[[70,6]],[[111,7],[0,6]],[[69,8]],[[70,9]],[[0,9]]],[[[28,
1],[20,2]],[[112,3]],[[0,2]],[[51,2]]],[[[113,1]],[[45,2],[0,1]],[[113,1],[0,2]]],[[[4,1]],[[20,2]],[[114,3]],[[69,4]],[[70,5]],[[0,5]]],[[[27,1]],[[94,2]],[[75,3]],[[115,4]],[[116,5],[0,4]],[[0,5]]],[[[30,1]],[[117,2]],[[116,3],[0,2]],[[0,3]]],[[[46,1],[118,1]],[[0,1]]],[[[26,1]],[[20,2]],[[45,1],[0,2]]],[[[30,1]],[[44,2]],[[69,3]],[[70,4]],[[111,5],[119,1],[0,4]],[[69,6]],[[70,7]],[[0,7]]],[[[20,1]],[[95,2],[0,1]],[[20,3]],[[0,3]]],[[[120,1]],[[45,2],[0,1]],[[120,1],[0,2]]],[[[29,1]],[[91,2],[97,
3]],[[23,4]],[[91,2],[23,4],[97,3]],[[121,5],[41,5],[28,6]],[[0,5]],[[121,7]],[[51,5]]],[[[23,1]],[[122,2]],[[0,2]]],[[[123,1],[124,1]],[[0,1]]],[[[36,1]],[[69,2],[125,3]],[[44,4]],[[69,2]],[[0,4]]],[[[27,1]],[[94,2]],[[75,3]],[[126,4]],[[127,5],[0,4]],[[0,5]]],[[[30,1]],[[117,2]],[[127,3],[0,2]],[[0,3]]],[[[128,1],[129,1]],[[0,1]]],[[[44,1]],[[128,2],[45,3],[0,1]],[[0,2]],[[44,4],[0,3]],[[45,3],[0,4]]],[[[7,1],[130,2]],[[39,2]],[[0,2]]],[[[36,1]],[[69,2],[125,3]],[[117,4]],[[69,2]],[[0,4]]],[[[131,
1],[115,1]],[[0,1]]],[[[132,1]],[[133,0],[0,1]]],[[[28,1]],[[51,2],[125,3]],[[0,2]],[[51,2]]],[[[22,1]],[[0,1]]],[[[134,1]],[[135,1],[43,2],[0,1]],[[104,3]],[[0,3]]],[[[12,1]],[[44,2],[136,3],[0,1]],[[45,4],[0,2]],[[44,5]],[[44,2],[0,4]],[[45,6],[0,5]],[[44,7]],[[45,8],[0,7]],[[44,7],[0,8]]],[[[5,1]],[[44,2],[0,1]],[[45,3],[0,2]],[[44,4]],[[45,5],[0,4]],[[44,6]],[[0,6]]],[[[18,1]],[[71,2],[0,1]],[[0,2]]],[[[137,1]],[[136,0],[138,0],[0,1]]],[[[139,1]],[[2,2],[140,3]],[[0,2]],[[139,1],[2,2]]],[[[69,
1]],[[44,2],[0,1]],[[0,2]]],[[[141,1],[142,1],[143,1],[144,1],[145,1],[146,1],[147,1],[148,1],[149,1]],[[0,1]]],[[[1,1],[3,1]],[[0,1]]],[[[44,1],[69,2],[97,3]],[[69,2],[0,1]],[[44,4],[150,5],[0,2]],[[97,6]],[[150,5],[0,4]],[[0,5]],[[97,5]]],[[[151,1]],[[45,2],[0,1]],[[151,1],[0,2]]],[[[1,1],[2,2]],[[0,1]],[[152,3]],[[105,4]],[[153,1],[105,4]]],[[[104,1]],[[154,0],[41,0],[155,0],[156,0],[0,1]]],[[[115,1],[157,2]],[[30,3],[0,1]],[[0,2]],[[115,4]],[[111,5]],[[44,2]]],[[[44,1]],[[45,2],[0,1]],[[44,1],
[0,2]]],[[[44,1]],[[45,0],[0,1]]],[[[44,1]],[[46,2],[45,3],[0,1]],[[0,2]],[[44,4],[0,3]],[[45,3],[0,4]]],[[[117,1]],[[45,2],[0,1]],[[117,3]],[[45,4],[0,3]],[[117,3],[0,4]]],[[[28,1],[97,2],[11,3]],[[51,4],[92,5]],[[20,4]],[[158,6]],[[0,4]],[[51,4]],[[50,4]]],[[[14,1]],[[69,2]],[[70,3]],[[159,4],[160,5]],[[69,6]],[[69,7]],[[70,8]],[[70,9]],[[159,4],[111,10],[160,5],[0,8]],[[0,9]],[[69,11]],[[70,12]],[[160,5],[0,12]]],[[[41,1],[113,2],[43,3]],[[20,4]],[[47,5],[45,6],[0,2]],[[20,7]],[[45,8],[0,4]],[[44,
9]],[[41,1],[113,2],[43,3],[0,6]],[[0,7]],[[43,3]],[[45,6],[0,9]]],[[[16,1]],[[44,2]],[[69,3]],[[70,4]],[[111,5],[0,4]],[[69,6]],[[70,7]],[[0,7]]],[[[34,1]],[[44,2]],[[69,3],[161,4]],[[70,5]],[[69,3]],[[0,5]]],[[[95,1]],[[80,2]],[[0,2]]],[[[162,1]],[[163,0],[0,1]]],[[[25,1]],[[71,2],[0,1]],[[0,2]]],[[[53,1]],[[0,1]]]],labels:[[0,"EMPTY"],[319,null],[4,null],[269,null],[1,"def"],[1,"raise"],[32,null],[1,"not"],[2,null],[26,null],[1,"class"],[9,null],[1,"print"],[25,null],[1,"try"],[1,"exec"],[1,"while"],
[3,null],[1,"return"],[1,"assert"],[1,null],[1,"del"],[1,"pass"],[1,"import"],[15,null],[1,"yield"],[1,"global"],[1,"for"],[7,null],[1,"from"],[1,"if"],[1,"break"],[1,"continue"],[50,null],[1,"with"],[14,null],[1,"lambda"],[318,null],[19,null],[308,null],[1,"and"],[16,null],[260,null],[36,null],[327,null],[12,null],[293,null],[22,null],[326,null],[307,null],[10,null],[8,null],[330,null],[339,null],[275,null],[27,null],[329,null],[46,null],[39,null],[41,null],[47,null],[42,null],[43,null],[37,null],
[44,null],[49,null],[40,null],[38,null],[45,null],[11,null],[325,null],[328,null],[29,null],[21,null],[28,null],[1,"in"],[30,null],[1,"is"],[31,null],[20,null],[283,null],[267,null],[333,null],[297,null],[289,null],[266,null],[336,null],[335,null],[292,null],[271,null],[273,null],[278,null],[259,null],[272,null],[285,null],[1,"as"],[276,null],[23,null],[0,null],[1,"except"],[338,null],[18,null],[264,null],[314,null],[286,null],[322,null],[265,null],[270,null],[316,null],[317,null],[340,null],[1,"else"],
[291,null],[290,null],[312,null],[311,null],[295,null],[310,null],[294,null],[1,"elif"],[298,null],[299,null],[277,null],[301,null],[300,null],[334,null],[331,null],[306,null],[304,null],[305,null],[268,null],[309,null],[258,null],[1,"or"],[263,null],[332,null],[35,null],[261,null],[34,null],[321,null],[13,null],[288,null],[262,null],[284,null],[313,null],[315,null],[274,null],[282,null],[296,null],[302,null],[320,null],[323,null],[5,null],[6,null],[48,null],[17,null],[24,null],[303,null],[324,null],
[281,null],[1,"finally"],[337,null],[257,null],[33,null]],keywords:{and:40,as:95,assert:19,"break":31,"class":10,"continue":32,def:4,del:21,elif:119,"else":111,except:99,exec:15,"finally":160,"for":27,from:29,global:26,"if":30,"import":23,"in":75,is:77,lambda:36,not:7,or:133,pass:22,print:12,raise:5,"return":18,"try":14,"while":16,"with":34,yield:25},tokens:{0:98,1:20,2:8,3:17,4:2,5:152,6:153,7:28,8:51,9:11,10:50,11:69,12:45,13:140,14:35,15:24,16:41,17:155,18:101,19:38,20:79,21:73,22:47,23:97,24:156,
25:13,26:9,27:55,28:74,29:72,30:76,31:78,32:6,33:163,34:138,35:136,36:43,37:63,38:67,39:58,40:66,41:59,42:61,43:62,44:64,45:68,46:57,47:60,48:154,49:65,50:33},start:256};function Parser(a,b){this.filename=a;this.grammar=b;return this}Parser.prototype.setup=function(a){a=a||this.grammar.start;this.stack=[{dfa:this.grammar.dfas[a],state:0,node:{type:a,value:null,context:null,children:[]}}];this.used_names={}};function findInDfa(a,b){for(var c=a.length;c--;)if(a[c][0]===b[0]&&a[c][1]===b[1])return!0;return!1}
Parser.prototype.addtoken=function(a,b,c){var d=this.classify(a,b,c);a:for(;;){for(var e=this.stack[this.stack.length-1],f=e.dfa[0],g=f[e.state],h=0;h<g.length;++h){var k=g[h][0],l=g[h][1],m=this.grammar.labels[k][0];if(d===k){goog.asserts.assert(256>m);this.shift(a,b,l,c);for(a=l;1===f[a].length&&0===f[a][0][0]&&f[a][0][1]===a;){this.pop();if(0===this.stack.length)return!0;e=this.stack[this.stack.length-1];a=e.state;f=e.dfa[0]}return!1}if(256<=m&&this.grammar.dfas[m][1].hasOwnProperty(d)){this.push(m,
this.grammar.dfas[m],l,c);continue a}}if(findInDfa(g,[0,e.state])){if(this.pop(),0===this.stack.length)throw new Sk.builtin.ParseError("too much input",this.filename);}else throw new Sk.builtin.ParseError("bad input",this.filename,c[0][0],c);}};
Parser.prototype.classify=function(a,b,c){if(a===Sk.Tokenizer.Tokens.T_NAME&&(this.used_names[b]=!0,b=this.grammar.keywords.hasOwnProperty(b)&&this.grammar.keywords[b]))return b;b=this.grammar.tokens.hasOwnProperty(a)&&this.grammar.tokens[a];if(!b)throw new Sk.builtin.ParseError("bad token",this.filename,c[0][0],c);return b};
Parser.prototype.shift=function(a,b,c,d){var e=this.stack[this.stack.length-1].dfa,f=this.stack[this.stack.length-1].node;f.children.push({type:a,value:b,lineno:d[0][0],col_offset:d[0][1],children:null});this.stack[this.stack.length-1]={dfa:e,state:c,node:f}};
Parser.prototype.push=function(a,b,c,d){a={type:a,value:null,lineno:d[0][0],col_offset:d[0][1],children:[]};this.stack[this.stack.length-1]={dfa:this.stack[this.stack.length-1].dfa,state:c,node:this.stack[this.stack.length-1].node};this.stack.push({dfa:b,state:0,node:a})};Parser.prototype.pop=function(){var a=this.stack.pop().node;a&&(0!==this.stack.length?this.stack[this.stack.length-1].node.children.push(a):(this.rootnode=a,this.rootnode.used_names=this.used_names))};
function makeParser(a,b){void 0===b&&(b="file_input");var c=new Parser(a,Sk.ParseTables);"file_input"===b?c.setup(Sk.ParseTables.sym.file_input):goog.asserts.fail("todo;");var d=Sk.Tokenizer.Tokens.T_COMMENT,e=Sk.Tokenizer.Tokens.T_NL,f=Sk.Tokenizer.Tokens.T_OP,g=new Sk.Tokenizer(a,"single_input"===b,function(a,b,g,m,n){if(a!==d&&a!==e&&(a===f&&(a=Sk.OpMap[b]),c.addtoken(a,b,[g,m,n])))return!0});return function(a){if(a=g.generateTokens(a)){if("done"!==a)throw new Sk.builtin.ParseError("incomplete input",
this.filename);return c.rootnode}return!1}}Sk.parse=function(a,b){var c=makeParser(a);"\n"!==b.substr(b.length-1,1)&&(b+="\n");for(var d=b.split("\n"),e,f=0;f<d.length;++f)e=c(d[f]+(f===d.length-1?"":"\n"));return e};Sk.parseTreeDump=function(a,b){b=b||"";var c;c=""+b;if(256<=a.type){c+=Sk.ParseTables.number2symbol[a.type]+"\n";for(var d=0;d<a.children.length;++d)c+=Sk.parseTreeDump(a.children[d],b+"  ")}else c+=Sk.Tokenizer.tokenNames[a.type]+": "+(new Sk.builtin.str(a.value)).$r().v+"\n";return c};
goog.exportSymbol("Sk.parse",Sk.parse);goog.exportSymbol("Sk.parseTreeDump",Sk.parseTreeDump);function Load(){}function Store(){}function Del(){}function AugLoad(){}function AugStore(){}function Param(){}function And(){}function Or(){}function Add(){}function Sub(){}function Mult(){}function Div(){}function Mod(){}function Pow(){}function LShift(){}function RShift(){}function BitOr(){}function BitXor(){}function BitAnd(){}function FloorDiv(){}function Invert(){}function Not(){}function UAdd(){}function USub(){}function Eq(){}function NotEq(){}function Lt(){}function LtE(){}
function Gt(){}function GtE(){}function Is(){}function IsNot(){}function In_(){}function NotIn(){}function Module(a){this.body=a;return this}function Interactive(a){this.body=a;return this}function Expression(a){goog.asserts.assert(null!==a&&void 0!==a);this.body=a;return this}function Suite(a){this.body=a;return this}
function FunctionDef(a,b,c,d,e,f){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);this.name=a;this.args=b;this.body=c;this.decorator_list=d;this.lineno=e;this.col_offset=f;return this}function ClassDef(a,b,c,d,e,f){goog.asserts.assert(null!==a&&void 0!==a);this.name=a;this.bases=b;this.body=c;this.decorator_list=d;this.lineno=e;this.col_offset=f;return this}function Return_(a,b,c){this.value=a;this.lineno=b;this.col_offset=c;return this}
function Delete_(a,b,c){this.targets=a;this.lineno=b;this.col_offset=c;return this}function Assign(a,b,c,d){goog.asserts.assert(null!==b&&void 0!==b);this.targets=a;this.value=b;this.lineno=c;this.col_offset=d;return this}function AugAssign(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);goog.asserts.assert(null!==c&&void 0!==c);this.target=a;this.op=b;this.value=c;this.lineno=d;this.col_offset=e;return this}
function Print(a,b,c,d,e){this.dest=a;this.values=b;this.nl=c;this.lineno=d;this.col_offset=e;return this}function For_(a,b,c,d,e,f){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);this.target=a;this.iter=b;this.body=c;this.orelse=d;this.lineno=e;this.col_offset=f;return this}function While_(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);this.test=a;this.body=b;this.orelse=c;this.lineno=d;this.col_offset=e;return this}
function If_(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);this.test=a;this.body=b;this.orelse=c;this.lineno=d;this.col_offset=e;return this}function With_(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);this.context_expr=a;this.optional_vars=b;this.body=c;this.lineno=d;this.col_offset=e;return this}function Raise(a,b,c,d,e){this.type=a;this.inst=b;this.tback=c;this.lineno=d;this.col_offset=e;return this}
function TryExcept(a,b,c,d,e){this.body=a;this.handlers=b;this.orelse=c;this.lineno=d;this.col_offset=e;return this}function TryFinally(a,b,c,d){this.body=a;this.finalbody=b;this.lineno=c;this.col_offset=d;return this}function Assert(a,b,c,d){goog.asserts.assert(null!==a&&void 0!==a);this.test=a;this.msg=b;this.lineno=c;this.col_offset=d;return this}function Import_(a,b,c){this.names=a;this.lineno=b;this.col_offset=c;return this}
function ImportFrom(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);this.module=a;this.names=b;this.level=c;this.lineno=d;this.col_offset=e;return this}function Exec(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);this.body=a;this.globals=b;this.locals=c;this.lineno=d;this.col_offset=e;return this}function Global(a,b,c){this.names=a;this.lineno=b;this.col_offset=c;return this}
function Expr(a,b,c){goog.asserts.assert(null!==a&&void 0!==a);this.value=a;this.lineno=b;this.col_offset=c;return this}function Pass(a,b){this.lineno=a;this.col_offset=b;return this}function Break_(a,b){this.lineno=a;this.col_offset=b;return this}function Continue_(a,b){this.lineno=a;this.col_offset=b;return this}function BoolOp(a,b,c,d){goog.asserts.assert(null!==a&&void 0!==a);this.op=a;this.values=b;this.lineno=c;this.col_offset=d;return this}
function BinOp(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);goog.asserts.assert(null!==c&&void 0!==c);this.left=a;this.op=b;this.right=c;this.lineno=d;this.col_offset=e;return this}function UnaryOp(a,b,c,d){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);this.op=a;this.operand=b;this.lineno=c;this.col_offset=d;return this}
function Lambda(a,b,c,d){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);this.args=a;this.body=b;this.lineno=c;this.col_offset=d;return this}function IfExp(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);goog.asserts.assert(null!==c&&void 0!==c);this.test=a;this.body=b;this.orelse=c;this.lineno=d;this.col_offset=e;return this}
function Dict(a,b,c,d){this.keys=a;this.values=b;this.lineno=c;this.col_offset=d;return this}function ListComp(a,b,c,d){goog.asserts.assert(null!==a&&void 0!==a);this.elt=a;this.generators=b;this.lineno=c;this.col_offset=d;return this}function GeneratorExp(a,b,c,d){goog.asserts.assert(null!==a&&void 0!==a);this.elt=a;this.generators=b;this.lineno=c;this.col_offset=d;return this}function Yield(a,b,c){this.value=a;this.lineno=b;this.col_offset=c;return this}
function Compare(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);this.left=a;this.ops=b;this.comparators=c;this.lineno=d;this.col_offset=e;return this}function Call(a,b,c,d,e,f,g){goog.asserts.assert(null!==a&&void 0!==a);this.func=a;this.args=b;this.keywords=c;this.starargs=d;this.kwargs=e;this.lineno=f;this.col_offset=g;return this}function Num(a,b,c){goog.asserts.assert(null!==a&&void 0!==a);this.n=a;this.lineno=b;this.col_offset=c;return this}
function Str(a,b,c){goog.asserts.assert(null!==a&&void 0!==a);this.s=a;this.lineno=b;this.col_offset=c;return this}function Attribute(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);goog.asserts.assert(null!==c&&void 0!==c);this.value=a;this.attr=b;this.ctx=c;this.lineno=d;this.col_offset=e;return this}
function Subscript(a,b,c,d,e){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);goog.asserts.assert(null!==c&&void 0!==c);this.value=a;this.slice=b;this.ctx=c;this.lineno=d;this.col_offset=e;return this}function Name(a,b,c,d){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);this.id=a;this.ctx=b;this.lineno=c;this.col_offset=d;return this}
function List(a,b,c,d){goog.asserts.assert(null!==b&&void 0!==b);this.elts=a;this.ctx=b;this.lineno=c;this.col_offset=d;return this}function Tuple(a,b,c,d){goog.asserts.assert(null!==b&&void 0!==b);this.elts=a;this.ctx=b;this.lineno=c;this.col_offset=d;return this}function Ellipsis(){return this}function Slice(a,b,c){this.lower=a;this.upper=b;this.step=c;return this}function ExtSlice(a){this.dims=a;return this}function Index(a){goog.asserts.assert(null!==a&&void 0!==a);this.value=a;return this}
function comprehension(a,b,c){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);this.target=a;this.iter=b;this.ifs=c;return this}function ExceptHandler(a,b,c,d,e){this.type=a;this.name=b;this.body=c;this.lineno=d;this.col_offset=e;return this}function arguments_(a,b,c,d){this.args=a;this.vararg=b;this.kwarg=c;this.defaults=d;return this}
function keyword(a,b){goog.asserts.assert(null!==a&&void 0!==a);goog.asserts.assert(null!==b&&void 0!==b);this.arg=a;this.value=b;return this}function alias(a,b){goog.asserts.assert(null!==a&&void 0!==a);this.name=a;this.asname=b;return this}Module.prototype._astname="Module";Module.prototype._fields=["body",function(a){return a.body}];Interactive.prototype._astname="Interactive";Interactive.prototype._fields=["body",function(a){return a.body}];Expression.prototype._astname="Expression";
Expression.prototype._fields=["body",function(a){return a.body}];Suite.prototype._astname="Suite";Suite.prototype._fields=["body",function(a){return a.body}];FunctionDef.prototype._astname="FunctionDef";FunctionDef.prototype._fields=["name",function(a){return a.name},"args",function(a){return a.args},"body",function(a){return a.body},"decorator_list",function(a){return a.decorator_list}];ClassDef.prototype._astname="ClassDef";
ClassDef.prototype._fields=["name",function(a){return a.name},"bases",function(a){return a.bases},"body",function(a){return a.body},"decorator_list",function(a){return a.decorator_list}];Return_.prototype._astname="Return";Return_.prototype._fields=["value",function(a){return a.value}];Delete_.prototype._astname="Delete";Delete_.prototype._fields=["targets",function(a){return a.targets}];Assign.prototype._astname="Assign";Assign.prototype._fields=["targets",function(a){return a.targets},"value",function(a){return a.value}];
AugAssign.prototype._astname="AugAssign";AugAssign.prototype._fields=["target",function(a){return a.target},"op",function(a){return a.op},"value",function(a){return a.value}];Print.prototype._astname="Print";Print.prototype._fields=["dest",function(a){return a.dest},"values",function(a){return a.values},"nl",function(a){return a.nl}];For_.prototype._astname="For";
For_.prototype._fields=["target",function(a){return a.target},"iter",function(a){return a.iter},"body",function(a){return a.body},"orelse",function(a){return a.orelse}];While_.prototype._astname="While";While_.prototype._fields=["test",function(a){return a.test},"body",function(a){return a.body},"orelse",function(a){return a.orelse}];If_.prototype._astname="If";If_.prototype._fields=["test",function(a){return a.test},"body",function(a){return a.body},"orelse",function(a){return a.orelse}];
With_.prototype._astname="With";With_.prototype._fields=["context_expr",function(a){return a.context_expr},"optional_vars",function(a){return a.optional_vars},"body",function(a){return a.body}];Raise.prototype._astname="Raise";Raise.prototype._fields=["type",function(a){return a.type},"inst",function(a){return a.inst},"tback",function(a){return a.tback}];TryExcept.prototype._astname="TryExcept";
TryExcept.prototype._fields=["body",function(a){return a.body},"handlers",function(a){return a.handlers},"orelse",function(a){return a.orelse}];TryFinally.prototype._astname="TryFinally";TryFinally.prototype._fields=["body",function(a){return a.body},"finalbody",function(a){return a.finalbody}];Assert.prototype._astname="Assert";Assert.prototype._fields=["test",function(a){return a.test},"msg",function(a){return a.msg}];Import_.prototype._astname="Import";Import_.prototype._fields=["names",function(a){return a.names}];
ImportFrom.prototype._astname="ImportFrom";ImportFrom.prototype._fields=["module",function(a){return a.module},"names",function(a){return a.names},"level",function(a){return a.level}];Exec.prototype._astname="Exec";Exec.prototype._fields=["body",function(a){return a.body},"globals",function(a){return a.globals},"locals",function(a){return a.locals}];Global.prototype._astname="Global";Global.prototype._fields=["names",function(a){return a.names}];Expr.prototype._astname="Expr";
Expr.prototype._fields=["value",function(a){return a.value}];Pass.prototype._astname="Pass";Pass.prototype._fields=[];Break_.prototype._astname="Break";Break_.prototype._fields=[];Continue_.prototype._astname="Continue";Continue_.prototype._fields=[];BoolOp.prototype._astname="BoolOp";BoolOp.prototype._fields=["op",function(a){return a.op},"values",function(a){return a.values}];BinOp.prototype._astname="BinOp";
BinOp.prototype._fields=["left",function(a){return a.left},"op",function(a){return a.op},"right",function(a){return a.right}];UnaryOp.prototype._astname="UnaryOp";UnaryOp.prototype._fields=["op",function(a){return a.op},"operand",function(a){return a.operand}];Lambda.prototype._astname="Lambda";Lambda.prototype._fields=["args",function(a){return a.args},"body",function(a){return a.body}];IfExp.prototype._astname="IfExp";
IfExp.prototype._fields=["test",function(a){return a.test},"body",function(a){return a.body},"orelse",function(a){return a.orelse}];Dict.prototype._astname="Dict";Dict.prototype._fields=["keys",function(a){return a.keys},"values",function(a){return a.values}];ListComp.prototype._astname="ListComp";ListComp.prototype._fields=["elt",function(a){return a.elt},"generators",function(a){return a.generators}];GeneratorExp.prototype._astname="GeneratorExp";
GeneratorExp.prototype._fields=["elt",function(a){return a.elt},"generators",function(a){return a.generators}];Yield.prototype._astname="Yield";Yield.prototype._fields=["value",function(a){return a.value}];Compare.prototype._astname="Compare";Compare.prototype._fields=["left",function(a){return a.left},"ops",function(a){return a.ops},"comparators",function(a){return a.comparators}];Call.prototype._astname="Call";
Call.prototype._fields=["func",function(a){return a.func},"args",function(a){return a.args},"keywords",function(a){return a.keywords},"starargs",function(a){return a.starargs},"kwargs",function(a){return a.kwargs}];Num.prototype._astname="Num";Num.prototype._fields=["n",function(a){return a.n}];Str.prototype._astname="Str";Str.prototype._fields=["s",function(a){return a.s}];Attribute.prototype._astname="Attribute";
Attribute.prototype._fields=["value",function(a){return a.value},"attr",function(a){return a.attr},"ctx",function(a){return a.ctx}];Subscript.prototype._astname="Subscript";Subscript.prototype._fields=["value",function(a){return a.value},"slice",function(a){return a.slice},"ctx",function(a){return a.ctx}];Name.prototype._astname="Name";Name.prototype._fields=["id",function(a){return a.id},"ctx",function(a){return a.ctx}];List.prototype._astname="List";
List.prototype._fields=["elts",function(a){return a.elts},"ctx",function(a){return a.ctx}];Tuple.prototype._astname="Tuple";Tuple.prototype._fields=["elts",function(a){return a.elts},"ctx",function(a){return a.ctx}];Load.prototype._astname="Load";Load.prototype._isenum=!0;Store.prototype._astname="Store";Store.prototype._isenum=!0;Del.prototype._astname="Del";Del.prototype._isenum=!0;AugLoad.prototype._astname="AugLoad";AugLoad.prototype._isenum=!0;AugStore.prototype._astname="AugStore";
AugStore.prototype._isenum=!0;Param.prototype._astname="Param";Param.prototype._isenum=!0;Ellipsis.prototype._astname="Ellipsis";Ellipsis.prototype._fields=[];Slice.prototype._astname="Slice";Slice.prototype._fields=["lower",function(a){return a.lower},"upper",function(a){return a.upper},"step",function(a){return a.step}];ExtSlice.prototype._astname="ExtSlice";ExtSlice.prototype._fields=["dims",function(a){return a.dims}];Index.prototype._astname="Index";Index.prototype._fields=["value",function(a){return a.value}];
And.prototype._astname="And";And.prototype._isenum=!0;Or.prototype._astname="Or";Or.prototype._isenum=!0;Add.prototype._astname="Add";Add.prototype._isenum=!0;Sub.prototype._astname="Sub";Sub.prototype._isenum=!0;Mult.prototype._astname="Mult";Mult.prototype._isenum=!0;Div.prototype._astname="Div";Div.prototype._isenum=!0;Mod.prototype._astname="Mod";Mod.prototype._isenum=!0;Pow.prototype._astname="Pow";Pow.prototype._isenum=!0;LShift.prototype._astname="LShift";LShift.prototype._isenum=!0;
RShift.prototype._astname="RShift";RShift.prototype._isenum=!0;BitOr.prototype._astname="BitOr";BitOr.prototype._isenum=!0;BitXor.prototype._astname="BitXor";BitXor.prototype._isenum=!0;BitAnd.prototype._astname="BitAnd";BitAnd.prototype._isenum=!0;FloorDiv.prototype._astname="FloorDiv";FloorDiv.prototype._isenum=!0;Invert.prototype._astname="Invert";Invert.prototype._isenum=!0;Not.prototype._astname="Not";Not.prototype._isenum=!0;UAdd.prototype._astname="UAdd";UAdd.prototype._isenum=!0;
USub.prototype._astname="USub";USub.prototype._isenum=!0;Eq.prototype._astname="Eq";Eq.prototype._isenum=!0;NotEq.prototype._astname="NotEq";NotEq.prototype._isenum=!0;Lt.prototype._astname="Lt";Lt.prototype._isenum=!0;LtE.prototype._astname="LtE";LtE.prototype._isenum=!0;Gt.prototype._astname="Gt";Gt.prototype._isenum=!0;GtE.prototype._astname="GtE";GtE.prototype._isenum=!0;Is.prototype._astname="Is";Is.prototype._isenum=!0;IsNot.prototype._astname="IsNot";IsNot.prototype._isenum=!0;
In_.prototype._astname="In";In_.prototype._isenum=!0;NotIn.prototype._astname="NotIn";NotIn.prototype._isenum=!0;comprehension.prototype._astname="comprehension";comprehension.prototype._fields=["target",function(a){return a.target},"iter",function(a){return a.iter},"ifs",function(a){return a.ifs}];ExceptHandler.prototype._astname="ExceptHandler";ExceptHandler.prototype._fields=["type",function(a){return a.type},"name",function(a){return a.name},"body",function(a){return a.body}];
arguments_.prototype._astname="arguments";arguments_.prototype._fields=["args",function(a){return a.args},"vararg",function(a){return a.vararg},"kwarg",function(a){return a.kwarg},"defaults",function(a){return a.defaults}];keyword.prototype._astname="keyword";keyword.prototype._fields=["arg",function(a){return a.arg},"value",function(a){return a.value}];alias.prototype._astname="alias";alias.prototype._fields=["name",function(a){return a.name},"asname",function(a){return a.asname}];var SYM=Sk.ParseTables.sym,TOK=Sk.Tokenizer.Tokens;function Compiling(a,b){this.c_encoding=a;this.c_filename=b}function NCH(a){goog.asserts.assert(void 0!==a);return null===a.children?0:a.children.length}function CHILD(a,b){goog.asserts.assert(void 0!==a);goog.asserts.assert(void 0!==b);return a.children[b]}function REQ(a,b){goog.asserts.assert(a.type===b,"node wasn't expected type")}
function strobj(a){goog.asserts.assert("string"===typeof a,"expecting string, got "+typeof a);return new Sk.builtin.str(a)}
function numStmts(a){switch(a.type){case SYM.single_input:if(CHILD(a,0).type===TOK.T_NEWLINE)break;else return numStmts(CHILD(a,0));case SYM.file_input:for(var b=0,c=0;c<NCH(a);++c){var d=CHILD(a,c);d.type===SYM.stmt&&(b+=numStmts(d))}return b;case SYM.stmt:return numStmts(CHILD(a,0));case SYM.compound_stmt:return 1;case SYM.simple_stmt:return Math.floor(NCH(a)/2);case SYM.suite:if(1===NCH(a))return numStmts(CHILD(a,0));b=0;for(c=2;c<NCH(a)-1;++c)b+=numStmts(CHILD(a,c));return b;default:goog.asserts.fail("Non-statement found")}return 0}
function forbiddenCheck(a,b,c,d){if("None"===c)throw new Sk.builtin.SyntaxError("assignment to None",a.c_filename,d);if("True"===c||"False"===c)throw new Sk.builtin.SyntaxError("assignment to True or False is forbidden",a.c_filename,d);}
function setContext(a,b,c,d){goog.asserts.assert(c!==AugStore&&c!==AugLoad);var e=null,f=null;switch(b.constructor){case Attribute:case Name:c===Store&&forbiddenCheck(a,d,b.attr,d.lineno);b.ctx=c;break;case Subscript:b.ctx=c;break;case List:b.ctx=c;e=b.elts;break;case Tuple:if(0===b.elts.length)throw new Sk.builtin.SyntaxError("can't assign to ()",a.c_filename,d.lineno);b.ctx=c;e=b.elts;break;case Lambda:f="lambda";break;case Call:f="function call";break;case BoolOp:case BinOp:case UnaryOp:f="operator";
break;case GeneratorExp:f="generator expression";break;case Yield:f="yield expression";break;case ListComp:f="list comprehension";break;case Dict:case Num:case Str:f="literal";break;case Compare:f="comparison";break;case IfExp:f="conditional expression";break;default:goog.asserts.fail("unhandled expression in assignment")}if(f)throw new Sk.builtin.SyntaxError("can't "+(c===Store?"assign to":"delete")+" "+f,a.c_filename,d.lineno);if(e)for(b=0;b<e.length;++b)setContext(a,e[b],c,d)}var operatorMap={};
(function(){operatorMap[TOK.T_VBAR]=BitOr;operatorMap[TOK.T_VBAR]=BitOr;operatorMap[TOK.T_CIRCUMFLEX]=BitXor;operatorMap[TOK.T_AMPER]=BitAnd;operatorMap[TOK.T_LEFTSHIFT]=LShift;operatorMap[TOK.T_RIGHTSHIFT]=RShift;operatorMap[TOK.T_PLUS]=Add;operatorMap[TOK.T_MINUS]=Sub;operatorMap[TOK.T_STAR]=Mult;operatorMap[TOK.T_SLASH]=Div;operatorMap[TOK.T_DOUBLESLASH]=FloorDiv;operatorMap[TOK.T_PERCENT]=Mod})();
function getOperator(a){goog.asserts.assert(void 0!==operatorMap[a.type]);return operatorMap[a.type]}
function astForCompOp(a,b){REQ(b,SYM.comp_op);if(1===NCH(b))switch(b=CHILD(b,0),b.type){case TOK.T_LESS:return Lt;case TOK.T_GREATER:return Gt;case TOK.T_EQEQUAL:return Eq;case TOK.T_LESSEQUAL:return LtE;case TOK.T_GREATEREQUAL:return GtE;case TOK.T_NOTEQUAL:return NotEq;case TOK.T_NAME:if("in"===b.value)return In_;if("is"===b.value)return Is}else if(2===NCH(b)&&CHILD(b,0).type===TOK.T_NAME){if("in"===CHILD(b,1).value)return NotIn;if("is"===CHILD(b,0).value)return IsNot}goog.asserts.fail("invalid comp_op")}
function seqForTestlist(a,b){goog.asserts.assert(b.type===SYM.testlist||b.type===SYM.listmaker||b.type===SYM.testlist_gexp||b.type===SYM.testlist_safe||b.type===SYM.testlist1);for(var c=[],d=0;d<NCH(b);d+=2)goog.asserts.assert(CHILD(b,d).type===SYM.test||CHILD(b,d).type===SYM.old_test),c[d/2]=astForExpr(a,CHILD(b,d));return c}
function astForSuite(a,b){REQ(b,SYM.suite);var c=[],d=0,e;if(CHILD(b,0).type===SYM.simple_stmt){b=CHILD(b,0);e=NCH(b)-1;CHILD(b,e-1).type===TOK.T_SEMI&&(e-=1);for(var f=0;f<e;f+=2)c[d++]=astForStmt(a,CHILD(b,f))}else for(f=2;f<NCH(b)-1;++f)if(e=CHILD(b,f),REQ(e,SYM.stmt),1===numStmts(e))c[d++]=astForStmt(a,e);else{e=CHILD(e,0);REQ(e,SYM.simple_stmt);for(var g=0;g<NCH(e);g+=2){if(0===NCH(CHILD(e,g))){goog.asserts.assert(g+1===NCH(e));break}c[d++]=astForStmt(a,CHILD(e,g))}}goog.asserts.assert(d===numStmts(b));
return c}
function astForExceptClause(a,b,c){REQ(b,SYM.except_clause);REQ(c,SYM.suite);if(1===NCH(b))return new ExceptHandler(null,null,astForSuite(a,c),b.lineno,b.col_offset);if(2===NCH(b))return new ExceptHandler(astForExpr(a,CHILD(b,1)),null,astForSuite(a,c),b.lineno,b.col_offset);if(4===NCH(b)){var d=astForExpr(a,CHILD(b,3));setContext(a,d,Store,CHILD(b,3));return new ExceptHandler(astForExpr(a,CHILD(b,1)),d,astForSuite(a,c),b.lineno,b.col_offset)}goog.asserts.fail("wrong number of children for except clause")}
function astForTryStmt(a,b){var c=NCH(b),d=(c-3)/3,e,f=[],g=null;REQ(b,SYM.try_stmt);e=astForSuite(a,CHILD(b,2));if(CHILD(b,c-3).type===TOK.T_NAME)"finally"===CHILD(b,c-3).value?(9<=c&&CHILD(b,c-6).type===TOK.T_NAME&&(f=astForSuite(a,CHILD(b,c-4)),d--),g=astForSuite(a,CHILD(b,c-1))):f=astForSuite(a,CHILD(b,c-1)),d--;else if(CHILD(b,c-3).type!==SYM.except_clause)throw new Sk.builtin.SyntaxError("malformed 'try' statement",a.c_filename,b.lineno);if(0<d){for(var c=[],h=0;h<d;++h)c[h]=astForExceptClause(a,
CHILD(b,3+3*h),CHILD(b,5+3*h));d=new TryExcept(e,c,f,b.lineno,b.col_offset);if(!g)return d;e=[d]}goog.asserts.assert(null!==g);return new TryFinally(e,g,b.lineno,b.col_offset)}function astForDottedName(a,b){REQ(b,SYM.dotted_name);for(var c=b.lineno,d=b.col_offset,e=strobj(CHILD(b,0).value),f=new Name(e,Load,c,d),g=2;g<NCH(b);g+=2)e=strobj(CHILD(b,g).value),f=new Attribute(f,e,Load,c,d);return f}
function astForDecorator(a,b){REQ(b,SYM.decorator);REQ(CHILD(b,0),TOK.T_AT);REQ(CHILD(b,NCH(b)-1),TOK.T_NEWLINE);var c=astForDottedName(a,CHILD(b,1));return 3===NCH(b)?c:5===NCH(b)?new Call(c,[],[],null,null,b.lineno,b.col_offset):astForCall(a,CHILD(b,3),c)}function astForDecorators(a,b){REQ(b,SYM.decorators);for(var c=[],d=0;d<NCH(b);++d)c[d]=astForDecorator(a,CHILD(b,d));return c}
function astForDecorated(a,b){REQ(b,SYM.decorated);var c=astForDecorators(a,CHILD(b,0));goog.asserts.assert(CHILD(b,1).type===SYM.funcdef||CHILD(b,1).type===SYM.classdef);var d=null;CHILD(b,1).type===SYM.funcdef?d=astForFuncdef(a,CHILD(b,1),c):CHILD(b,1)===SYM.classdef&&(d=astForClassdef(a,CHILD(b,1),c));d&&(d.lineno=b.lineno,d.col_offset=b.col_offset);return d}function astForWithVar(a,b){REQ(b,SYM.with_var);return astForExpr(a,CHILD(b,1))}
function astForWithStmt(a,b){var c=3;goog.asserts.assert(b.type===SYM.with_stmt);var d=astForExpr(a,CHILD(b,1));if(CHILD(b,2).type===SYM.with_var){var e=astForWithVar(a,CHILD(b,2));setContext(a,e,Store,b);c=4}return new With_(d,e,astForSuite(a,CHILD(b,c)),b.lineno,b.col_offset)}
function astForExecStmt(a,b){var c,d=null,e=null,f=NCH(b);goog.asserts.assert(2===f||4===f||6===f);REQ(b,SYM.exec_stmt);c=astForExpr(a,CHILD(b,1));4<=f&&(d=astForExpr(a,CHILD(b,3)));6===f&&(e=astForExpr(a,CHILD(b,5)));return new Exec(c,d,e,b.lineno,b.col_offset)}
function astForIfStmt(a,b){REQ(b,SYM.if_stmt);if(4===NCH(b))return new If_(astForExpr(a,CHILD(b,1)),astForSuite(a,CHILD(b,3)),[],b.lineno,b.col_offset);var c=CHILD(b,4).value.charAt(2);if("s"===c)return new If_(astForExpr(a,CHILD(b,1)),astForSuite(a,CHILD(b,3)),astForSuite(a,CHILD(b,6)),b.lineno,b.col_offset);if("i"===c){var c=NCH(b)-4,d=!1,e=[];CHILD(b,c+1).type===TOK.T_NAME&&"s"===CHILD(b,c+1).value.charAt(2)&&(d=!0,c-=3);c/=4;d&&(e=[new If_(astForExpr(a,CHILD(b,NCH(b)-6)),astForSuite(a,CHILD(b,
NCH(b)-4)),astForSuite(a,CHILD(b,NCH(b)-1)),CHILD(b,NCH(b)-6).lineno,CHILD(b,NCH(b)-6).col_offset)],c--);for(d=0;d<c;++d)var f=5+4*(c-d-1),e=[new If_(astForExpr(a,CHILD(b,f)),astForSuite(a,CHILD(b,f+2)),e,CHILD(b,f).lineno,CHILD(b,f).col_offset)];return new If_(astForExpr(a,CHILD(b,1)),astForSuite(a,CHILD(b,3)),e,b.lineno,b.col_offset)}goog.asserts.fail("unexpected token in 'if' statement")}
function astForExprlist(a,b,c){REQ(b,SYM.exprlist);for(var d=[],e=0;e<NCH(b);e+=2){var f=astForExpr(a,CHILD(b,e));d[e/2]=f;c&&setContext(a,f,c,CHILD(b,e))}return d}function astForDelStmt(a,b){REQ(b,SYM.del_stmt);return new Delete_(astForExprlist(a,CHILD(b,1),Del),b.lineno,b.col_offset)}function astForGlobalStmt(a,b){REQ(b,SYM.global_stmt);for(var c=[],d=1;d<NCH(b);d+=2)c[(d-1)/2]=strobj(CHILD(b,d).value);return new Global(c,b.lineno,b.col_offset)}
function astForAssertStmt(a,b){REQ(b,SYM.assert_stmt);if(2===NCH(b))return new Assert(astForExpr(a,CHILD(b,1)),null,b.lineno,b.col_offset);if(4===NCH(b))return new Assert(astForExpr(a,CHILD(b,1)),astForExpr(a,CHILD(b,3)),b.lineno,b.col_offset);goog.asserts.fail("improper number of parts to assert stmt")}
function aliasForImportName(a,b){a:for(;;)switch(b.type){case SYM.import_as_name:var c=null,d=strobj(CHILD(b,0).value);3===NCH(b)&&(c=CHILD(b,2).value);return new alias(d,null==c?null:strobj(c));case SYM.dotted_as_name:if(1===NCH(b)){b=CHILD(b,0);continue a}else return c=aliasForImportName(a,CHILD(b,0)),goog.asserts.assert(!c.asname),c.asname=strobj(CHILD(b,2).value),c;case SYM.dotted_name:if(1===NCH(b))return new alias(strobj(CHILD(b,0).value),null);c="";for(d=0;d<NCH(b);d+=2)c+=CHILD(b,d).value+
".";return new alias(strobj(c.substr(0,c.length-1)),null);case TOK.T_STAR:return new alias(strobj("*"),null);default:throw new Sk.builtin.SyntaxError("unexpected import name",a.c_filename,b.lineno);}}
function astForImportStmt(a,b){REQ(b,SYM.import_stmt);var c=b.lineno,d=b.col_offset;b=CHILD(b,0);if(b.type===SYM.import_name){b=CHILD(b,1);REQ(b,SYM.dotted_as_names);for(var e=[],f=0;f<NCH(b);f+=2)e[f/2]=aliasForImportName(a,CHILD(b,f));return new Import_(e,c,d)}if(b.type===SYM.import_from){for(var g=null,h=0,e=1;e<NCH(b);++e){if(CHILD(b,e).type===SYM.dotted_name){g=aliasForImportName(a,CHILD(b,e));e++;break}else if(CHILD(b,e).type!==TOK.T_DOT)break;h++}++e;switch(CHILD(b,e).type){case TOK.T_STAR:b=
CHILD(b,e);break;case TOK.T_LPAR:b=CHILD(b,e+1);NCH(b);break;case SYM.import_as_names:b=CHILD(b,e);e=NCH(b);if(0===e%2)throw new Sk.builtin.SyntaxError("trailing comma not allowed without surrounding parentheses",a.c_filename,b.lineno);break;default:throw new Sk.builtin.SyntaxError("Unexpected node-type in from-import",a.c_filename,b.lineno);}e=[];if(b.type===TOK.T_STAR)e[0]=aliasForImportName(a,b);else for(f=0;f<NCH(b);f+=2)e[f/2]=aliasForImportName(a,CHILD(b,f));return new ImportFrom(strobj(g?g.name.v:
""),e,h,c,d)}throw new Sk.builtin.SyntaxError("unknown import statement",a.c_filename,b.lineno);}function astForTestlistGexp(a,b){goog.asserts.assert(b.type===SYM.testlist_gexp||b.type===SYM.argument);return 1<NCH(b)&&CHILD(b,1).type===SYM.gen_for?astForGenexp(a,b):astForTestlist(a,b)}
function astForListcomp(a,b){function c(a,b){for(var c=0;;){REQ(b,SYM.list_iter);if(CHILD(b,0).type===SYM.list_for)return c;b=CHILD(b,0);REQ(b,SYM.list_if);c++;if(2==NCH(b))return c;b=CHILD(b,2)}}REQ(b,SYM.listmaker);goog.asserts.assert(1<NCH(b));for(var d=astForExpr(a,CHILD(b,0)),e=function(a,b){var c=0,d=CHILD(b,1);a:for(;;){c++;REQ(d,SYM.list_for);if(5===NCH(d))d=CHILD(d,4);else return c;b:for(;;){REQ(d,SYM.list_iter);d=CHILD(d,0);if(d.type===SYM.list_for)continue a;else if(d.type===SYM.list_if)if(3===
NCH(d)){d=CHILD(d,2);continue b}else return c;break}break}}(a,b),f=[],g=CHILD(b,1),h=0;h<e;++h){REQ(g,SYM.list_for);var k=CHILD(g,1),l=astForExprlist(a,k,Store),m=astForTestlist(a,CHILD(g,3)),k=1===NCH(k)?new comprehension(l[0],m,[]):new comprehension(new Tuple(l,Store,g.lineno,g.col_offset),m,[]);if(5===NCH(g)){for(var g=CHILD(g,4),l=c(a,g),m=[],n=0;n<l;++n)REQ(g,SYM.list_iter),g=CHILD(g,0),REQ(g,SYM.list_if),m[n]=astForExpr(a,CHILD(g,1)),3===NCH(g)&&(g=CHILD(g,2));g.type===SYM.list_iter&&(g=CHILD(g,
0));k.ifs=m}f[h]=k}return new ListComp(d,f,b.lineno,b.col_offset)}
function astForFactor(a,b){if(CHILD(b,0).type===TOK.T_MINUS&&2===NCH(b)){var c=CHILD(b,1);if(c.type===SYM.factor&&1===NCH(c)&&(c=CHILD(c,0),c.type===SYM.power&&1===NCH(c)&&(c=CHILD(c,0),c.type===SYM.atom))){var d=CHILD(c,0);if(d.type===TOK.T_NUMBER)return d.value="-"+d.value,astForAtom(a,c)}}c=astForExpr(a,CHILD(b,1));switch(CHILD(b,0).type){case TOK.T_PLUS:return new UnaryOp(UAdd,c,b.lineno,b.col_offset);case TOK.T_MINUS:return new UnaryOp(USub,c,b.lineno,b.col_offset);case TOK.T_TILDE:return new UnaryOp(Invert,
c,b.lineno,b.col_offset)}goog.asserts.fail("unhandled factor")}function astForForStmt(a,b){var c=[];REQ(b,SYM.for_stmt);9===NCH(b)&&(c=astForSuite(a,CHILD(b,8)));var d=CHILD(b,1),e=astForExprlist(a,d,Store),d=1===NCH(d)?e[0]:new Tuple(e,Store,b.lineno,b.col_offset);return new For_(d,astForTestlist(a,CHILD(b,3)),astForSuite(a,CHILD(b,5)),c,b.lineno,b.col_offset)}
function astForCall(a,b,c){REQ(b,SYM.arglist);for(var d=0,e=0,f=0,g=0;g<NCH(b);++g){var h=CHILD(b,g);h.type===SYM.argument&&(1===NCH(h)?d++:CHILD(h,1).type===SYM.gen_for?f++:e++)}if(1<f||f&&(d||e))throw new Sk.builtin.SyntaxError("Generator expression must be parenthesized if not sole argument",a.c_filename,b.lineno);if(255<d+e+f)throw new Sk.builtin.SyntaxError("more than 255 arguments",a.c_filename,b.lineno);for(var f=[],k=[],e=d=0,l=null,m=null,g=0;g<NCH(b);++g)if(h=CHILD(b,g),h.type===SYM.argument)if(1===
NCH(h)){if(e)throw new Sk.builtin.SyntaxError("non-keyword arg after keyword arg",a.c_filename,b.lineno);if(l)throw new Sk.builtin.SyntaxError("only named arguments may follow *expression",a.c_filename,b.lineno);f[d++]=astForExpr(a,CHILD(h,0))}else if(CHILD(h,1).type===SYM.gen_for)f[d++]=astForGenexp(a,h);else{var n=astForExpr(a,CHILD(h,0));if(n.constructor===Lambda)throw new Sk.builtin.SyntaxError("lambda cannot contain assignment",a.c_filename,b.lineno);if(n.constructor!==Name)throw new Sk.builtin.SyntaxError("keyword can't be an expression",
a.c_filename,b.lineno);n=n.id;forbiddenCheck(a,CHILD(h,0),n,b.lineno);for(var p=0;p<e;++p)if(k[p].arg===n)throw new Sk.builtin.SyntaxError("keyword argument repeated",a.c_filename,b.lineno);k[e++]=new keyword(n,astForExpr(a,CHILD(h,2)))}else h.type===TOK.T_STAR?l=astForExpr(a,CHILD(b,++g)):h.type===TOK.T_DOUBLESTAR&&(m=astForExpr(a,CHILD(b,++g)));return new Call(c,f,k,l,m,c.lineno,c.col_offset)}
function astForTrailer(a,b,c){REQ(b,SYM.trailer);if(CHILD(b,0).type===TOK.T_LPAR)return 2===NCH(b)?new Call(c,[],[],null,null,b.lineno,b.col_offset):astForCall(a,CHILD(b,1),c);if(CHILD(b,0).type===TOK.T_DOT)return new Attribute(c,strobj(CHILD(b,1).value),Load,b.lineno,b.col_offset);REQ(CHILD(b,0),TOK.T_LSQB);REQ(CHILD(b,2),TOK.T_RSQB);b=CHILD(b,1);if(1===NCH(b))return new Subscript(c,astForSlice(a,CHILD(b,0)),Load,b.lineno,b.col_offset);for(var d=!0,e=[],f=0;f<NCH(b);f+=2){var g=astForSlice(a,CHILD(b,
f));g.constructor!==Index&&(d=!1);e[f/2]=g}if(!d)return new Subscript(c,new ExtSlice(e),Load,b.lineno,b.col_offset);a=[];for(f=0;f<e.length;++f)g=e[f],goog.asserts.assert(g.constructor===Index&&null!==g.value&&void 0!==g.value),a[f]=g.value;e=new Tuple(a,Load,b.lineno,b.col_offset);return new Subscript(c,new Index(e),Load,b.lineno,b.col_offset)}
function astForFlowStmt(a,b){var c;REQ(b,SYM.flow_stmt);c=CHILD(b,0);switch(c.type){case SYM.break_stmt:return new Break_(b.lineno,b.col_offset);case SYM.continue_stmt:return new Continue_(b.lineno,b.col_offset);case SYM.yield_stmt:return new Expr(astForExpr(a,CHILD(c,0)),b.lineno,b.col_offset);case SYM.return_stmt:return 1===NCH(c)?new Return_(null,b.lineno,b.col_offset):new Return_(astForTestlist(a,CHILD(c,1)),b.lineno,b.col_offset);case SYM.raise_stmt:if(1===NCH(c))return new Raise(null,null,null,
b.lineno,b.col_offset);if(2===NCH(c))return new Raise(astForExpr(a,CHILD(c,1)),null,null,b.lineno,b.col_offset);if(4===NCH(c))return new Raise(astForExpr(a,CHILD(c,1)),astForExpr(a,CHILD(c,3)),null,b.lineno,b.col_offset);if(6===NCH(c))return new Raise(astForExpr(a,CHILD(c,1)),astForExpr(a,CHILD(c,3)),astForExpr(a,CHILD(c,5)),b.lineno,b.col_offset);default:goog.asserts.fail("unexpected flow_stmt")}goog.asserts.fail("unhandled flow statement")}
function astForArguments(a,b){var c,d=null,e=null;if(b.type===SYM.parameters){if(2===NCH(b))return new arguments_([],null,null,[]);b=CHILD(b,1)}REQ(b,SYM.varargslist);for(var f=[],g=[],h=!1,k=0,l=0,m=0;k<NCH(b);)switch(c=CHILD(b,k),c.type){case SYM.fpdef:var n=0;a:for(;;){if(k+1<NCH(b)&&CHILD(b,k+1).type===TOK.T_EQUAL)g[l++]=astForExpr(a,CHILD(b,k+2)),k+=2,h=!0;else if(h){if(n)throw new Sk.builtin.SyntaxError("parenthesized arg with default",a.c_filename,b.lineno);throw new Sk.builtin.SyntaxError("non-default argument follows default argument",
a.c_filename,b.lineno);}if(3===NCH(c)){c=CHILD(c,1);if(1!==NCH(c))throw new Sk.builtin.SyntaxError("tuple parameter unpacking has been removed",a.c_filename,b.lineno);n=!0;c=CHILD(c,0);goog.asserts.assert(c.type===SYM.fpdef);continue a}if(CHILD(c,0).type===TOK.T_NAME){forbiddenCheck(a,b,CHILD(c,0).value,b.lineno);var p=strobj(CHILD(c,0).value);f[m++]=new Name(p,Param,c.lineno,c.col_offset)}k+=2;if(n)throw new Sk.builtin.SyntaxError("parenthesized argument names are invalid",a.c_filename,b.lineno);
break}break;case TOK.T_STAR:forbiddenCheck(a,CHILD(b,k+1),CHILD(b,k+1).value,b.lineno);d=strobj(CHILD(b,k+1).value);k+=3;break;case TOK.T_DOUBLESTAR:forbiddenCheck(a,CHILD(b,k+1),CHILD(b,k+1).value,b.lineno);e=strobj(CHILD(b,k+1).value);k+=3;break;default:goog.asserts.fail("unexpected node in varargslist")}return new arguments_(f,d,e,g)}
function astForFuncdef(a,b,c){REQ(b,SYM.funcdef);var d=strobj(CHILD(b,1).value);forbiddenCheck(a,CHILD(b,1),CHILD(b,1).value,b.lineno);var e=astForArguments(a,CHILD(b,2));a=astForSuite(a,CHILD(b,4));return new FunctionDef(d,e,a,c,b.lineno,b.col_offset)}function astForClassBases(a,b){goog.asserts.assert(0<NCH(b));REQ(b,SYM.testlist);return 1===NCH(b)?[astForExpr(a,CHILD(b,0))]:seqForTestlist(a,b)}
function astForClassdef(a,b,c){REQ(b,SYM.classdef);forbiddenCheck(a,b,CHILD(b,1).value,b.lineno);var d=strobj(CHILD(b,1).value);if(4===NCH(b))return new ClassDef(d,[],astForSuite(a,CHILD(b,3)),c,b.lineno,b.col_offset);if(CHILD(b,3).type===TOK.T_RPAR)return new ClassDef(d,[],astForSuite(a,CHILD(b,5)),c,b.lineno,b.col_offset);var e=astForClassBases(a,CHILD(b,3));a=astForSuite(a,CHILD(b,6));return new ClassDef(d,e,a,c,b.lineno,b.col_offset)}
function astForLambdef(a,b){var c,d;3===NCH(b)?(c=new arguments_([],null,null,[]),d=astForExpr(a,CHILD(b,2))):(c=astForArguments(a,CHILD(b,1)),d=astForExpr(a,CHILD(b,3)));return new Lambda(c,d,b.lineno,b.col_offset)}
function astForGenexp(a,b){function c(a,b){for(var c=0;;){REQ(b,SYM.gen_iter);if(CHILD(b,0).type===SYM.gen_for)return c;b=CHILD(b,0);REQ(b,SYM.gen_if);c++;if(2==NCH(b))return c;b=CHILD(b,2)}}goog.asserts.assert(b.type===SYM.testlist_gexp||b.type===SYM.argument);goog.asserts.assert(1<NCH(b));for(var d=astForExpr(a,CHILD(b,0)),e=function(a,b){var c=0,d=CHILD(b,1);a:for(;;){c++;REQ(d,SYM.gen_for);if(5===NCH(d))d=CHILD(d,4);else return c;b:for(;;){REQ(d,SYM.gen_iter);d=CHILD(d,0);if(d.type===SYM.gen_for)continue a;
else if(d.type===SYM.gen_if)if(3===NCH(d)){d=CHILD(d,2);continue b}else return c;break}break}goog.asserts.fail("logic error in countGenFors")}(a,b),f=[],g=CHILD(b,1),h=0;h<e;++h){REQ(g,SYM.gen_for);var k=CHILD(g,1),l=astForExprlist(a,k,Store),m=astForExpr(a,CHILD(g,3)),k=1===NCH(k)?new comprehension(l[0],m,[]):new comprehension(new Tuple(l,Store,g.lineno,g.col_offset),m,[]);if(5===NCH(g)){for(var g=CHILD(g,4),l=c(a,g),n=[],p=0;p<l;++p)REQ(g,SYM.gen_iter),g=CHILD(g,0),REQ(g,SYM.gen_if),m=astForExpr(a,
CHILD(g,1)),n[p]=m,3===NCH(g)&&(g=CHILD(g,2));g.type===SYM.gen_iter&&(g=CHILD(g,0));k.ifs=n}f[h]=k}return new GeneratorExp(d,f,b.lineno,b.col_offset)}
function astForWhileStmt(a,b){REQ(b,SYM.while_stmt);if(4===NCH(b))return new While_(astForExpr(a,CHILD(b,1)),astForSuite(a,CHILD(b,3)),[],b.lineno,b.col_offset);if(7===NCH(b))return new While_(astForExpr(a,CHILD(b,1)),astForSuite(a,CHILD(b,3)),astForSuite(a,CHILD(b,6)),b.lineno,b.col_offset);goog.asserts.fail("wrong number of tokens for 'while' stmt")}
function astForAugassign(a,b){REQ(b,SYM.augassign);b=CHILD(b,0);switch(b.value.charAt(0)){case "+":return Add;case "-":return Sub;case "/":return"/"===b.value.charAt(1)?FloorDiv:Div;case "%":return Mod;case "<":return LShift;case ">":return RShift;case "&":return BitAnd;case "^":return BitXor;case "|":return BitOr;case "*":return"*"===b.value.charAt(1)?Pow:Mult;default:goog.asserts.fail("invalid augassign")}}
function astForBinop(a,b){for(var c=new BinOp(astForExpr(a,CHILD(b,0)),getOperator(CHILD(b,1)),astForExpr(a,CHILD(b,2)),b.lineno,b.col_offset),d=(NCH(b)-1)/2,e=1;e<d;++e)var f=CHILD(b,2*e+1),g=getOperator(f),h=astForExpr(a,CHILD(b,2*e+2)),c=new BinOp(c,g,h,f.lineno,f.col_offset);return c}
function astForTestlist(a,b){goog.asserts.assert(0<NCH(b));b.type===SYM.testlist_gexp?1<NCH(b)&&goog.asserts.assert(CHILD(b,1).type!==SYM.gen_for):goog.asserts.assert(b.type===SYM.testlist||b.type===SYM.testlist_safe||b.type===SYM.testlist1);return 1===NCH(b)?astForExpr(a,CHILD(b,0)):new Tuple(seqForTestlist(a,b),Load,b.lineno,b.col_offset)}
function astForExprStmt(a,b){REQ(b,SYM.expr_stmt);if(1===NCH(b))return new Expr(astForTestlist(a,CHILD(b,0)),b.lineno,b.col_offset);if(CHILD(b,1).type===SYM.augassign){var c=CHILD(b,0),d=astForTestlist(a,c);switch(d.constructor){case GeneratorExp:throw new Sk.builtin.SyntaxError("augmented assignment to generator expression not possible",a.c_filename,b.lineno);case Yield:throw new Sk.builtin.SyntaxError("augmented assignment to yield expression not possible",a.c_filename,b.lineno);case Name:forbiddenCheck(a,
c,d.id,b.lineno);break;case Attribute:case Subscript:break;default:throw new Sk.builtin.SyntaxError("illegal expression for augmented assignment",a.c_filename,b.lineno);}setContext(a,d,Store,c);c=CHILD(b,2);c=c.type===SYM.testlist?astForTestlist(a,c):astForExpr(a,c);return new AugAssign(d,astForAugassign(a,CHILD(b,1)),c,b.lineno,b.col_offset)}REQ(CHILD(b,1),TOK.T_EQUAL);for(var d=[],e=0;e<NCH(b)-2;e+=2){c=CHILD(b,e);if(c.type===SYM.yield_expr)throw new Sk.builtin.SyntaxError("assignment to yield expression not possible",
a.c_filename,b.lineno);c=astForTestlist(a,c);setContext(a,c,Store,CHILD(b,e));d[e/2]=c}c=CHILD(b,NCH(b)-1);c=c.type===SYM.testlist?astForTestlist(a,c):astForExpr(a,c);return new Assign(d,c,b.lineno,b.col_offset)}function astForIfexpr(a,b){goog.asserts.assert(5===NCH(b));return new IfExp(astForExpr(a,CHILD(b,2)),astForExpr(a,CHILD(b,0)),astForExpr(a,CHILD(b,4)),b.lineno,b.col_offset)}
function parsestr(a,b){var c=b.charAt(0),d=!1;if("u"===c||"U"===c)b=b.substr(1),c=b.charAt(0);else if("r"===c||"R"===c)b=b.substr(1),c=b.charAt(0),d=!0;goog.asserts.assert("b"!==c&&"B"!==c,"todo; haven't done b'' strings yet");goog.asserts.assert("'"===c||'"'===c&&b.charAt(b.length-1)===c);b=b.substr(1,b.length-2);4<=b.length&&(b.charAt(0)===c&&b.charAt(1)===c)&&(goog.asserts.assert(b.charAt(b.length-1)===c&&b.charAt(b.length-2)===c),b=b.substr(2,b.length-4));if(d||-1===b.indexOf("\\"))c=strobj(decodeURIComponent(escape(b)));
else{for(var c=strobj,d=b,e=d.length,f="",g=0;g<e;++g){var h=d.charAt(g);if("\\"===h)if(++g,h=d.charAt(g),"n"===h)f+="\n";else if("\\"===h)f+="\\";else if("t"===h)f+="\t";else if("r"===h)f+="\r";else if("b"===h)f+="\b";else if("f"===h)f+="\f";else if("v"===h)f+="\v";else if("0"===h)f+="\x00";else if('"'===h)f+='"';else if("'"===h)f+="'";else{if("\n"!==h)if("x"===h)var h=d.charAt(++g),k=d.charAt(++g),f=f+String.fromCharCode(parseInt(h+k,16));else if("u"===h||"U"===h)var h=d.charAt(++g),k=d.charAt(++g),
l=d.charAt(++g),m=d.charAt(++g),f=f+String.fromCharCode(parseInt(h+k,16),parseInt(l+m,16));else f+="\\"+h}else f+=h}c=c(f)}return c}function parsestrplus(a,b){REQ(CHILD(b,0),TOK.T_STRING);for(var c=new Sk.builtin.str(""),d=0;d<NCH(b);++d)try{c=c.sq$concat(parsestr(a,CHILD(b,d).value))}catch(e){throw new Sk.builtin.SyntaxError("invalid string (possibly contains a unicode character)",a.c_filename,CHILD(b,d).lineno);}return c}
function parsenumber(a,b,c){var d=b.charAt(b.length-1);if("j"===d||"J"===d)throw new Sk.builtin.SyntaxError("complex numbers are currently unsupported",a.c_filename,c);if("l"===d||"L"===d)return Sk.longFromStr(b.substr(0,b.length-1),0);if(-1!==b.indexOf("."))return new Sk.builtin.nmber(parseFloat(b),Sk.builtin.nmber.float$);c=b;a=!1;"-"===b.charAt(0)&&(c=b.substr(1),a=!0);if("0"!==c.charAt(0)||"x"!==c.charAt(1)&&"X"!==c.charAt(1)){if(-1!==b.indexOf("e")||-1!==b.indexOf("E"))return new Sk.builtin.nmber(parseFloat(b),
Sk.builtin.nmber.float$);if("0"!==c.charAt(0)||"b"!==c.charAt(1)&&"B"!==c.charAt(1))if("0"===c.charAt(0))if("0"===c)c=0;else{c=c.substring(1);if("o"===c.charAt(0)||"O"===c.charAt(0))c=c.substring(1);c=parseInt(c,8)}else c=parseInt(c,10);else c=c.substring(2),c=parseInt(c,2)}else c=c.substring(2),c=parseInt(c,16);return c>Sk.builtin.lng.threshold$&&Math.floor(c)===c&&-1===b.indexOf("e")&&-1===b.indexOf("E")?Sk.longFromStr(b,0):a?new Sk.builtin.nmber(-c,Sk.builtin.int$):new Sk.builtin.nmber(c,Sk.builtin.int$)}
function astForSlice(a,b){REQ(b,SYM.subscript);var c=CHILD(b,0),d=null,e=null,f=null;if(c.type===TOK.T_DOT)return new Ellipsis;if(1===NCH(b)&&c.type===SYM.test)return new Index(astForExpr(a,c));c.type===SYM.test&&(d=astForExpr(a,c));c.type===TOK.T_COLON?1<NCH(b)&&(c=CHILD(b,1),c.type===SYM.test&&(e=astForExpr(a,c))):2<NCH(b)&&(c=CHILD(b,2),c.type===SYM.test&&(e=astForExpr(a,c)));c=CHILD(b,NCH(b)-1);c.type===SYM.sliceop&&(1===NCH(c)?(c=CHILD(c,0),f=new Name(strobj("None"),Load,c.lineno,c.col_offset)):
(c=CHILD(c,1),c.type===SYM.test&&(f=astForExpr(a,c))));return new Slice(d,e,f)}
function astForAtom(a,b){var c=CHILD(b,0);switch(c.type){case TOK.T_NAME:return new Name(strobj(c.value),Load,b.lineno,b.col_offset);case TOK.T_STRING:return new Str(parsestrplus(a,b),b.lineno,b.col_offset);case TOK.T_NUMBER:return new Num(parsenumber(a,c.value,b.lineno),b.lineno,b.col_offset);case TOK.T_LPAR:return c=CHILD(b,1),c.type===TOK.T_RPAR?new Tuple([],Load,b.lineno,b.col_offset):c.type===SYM.yield_expr?astForExpr(a,c):1<NCH(c)&&CHILD(c,1).type===SYM.gen_for?astForGenexp(a,c):astForTestlistGexp(a,
c);case TOK.T_LSQB:c=CHILD(b,1);if(c.type===TOK.T_RSQB)return new List([],Load,b.lineno,b.col_offset);REQ(c,SYM.listmaker);return 1===NCH(c)||CHILD(c,1).type===TOK.T_COMMA?new List(seqForTestlist(a,c),Load,b.lineno,b.col_offset):astForListcomp(a,c);case TOK.T_LBRACE:c=CHILD(b,1);NCH(c);for(var d=[],e=[],f=0;f<NCH(c);f+=4)d[f/4]=astForExpr(a,CHILD(c,f)),e[f/4]=astForExpr(a,CHILD(c,f+2));return new Dict(d,e,b.lineno,b.col_offset);case TOK.T_BACKQUOTE:throw new Sk.builtin.SyntaxError("backquote not supported, use repr()",
a.c_filename,b.lineno);default:goog.asserts.fail("unhandled atom",c.type)}}function astForPower(a,b){REQ(b,SYM.power);var c=astForAtom(a,CHILD(b,0));if(1===NCH(b))return c;for(var d=1;d<NCH(b);++d){var e=CHILD(b,d);if(e.type!==SYM.trailer)break;e=astForTrailer(a,e,c);e.lineno=c.lineno;e.col_offset=c.col_offset;c=e}CHILD(b,NCH(b)-1).type===SYM.factor&&(d=astForExpr(a,CHILD(b,NCH(b)-1)),c=new BinOp(c,Pow,d,b.lineno,b.col_offset));return c}
function astForExpr(a,b){a:for(;;){switch(b.type){case SYM.test:case SYM.old_test:if(CHILD(b,0).type===SYM.lambdef||CHILD(b,0).type===SYM.old_lambdef)return astForLambdef(a,CHILD(b,0));if(1<NCH(b))return astForIfexpr(a,b);case SYM.or_test:case SYM.and_test:if(1===NCH(b)){b=CHILD(b,0);continue a}for(var c=[],d=0;d<NCH(b);d+=2)c[d/2]=astForExpr(a,CHILD(b,d));if("and"===CHILD(b,1).value)return new BoolOp(And,c,b.lineno,b.col_offset);goog.asserts.assert("or"===CHILD(b,1).value);return new BoolOp(Or,c,
b.lineno,b.col_offset);case SYM.not_test:if(1===NCH(b)){b=CHILD(b,0);continue a}else return new UnaryOp(Not,astForExpr(a,CHILD(b,1)),b.lineno,b.col_offset);case SYM.comparison:if(1===NCH(b)){b=CHILD(b,0);continue a}else{for(var c=[],e=[],d=1;d<NCH(b);d+=2)c[(d-1)/2]=astForCompOp(a,CHILD(b,d)),e[(d-1)/2]=astForExpr(a,CHILD(b,d+1));return new Compare(astForExpr(a,CHILD(b,0)),c,e,b.lineno,b.col_offset)}case SYM.expr:case SYM.xor_expr:case SYM.and_expr:case SYM.shift_expr:case SYM.arith_expr:case SYM.term:if(1===
NCH(b)){b=CHILD(b,0);continue a}return astForBinop(a,b);case SYM.yield_expr:return d=null,2===NCH(b)&&(d=astForTestlist(a,CHILD(b,1))),new Yield(d,b.lineno,b.col_offset);case SYM.factor:if(1===NCH(b)){b=CHILD(b,0);continue a}return astForFactor(a,b);case SYM.power:return astForPower(a,b);default:goog.asserts.fail("unhandled expr","n.type: %d",b.type)}break}}
function astForPrintStmt(a,b){var c=1,d=null;REQ(b,SYM.print_stmt);2<=NCH(b)&&CHILD(b,1).type===TOK.T_RIGHTSHIFT&&(d=astForExpr(a,CHILD(b,2)),c=4);for(var e=[],f=0;c<NCH(b);c+=2,++f)e[f]=astForExpr(a,CHILD(b,c));c=CHILD(b,NCH(b)-1).type===TOK.T_COMMA?!1:!0;return new Print(d,e,c,b.lineno,b.col_offset)}
function astForStmt(a,b){b.type===SYM.stmt&&(goog.asserts.assert(1===NCH(b)),b=CHILD(b,0));b.type===SYM.simple_stmt&&(goog.asserts.assert(1===numStmts(b)),b=CHILD(b,0));if(b.type===SYM.small_stmt)switch(REQ(b,SYM.small_stmt),b=CHILD(b,0),b.type){case SYM.expr_stmt:return astForExprStmt(a,b);case SYM.print_stmt:return astForPrintStmt(a,b);case SYM.del_stmt:return astForDelStmt(a,b);case SYM.pass_stmt:return new Pass(b.lineno,b.col_offset);case SYM.flow_stmt:return astForFlowStmt(a,b);case SYM.import_stmt:return astForImportStmt(a,
b);case SYM.global_stmt:return astForGlobalStmt(a,b);case SYM.exec_stmt:return astForExecStmt(a,b);case SYM.assert_stmt:return astForAssertStmt(a,b);default:goog.asserts.fail("unhandled small_stmt")}else{var c=CHILD(b,0);REQ(b,SYM.compound_stmt);switch(c.type){case SYM.if_stmt:return astForIfStmt(a,c);case SYM.while_stmt:return astForWhileStmt(a,c);case SYM.for_stmt:return astForForStmt(a,c);case SYM.try_stmt:return astForTryStmt(a,c);case SYM.with_stmt:return astForWithStmt(a,c);case SYM.funcdef:return astForFuncdef(a,
c,[]);case SYM.classdef:return astForClassdef(a,c,[]);case SYM.decorated:return astForDecorated(a,c);default:goog.asserts.assert("unhandled compound_stmt")}}}
Sk.astFromParse=function(a,b){var c=new Compiling("utf-8",b),d=[],e,f=0;switch(a.type){case SYM.file_input:for(var g=0;g<NCH(a)-1;++g)if(e=CHILD(a,g),a.type!==TOK.T_NEWLINE){REQ(e,SYM.stmt);var h=numStmts(e);if(1===h)d[f++]=astForStmt(c,e);else{e=CHILD(e,0);REQ(e,SYM.simple_stmt);for(var k=0;k<h;++k)d[f++]=astForStmt(c,CHILD(e,2*k))}}return new Module(d);case SYM.eval_input:goog.asserts.fail("todo;");case SYM.single_input:goog.asserts.fail("todo;");default:goog.asserts.fail("todo;")}};
Sk.astDump=function(a){var b=function(a){for(var b="",c=0;c<a;++c)b+=" ";return b},c=function(a,e){if(null===a)return e+"None";if(a.prototype&&void 0!==a.prototype._astname&&a.prototype._isenum)return e+a.prototype._astname+"()";if(void 0!==a._astname){for(var f=b(a._astname.length+1),g=[],h=0;h<a._fields.length;h+=2){var k=a._fields[h],l=a._fields[h+1](a),m=b(k.length+1);g.push([k,c(l,e+f+m)])}k=[];for(h=0;h<g.length;++h)l=g[h],k.push(l[0]+"="+l[1].replace(/^\s+/,""));h=k.join(",\n"+e+f);return e+
a._astname+"("+h+")"}if(goog.isArrayLike(a)){f=[];for(h=0;h<a.length;++h)f.push(c(a[h],e+" "));h=f.join(",\n");return e+"["+h.replace(/^\s+/,"")+"]"}h=!0===a?"True":!1===a?"False":a instanceof Sk.builtin.lng?a.tp$str().v:a instanceof Sk.builtin.str?a.$r().v:""+a;return e+h};return c(a,"")};goog.exportSymbol("Sk.astFromParse",Sk.astFromParse);goog.exportSymbol("Sk.astDump",Sk.astDump);var DEF_GLOBAL=1,DEF_LOCAL=2,DEF_PARAM=4,USE=8,DEF_STAR=16,DEF_DOUBLESTAR=32,DEF_INTUPLE=64,DEF_FREE=128,DEF_FREE_GLOBAL=256,DEF_FREE_CLASS=512,DEF_IMPORT=1024,DEF_BOUND=DEF_LOCAL|DEF_PARAM|DEF_IMPORT,SCOPE_OFF=11,SCOPE_MASK=7,LOCAL=1,GLOBAL_EXPLICIT=2,GLOBAL_IMPLICIT=3,FREE=4,CELL=5,OPT_IMPORT_STAR=1,OPT_EXEC=2,OPT_BARE_EXEC=4,OPT_TOPLEVEL=8,GENERATOR=2,GENERATOR_EXPRESSION=2,ModuleBlock="module",FunctionBlock="function",ClassBlock="class";
function Symbol(a,b,c){this.__name=a;this.__flags=b;this.__scope=b>>SCOPE_OFF&SCOPE_MASK;this.__namespaces=c||[]}Symbol.prototype.get_name=function(){return this.__name};Symbol.prototype.is_referenced=function(){return!!(this.__flags&USE)};Symbol.prototype.is_parameter=function(){return!!(this.__flags&DEF_PARAM)};Symbol.prototype.is_global=function(){return this.__scope===GLOBAL_IMPLICIT||this.__scope==GLOBAL_EXPLICIT};Symbol.prototype.is_declared_global=function(){return this.__scope==GLOBAL_EXPLICIT};
Symbol.prototype.is_local=function(){return!!(this.__flags&DEF_BOUND)};Symbol.prototype.is_free=function(){return this.__scope==FREE};Symbol.prototype.is_imported=function(){return!!(this.__flags&DEF_IMPORT)};Symbol.prototype.is_assigned=function(){return!!(this.__flags&DEF_LOCAL)};Symbol.prototype.is_namespace=function(){return this.__namespaces&&0<this.__namespaces.length};Symbol.prototype.get_namespaces=function(){return this.__namespaces};var astScopeCounter=0;
function SymbolTableScope(a,b,c,d,e){this.symFlags={};this.name=b;this.varnames=[];this.children=[];this.blockType=c;this.returnsValue=this.varkeywords=this.varargs=this.generator=this.childHasFree=this.hasFree=this.isNested=!1;this.lineno=e;this.table=a;a.cur&&(a.cur.nested||a.cur.blockType===FunctionBlock)&&(this.isNested=!0);d.scopeId=astScopeCounter++;a.stss[d.scopeId]=this;this.symbols={}}SymbolTableScope.prototype.get_type=function(){return this.blockType};
SymbolTableScope.prototype.get_name=function(){return this.name};SymbolTableScope.prototype.get_lineno=function(){return this.lineno};SymbolTableScope.prototype.is_nested=function(){return this.isNested};SymbolTableScope.prototype.has_children=function(){return 0<this.children.length};SymbolTableScope.prototype.get_identifiers=function(){return this._identsMatching(function(a){return!0})};
SymbolTableScope.prototype.lookup=function(a){if(this.symbols.hasOwnProperty(a))a=this.symbols[a];else{var b=this.symFlags[a],c=this.__check_children(a);a=this.symbols[a]=new Symbol(a,b,c)}return a};SymbolTableScope.prototype.__check_children=function(a){for(var b=[],c=0;c<this.children.length;++c){var d=this.children[c];d.name===a&&b.push(d)}return b};
SymbolTableScope.prototype._identsMatching=function(a){var b=[],c;for(c in this.symFlags)this.symFlags.hasOwnProperty(c)&&a(this.symFlags[c])&&b.push(c);b.sort();return b};SymbolTableScope.prototype.get_parameters=function(){goog.asserts.assert("function"==this.get_type(),"get_parameters only valid for function scopes");this._funcParams||(this._funcParams=this._identsMatching(function(a){return a&DEF_PARAM}));return this._funcParams};
SymbolTableScope.prototype.get_locals=function(){goog.asserts.assert("function"==this.get_type(),"get_locals only valid for function scopes");this._funcLocals||(this._funcLocals=this._identsMatching(function(a){return a&DEF_BOUND}));return this._funcLocals};
SymbolTableScope.prototype.get_globals=function(){goog.asserts.assert("function"==this.get_type(),"get_globals only valid for function scopes");this._funcGlobals||(this._funcGlobals=this._identsMatching(function(a){a=a>>SCOPE_OFF&SCOPE_MASK;return a==GLOBAL_IMPLICIT||a==GLOBAL_EXPLICIT}));return this._funcGlobals};
SymbolTableScope.prototype.get_frees=function(){goog.asserts.assert("function"==this.get_type(),"get_frees only valid for function scopes");this._funcFrees||(this._funcFrees=this._identsMatching(function(a){return(a>>SCOPE_OFF&SCOPE_MASK)==FREE}));return this._funcFrees};
SymbolTableScope.prototype.get_methods=function(){goog.asserts.assert("class"==this.get_type(),"get_methods only valid for class scopes");if(!this._classMethods){for(var a=[],b=0;b<this.children.length;++b)a.push(this.children[b].name);a.sort();this._classMethods=a}return this._classMethods};SymbolTableScope.prototype.getScope=function(a){a=this.symFlags[a];return void 0===a?0:a>>SCOPE_OFF&SCOPE_MASK};
function SymbolTable(a){this.filename=a;this.top=this.cur=null;this.stack=[];this.curClass=this.global=null;this.tmpname=0;this.stss={}}SymbolTable.prototype.getStsForAst=function(a){goog.asserts.assert(void 0!==a.scopeId,"ast wasn't added to st?");a=this.stss[a.scopeId];goog.asserts.assert(void 0!==a,"unknown sym tab entry");return a};
SymbolTable.prototype.SEQStmt=function(a){goog.asserts.assert(goog.isArrayLike(a),"SEQ: nodes isn't array? got %s",a);for(var b=a.length,c=0;c<b;++c){var d=a[c];d&&this.visitStmt(d)}};SymbolTable.prototype.SEQExpr=function(a){goog.asserts.assert(goog.isArrayLike(a),"SEQ: nodes isn't array? got %s",a);for(var b=a.length,c=0;c<b;++c){var d=a[c];d&&this.visitExpr(d)}};
SymbolTable.prototype.enterBlock=function(a,b,c,d){a=fixReservedNames(a);var e=null;this.cur&&(e=this.cur,this.stack.push(this.cur));this.cur=new SymbolTableScope(this,a,b,c,d);"top"===a&&(this.global=this.cur.symFlags);e&&e.children.push(this.cur)};SymbolTable.prototype.exitBlock=function(){this.cur=null;0<this.stack.length&&(this.cur=this.stack.pop())};
SymbolTable.prototype.visitParams=function(a,b){for(var c=0;c<a.length;++c){var d=a[c];if(d.constructor===Name)goog.asserts.assert(d.ctx===Param||d.ctx===Store&&!b),this.addDef(d.id,DEF_PARAM,d.lineno);else throw new Sk.builtin.SyntaxError("invalid expression in parameter list",this.filename);}};
SymbolTable.prototype.visitArguments=function(a,b){a.args&&this.visitParams(a.args,!0);a.vararg&&(this.addDef(a.vararg,DEF_PARAM,b),this.cur.varargs=!0);a.kwarg&&(this.addDef(a.kwarg,DEF_PARAM,b),this.cur.varkeywords=!0)};SymbolTable.prototype.newTmpname=function(a){this.addDef(new Sk.builtin.str("_["+ ++this.tmpname+"]"),DEF_LOCAL,a)};
SymbolTable.prototype.addDef=function(a,b,c){var d=mangleName(this.curClass,new Sk.builtin.str(a)).v,d=fixReservedNames(d),e=this.cur.symFlags[d];if(void 0!==e){if(b&DEF_PARAM&&e&DEF_PARAM)throw new Sk.builtin.SyntaxError("duplicate argument '"+a.v+"' in function definition",this.filename,c);e|=b}else e=b;this.cur.symFlags[d]=e;b&DEF_PARAM?this.cur.varnames.push(d):b&DEF_GLOBAL&&(e=b,a=this.global[d],void 0!==a&&(e|=a),this.global[d]=e)};
SymbolTable.prototype.visitSlice=function(a){switch(a.constructor){case Slice:a.lower&&this.visitExpr(a.lower);a.upper&&this.visitExpr(a.upper);a.step&&this.visitExpr(a.step);break;case ExtSlice:for(var b=0;b<a.dims.length;++b)this.visitSlice(a.dims[b]);break;case Index:this.visitExpr(a.value)}};
SymbolTable.prototype.visitStmt=function(a){goog.asserts.assert(void 0!==a,"visitStmt called with undefined");switch(a.constructor){case FunctionDef:this.addDef(a.name,DEF_LOCAL,a.lineno);a.args.defaults&&this.SEQExpr(a.args.defaults);a.decorator_list&&this.SEQExpr(a.decorator_list);this.enterBlock(a.name.v,FunctionBlock,a,a.lineno);this.visitArguments(a.args,a.lineno);this.SEQStmt(a.body);this.exitBlock();break;case ClassDef:this.addDef(a.name,DEF_LOCAL,a.lineno);this.SEQExpr(a.bases);a.decorator_list&&
this.SEQExpr(a.decorator_list);this.enterBlock(a.name.v,ClassBlock,a,a.lineno);var b=this.curClass;this.curClass=a.name;this.SEQStmt(a.body);this.curCalss=b;this.exitBlock();break;case Return_:if(a.value&&(this.visitExpr(a.value),this.cur.returnsValue=!0,this.cur.generator))throw new Sk.builtin.SyntaxError("'return' with argument inside generator",this.filename);break;case Delete_:this.SEQExpr(a.targets);break;case Assign:this.SEQExpr(a.targets);this.visitExpr(a.value);break;case AugAssign:this.visitExpr(a.target);
this.visitExpr(a.value);break;case Print:a.dest&&this.visitExpr(a.dest);this.SEQExpr(a.values);break;case For_:this.visitExpr(a.target);this.visitExpr(a.iter);this.SEQStmt(a.body);a.orelse&&this.SEQStmt(a.orelse);break;case While_:this.visitExpr(a.test);this.SEQStmt(a.body);a.orelse&&this.SEQStmt(a.orelse);break;case If_:this.visitExpr(a.test);this.SEQStmt(a.body);a.orelse&&this.SEQStmt(a.orelse);break;case Raise:a.type&&(this.visitExpr(a.type),a.inst&&(this.visitExpr(a.inst),a.tback&&this.visitExpr(a.tback)));
break;case TryExcept:this.SEQStmt(a.body);this.SEQStmt(a.orelse);this.visitExcepthandlers(a.handlers);break;case TryFinally:this.SEQStmt(a.body);this.SEQStmt(a.finalbody);break;case Assert:this.visitExpr(a.test);a.msg&&this.visitExpr(a.msg);break;case Import_:case ImportFrom:this.visitAlias(a.names,a.lineno);break;case Exec:this.visitExpr(a.body);a.globals&&(this.visitExpr(a.globals),a.locals&&this.visitExpr(a.locals));break;case Global:for(var b=a.names.length,c=0;c<b;++c){var d=mangleName(this.curClass,
a.names[c]).v,d=fixReservedNames(d),e=this.cur.symFlags[d];if(e&(DEF_LOCAL|USE)){if(e&DEF_LOCAL)throw new Sk.builtin.SyntaxError("name '"+d+"' is assigned to before global declaration",this.filename,a.lineno);throw new Sk.builtin.SyntaxError("name '"+d+"' is used prior to global declaration",this.filename,a.lineno);}this.addDef(new Sk.builtin.str(d),DEF_GLOBAL,a.lineno)}break;case Expr:this.visitExpr(a.value);break;case Pass:case Break_:case Continue_:break;case With_:this.newTmpname(a.lineno);this.visitExpr(a.context_expr);
a.optional_vars&&(this.newTmpname(a.lineno),this.visitExpr(a.optional_vars));this.SEQStmt(a.body);break;default:goog.asserts.fail("Unhandled type "+a.constructor.name+" in visitStmt")}};
SymbolTable.prototype.visitExpr=function(a){goog.asserts.assert(void 0!==a,"visitExpr called with undefined");switch(a.constructor){case BoolOp:this.SEQExpr(a.values);break;case BinOp:this.visitExpr(a.left);this.visitExpr(a.right);break;case UnaryOp:this.visitExpr(a.operand);break;case Lambda:this.addDef(new Sk.builtin.str("lambda"),DEF_LOCAL,a.lineno);a.args.defaults&&this.SEQExpr(a.args.defaults);this.enterBlock("lambda",FunctionBlock,a,a.lineno);this.visitArguments(a.args,a.lineno);this.visitExpr(a.body);
this.exitBlock();break;case IfExp:this.visitExpr(a.test);this.visitExpr(a.body);this.visitExpr(a.orelse);break;case Dict:this.SEQExpr(a.keys);this.SEQExpr(a.values);break;case ListComp:this.newTmpname(a.lineno);this.visitExpr(a.elt);this.visitComprehension(a.generators,0);break;case GeneratorExp:this.visitGenexp(a);break;case Yield:a.value&&this.visitExpr(a.value);this.cur.generator=!0;if(this.cur.returnsValue)throw new Sk.builtin.SyntaxError("'return' with argument inside generator",this.filename);
break;case Compare:this.visitExpr(a.left);this.SEQExpr(a.comparators);break;case Call:this.visitExpr(a.func);this.SEQExpr(a.args);for(var b=0;b<a.keywords.length;++b)this.visitExpr(a.keywords[b].value);a.starargs&&this.visitExpr(a.starargs);a.kwargs&&this.visitExpr(a.kwargs);break;case Num:case Str:break;case Attribute:this.visitExpr(a.value);break;case Subscript:this.visitExpr(a.value);this.visitSlice(a.slice);break;case Name:this.addDef(a.id,a.ctx===Load?USE:DEF_LOCAL,a.lineno);break;case List:case Tuple:this.SEQExpr(a.elts);
break;default:goog.asserts.fail("Unhandled type "+a.constructor.name+" in visitExpr")}};SymbolTable.prototype.visitComprehension=function(a,b){for(var c=a.length,d=b;d<c;++d){var e=a[d];this.visitExpr(e.target);this.visitExpr(e.iter);this.SEQExpr(e.ifs)}};
SymbolTable.prototype.visitAlias=function(a,b){for(var c=0;c<a.length;++c){var d=a[c],e=d=null===d.asname?d.name.v:d.asname.v,f=d.indexOf(".");-1!==f&&(e=d.substr(0,f));if("*"!==d)this.addDef(new Sk.builtin.str(e),DEF_IMPORT,b);else if(this.cur.blockType!==ModuleBlock)throw new Sk.builtin.SyntaxError("import * only allowed at module level",this.filename);}};
SymbolTable.prototype.visitGenexp=function(a){var b=a.generators[0];this.visitExpr(b.iter);this.enterBlock("genexpr",FunctionBlock,a,a.lineno);this.cur.generator=!0;this.addDef(new Sk.builtin.str(".0"),DEF_PARAM,a.lineno);this.visitExpr(b.target);this.SEQExpr(b.ifs);this.visitComprehension(a.generators,1);this.visitExpr(a.elt);this.exitBlock()};SymbolTable.prototype.visitExcepthandlers=function(a){for(var b=0,c;c=a[b];++b)c.type&&this.visitExpr(c.type),c.name&&this.visitExpr(c.name),this.SEQStmt(c.body)};
function _dictUpdate(a,b){for(var c in b)a[c]=b[c]}
SymbolTable.prototype.analyzeBlock=function(a,b,c,d){var e={},f={},g={},h={},k={};a.blockType==ClassBlock&&(_dictUpdate(g,d),b&&_dictUpdate(h,b));for(var l in a.symFlags)this.analyzeName(a,f,l,a.symFlags[l],b,e,c,d);a.blockType!==ClassBlock&&(a.blockType===FunctionBlock&&_dictUpdate(h,e),b&&_dictUpdate(h,b),_dictUpdate(g,d));d={};e=a.children.length;for(l=0;l<e;++l){var m=a.children[l];this.analyzeChildBlock(m,h,k,g,d);if(m.hasFree||m.childHasFree)a.childHasFree=!0}_dictUpdate(k,d);a.blockType===
FunctionBlock&&this.analyzeCells(f,k);this.updateSymbols(a.symFlags,f,b,k,a.blockType===ClassBlock);_dictUpdate(c,k)};SymbolTable.prototype.analyzeChildBlock=function(a,b,c,d,e){var f={};_dictUpdate(f,b);b={};_dictUpdate(b,c);c={};_dictUpdate(c,d);this.analyzeBlock(a,f,b,c);_dictUpdate(e,b)};SymbolTable.prototype.analyzeCells=function(a,b){for(var c in a)a[c]===LOCAL&&void 0!==b[c]&&(a[c]=CELL,delete b[c])};
SymbolTable.prototype.updateSymbols=function(a,b,c,d,e){for(var f in a){var g=a[f],g=g|b[f]<<SCOPE_OFF;a[f]=g}b=FREE<<SCOPE_OFF;for(f in d)d=a[f],void 0!==d?e&&d&(DEF_BOUND|DEF_GLOBAL)&&(a[f]=d|DEF_FREE_CLASS):void 0!==c[f]&&(a[f]=b)};
SymbolTable.prototype.analyzeName=function(a,b,c,d,e,f,g,h){if(d&DEF_GLOBAL){if(d&DEF_PARAM)throw new Sk.builtin.SyntaxError("name '"+c+"' is local and global",this.filename,a.lineno);b[c]=GLOBAL_EXPLICIT;h[c]=null;e&&void 0!==e[c]&&delete e[c]}else d&DEF_BOUND?(b[c]=LOCAL,f[c]=null,delete h[c]):e&&void 0!==e[c]?(b[c]=FREE,a.hasFree=!0,g[c]=null):(h&&void 0!==h[c]||!a.isNested||(a.hasFree=!0),b[c]=GLOBAL_IMPLICIT)};SymbolTable.prototype.analyze=function(){this.analyzeBlock(this.top,null,{},{})};
Sk.symboltable=function(a,b){var c=new SymbolTable(b);c.enterBlock("top",ModuleBlock,a,0);c.top=c.cur;for(var d=0;d<a.body.length;++d)c.visitStmt(a.body[d]);c.exitBlock();c.analyze();return c};
Sk.dumpSymtab=function(a){var b=function(a){return a?"True":"False"},c=function(a){for(var b=[],c=0;c<a.length;++c)b.push((new Sk.builtin.str(a[c])).$r().v);return"["+b.join(", ")+"]"},d=function(a,f){void 0===f&&(f="");var g;g=""+(f+"Sym_type: "+a.get_type()+"\n");g+=f+"Sym_name: "+a.get_name()+"\n";g+=f+"Sym_lineno: "+a.get_lineno()+"\n";g+=f+"Sym_nested: "+b(a.is_nested())+"\n";g+=f+"Sym_haschildren: "+b(a.has_children())+"\n";"class"===a.get_type()?g+=f+"Class_methods: "+c(a.get_methods())+"\n":
"function"===a.get_type()&&(g+=f+"Func_params: "+c(a.get_parameters())+"\n",g+=f+"Func_locals: "+c(a.get_locals())+"\n",g+=f+"Func_globals: "+c(a.get_globals())+"\n",g+=f+"Func_frees: "+c(a.get_frees())+"\n");g+=f+"-- Identifiers --\n";for(var h=a.get_identifiers(),k=h.length,l=0;l<k;++l){var m=a.lookup(h[l]);g+=f+"name: "+m.get_name()+"\n";g+=f+"  is_referenced: "+b(m.is_referenced())+"\n";g+=f+"  is_imported: "+b(m.is_imported())+"\n";g+=f+"  is_parameter: "+b(m.is_parameter())+"\n";g+=f+"  is_global: "+
b(m.is_global())+"\n";g+=f+"  is_declared_global: "+b(m.is_declared_global())+"\n";g+=f+"  is_local: "+b(m.is_local())+"\n";g+=f+"  is_free: "+b(m.is_free())+"\n";g+=f+"  is_assigned: "+b(m.is_assigned())+"\n";g+=f+"  is_namespace: "+b(m.is_namespace())+"\n";var m=m.get_namespaces(),n=m.length;g+=f+"  namespaces: [\n";for(var p=[],q=0;q<n;++q)p.push(d(m[q],f+"    "));g+=p.join("\n");g+=f+"  ]\n"}return g};return d(a.top,"")};goog.exportSymbol("Sk.symboltable",Sk.symboltable);
goog.exportSymbol("Sk.dumpSymtab",Sk.dumpSymtab);var out;Sk.gensymcount=0;function Compiler(a,b,c,d){this.filename=a;this.st=b;this.flags=c;this.interactive=!1;this.nestlevel=0;this.u=null;this.stack=[];this.result=[];this.allUnits=[];this.source=d?d.split("\n"):!1}
function CompilerUnit(){this.private_=this.name=this.ste=null;this.lineno=this.firstlineno=0;this.linenoSet=!1;this.localnames=[];this.blocknum=0;this.blocks=[];this.curblock=0;this.scopename=null;this.suffixCode=this.switchCode=this.varDeclsCode=this.prefixCode="";this.breakBlocks=[];this.continueBlocks=[];this.exceptBlocks=[];this.finallyBlocks=[]}CompilerUnit.prototype.activateScope=function(){var a=this;out=function(){for(var b=a.blocks[a.curblock],c=0;c<arguments.length;++c)b.push(arguments[c])}};
Compiler.prototype.getSourceLine=function(a){goog.asserts.assert(this.source);return this.source[a-1]};Compiler.prototype.annotateSource=function(a){if(this.source){var b=a.lineno;a=a.col_offset;out("\n//\n// line ",b,":\n// ",this.getSourceLine(b),"\n// ");for(var c=0;c<a;++c)out(" ");out("^\n//\n");out("\nSk.currLineNo = ",b,";\nSk.currColNo = ",a,"\n\n");out("\nSk.currFilename = '",this.filename,"';\n\n")}};Compiler.prototype.gensym=function(a){a="$"+(a||"");return a+=Sk.gensymcount++};
Compiler.prototype.niceName=function(a){return this.gensym(a.replace("<","").replace(">","").replace(" ","_"))};
var reservedWords_={"abstract":!0,as:!0,"boolean":!0,"break":!0,"byte":!0,"case":!0,"catch":!0,"char":!0,"class":!0,"continue":!0,"const":!0,"debugger":!0,"default":!0,"delete":!0,"do":!0,"double":!0,"else":!0,"enum":!0,"export":!0,"extends":!0,"false":!0,"final":!0,"finally":!0,"float":!0,"for":!0,"function":!0,"goto":!0,"if":!0,"implements":!0,"import":!0,"in":!0,"instanceof":!0,"int":!0,"interface":!0,is:!0,"long":!0,namespace:!0,"native":!0,"new":!0,"null":!0,"package":!0,"private":!0,"protected":!0,
"public":!0,"return":!0,"short":!0,"static":!0,"super":!1,"switch":!0,"synchronized":!0,"this":!0,"throw":!0,"throws":!0,"transient":!0,"true":!0,"try":!0,"typeof":!0,use:!0,"var":!0,"void":!0,"volatile":!0,"while":!0,"with":!0};function fixReservedWords(a){return!0!==reservedWords_[a]?a:a+"_$rw$"}
var reservedNames_={__defineGetter__:!0,__defineSetter__:!0,apply:!0,call:!0,eval:!0,hasOwnProperty:!0,isPrototypeOf:!0,__lookupGetter__:!0,__lookupSetter__:!0,__noSuchMethod__:!0,propertyIsEnumerable:!0,toSource:!0,toLocaleString:!0,toString:!0,unwatch:!0,valueOf:!0,watch:!0,length:!0};function fixReservedNames(a){return reservedNames_[a]?a+"_$rn$":a}
function mangleName(a,b){var c=b.v,d=null;if(null===a||(null===c||"_"!==c.charAt(0)||"_"!==c.charAt(1))||"_"===c.charAt(c.length-1)&&"_"===c.charAt(c.length-2))return b;d=a.v;d.replace(/_/g,"");if(""===d)return b;d=a.v;d.replace(/^_*/,"");return d=new Sk.builtin.str("_"+d+c)}Compiler.prototype._gr=function(a,b){var c=this.gensym(a);out("var ",c,"=");for(var d=1;d<arguments.length;++d)out(arguments[d]);out(";");return c};
Compiler.prototype._interruptTest=function(){out("if (Sk.execStart === undefined) {Sk.execStart=new Date()}");out("if (Sk.execLimit != null && new Date() - Sk.execStart > Sk.execLimit) {throw new Sk.builtin.TimeLimitError(Sk.timeoutMsg())}")};Compiler.prototype._jumpfalse=function(a,b){var c=this._gr("jfalse","(",a,"===false||!Sk.misceval.isTrue(",a,"))");this._interruptTest();out("if(",c,"){/*test failed */$blk=",b,";continue;}")};
Compiler.prototype._jumpundef=function(a,b){this._interruptTest();out("if(",a,"===undefined){$blk=",b,";continue;}")};Compiler.prototype._jumptrue=function(a,b){var c=this._gr("jtrue","(",a,"===true||Sk.misceval.isTrue(",a,"))");this._interruptTest();out("if(",c,"){/*test passed */$blk=",b,";continue;}")};Compiler.prototype._jump=function(a){this._interruptTest();out("$blk=",a,";continue;")};
Compiler.prototype.ctupleorlist=function(a,b,c){goog.asserts.assert("tuple"===c||"list"===c);if(a.ctx===Store)for(var d=0;d<a.elts.length;++d)this.vexpr(a.elts[d],"Sk.abstr.objectGetItem("+b+","+d+")");else if(a.ctx===Load){b=[];for(d=0;d<a.elts.length;++d)b.push(this._gr("elem",this.vexpr(a.elts[d])));return this._gr("load"+c,"new Sk.builtins['",c,"']([",b,"])")}};
Compiler.prototype.cdict=function(a){goog.asserts.assert(a.values.length===a.keys.length);for(var b=[],c=0;c<a.values.length;++c){var d=this.vexpr(a.values[c]);b.push(this.vexpr(a.keys[c]));b.push(d)}return this._gr("loaddict","new Sk.builtins['dict']([",b,"])")};
Compiler.prototype.clistcompgen=function(a,b,c,d){var e=this.newBlock("list gen start"),f=this.newBlock("list gen skip"),g=this.newBlock("list gen anchor"),h=b[c],k=this.vexpr(h.iter),k=this._gr("iter","Sk.abstr.iter(",k,")");this._jump(e);this.setBlock(e);k=this._gr("next","Sk.abstr.iternext(",k,")");this._jumpundef(k,g);this.vexpr(h.target,k);for(var k=h.ifs.length,l=0;l<k;++l){var m=this.vexpr(h.ifs[l]);this._jumpfalse(m,e)}++c<b.length&&this.clistcompgen(a,b,c,d);c>=b.length&&(b=this.vexpr(d),
out(a,".v.push(",b,");"),this._jump(f),this.setBlock(f));this._jump(e);this.setBlock(g);return a};Compiler.prototype.clistcomp=function(a){goog.asserts.assert(a instanceof ListComp);var b=this._gr("_compr","new Sk.builtins['list']([])");return this.clistcompgen(b,a.generators,0,a.elt)};
Compiler.prototype.cyield=function(a){if(this.u.ste.blockType!==FunctionBlock)throw new SyntaxError("'yield' outside function");var b="null";a.value&&(b=this.vexpr(a.value));a=this.newBlock("after yield");out("return [/*resume*/",a,",/*ret*/",b,"];");this.setBlock(a);return"$gen.gi$sentvalue"};
Compiler.prototype.ccompare=function(a){goog.asserts.assert(a.ops.length===a.comparators.length);for(var b=this.vexpr(a.left),c=a.ops.length,d=this.newBlock("done"),e=this._gr("compareres","null"),f=0;f<c;++f){var g=this.vexpr(a.comparators[f]),b=this._gr("compare","Sk.builtin.bool(Sk.misceval.richCompareBool(",b,",",g,",'",a.ops[f].prototype._astname,"'))");out(e,"=",b,";");this._jumpfalse(b,d);b=g}this._jump(d);this.setBlock(d);return e};
Compiler.prototype.ccall=function(a){var b=this.vexpr(a.func),c=this.vseqexpr(a.args);if(0<a.keywords.length||a.starargs||a.kwargs){for(var d=[],e=0;e<a.keywords.length;++e)d.push("'"+a.keywords[e].arg.v+"'"),d.push(this.vexpr(a.keywords[e].value));var d="["+d.join(",")+"]",f=e="undefined";a.starargs&&(e=this.vexpr(a.starargs));a.kwargs&&(f=this.vexpr(a.kwargs));return this._gr("call","Sk.misceval.call(",b,",",f,",",e,",",d,0<c.length?",":"",c,")")}return this._gr("call","Sk.misceval.callsim(",b,
0<c.length?",":"",c,")")};Compiler.prototype.cslice=function(a){goog.asserts.assert(a instanceof Slice);var b=a.lower?this.vexpr(a.lower):"null",c=a.upper?this.vexpr(a.upper):"null";a=a.step?this.vexpr(a.step):"null";return this._gr("slice","new Sk.builtins['slice'](",b,",",c,",",a,")")};
Compiler.prototype.vslicesub=function(a){var b;switch(a.constructor){case Number:case String:b=a;break;case Index:b=this.vexpr(a.value);break;case Slice:b=this.cslice(a);break;case Ellipsis:case ExtSlice:goog.asserts.fail("todo;");break;default:goog.asserts.fail("invalid subscript kind")}return b};Compiler.prototype.vslice=function(a,b,c,d){a=this.vslicesub(a);return this.chandlesubscr(b,c,a,d)};
Compiler.prototype.chandlesubscr=function(a,b,c,d){if(a===Load||a===AugLoad)return this._gr("lsubscr","Sk.abstr.objectGetItem(",b,",",c,")");a===Store||a===AugStore?out("Sk.abstr.objectSetItem(",b,",",c,",",d,");"):a===Del?out("Sk.abstr.objectDelItem(",b,",",c,");"):goog.asserts.fail("handlesubscr fail")};
Compiler.prototype.cboolop=function(a){goog.asserts.assert(a instanceof BoolOp);var b;b=a.op===And?this._jumpfalse:this._jumptrue;var c=this.newBlock("end of boolop");a=a.values;for(var d=a.length,e,f=0;f<d;++f){var g=this.vexpr(a[f]);0===f&&(e=this._gr("boolopsucc",g));out(e,"=",g,";");b.call(this,g,c)}this._jump(c);this.setBlock(c);return e};
Compiler.prototype.vexpr=function(a,b,c){a.lineno>this.u.lineno&&(this.u.lineno=a.lineno,this.u.linenoSet=!1);switch(a.constructor){case BoolOp:return this.cboolop(a);case BinOp:return this._gr("binop","Sk.abstr.numberBinOp(",this.vexpr(a.left),",",this.vexpr(a.right),",'",a.op.prototype._astname,"')");case UnaryOp:return this._gr("unaryop","Sk.abstr.numberUnaryOp(",this.vexpr(a.operand),",'",a.op.prototype._astname,"')");case Lambda:return this.clambda(a);case IfExp:return this.cifexp(a);case Dict:return this.cdict(a);
case ListComp:return this.clistcomp(a);case GeneratorExp:return this.cgenexp(a);case Yield:return this.cyield(a);case Compare:return this.ccompare(a);case Call:return b=this.ccall(a),this.annotateSource(a),b;case Num:if("number"===typeof a.n)return a.n;if(a.n instanceof Sk.builtin.nmber)return"new Sk.builtin.nmber("+a.n.v+",'"+a.n.skType+"')";if(a.n instanceof Sk.builtin.lng)return"Sk.longFromStr('"+a.n.tp$str().v+"')";goog.asserts.fail("unhandled Num type");case Str:return this._gr("str","new Sk.builtins['str'](",
a.s.$r().v,")");case Attribute:var d;a.ctx!==AugStore&&(d=this.vexpr(a.value));var e=a.attr.$r().v,e=e.substring(1,e.length-1),e=mangleName(this.u.private_,new Sk.builtin.str(e)).v,e=fixReservedWords(e),e=fixReservedNames(e);switch(a.ctx){case AugLoad:case Load:return this._gr("lattr","Sk.abstr.gattr(",d,",'",e,"')");case AugStore:out("if(",b,"!==undefined){");d=this.vexpr(c||null);out("Sk.abstr.sattr(",d,",'",e,"',",b,");");out("}");break;case Store:out("Sk.abstr.sattr(",d,",'",e,"',",b,");");break;
case Del:goog.asserts.fail("todo;");break;default:goog.asserts.fail("invalid attribute expression")}break;case Subscript:switch(a.ctx){case AugLoad:case Load:case Store:case Del:return this.vslice(a.slice,a.ctx,this.vexpr(a.value),b);case AugStore:out("if(",b,"!==undefined){");d=this.vexpr(c||null);this.vslice(a.slice,a.ctx,d,b);out("}");break;default:goog.asserts.fail("invalid subscript expression")}break;case Name:return this.nameop(a.id,a.ctx,b);case List:return this.ctupleorlist(a,b,"list");case Tuple:return this.ctupleorlist(a,
b,"tuple");default:goog.asserts.fail("unhandled case in vexpr")}};Compiler.prototype.vseqexpr=function(a,b){goog.asserts.assert(void 0===b||a.length===b.length);for(var c=[],d=0;d<a.length;++d)c.push(this.vexpr(a[d],void 0===b?void 0:b[d]));return c};
Compiler.prototype.caugassign=function(a){goog.asserts.assert(a instanceof AugAssign);var b=a.target;switch(b.constructor){case Attribute:var c=new Attribute(b.value,b.attr,AugLoad,b.lineno,b.col_offset),d=this.vexpr(c),e=this.vexpr(a.value);a=this._gr("inplbinopattr","Sk.abstr.numberInplaceBinOp(",d,",",e,",'",a.op.prototype._astname,"')");c.ctx=AugStore;return this.vexpr(c,a,b.value);case Subscript:return c=this.vslicesub(b.slice),c=new Subscript(b.value,c,AugLoad,b.lineno,b.col_offset),d=this.vexpr(c),
e=this.vexpr(a.value),a=this._gr("inplbinopsubscr","Sk.abstr.numberInplaceBinOp(",d,",",e,",'",a.op.prototype._astname,"')"),c.ctx=AugStore,this.vexpr(c,a,b.value);case Name:return c=this.nameop(b.id,Load),e=this.vexpr(a.value),a=this._gr("inplbinop","Sk.abstr.numberInplaceBinOp(",c,",",e,",'",a.op.prototype._astname,"')"),this.nameop(b.id,Store,a);default:goog.asserts.fail("unhandled case in augassign")}};
Compiler.prototype.exprConstant=function(a){switch(a.constructor){case Num:return Sk.misceval.isTrue(a.n);case Str:return Sk.misceval.isTrue(a.s);default:return-1}};Compiler.prototype.newBlock=function(a){var b=this.u.blocknum++;this.u.blocks[b]=[];this.u.blocks[b]._name=a||"<unnamed>";return b};Compiler.prototype.setBlock=function(a){goog.asserts.assert(0<=a&&a<this.u.blocknum);this.u.curblock=a};Compiler.prototype.pushBreakBlock=function(a){goog.asserts.assert(0<=a&&a<this.u.blocknum);this.u.breakBlocks.push(a)};
Compiler.prototype.popBreakBlock=function(){this.u.breakBlocks.pop()};Compiler.prototype.pushContinueBlock=function(a){goog.asserts.assert(0<=a&&a<this.u.blocknum);this.u.continueBlocks.push(a)};Compiler.prototype.popContinueBlock=function(){this.u.continueBlocks.pop()};Compiler.prototype.pushExceptBlock=function(a){goog.asserts.assert(0<=a&&a<this.u.blocknum);this.u.exceptBlocks.push(a)};Compiler.prototype.popExceptBlock=function(){this.u.exceptBlocks.pop()};
Compiler.prototype.pushFinallyBlock=function(a){goog.asserts.assert(0<=a&&a<this.u.blocknum);this.u.finallyBlocks.push(a)};Compiler.prototype.popFinallyBlock=function(){this.u.finallyBlocks.pop()};Compiler.prototype.setupExcept=function(a){out("$exc.push(",a,");")};Compiler.prototype.endExcept=function(){out("$exc.pop();")};
Compiler.prototype.outputLocals=function(a){for(var b={},c=0;a.argnames&&c<a.argnames.length;++c)b[a.argnames[c]]=!0;a.localnames.sort();for(var d=[],c=0;c<a.localnames.length;++c){var e=a.localnames[c];void 0===b[e]&&(d.push(e),b[e]=!0)}return 0<d.length?"var "+d.join(",")+";":""};
Compiler.prototype.outputAllUnits=function(){for(var a="",b=0;b<this.allUnits.length;++b){for(var c=this.allUnits[b],a=a+c.prefixCode,a=a+this.outputLocals(c),a=a+c.varDeclsCode,a=a+c.switchCode,d=c.blocks,e=0;e<d.length;++e)a+="case "+e+": /* --- "+d[e]._name+" --- */",a+=d[e].join(""),a+="throw new Sk.builtin.SystemError('internal error: unterminated block');";a+=c.suffixCode}return a};
Compiler.prototype.cif=function(a){goog.asserts.assert(a instanceof If_);var b=this.exprConstant(a.test);if(0===b)a.orelse&&this.vseqstmt(a.orelse);else if(1===b)this.vseqstmt(a.body);else{var c=this.newBlock("end of if"),b=this.newBlock("next branch of if"),d=this.vexpr(a.test);this._jumpfalse(d,b);this.vseqstmt(a.body);this._jump(c);this.setBlock(b);a.orelse&&this.vseqstmt(a.orelse);this._jump(c)}this.setBlock(c)};
Compiler.prototype.cwhile=function(a){if(0===this.exprConstant(a.test))a.orelse&&this.vseqstmt(a.orelse);else{var b=this.newBlock("while test");this._jump(b);this.setBlock(b);var c=this.newBlock("after while"),d=0<a.orelse.length?this.newBlock("while orelse"):null,e=this.newBlock("while body");this._jumpfalse(this.vexpr(a.test),d?d:c);this._jump(e);this.pushBreakBlock(c);this.pushContinueBlock(b);this.setBlock(e);this.vseqstmt(a.body);this._jump(b);this.popContinueBlock();this.popBreakBlock();0<a.orelse.length&&
(this.setBlock(d),this.vseqstmt(a.orelse),this._jump(c));this.setBlock(c)}};
Compiler.prototype.cfor=function(a){var b=this.newBlock("for start"),c=this.newBlock("for cleanup"),d=this.newBlock("for end");this.pushBreakBlock(d);this.pushContinueBlock(b);var e=this.vexpr(a.iter),f;this.u.ste.generator?(f="$loc."+this.gensym("iter"),out(f,"=Sk.abstr.iter(",e,");")):f=this._gr("iter","Sk.abstr.iter(",e,")");this._jump(b);this.setBlock(b);e=this._gr("next","Sk.abstr.iternext(",f,")");this._jumpundef(e,c);this.vexpr(a.target,e);this.vseqstmt(a.body);this._jump(b);this.setBlock(c);
this.popContinueBlock();this.popBreakBlock();this.vseqstmt(a.orelse);this._jump(d);this.setBlock(d)};Compiler.prototype.craise=function(a){if(a&&a.type&&a.type.id&&"StopIteration"===a.type.id.v)out("return undefined;");else{var b="";a.inst?(b=this.vexpr(a.inst),out("throw ",this.vexpr(a.type),"(",b,");")):a.type?a.type.func?out("throw ",this.vexpr(a.type),";"):out("throw ",this.vexpr(a.type),"('');"):out("throw $err;")}};
Compiler.prototype.ctryexcept=function(a){for(var b=a.handlers.length,c=[],d=0;d<b;++d)c.push(this.newBlock("except_"+d+"_"));var e=this.newBlock("unhandled"),f=this.newBlock("orelse"),g=this.newBlock("end");this.setupExcept(c[0]);this.vseqstmt(a.body);this.endExcept();this._jump(f);for(d=0;d<b;++d){this.setBlock(c[d]);var h=a.handlers[d];if(!h.type&&d<b-1)throw new SyntaxError("default 'except:' must be last");if(h.type){var k=this.vexpr(h.type),l=d==b-1?e:c[d+1],k=this._gr("instance","$err instanceof ",
k);this._jumpfalse(k,l)}h.name&&this.vexpr(h.name,"$err");this.vseqstmt(h.body);this._jump(g)}this.setBlock(e);out("throw $err;");this.setBlock(f);this.vseqstmt(a.orelse);this._jump(g);this.setBlock(g)};Compiler.prototype.ctryfinally=function(a){out("/*todo; tryfinally*/");this.ctryexcept(a.body[0])};Compiler.prototype.cassert=function(a){var b=this.vexpr(a.test),c=this.newBlock("end");this._jumptrue(b,c);out("throw new Sk.builtin.AssertionError(",a.msg?this.vexpr(a.msg):"",");");this.setBlock(c)};
Compiler.prototype.cimportas=function(a,b,c){a=a.v;var d=a.indexOf(".");if(-1!==d)for(a=a.substr(d+1);-1!==d;){var d=a.indexOf("."),e=-1!==d?a.substr(0,d):a;c=this._gr("lattr","Sk.abstr.gattr(",c,",'",e,"')");a=a.substr(d+1)}return this.nameop(b,Store,c)};
Compiler.prototype.cimport=function(a){for(var b=a.names.length,c=0;c<b;++c){var d=a.names[c],e=this._gr("module","Sk.builtin.__import__(",d.name.$r().v,",$gbl,$loc,[])");if(d.asname)this.cimportas(d.name,d.asname,e);else{var d=d.name,f=d.v.indexOf(".");-1!==f&&(d=new Sk.builtin.str(d.v.substr(0,f)));this.nameop(d,Store,e)}}};
Compiler.prototype.cfromimport=function(a){for(var b=a.names.length,c=[],d=0;d<b;++d)c[d]=a.names[d].name.$r().v;c=this._gr("module","Sk.builtin.__import__(",a.module.$r().v,",$gbl,$loc,[",c,"])");for(d=0;d<b;++d){var e=a.names[d];if(0===d&&"*"===e.name.v){goog.asserts.assert(1===b);out("Sk.importStar(",c,",$loc, $gbl);");break}var f=this._gr("item","Sk.abstr.gattr(",c,",",e.name.$r().v,")"),g=e.name;e.asname&&(g=e.asname);this.nameop(g,Store,f)}};
Compiler.prototype.buildcodeobj=function(a,b,c,d,e){var f=[],g=null,h=null;c&&this.vseqexpr(c);d&&d.defaults&&(f=this.vseqexpr(d.defaults));d&&d.vararg&&(g=d.vararg);d&&d.kwarg&&(h=d.kwarg);a=this.enterScope(b,a,a.lineno);c=this.u.ste.generator;var k=this.u.ste.hasFree,l=this.u.ste.childHasFree,m=this.newBlock("codeobj entry");this.u.prefixCode="var "+a+"=(function "+this.niceName(b.v)+"$(";var n=[];if(c){if(h)throw new SyntaxError(b.v+"(): keyword arguments in generators not supported");if(g)throw new SyntaxError(b.v+
"(): variable number of arguments in generators not supported");n.push("$gen")}else{h&&n.push("$kwa");for(var p=0;d&&p<d.args.length;++p)n.push(this.nameop(d.args[p].id,Param))}k&&n.push("$free");this.u.prefixCode+=n.join(",");this.u.prefixCode+="){";c&&(this.u.prefixCode+="\n// generator\n");k&&(this.u.prefixCode+="\n// has free\n");l&&(this.u.prefixCode+="\n// has cell\n");p="{}";c&&(m="$gen.gi$resumeat",p="$gen.gi$locals");var q="";l&&(q=",$cell={}");this.u.varDeclsCode+="var $blk="+m+",$exc=[],$loc="+
p+q+",$gbl=this,$err=undefined;";for(p=0;d&&p<d.args.length;++p)l=d.args[p].id,this.isCell(l)&&(this.u.varDeclsCode+="$cell."+l.v+"="+l.v+";");c||(this.u.varDeclsCode+='Sk.builtin.pyCheckArgs("'+b.v+'", arguments, '+(d?d.args.length-f.length:0)+", "+(g?Infinity:d?d.args.length:0)+", "+(h?!0:!1)+", "+k+");");if(0<f.length)for(l=d.args.length-f.length,p=0;p<f.length;++p)m=this.nameop(d.args[p+l].id,Param),this.u.varDeclsCode+="if("+m+"===undefined)"+m+"="+a+".$defaults["+p+"];";g&&(this.u.varDeclsCode+=
g.v+"=new Sk.builtins['tuple'](Array.prototype.slice.call(arguments,"+n.length+"));");h&&(this.u.varDeclsCode+=h.v+"=new Sk.builtins['dict']($kwa);");this.u.switchCode="while(true){try{ switch($blk){";this.u.suffixCode="} }catch(err){if ($exc.length>0) { $err = err; $blk=$exc.pop(); continue; } else { throw err; }} }});";e.call(this,a);var r;if(d&&0<d.args.length){e=[];for(p=0;p<d.args.length;++p)e.push(d.args[p].id.v);r=e.join("', '");this.u.argnames=e}this.exitScope();0<f.length&&out(a,
".$defaults=[",f.join(","),"];");r&&out(a,".co_varnames=['",r,"'];");h&&out(a,".co_kwargs=1;");h="";k&&(h=",$cell",this.u.ste.hasFree&&(h+=",$free"));return c?d&&0<d.args.length?this._gr("gener",'(function(){var $origargs=Array.prototype.slice.call(arguments);Sk.builtin.pyCheckArgs("',b.v,'",arguments,',d.args.length-f.length,",",d.args.length,");return new Sk.builtins['generator'](",a,",$gbl,$origargs",h,");})"):this._gr("gener",'(function(){Sk.builtin.pyCheckArgs("',b.v,"\",arguments,0,0);return new Sk.builtins['generator'](",
a,",$gbl,[]",h,");})"):this._gr("funcobj","new Sk.builtins['function'](",a,",$gbl",h,")")};Compiler.prototype.cfunction=function(a){goog.asserts.assert(a instanceof FunctionDef);var b=this.buildcodeobj(a,a.name,a.decorator_list,a.args,function(b){this.vseqstmt(a.body);out("return Sk.builtin.none.none$;")});this.nameop(a.name,Store,b)};
Compiler.prototype.clambda=function(a){goog.asserts.assert(a instanceof Lambda);return this.buildcodeobj(a,new Sk.builtin.str("<lambda>"),null,a.args,function(b){b=this.vexpr(a.body);out("return ",b,";")})};
Compiler.prototype.cifexp=function(a){var b=this.newBlock("next of ifexp"),c=this.newBlock("end of ifexp"),d=this._gr("res","null"),e=this.vexpr(a.test);this._jumpfalse(e,b);out(d,"=",this.vexpr(a.body),";");this._jump(c);this.setBlock(b);out(d,"=",this.vexpr(a.orelse),";");this._jump(c);this.setBlock(c);return d};
Compiler.prototype.cgenexpgen=function(a,b,c){var d=this.newBlock("start for "+b),e=this.newBlock("skip for "+b);this.newBlock("if cleanup for "+b);var f=this.newBlock("end for "+b),g=a[b],h;if(0===b)h="$loc.$iter0";else{var k=this.vexpr(g.iter);h="$loc."+this.gensym("iter");out(h,"=","Sk.abstr.iter(",k,");")}this._jump(d);this.setBlock(d);h=this._gr("next","Sk.abstr.iternext(",h,")");this._jumpundef(h,f);this.vexpr(g.target,h);h=g.ifs.length;for(k=0;k<h;++k){var l=this.vexpr(g.ifs[k]);this._jumpfalse(l,
d)}++b<a.length&&this.cgenexpgen(a,b,c);b>=a.length&&(a=this.vexpr(c),out("return [",e,"/*resume*/,",a,"/*ret*/];"),this.setBlock(e));this._jump(d);this.setBlock(f);1===b&&out("return null;")};Compiler.prototype.cgenexp=function(a){var b=this.buildcodeobj(a,new Sk.builtin.str("<genexpr>"),null,null,function(b){this.cgenexpgen(a.generators,0,a.elt)}),b=this._gr("gener",b,"()");out(b,".gi$locals.$iter0=Sk.abstr.iter(",this.vexpr(a.generators[0].iter),");");return b};
Compiler.prototype.cclass=function(a){goog.asserts.assert(a instanceof ClassDef);var b=this.vseqexpr(a.bases),c=this.enterScope(a.name,a,a.lineno),d=this.newBlock("class entry");this.u.prefixCode="var "+c+"=(function $"+a.name.v+"$class_outer($globals,$locals,$rest){var $gbl=$globals,$loc=$locals;";this.u.switchCode+="return(function "+a.name.v+"(){";this.u.switchCode+="var $blk="+d+",$exc=[];while(true){switch($blk){";this.u.suffixCode="}break;}}).apply(null,$rest);});";this.u.private_=a.name;this.cbody(a.body);
out("break;");this.exitScope();b=this._gr("built","Sk.misceval.buildClass($gbl,",c,",",a.name.$r().v,",[",b,"])");this.nameop(a.name,Store,b)};Compiler.prototype.ccontinue=function(a){if(0===this.u.continueBlocks.length)throw new SyntaxError("'continue' outside loop");this._jump(this.u.continueBlocks[this.u.continueBlocks.length-1])};
Compiler.prototype.vstmt=function(a){this.u.lineno=a.lineno;this.u.linenoSet=!1;this.annotateSource(a);switch(a.constructor){case FunctionDef:this.cfunction(a);break;case ClassDef:this.cclass(a);break;case Return_:if(this.u.ste.blockType!==FunctionBlock)throw new SyntaxError("'return' outside function");a.value?out("return ",this.vexpr(a.value),";"):out("return null;");break;case Delete_:this.vseqexpr(a.targets);break;case Assign:for(var b=a.targets.length,c=this.vexpr(a.value),d=0;d<b;++d)this.vexpr(a.targets[d],
c);break;case AugAssign:return this.caugassign(a);case Print:this.cprint(a);break;case For_:return this.cfor(a);case While_:return this.cwhile(a);case If_:return this.cif(a);case Raise:return this.craise(a);case TryExcept:return this.ctryexcept(a);case TryFinally:return this.ctryfinally(a);case Assert:return this.cassert(a);case Import_:return this.cimport(a);case ImportFrom:return this.cfromimport(a);case Global:break;case Expr:this.vexpr(a.value);break;case Pass:break;case Break_:if(0===this.u.breakBlocks.length)throw new SyntaxError("'break' outside loop");
this._jump(this.u.breakBlocks[this.u.breakBlocks.length-1]);break;case Continue_:this.ccontinue(a);break;default:goog.asserts.fail("unhandled case in vstmt")}};Compiler.prototype.vseqstmt=function(a){for(var b=0;b<a.length;++b)this.vstmt(a[b])};var OP_FAST=0,OP_GLOBAL=1,OP_DEREF=2,OP_NAME=3,D_NAMES=0,D_FREEVARS=1,D_CELLVARS=2;Compiler.prototype.isCell=function(a){a=mangleName(this.u.private_,a).v;return this.u.ste.getScope(a)===CELL?!0:!1};
Compiler.prototype.nameop=function(a,b,c){if((b===Store||b===AugStore||b===Del)&&"__debug__"===a.v)throw new Sk.builtin.SyntaxError("can not assign to __debug__");if((b===Store||b===AugStore||b===Del)&&"None"===a.v)throw new Sk.builtin.SyntaxError("can not assign to None");if("None"===a.v)return"Sk.builtin.none.none$";if("True"===a.v)return"Sk.builtin.bool.true$";if("False"===a.v)return"Sk.builtin.bool.false$";var d=mangleName(this.u.private_,a).v,d=fixReservedNames(d),e=OP_NAME,f=this.u.ste.getScope(d),
g=null;switch(f){case FREE:g="$free";e=OP_DEREF;break;case CELL:g="$cell";e=OP_DEREF;break;case LOCAL:this.u.ste.blockType!==FunctionBlock||this.u.ste.generator||(e=OP_FAST);break;case GLOBAL_IMPLICIT:this.u.ste.blockType===FunctionBlock&&(e=OP_GLOBAL);break;case GLOBAL_EXPLICIT:e=OP_GLOBAL}d=fixReservedWords(d);goog.asserts.assert(f||"_"===a.v.charAt(1));a=d;this.u.ste.generator||this.u.ste.blockType!==FunctionBlock?d="$loc."+d:e!==OP_FAST&&e!==OP_NAME||this.u.localnames.push(d);switch(e){case OP_FAST:switch(b){case Load:case Param:return out("if (",
d," === undefined) { throw new Error('local variable \\'",d,"\\' referenced before assignment'); }\n"),d;case Store:out(d,"=",c,";");break;case Del:out("delete ",d,";");break;default:goog.asserts.fail("unhandled")}break;case OP_NAME:switch(b){case Load:return b=this.gensym("loadname"),out("var ",b,"=",d,"!==undefined?",d,":Sk.misceval.loadname('",a,"',$gbl);"),b;case Store:out(d,"=",c,";");break;case Del:out("delete ",d,";");break;case Param:return d;default:goog.asserts.fail("unhandled")}break;case OP_GLOBAL:switch(b){case Load:return this._gr("loadgbl",
"Sk.misceval.loadname('",a,"',$gbl)");case Store:out("$gbl.",a,"=",c,";");break;case Del:out("delete $gbl.",a);break;default:goog.asserts.fail("unhandled case in name op_global")}break;case OP_DEREF:switch(b){case Load:return g+"."+a;case Store:out(g,".",a,"=",c,";");break;case Param:return a;default:goog.asserts.fail("unhandled case in name op_deref")}break;default:goog.asserts.fail("unhandled case")}};
Compiler.prototype.enterScope=function(a,b,c){var d=new CompilerUnit;d.ste=this.st.getStsForAst(b);d.name=a;d.firstlineno=c;this.u&&this.u.private_&&(d.private_=this.u.private_);this.stack.push(this.u);this.allUnits.push(d);a=this.gensym("scope");d.scopename=a;this.u=d;this.u.activateScope();this.nestlevel++;return a};
Compiler.prototype.exitScope=function(){var a=this.u;this.nestlevel--;(this.u=0<=this.stack.length-1?this.stack.pop():null)&&this.u.activateScope();if("<module>"!==a.name.v){var b=a.name.$r().v,b=b.substring(1,b.length-1),b=fixReservedWords(b),b=fixReservedNames(b);out(a.scopename,".co_name=new Sk.builtins['str']('",b,"');")}};Compiler.prototype.cbody=function(a){for(var b=0;b<a.length;++b)this.vstmt(a[b])};
Compiler.prototype.cprint=function(a){goog.asserts.assert(a instanceof Print);a.dest&&this.vexpr(a.dest);for(var b=a.values.length,c=0;c<b;++c)out("Sk.misceval.print_(","new Sk.builtins['str'](",this.vexpr(a.values[c]),").v);");a.nl&&out("Sk.misceval.print_(",'"\\n");')};
Compiler.prototype.cmod=function(a){var b=this.enterScope(new Sk.builtin.str("<module>"),a,0),c=this.newBlock("module entry");this.u.prefixCode="var "+b+"=(function($modname){";this.u.varDeclsCode="var $blk="+c+",$exc=[],$gbl={},$loc=$gbl,$err=undefined;$gbl.__name__=$modname;Sk.globals=$gbl;";this.u.switchCode="try { while(true){try{ switch($blk){";this.u.suffixCode="} }catch(err){if ($exc.length>0) { $err = err; $blk=$exc.pop(); continue; } else { throw err; }} } }catch(err){ if (err instanceof Sk.builtin.SystemExit && !Sk.throwSystemExit) { Sk.misceval.print_(err.toString() + '\\n'); return $loc; } else { throw err; } } });";
switch(a.constructor){case Module:this.cbody(a.body);out("return $loc;");break;default:goog.asserts.fail("todo; unhandled case in compilerMod")}this.exitScope();this.result.push(this.outputAllUnits());return b};Sk.compile=function(a,b,c){c=Sk.parse(b,a);c=Sk.astFromParse(c,b);var d=Sk.symboltable(c,b);a=new Compiler(b,d,0,a);b=a.cmod(c);a=a.result.join("");return{funcname:b,code:a}};goog.exportSymbol("Sk.compile",Sk.compile);Sk.resetCompiler=function(){Sk.gensymcount=0};
goog.exportSymbol("Sk.resetCompiler",Sk.resetCompiler);Sk.sysmodules=new Sk.builtin.dict([]);Sk.realsyspath=void 0;Sk.importSearchPathForName=function(a,b,c){for(var d=Sk.realsyspath.tp$iter(),e=d.tp$iternext();void 0!==e;e=d.tp$iternext())for(var f=a.replace(/\./g,"/"),e=[e.v+"/"+f+b,e.v+"/"+f+"/__init__"+b],f=0;f<e.length;++f){var g=e[f];try{return Sk.read(g),g}catch(h){}}if(!c)throw new Sk.builtin.ImportError("No module named "+a);};
Sk.doOneTimeInitialization=function(){Sk.builtin.type.basesStr_=new Sk.builtin.str("__bases__");Sk.builtin.type.mroStr_=new Sk.builtin.str("__mro__");Sk.builtin.object.$d=new Sk.builtin.dict([]);Sk.builtin.object.$d.mp$ass_subscript(Sk.builtin.type.basesStr_,new Sk.builtin.tuple([]));Sk.builtin.object.$d.mp$ass_subscript(Sk.builtin.type.mroStr_,new Sk.builtin.tuple([Sk.builtin.object]))};
Sk.importSetUpPath=function(){if(!Sk.realsyspath){for(var a=[new Sk.builtin.str("src/builtin"),new Sk.builtin.str("src/lib"),new Sk.builtin.str(".")],b=0;b<Sk.syspath.length;++b)a.push(new Sk.builtin.str(Sk.syspath[b]));Sk.realsyspath=new Sk.builtin.list(a);Sk.doOneTimeInitialization()}};if(COMPILED)var js_beautify=function(a){return a};
Sk.importModuleInternal_=function(a,b,c,d){Sk.importSetUpPath();void 0===c&&(c=a);var e=null,f=c.split("."),g;try{var h=Sk.sysmodules.mp$subscript(c);return 1<f.length?Sk.sysmodules.mp$subscript(f[0]):h}catch(k){}1<f.length&&(g=f.slice(0,f.length-1).join("."),e=Sk.importModuleInternal_(g,b));h=new Sk.builtin.module;Sk.sysmodules.mp$ass_subscript(a,h);d?a=Sk.compile(d,a+".py","exec"):(d=Sk.importSearchPathForName(a,".js",!0))?a={funcname:"$builtinmodule",code:Sk.read(d)}:(a=Sk.importSearchPathForName(a,
".py"),a=Sk.compile(Sk.read(a),a,"exec"));d=h.$js=a.code;null!=Sk.dateSet&&Sk.dateSet||(d="Sk.execStart = new Date();\n"+a.code,Sk.dateSet=!0);if(b){b=js_beautify(a.code).split("\n");for(d=1;d<=b.length;++d){for(var l="",m=(""+d).length;5>m;++m)l+=" ";b[d-1]="/* "+l+d+" */ "+b[d-1]}d=b.join("\n");Sk.debugout(d)}d+="\n"+a.funcname+"("+("new Sk.builtin.str('"+c+"')")+");";b=goog.global.eval(d);b.__name__||(b.__name__=new Sk.builtin.str(c));h.$d=b;return e?(Sk.sysmodules.mp$subscript(g).tp$setattr(f[f.length-
1],h),e):h};Sk.importModule=function(a,b){return Sk.importModuleInternal_(a,b)};Sk.importMain=function(a,b){Sk.dateSet=!1;Sk.filesLoaded=!1;Sk.sysmodules=new Sk.builtin.dict([]);Sk.realsyspath=void 0;Sk.resetCompiler();return Sk.importModuleInternal_(a,b,"__main__")};Sk.importMainWithBody=function(a,b,c){Sk.dateSet=!1;Sk.filesLoaded=!1;Sk.sysmodules=new Sk.builtin.dict([]);Sk.realsyspath=void 0;Sk.resetCompiler();return Sk.importModuleInternal_(a,b,"__main__",c)};
Sk.builtin.__import__=function(a,b,c,d){b=Sk.importModuleInternal_(a);if(!d||0===d.length)return b;b=Sk.sysmodules.mp$subscript(a);goog.asserts.assert(b);return b};Sk.importStar=function(a,b){var c=Object.getOwnPropertyNames(a.$d),d;for(d in c)b[c[d]]=a.$d[c[d]]};goog.exportSymbol("Sk.importMain",Sk.importMain);goog.exportSymbol("Sk.importMainWithBody",Sk.importMainWithBody);goog.exportSymbol("Sk.builtin.__import__",Sk.builtin.__import__);goog.exportSymbol("Sk.importStar",Sk.importStar);Sk.builtin.timSort=function(a,b){this.list=new Sk.builtin.list(a.v);this.MIN_GALLOP=7;this.listlength=b?b:a.sq$length()};Sk.builtin.timSort.prototype.lt=function(a,b){return Sk.misceval.richCompareBool(a,b,"Lt")};Sk.builtin.timSort.prototype.le=function(a,b){return!this.lt(b,a)};Sk.builtin.timSort.prototype.setitem=function(a,b){this.list.v[a]=b};
Sk.builtin.timSort.prototype.binary_sort=function(a,b){for(var c=a.base+b;c<a.base+a.len;c++){for(var d=a.base,e=c,f=a.getitem(e);d<e;){var g=d+(e-d>>1);this.lt(f,a.getitem(g))?e=g:d=g+1}goog.asserts.assert(d===e);for(g=c;g>d;g--)a.setitem(g,a.getitem(g-1));a.setitem(d,f)}};
Sk.builtin.timSort.prototype.count_run=function(a){var b;if(1>=a.len){var c=a.len;b=!1}else if(c=2,this.lt(a.getitem(a.base+1),a.getitem(a.base))){b=!0;for(var d=a.base+2;d<a.base+a.len;d++)if(this.lt(a.getitem(d),a.getitem(d-1)))c++;else break}else for(b=!1,d=a.base+2;d<a.base+a.len&&!this.lt(a.getitem(d),a.getitem(d-1));d++)c++;return{run:new Sk.builtin.listSlice(a.list,a.base,c),descending:b}};
Sk.builtin.timSort.prototype.sort=function(){var a=new Sk.builtin.listSlice(this.list,0,this.listlength);if(!(2>a.len)){this.merge_init();for(var b=this.merge_compute_minrun(a.len);0<a.len;){var c=this.count_run(a);c.descending&&c.run.reverse();if(c.run.len<b){var d=c.run.len;c.run.len=b<a.len?b:a.len;this.binary_sort(c.run,d)}a.advance(c.run.len);this.pending.push(c.run);this.merge_collapse()}goog.asserts.assert(a.base==this.listlength);this.merge_force_collapse();goog.asserts.assert(1==this.pending.length);
goog.asserts.assert(0==this.pending[0].base);goog.asserts.assert(this.pending[0].len==this.listlength)}};
Sk.builtin.timSort.prototype.gallop=function(a,b,c,d){goog.asserts.assert(0<=c&&c<b.len);var e=this;d=d?function(a,b){return e.le(a,b)}:function(a,b){return e.lt(a,b)};var f=b.base+c,g=0,h=1,k;if(d(b.getitem(f),a)){for(k=b.len-c;h<k;)if(d(b.getitem(f+h),a)){g=h;try{h=(h<<1)+1}catch(l){h=k}}else break;h>k&&(h=k);g+=c;h+=c}else{for(k=c+1;h<k&&!d(b.getitem(f-h),a);){g=h;try{h=(h<<1)+1}catch(m){h=k}}h>k&&(h=k);f=c-g;g=c-h;h=f}goog.asserts.assert(-1<=g<h<=b.len);for(g+=1;g<h;)c=g+(h-g>>1),d(b.getitem(b.base+
c),a)?g=c+1:h=c;goog.asserts.assert(g==h);return h};Sk.builtin.timSort.prototype.merge_init=function(){this.min_gallop=this.MIN_GALLOP;this.pending=[]};
Sk.builtin.timSort.prototype.merge_lo=function(a,b){goog.asserts.assert(0<a.len&&0<b.len&&a.base+a.len==b.base);var c=this.min_gallop,d=a.base;a=a.copyitems();try{if(this.setitem(d,b.popleft()),d++,1!=a.len&&0!=b.len)for(var e,f;;){for(f=e=0;;)if(this.lt(b.getitem(b.base),a.getitem(a.base))){this.setitem(d,b.popleft());d++;if(0==b.len)return;f++;e=0;if(f>=c)break}else{this.setitem(d,a.popleft());d++;if(1==a.len)return;e++;f=0;if(e>=c)break}for(c+=1;;){this.min_gallop=c-=1<c;e=this.gallop(b.getitem(b.base),
a,0,!0);for(var g=a.base;g<a.base+e;g++)this.setitem(d,a.getitem(g)),d++;a.advance(e);if(1>=a.len)return;this.setitem(d,b.popleft());d++;if(0==b.len)return;f=this.gallop(a.getitem(a.base),b,0,!1);for(g=b.base;g<b.base+f;g++)this.setitem(d,b.getitem(g)),d++;b.advance(f);if(0==b.len)return;this.setitem(d,a.popleft());d++;if(1==a.len)return;if(e<this.MIN_GALLOP&&f<this.MIN_GALLOP)break;c++;this.min_gallop=c}}}finally{goog.asserts.assert(0<=a.len&&0<=b.len);for(g=b.base;g<b.base+b.len;g++)this.setitem(d,
b.getitem(g)),d++;for(g=a.base;g<a.base+a.len;g++)this.setitem(d,a.getitem(g)),d++}};
Sk.builtin.timSort.prototype.merge_hi=function(a,b){goog.asserts.assert(0<a.len&&0<b.len&&a.base+a.len==b.base);var c=this.min_gallop,d=b.base+b.len;b=b.copyitems();try{if(d--,this.setitem(d,a.popright()),0!=a.len&&1!=b.len)for(var e,f,g,h;;){for(f=e=0;;)if(g=a.getitem(a.base+a.len-1),h=b.getitem(b.base+b.len-1),this.lt(h,g)){d--;this.setitem(d,g);a.len--;if(0==a.len)return;e++;f=0;if(e>=c)break}else{d--;this.setitem(d,h);b.len--;if(1==b.len)return;f++;e=0;if(f>=c)break}for(c+=1;;){this.min_gallop=
c-=1<c;h=b.getitem(b.base+b.len-1);var k=this.gallop(h,a,a.len-1,!0);e=a.len-k;for(var l=a.base+a.len-1;l>a.base+k-1;l--)d--,this.setitem(d,a.getitem(l));a.len-=e;if(0==a.len)return;d--;this.setitem(d,b.popright());if(1==b.len)return;g=a.getitem(a.base+a.len-1);k=this.gallop(g,b,b.len-1,!1);f=b.len-k;for(l=b.base+b.len-1;l>b.base+k-1;l--)d--,this.setitem(d,b.getitem(l));b.len-=f;if(1>=b.len)return;d--;this.setitem(d,a.popright());if(0==a.len)return;if(e<this.MIN_GALLOP&&f<this.MIN_GALLOP)break;c++;
this.min_gallop=c}}}finally{goog.asserts.assert(0<=a.len&&0<=b.len);for(l=a.base+a.len-1;l>a.base-1;l--)d--,this.setitem(d,a.getitem(l));for(l=b.base+b.len-1;l>b.base-1;l--)d--,this.setitem(d,b.getitem(l))}};
Sk.builtin.timSort.prototype.merge_at=function(a){0>a&&(a=this.pending.length+a);var b=this.pending[a],c=this.pending[a+1];goog.asserts.assert(0<b.len&&0<c.len);goog.asserts.assert(b.base+b.len==c.base);this.pending[a]=new Sk.builtin.listSlice(this.list,b.base,b.len+c.len);this.pending.splice(a+1,1);a=this.gallop(c.getitem(c.base),b,0,!0);b.advance(a);0!=b.len&&(c.len=this.gallop(b.getitem(b.base+b.len-1),c,c.len-1,!1),0!=c.len&&(b.len<=c.len?this.merge_lo(b,c):this.merge_hi(b,c)))};
Sk.builtin.timSort.prototype.merge_collapse=function(){for(var a=this.pending;1<a.length;)if(3<=a.length&&a[a.length-3].len<=a[a.length-2].len+a[a.length-1].len)a[a.length-3].len<a[a.length-1].len?this.merge_at(-3):this.merge_at(-2);else if(a[a.length-2].len<=a[a.length-1].len)this.merge_at(-2);else break};Sk.builtin.timSort.prototype.merge_force_collapse=function(){for(var a=this.pending;1<a.length;)3<=a.length&&a[a.length-3].len<a[a.length-1].len?this.merge_at(-3):this.merge_at(-2)};
Sk.builtin.timSort.prototype.merge_compute_minrun=function(a){for(var b=0;64<=a;)b|=a&1,a>>=1;return a+b};Sk.builtin.listSlice=function(a,b,c){this.list=a;this.base=b;this.len=c};Sk.builtin.listSlice.prototype.copyitems=function(){var a=this.base,b=this.base+this.len;goog.asserts.assert(0<=a<=b);return new Sk.builtin.listSlice(new Sk.builtin.list(this.list.v.slice(a,b)),0,this.len)};Sk.builtin.listSlice.prototype.advance=function(a){this.base+=a;this.len-=a;goog.asserts.assert(this.base<=this.list.sq$length())};
Sk.builtin.listSlice.prototype.getitem=function(a){return this.list.v[a]};Sk.builtin.listSlice.prototype.setitem=function(a,b){this.list.v[a]=b};Sk.builtin.listSlice.prototype.popleft=function(){var a=this.list.v[this.base];this.base++;this.len--;return a};Sk.builtin.listSlice.prototype.popright=function(){this.len--;return this.list.v[this.base+this.len]};
Sk.builtin.listSlice.prototype.reverse=function(){for(var a=this.list,b=this.base,c=b+this.len-1;b<c;){var d=a.v[b];a.v[b]=a.v[c];a.v[c]=d;b++;c--}};goog.exportSymbol("Sk.builtin.listSlice",Sk.builtin.listSlice);goog.exportSymbol("Sk.builtin.timSort",Sk.builtin.timSort);Sk.builtins={range:Sk.builtin.range,round:Sk.builtin.round,len:Sk.builtin.len,min:Sk.builtin.min,max:Sk.builtin.max,sum:Sk.builtin.sum,zip:Sk.builtin.zip,abs:Sk.builtin.abs,fabs:Sk.builtin.abs,ord:Sk.builtin.ord,chr:Sk.builtin.chr,hex:Sk.builtin.hex,oct:Sk.builtin.oct,bin:Sk.builtin.bin,dir:Sk.builtin.dir,repr:Sk.builtin.repr,open:Sk.builtin.open,isinstance:Sk.builtin.isinstance,hash:Sk.builtin.hash,getattr:Sk.builtin.getattr,float_$rw$:Sk.builtin.float_,int_$rw$:Sk.builtin.int_,hasattr:Sk.builtin.hasattr,
map:Sk.builtin.map,filter:Sk.builtin.filter,reduce:Sk.builtin.reduce,sorted:Sk.builtin.sorted,bool:Sk.builtin.bool,any:Sk.builtin.any,all:Sk.builtin.all,enumerate:Sk.builtin.enumerate,AttributeError:Sk.builtin.AttributeError,ValueError:Sk.builtin.ValueError,Exception:Sk.builtin.Exception,ZeroDivisionError:Sk.builtin.ZeroDivisionError,AssertionError:Sk.builtin.AssertionError,ImportError:Sk.builtin.ImportError,IndentationError:Sk.builtin.IndentationError,IndexError:Sk.builtin.IndexError,KeyError:Sk.builtin.KeyError,
TypeError:Sk.builtin.TypeError,NameError:Sk.builtin.NameError,IOError:Sk.builtin.IOError,NotImplementedError:Sk.builtin.NotImplementedError,SystemExit:Sk.builtin.SystemExit,OverflowError:Sk.builtin.OverflowError,OperationError:Sk.builtin.OperationError,dict:Sk.builtin.dict,file:Sk.builtin.file,"function":Sk.builtin.func,generator:Sk.builtin.generator,list:Sk.builtin.list,long_$rw$:Sk.builtin.lng,method:Sk.builtin.method,object:Sk.builtin.object,slice:Sk.builtin.slice,str:Sk.builtin.str,set:Sk.builtin.set,
tuple:Sk.builtin.tuple,type:Sk.builtin.type,input:Sk.builtin.input,raw_input:Sk.builtin.raw_input,jseval:Sk.builtin.jseval,jsmillis:Sk.builtin.jsmillis,quit:Sk.builtin.quit,exit:Sk.builtin.quit,bytearray:Sk.builtin.bytearray,callable:Sk.builtin.callable,complex:Sk.builtin.complex,delattr:Sk.builtin.delattr,divmod:Sk.builtin.divmod,eval_$rn$:Sk.builtin.eval_,execfile:Sk.builtin.execfile,format:Sk.builtin.format,frozenset:Sk.builtin.frozenset,globals:Sk.builtin.globals,help:Sk.builtin.help,issubclass:Sk.builtin.issubclass,
iter:Sk.builtin.iter,locals:Sk.builtin.locals,memoryview:Sk.builtin.memoryview,next:Sk.builtin.next_,pow:Sk.builtin.pow,property:Sk.builtin.property,reload:Sk.builtin.reload,reversed:Sk.builtin.reversed,"super":Sk.builtin.superbi,unichr:Sk.builtin.unichr,vars:Sk.builtin.vars,xrange:Sk.builtin.xrange,apply_$rn$:Sk.builtin.apply_,buffer:Sk.builtin.buffer,coerce:Sk.builtin.coerce,intern:Sk.builtin.intern};goog.exportSymbol("Sk.builtins",Sk.builtins);}());
exports.Sk = Sk;
});