import 'reflect-metadata';

import { Transform, Type, TypeOptions } from 'class-transformer';
import { ObjectId } from 'mongodb';

import { Entity } from './entity';
import { ClassType } from './repository';

export * from './repository';
export * from './entity';

export type TypeFunction = (type?: TypeOptions) => ClassType<any>;

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

export interface Ref<T extends Entity> {
  id: string;   // field of main entity that holds id of the referenced entity 
  name: string; // field of main entity that will hold populated data 
  typeFunction: TypeFunction; // type of referenced entity
}