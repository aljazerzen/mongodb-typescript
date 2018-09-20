import { plainToClass } from 'class-transformer';
import { Collection as MongoCollection, Cursor, FilterQuery, MongoClient, ObjectId } from 'mongodb';

import { Ref } from '.';
import { Entity } from './entity';

export declare type ClassType<T> = {
  new(...args: any[]): T;
};

export function dehydrate<T>(entity: T): Object {
  // const plain = classToPlain(entity) as any;

  const refs = Reflect.getMetadata('mongo:refs', entity) || {};

  for (let name in refs) {
    const ref: Ref = refs[name];
    if ((entity as any)[name]) {
      if (!ref.array) {
        (entity as any)[ref.id] = (entity as any)[name]._id;
      } else {
        (entity as any)[ref.id] = (entity as any)[name].map((e: any) => e._id);
      }
    }
  }
  const plain: any = Object.assign({}, entity);
  for (let name in refs) {
    delete plain[name];
  }

  const nested = Reflect.getMetadata('mongo:nested', entity) || [];
  for (let { name, array } of nested) {
    if (plain[name]) {
      if (!array) {
        plain[name] = dehydrate(plain[name]);
      } else {
        plain[name] = plain[name].map((e: any) => dehydrate(e));
      }
    }
  }

  return plain;
}

export class Repository<T extends Entity> {

  /**
   * Underlying mongodb collection (use with caution)
   * any of methods from this will not return hydrated objects
   */
  collection: MongoCollection;

  get c(): MongoCollection {
    return this.collection;
  }

  constructor(protected Type: ClassType<T>, mongo: MongoClient, collection: string) {
    this.collection = mongo.db().collection(collection);
  }

  async createIndexes() {
    const indexes = Reflect.getMetadata('mongo:indexes', this.Type.prototype) || [];
    if (indexes.length == 0)
      return null;
    return this.collection.createIndexes(indexes);
  }

  async insert(entity: T) {
    const plain = dehydrate<T>(entity);
    const res = await this.collection.insertOne(plain);
    entity._id = res.insertedId;
  }

  async update(entity: T) {
    const plain = dehydrate<T>(entity);
    await this.collection.updateOne({ _id: entity._id }, { $set: plain });
  }

  async save(entity: T) {
    if (!entity._id)
      await this.insert(entity);
    else
      await this.update(entity);
  }

  async findOne(query: FilterQuery<T> = {}): Promise<T | null> {
    return this.hydrate(await this.collection.findOne<Object>(query));
  }

  async findById(_id: ObjectId): Promise<T | null> {
    return this.findOne({ _id });
  }

  async findManyById(ids: ObjectId[]): Promise<T[]> {
    return this.find({ _id: { $in: ids } }).toArray();
  }

  /**
   * calls mongodb.find function and returns its cursor with attached map function that hydrates results
   * mongodb.find: http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find
   */
  find(query?: FilterQuery<T>): Cursor<T> {
    return this.collection.find(query).map(doc => this.hydrate(doc) as T);
  }

  async populate<S extends Entity>(entity: S, refName: string) {
    const refs = Reflect.getMetadata('mongo:refs', entity) || {};
    const ref: Ref = refs[refName];

    if (!ref)
      throw new Error(`cannot find ref '${refName}' on '${entity.constructor.name}'`);
    // if (ref.typeFunction().prototype !== this.Type.prototype)
    // throw new Error(`incompatible repository: expected ${ref.typeFunction().name}, got ${this.Type.name}`);

    if (!ref.array) {
      (entity as any)[refName] = await this.findById((entity as any)[ref.id] as ObjectId);
    } else {
      (entity as any)[refName] = await this.findManyById((entity as any)[ref.id] as ObjectId[]);
    }
  }

  async populateMany<S extends Entity>(entities: S[], refName: string) {
    const refs = Reflect.getMetadata('mongo:refs', entities[0]) || {};
    const ref: Ref = refs[refName];

    // if (ref.typeFunction().prototype !== this.Type.prototype)
    // throw new Error(`incompatible repository: expected ${ref.typeFunction().name}, got ${this.Type.name}`);

    const referenced = await this.findManyById(entities.map((entity: any) => entity[ref.id] as ObjectId));
    for (let entity of entities) {
      (entity as any)[refName] = referenced.find(r => r._id.equals((entity as any)[ref.id]));
    }
  }

  /**
   * Gets the number of documents matching the filter.
   * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#estimatedDocumentCount
   * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#countDocuments
   * @param estimate whether estimatedDocumentCount or countDocuments will be called.
   * @returns integer
   */
  async count(query?: FilterQuery<T>, estimate = true) {
    if (estimate)
      return this.collection.estimatedDocumentCount(query);
    else
      return this.collection.countDocuments(query);
  }

  hydrate(plain: Object | null) {
    return plain ? plainToClass<T, Object>(this.Type, plain) : null;
  }
}