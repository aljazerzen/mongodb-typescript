import { Collection as MongoCollection, Filter, FindOneAndUpdateOptions, FindOneAndDeleteOptions, UpdateFilter, FindCursor, MongoClient, ReplaceOptions, ObjectId, WithId } from 'mongodb';
export declare type ClassType<T> = {
    new (...args: any[]): T;
};
export declare function dehydrate<T>(entity: T, idField?: string): Object;
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
export declare class Repository<T> {
    protected Type: ClassType<T>;
    protected readonly collection: MongoCollection;
    /**
     * Underlying mongodb collection (use with caution)
     * any of methods from this will not return hydrated objects
     */
    get c(): MongoCollection;
    private readonly idField;
    constructor(Type: ClassType<T>, mongo: MongoClient, collection: string, options?: RepositoryOptions);
    createIndexes(forceBackground?: boolean): Promise<string[] | null>;
    insert(entity: T): Promise<void>;
    update(entity: T, options?: ReplaceOptions): Promise<void>;
    save(entity: T): Promise<void>;
    findOne(filter?: Filter<any>): Promise<T | null>;
    findById(id: ObjectId): Promise<T | null>;
    findManyById(ids: ObjectId[]): Promise<T[]>;
    findOneAndUpdate(filter: Filter<any> | undefined, update: UpdateFilter<any>, options?: FindOneAndUpdateOptions): Promise<T | null>;
    findOneAndDelete(filter?: Filter<any>, options?: FindOneAndDeleteOptions): Promise<T | null>;
    remove(entity: T): Promise<void>;
    /**
     * calls mongodb.find function and returns its cursor with attached map function that hydrates results
     * mongodb.find: http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#find
     */
    find(filter: Filter<any>): FindCursor<T>;
    populate<S extends object>(entity: S, refName: string): Promise<void>;
    populateMany<S extends object>(entities: S[], refName: string): Promise<void>;
    /**
     * Gets the number of documents matching the filter.
     * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#estimatedDocumentCount
     * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#countDocuments
     * @param filter whether estimatedDocumentCount or countDocuments will be called.
     * @returns integer
     */
    count(filter?: Filter<WithId<any>>): Promise<number>;
    hydrate(plain: Object | null): T | null;
}
