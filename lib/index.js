"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexes = exports.index = exports.ref = exports.ignore = exports.nested = exports.id = exports.objectId = void 0;
require("reflect-metadata");
const class_transformer_1 = require("class-transformer");
const mongodb_1 = require("mongodb");
__exportStar(require("./repository"), exports);
function isNotPrimitive(targetType, propertyKey) {
    if (targetType === mongodb_1.ObjectId || targetType === String || targetType === Number || targetType === Boolean) {
        throw new Error(`property '${propertyKey}' cannot have nested type '${targetType}'`);
    }
}
function addRef(name, ref, target) {
    const refs = Reflect.getMetadata('mongo:refs', target) || {};
    refs[name] = ref;
    Reflect.defineMetadata('mongo:refs', refs, target);
}
function pushToMetadata(metadataKey, values, target) {
    const data = Reflect.getMetadata(metadataKey, target) || [];
    Reflect.defineMetadata(metadataKey, data.concat(values), target);
}
function objectId(target, propertyKey) {
    const targetType = Reflect.getMetadata('design:type', target, propertyKey);
    if (targetType === mongodb_1.ObjectId) {
        (0, class_transformer_1.Type)(() => String)(target, propertyKey);
        (0, class_transformer_1.Transform)(val => new mongodb_1.ObjectId(val.value))(target, propertyKey);
    }
    else if (targetType === Array) {
        (0, class_transformer_1.Type)(() => String)(target, propertyKey);
        (0, class_transformer_1.Transform)(val => val.value.map((v) => new mongodb_1.ObjectId(v)))(target, propertyKey);
    }
    else {
        throw Error('@objectId can only be used on properties of type ObjectId or ObjectId[]');
    }
}
exports.objectId = objectId;
function id(target, propertyKey) {
    const targetType = Reflect.getMetadata('design:type', target, propertyKey);
    Reflect.defineMetadata('mongo:id', propertyKey, target);
    (0, class_transformer_1.Expose)({ name: '_id' })(target, propertyKey);
    if (targetType === mongodb_1.ObjectId) {
        (0, class_transformer_1.Type)(() => String)(target, propertyKey);
        objectId(target, propertyKey);
    }
}
exports.id = id;
function nested(typeFunction) {
    return function (target, propertyKey) {
        const targetType = Reflect.getMetadata('design:type', target, propertyKey);
        isNotPrimitive(targetType, propertyKey);
        (0, class_transformer_1.Type)(typeFunction)(target, propertyKey);
        pushToMetadata('mongo:nested', [{ name: propertyKey, typeFunction, array: targetType === Array }], target);
    };
}
exports.nested = nested;
function ignore(target, propertyKey) {
    const ignores = Reflect.getMetadata('mongo:ignore', target) || {};
    ignores[propertyKey] = true;
    Reflect.defineMetadata('mongo:ignore', ignores, target);
}
exports.ignore = ignore;
function ref(refId) {
    return function (target, propertyKey) {
        const targetType = Reflect.getMetadata('design:type', target, propertyKey);
        isNotPrimitive(targetType, propertyKey);
        const array = targetType === Array;
        if (!refId) {
            refId = propertyKey + (array ? 'Ids' : 'Id');
            Reflect.defineMetadata('design:type', (array ? Array : mongodb_1.ObjectId), target, refId);
            objectId(target, refId);
        }
        addRef(propertyKey, { id: refId, array }, target);
    };
}
exports.ref = ref;
function index(type = 1, options = {}) {
    return function (target, propertyKey) {
        if (!propertyKey) {
            throw new Error('@index decorator can only be applied to class properties');
        }
        const indexOptions = Object.assign(Object.assign({ name: propertyKey }, options), { key: { [propertyKey]: type } });
        pushToMetadata('mongo:indexes', [indexOptions], target);
    };
}
exports.index = index;
function indexes(options) {
    return function (target) {
        pushToMetadata('mongo:indexes', options, target.prototype);
    };
}
exports.indexes = indexes;
//# sourceMappingURL=index.js.map