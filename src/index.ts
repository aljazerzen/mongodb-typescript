import 'reflect-metadata';

import { Transform, Type, TypeOptions } from 'class-transformer';
import { FilterQuery, ObjectId } from 'mongodb';

import { Entity } from './entity';
import { ClassType } from './repository';

export * from './repository';
export * from './entity';

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
 * Options passed to mongodb.createIndexes
 * http://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#createIndexes and http://docs.mongodb.org/manual/reference/command/createIndexes/
 */
export interface SimpleIndexOptions<T> {
  name?: string;
  background?: boolean;
  unique?: boolean;
  partialFilterExpression?: FilterQuery<T>;
  sparse?: boolean;
  expireAfterSeconds?: number;
  storageEngine?: { [storageEngineName: string]: string };
  weights?: { [key in keyof T]?: number };
  default_language?: string;
  language_override?: string;
  textIndexVersion?: number;
  '2dsphereIndexVersion'?: number;
  bits?: number;
  min?: number;
  max?: number;
  bucketSize?: number;
  collation?: Object;
};

function isNotPrimitive(targetType: ClassType<any>, propertyKey: string) {
  if (targetType === ObjectId || targetType === String || targetType === Number || targetType === Boolean) {
    throw new Error(`property '${propertyKey}' cannot have nested type '${targetType}'`);
  }
}

function addRef<T extends Entity>(ref: Ref<T>, target: any) {
  const refs = Reflect.getMetadata('mongo:refs', target) || {};
  refs[ref.name] = ref;
  Reflect.defineMetadata('mongo:refs', refs, target);
}

function pushToMetadata(metadataKey: string, values: any[], target: any) {
  const data: any[] = Reflect.getMetadata(metadataKey, target) || [];
  Reflect.defineMetadata(metadataKey, data.concat(values), target);
}

export function prop() {
  return function (target: any, propertyKey: string) {
    const targetType = Reflect.getMetadata('design:type', target, propertyKey);

    if (targetType === ObjectId) {
      // ObjectId workaround
      Type(() => String)(target, propertyKey);
      Transform(val => new ObjectId(val), { toClassOnly: false })(target, propertyKey);
    }
  }
}

export function nested(typeFunction: TypeFunction) {
  return function (target: any, propertyKey: string) {
    const targetType = Reflect.getMetadata('design:type', target, propertyKey);
    isNotPrimitive(targetType, propertyKey);

    Type(typeFunction)(target, propertyKey);
  }
}

export function referenced(typeFunction: TypeFunction, refId: string) {
  return function (target: any, propertyKey: string) {
    const targetType = Reflect.getMetadata('design:type', target, propertyKey);
    isNotPrimitive(targetType, propertyKey);

    addRef({ id: refId, name: propertyKey, typeFunction }, target);
  };
}

export function index<T = any>(type: number | string = 1, options: SimpleIndexOptions<T> = {}) {
  return function (target: any, propertyKey: string) {
    if (!propertyKey) {
      throw new Error('@index decorator can only be applied to class properties');
    }

    const indexOptions: IndexOptions<T> = {
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

export interface Ref<T extends Entity> {
  id: string;   // field of main entity that holds id of the referenced entity 
  name: string; // field of main entity that will hold populated data 
  typeFunction: TypeFunction; // type of referenced entity
}