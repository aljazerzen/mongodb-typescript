# mongodb-typescript

> Hydrate MongoDB documents into TypeScript-defined objects

When using MongoDB with TypeScript we usually want to save our "strongly-typed" entities into database collection and then 
retrieve them back at some later time. During this we face three major difficulties:
 1. **objects returned by `mongodb` driver are plain objects**. This means that if we have saved an object with some functions, these functions will not be saved and will not be present on retrieved document. If we were to assign all properties of received object to a properly TypeScript-typed object we will have to do this recursively, since some properties can also be typed objects and have own functions.
 2. **there is not easy way to reference other collections**. In a noSQL database relations should be avoided, but we all know this is not always a viable option. In such case we define a field with id referencing some other collection and then make separate request to retrieve referenced entity and append it to referencing entity. This is tedious and not easy to explain well to TypeScript's static typing.   
 3. **class definitions should reflect database schema**. In particular: we want to use a property decorator to define database indexes 

This package strives to facilitate at these points by wrapping official `mongodb` package. It utilizes `class-transformer` package to hydrate and de-hydrate plain object into classed objects and vice-versa.

It may seem that it is a TypeScript equivalent `mongoose` package, but this is not the case, since it does not provide any validation, stripping of non-defined properties or middleware.

This package is trying to be as non-restrictive as possible and to let the developer access underlying `mongodb` functions and mechanism (as cursors) while still providing hydration, population and schema reflection.

## Basic usage

```typescript
// define your entity
class User implements Entity {
  @prop()
  _id: ObjectId;

  @prop()
  name: string;

  @prop()
  age: number = 15;

  hello() {
    return `Hello, my name is ${this.name} and I am ${this.age} years old`;
  }
}


async function start() {
  // open connection to MongoDB
  const mongodb = await mongodb.connect('[your database url]');

  // create repository (think of it as reference to collection)
  const userRepo = new Repository<User>(User, client);

  // create new user entity (MongoDB document)
  const user = new User();
  user.name = 'tom';

  // insert it into collection and retrieve _id
  await userRepo.insert(user);

  // prints "User { _id: 5ba2648a6f74af5def444491, name: 'tom', age: 15 }"
  console.log(user);

  // now let's retrieve entity from database
  const saved = await userRepo.findById(user._id);
  
  // prints `Hello, my name is tom and I am 15 years old`
  saved.hello();
}
```

*Inspired by [Typegoose](https://www.npmjs.com/package/typegoose)*
