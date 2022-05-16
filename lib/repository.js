"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Repository = exports.dehydrate = void 0;
const class_transformer_1 = require("class-transformer");
function dehydrate(entity, idField) {
    // const plain = classToPlain(entity) as any;
    if (!entity)
        return entity;
    const refs = Reflect.getMetadata('mongo:refs', entity) || {};
    for (let name in refs) {
        const ref = refs[name];
        const reffedEntity = entity[name];
        if (reffedEntity) {
            if (!ref.array) {
                const idField = Reflect.getMetadata('mongo:id', reffedEntity);
                entity[ref.id] = reffedEntity[idField];
            }
            else {
                entity[ref.id] = reffedEntity.map((e) => e[Reflect.getMetadata('mongo:id', e)]);
            }
        }
    }
    const plain = Object.assign({}, entity);
    if (idField && idField !== '_id') {
        plain._id = plain[idField];
        delete plain[idField];
    }
    for (let name in refs) {
        delete plain[name];
    }
    const nested = Reflect.getMetadata('mongo:nested', entity) || [];
    for (let { name, array } of nested) {
        if (plain[name]) {
            if (!array) {
                plain[name] = dehydrate(plain[name]);
            }
            else {
                plain[name] = plain[name].map((e) => dehydrate(e));
            }
        }
    }
    const ignores = Reflect.getMetadata('mongo:ignore', entity) || {};
    for (const name in ignores) {
        delete plain[name];
    }
    return plain;
}
exports.dehydrate = dehydrate;
class Repository {
    constructor(Type, mongo, collection, options = {}) {
        this.Type = Type;
        this.collection = mongo.db(options.databaseName).collection(collection);
        this.idField = Reflect.getMetadata('mongo:id', this.Type.prototype);
        if (!this.idField)
            throw new Error(`repository cannot be created for entity '${Type.name}' because none of its properties has @id decorator'`);
        if (options.autoIndex)
            this.createIndexes(true);
    }
    /**
     * Underlying mongodb collection (use with caution)
     * any of methods from this will not return hydrated objects
     */
    get c() {
        return this.collection;
    }
    createIndexes(forceBackground = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const indexes = Reflect.getMetadata('mongo:indexes', this.Type.prototype) || [];
            if (indexes.length == 0)
                return null;
            if (forceBackground) {
                for (let index of indexes) {
                    index.background = true;
                }
            }
            return this.collection.createIndexes(indexes);
        });
    }
    insert(entity) {
        return __awaiter(this, void 0, void 0, function* () {
            const plain = dehydrate(entity, this.idField);
            const res = yield this.collection.insertOne(plain);
            entity[this.idField] = res.insertedId;
        });
    }
    update(entity, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const plain = dehydrate(entity, this.idField);
            yield this.collection.replaceOne({ _id: entity[this.idField] }, plain, options);
        });
    }
    save(entity) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!entity[this.idField])
                yield this.insert(entity);
            else
                yield this.update(entity);
        });
    }
    findOne(filter = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.collection.findOne(filter);
            return this.hydrate(result);
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.findOne({ _id: id });
        });
    }
    findManyById(ids) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.find({ _id: { $in: ids } }).toArray();
        });
    }
    findOneAndUpdate(filter = {}, update, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.collection.findOneAndUpdate(filter, update, options);
            return this.hydrate(result.value);
        });
    }
    findOneAndDelete(filter = {}, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.collection.findOneAndDelete(filter, options);
            return this.hydrate(result.value);
        });
    }
    remove(entity) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.c.deleteOne({ _id: entity[this.idField] });
        });
    }
    /**
     * calls mongodb.find function and returns its cursor with attached map function that hydrates results
     * mongodb.find: http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find
     */
    find(filter) {
        return this.collection.find(filter).map(doc => this.hydrate(doc));
    }
    populate(entity, refName) {
        return __awaiter(this, void 0, void 0, function* () {
            const refs = Reflect.getMetadata('mongo:refs', entity) || {};
            const ref = refs[refName];
            if (!ref)
                throw new Error(`cannot find ref '${refName}' on '${entity.constructor.name}'`);
            // if (ref.typeFunction().prototype !== this.Type.prototype)
            // throw new Error(`incompatible repository: expected ${ref.typeFunction().name}, got ${this.Type.name}`);
            if (!ref.array) {
                entity[refName] = yield this.findById(entity[ref.id]);
            }
            else {
                entity[refName] = yield this.findManyById(entity[ref.id]);
            }
        });
    }
    populateMany(entities, refName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (entities.length === 0)
                return;
            const refs = Reflect.getMetadata('mongo:refs', entities[0]) || {};
            const ref = refs[refName];
            // if (ref.typeFunction().prototype !== this.Type.prototype)
            // throw new Error(`incompatible repository: expected ${ref.typeFunction().name}, got ${this.Type.name}`);
            const referenced = yield this.findManyById(entities.map((entity) => entity[ref.id]));
            for (let entity of entities) {
                entity[refName] = referenced.find(r => r[this.idField].equals(entity[ref.id]));
            }
        });
    }
    /**
     * Gets the number of documents matching the filter.
     * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#estimatedDocumentCount
     * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#countDocuments
     * @param filter whether estimatedDocumentCount or countDocuments will be called.
     * @returns integer
     */
    count(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            if (filter) {
                return this.collection.countDocuments(filter);
            }
            return this.collection.countDocuments();
        });
    }
    hydrate(plain) {
        return plain ? (0, class_transformer_1.plainToClass)(this.Type, plain) : null;
    }
}
exports.Repository = Repository;
//# sourceMappingURL=repository.js.map