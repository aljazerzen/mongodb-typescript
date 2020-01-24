import 'reflect-metadata';

import { Expose, Transform, Type, TypeOptions } from 'class-transformer';
import { CollationDocument, FilterQuery, IndexSpecification, ObjectId } from 'mongodb';

import { ClassType } from './repository';

export * from './repository';

export type TypeFunction = (type?: TypeOptions) => ClassType<any>;

/**
 * Options passed to mongodb.createIndexes
 * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#createIndexes and http://docs.mongodb.org/manual/reference/command/createIndexes/
 */
export interface IndexOptions<T> extends SimpleIndexOptions<T> {
  key: { [key in keyof T]?: number | string };
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

  // stricter
  partialFilterExpression?: FilterQuery<T>;

  sparse?: boolean;
  expireAfterSeconds?: number;
  storageEngine?: object;

  // stricter
  weights?: { [key in keyof T]?: number };
  default_language?: string;
  language_override?: string;
  textIndexVersion?: number;
  '2dsphereIndexVersion'?: number;
  bits?: number;
  min?: number;
  max?: number;
  bucketSize?: number;
  collation?: CollationDocument;
};

function isNotPrimitive(targetType: ClassType<any>, propertyKey: string) {
  if (targetType === ObjectId || targetType === String || targetType === Number || targetType === Boolean) {
    throw new Error(`property '${propertyKey}' cannot have nested type '${targetType}'`);
  }
}

function addRef(name: string, ref: Ref, target: any) {
  const refs = Reflect.getMetadata('mongo:refs', target) || {};
  refs[name] = ref;
  Reflect.defineMetadata('mongo:refs', refs, target);
}

function pushToMetadata(metadataKey: string, values: any[], target: any) {
  const data: any[] = Reflect.getMetadata(metadataKey, target) || [];
  Reflect.defineMetadata(metadataKey, data.concat(values), target);
}

export function objectId(target: any, propertyKey: string) {
  const targetType = Reflect.getMetadata('design:type', target, propertyKey);

  if (targetType === ObjectId) {
    Type(() => String)(target, propertyKey);
    Transform(val => new ObjectId(val))(target, propertyKey);
  } else if (targetType === Array) {
    Type(() => String)(target, propertyKey);
    Transform(val => val.map((v: any) => new ObjectId(v)))(target, propertyKey);
  } else {
    throw Error('@objectId can only be used on properties of type ObjectId or ObjectId[]');
  }
}

export function id(target: any, propertyKey: string) {
  const targetType = Reflect.getMetadata('design:type', target, propertyKey);
  Reflect.defineMetadata('mongo:id', propertyKey, target);

  Expose({ name: '_id' })(target, propertyKey);

  if (targetType === ObjectId) {
    Type(() => String)(target, propertyKey);
    objectId(target, propertyKey);
  }
}

export function nested(typeFunction: TypeFunction) {
  return function (target: any, propertyKey: string) {
    const targetType = Reflect.getMetadata('design:type', target, propertyKey);
    isNotPrimitive(targetType, propertyKey);

    Type(typeFunction)(target, propertyKey);

    pushToMetadata('mongo:nested', [{ name: propertyKey, typeFunction, array: targetType === Array } as Nested], target);
  }
}

export function ignore(target: any, propertyKey: any) {
  const ignores = Reflect.getMetadata('mongo:ignore', target) || {};
  ignores[propertyKey] = true;
  Reflect.defineMetadata('mongo:ignore', ignores, target);
}

export function ref(refId?: string) {
  return function (target: any, propertyKey: string) {
    const targetType = Reflect.getMetadata('design:type', target, propertyKey);
    isNotPrimitive(targetType, propertyKey);

    const array = targetType === Array;

    if (!refId) {
      refId = propertyKey + (array ? 'Ids' : 'Id');
      Reflect.defineMetadata('design:type', (array ? Array : ObjectId), target, refId);
      objectId(target, refId);
    }

    addRef(propertyKey, { id: refId, array }, target);
  };
}

export function index<T = any>(type: number | string = 1, options: SimpleIndexOptions<T> = {}) {
  return function (target: any, propertyKey: string) {
    if (!propertyKey) {
      throw new Error('@index decorator can only be applied to class properties');
    }

    const indexOptions: IndexSpecification = {
      name: propertyKey,
      ...options,
      key: { [propertyKey]: type } as any,
    };
    pushToMetadata('mongo:indexes', [indexOptions], target);
  }
}

export function indexes<T = any>(options: IndexOptions<T>[]) {
  return function (target: any) {
    pushToMetadata('mongo:indexes', options, target.prototype);
  }
}

export interface Nested {
  name: string;
  array: boolean;
}

export interface Ref {
  id: string;
  array: boolean;
}