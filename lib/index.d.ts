import 'reflect-metadata';
import { TypeHelpOptions } from 'class-transformer';
import { CollationOptions, Document } from 'mongodb';
import { ClassType } from './repository';
export * from './repository';
export declare type TypeFunction = (type?: TypeHelpOptions) => ClassType<any>;
/**
 * Options passed to mongodb.createIndexes
 * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#createIndexes and http://docs.mongodb.org/manual/reference/command/createIndexes/
 */
export interface IndexOptions<T> extends SimpleIndexOptions<T> {
    key: {
        [key in keyof T]?: number | string;
    };
    name: string;
}
/**
 * This must be identical (with a few stricter fields) to IndexSpecification from mongodb, but without 'key' field.
 * It would be great it we could just extend that interface but without that field.
 *
 * Options passed to mongodb.createIndexes
 * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#createIndexes and http://docs.mongodb.org/manual/reference/command/createIndexes/
 */
export interface SimpleIndexOptions<T> {
    name?: string;
    background?: boolean;
    unique?: boolean;
    partialFilterExpression?: Document;
    sparse?: boolean;
    expireAfterSeconds?: number;
    storageEngine?: object;
    weights?: {
        [key in keyof T]?: number;
    };
    default_language?: string;
    language_override?: string;
    textIndexVersion?: number;
    '2dsphereIndexVersion'?: number;
    bits?: number;
    min?: number;
    max?: number;
    bucketSize?: number;
    collation?: CollationOptions;
}
export declare function objectId(target: any, propertyKey: string): void;
export declare function id(target: any, propertyKey: string): void;
export declare function nested(typeFunction: TypeFunction): (target: any, propertyKey: string) => void;
export declare function ignore(target: any, propertyKey: any): void;
export declare function ref(refId?: string): (target: any, propertyKey: string) => void;
export declare function index<T = any>(type?: number | string, options?: SimpleIndexOptions<T>): (target: any, propertyKey: string) => void;
export declare function indexes<T = any>(options: IndexOptions<T>[]): (target: any) => void;
export interface Nested {
    name: string;
    array: boolean;
}
export interface Ref {
    id: string;
    array: boolean;
}
