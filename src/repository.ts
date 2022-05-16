import { plainToClass } from 'class-transformer';
import {
  Collection as MongoCollection,
  Filter,
  FindOneAndUpdateOptions,
  FindOneAndDeleteOptions,
  UpdateFilter,
  IndexDescription,
  FindCursor,
  MongoClient,
  ReplaceOptions,
  ObjectId,
  WithId,
} from 'mongodb';

import { Ref } from '.';

export declare type ClassType<T> = {
  new(...args: any[]): T;
};


export function dehydrate<T>(entity: T, idField?: string): Object {
  // const plain = classToPlain(entity) as any;
  if (!entity)
    return entity;

  const refs = Reflect.getMetadata('mongo:refs', entity) || {};

  for (let name in refs) {
    const ref: Ref = refs[name];
    const reffedEntity = (entity as any)[name];
    if (reffedEntity) {
      if (!ref.array) {
        const idField = Reflect.getMetadata('mongo:id', reffedEntity);
        (entity as any)[ref.id] = reffedEntity[idField];
      } else {
        (entity as any)[ref.id] = reffedEntity.map((e: any) => e[Reflect.getMetadata('mongo:id', e)]);
      }
    }
  }
  const plain: any = Object.assign({}, entity);

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
      } else {
        plain[name] = plain[name].map((e: any) => dehydrate(e));
      }
    }
  }

  const ignores = Reflect.getMetadata('mongo:ignore', entity) || {};
  for (const name in ignores) {
    delete plain[name];
  }

  return plain;
}

export interface RepositoryOptions {
  /**
   * create indexes when creating repository. Will force `background` flag and not block other database operations.
   */
  autoIndex?: boolean;

  /**
   * database name passed to MongoClient.db
   *
   * overrides database name in connection string
   */
  databaseName?: string;
}

export class Repository<T> {

  protected readonly collection: MongoCollection;

  /**
   * Underlying mongodb collection (use with caution)
   * any of methods from this will not return hydrated objects
   */
  get c(): MongoCollection {
    return this.collection;
  }

  private readonly idField: string;

  constructor(protected Type: ClassType<T>, mongo: MongoClient, collection: string, options: RepositoryOptions = {}) {
    this.collection = mongo.db(options.databaseName).collection(collection);
    this.idField = Reflect.getMetadata('mongo:id', this.Type.prototype);
    if (!this.idField)
      throw new Error(`repository cannot be created for entity '${Type.name}' because none of its properties has @id decorator'`);

    if (options.autoIndex)
      this.createIndexes(true);
  }

  async createIndexes(forceBackground: boolean = false) {
    const indexes: IndexDescription[] = Reflect.getMetadata('mongo:indexes', this.Type.prototype) || [];

    if (indexes.length == 0)
      return null;

    if (forceBackground) {
      for (let index of indexes) {
        index.background = true;
      }
    }

    return this.collection.createIndexes(indexes);
  }

  async insert(entity: T) {
    const plain = dehydrate<T>(entity, this.idField);
    const res = await this.collection.insertOne(plain);
    (entity as any)[this.idField] = res.insertedId;
  }

  async update(entity: T, options: ReplaceOptions = {}) {
    const plain = dehydrate<T>(entity, this.idField);
    await this.collection.replaceOne({ _id: (entity as any)[this.idField] }, plain, options);
  }

  async save(entity: T) {
    if (!(entity as any)[this.idField])
      await this.insert(entity);
    else
      await this.update(entity);
  }

  async findOne(filter: Filter<any> = {}): Promise<T | null> {
    const result = await this.collection.findOne(filter);
    return this.hydrate(result);
  }

  async findById(id: ObjectId): Promise<T | null> {
    return this.findOne({ _id: id });
  }

  async findManyById(ids: ObjectId[]): Promise<T[]> {
    return this.find({ _id: { $in: ids } }).toArray();
  }

  async findOneAndUpdate(filter: Filter<any> = {}, update: UpdateFilter<any>, options: FindOneAndUpdateOptions = {}): Promise<T | null> {
    const result = await this.collection.findOneAndUpdate(filter,update, options );
    return this.hydrate(result.value)
}

  async findOneAndDelete(filter: Filter<any> = {}, options: FindOneAndDeleteOptions = {}): Promise<T | null> {
    const result = await this.collection.findOneAndDelete(filter, options );
    return this.hydrate(result.value)
  }

  async remove(entity: T): Promise<void> {
    await this.c.deleteOne({ _id: (entity as any)[this.idField] });
  }

  /**
   * calls mongodb.find function and returns its cursor with attached map function that hydrates results
   * mongodb.find: http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find
   */
  find(filter: Filter<any>): FindCursor<T> {
    return this.collection.find(filter).map(doc => this.hydrate(doc) as T);
  }

  async populate<S extends object>(entity: S, refName: string) {
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

  async populateMany<S extends object>(entities: S[], refName: string) {
    if (entities.length === 0)
      return;
    const refs = Reflect.getMetadata('mongo:refs', entities[0]) || {};
    const ref: Ref = refs[refName];

    // if (ref.typeFunction().prototype !== this.Type.prototype)
    // throw new Error(`incompatible repository: expected ${ref.typeFunction().name}, got ${this.Type.name}`);

    const referenced = await this.findManyById(entities.map((entity: any) => entity[ref.id] as ObjectId));
    for (let entity of entities) {
      (entity as any)[refName] = referenced.find(r => (r as any)[this.idField].equals((entity as any)[ref.id]));
    }
  }

  /**
   * Gets the number of documents matching the filter.
   * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#estimatedDocumentCount
   * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#countDocuments
   * @param filter whether estimatedDocumentCount or countDocuments will be called.
   * @returns integer
   */
  async count(filter?: Filter<WithId<any>>) {
    if(filter){
      return this.collection.countDocuments(filter);
    }

      return this.collection.countDocuments();
  }

  hydrate(plain: Object | null) {
    return plain ? plainToClass<T, Object>(this.Type, plain) : null;
  }
}
