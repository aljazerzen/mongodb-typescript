import 'reflect-metadata';

import { Transform, Type } from 'class-transformer';
import { ObjectId } from 'mongodb';

import { Entity } from './entity';
import { ClassType } from './repository';

export * from './repository';
export * from './entity';

export function entity(name: string) {
  return function (constructor) {
    Reflect.defineMetadata('mongo:collection', name, constructor);
  }
}

function addRef<T extends Entity>(ref: Ref<T>, target) {
  const refs = Reflect.getMetadata('mongo:refs', target) || {};
  refs[ref.name] = ref;
  Reflect.defineMetadata('mongo:refs', refs, target);
}

export function prop(typeFunction?, refId?: string) {
  return function (target, propertyKey: string) {
    const targetType = Reflect.getMetadata('design:type', target, propertyKey);

    if (targetType === ObjectId) {
      // ObjectId workaround
      Type(() => String)(target, propertyKey);
      Transform(val => new ObjectId(val), { toClassOnly: false })(target, propertyKey);

    } else {

      // nested objects transform functions
      if (typeFunction) {
        Type(typeFunction)(target, propertyKey);
      }
    }

    if (refId) {
      addRef({ id: refId, name: propertyKey, typeFunction }, target);
    }
  }
}

export interface Ref<T extends Entity> {
  id: string;   // field of main entity that holds id of the referenced entity 
  name: string; // field of main entity that will hold populated data 
  typeFunction: () => ClassType<T>; // type of referenced entity
}