# mongodb-typescript

> Hydrate MongoDB documents into TypeScript-defined objects

 - [Motivation](#motivation)
 - [Install](#install)
 - [Quick start](#quick-start)
 - [Reference](#reference)

## Motivation

When using MongoDB with TypeScript we usually want to save our "strongly-typed" entities into database collection and then
retrieve them back at some later time. During this we face three major difficulties:
 1. **objects returned by `mongodb` driver are plain objects**. This means that if we have saved an object with some functions, these functions will not be saved and will not be present on the retrieved document. If we were to assign all properties of received object to a properly TypeScript-typed object, we would have to do this recursively, since some properties can also be typed objects and have own functions.
 2. **there is not easy way to reference other collections**. In a noSQL database relations should be avoided, but we all know this is not always a viable option. In such case we define a field with id referencing some other collection and then make separate request to retrieve referenced entity and append it to referencing entity. This is tedious and not easy to explain well to TypeScript's static typing.
 3. **class definitions should reflect database schema**. In particular: we want to use a property decorator to define database indexes

This package strives to facilitate at these points by wrapping official `mongodb` package. It utilizes `class-transformer` package to hydrate and de-hydrate plain object into classed objects and vice-versa.

It may seem that it is a TypeScript equivalent to `mongoose` package, but this is not the case, since it does not provide any validation, stripping of non-defined properties or middleware.

This package is trying to be as non-restrictive as possible and to let the developer access underlying `mongodb` functions and mechanism (such as cursors) while still providing hydration, population and schema reflection.

## Install

```
$ npm install mongodb-typescript
```

Make sure to enable `emitDecoratorMetadata` and `experimentalDecorators` in [tsconfig.json](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html)

## Quick start

```typescript
import { id, Repository } from 'mongodb-typescript';

// define your entity
class User {
  @id id: ObjectId;

  name: string;

  age: number = 15;

  hello() {
    return `Hello, my name is ${this.name} and I am ${this.age} years old`;
  }
}


const repository = new Repository<User>(User, mongodbClient);

// create new user entity (MongoDB document)
const user = new User();
user.name = 'tom';

await userRepo.insert(user);

// prints "User { id: 5ba2648a6f74af5def444491, name: 'tom', age: 15 }"
console.log(user);

// now let's retrieve entity from database
const saved = await userRepo.findById(user.id);

// prints `Hello, my name is tom and I am 15 years old`
console.log(saved.hello());
```

## Reference

- [Entity definition](#entity-definition)
  - [@id](#id)
  - [@objectId](#objectId)
  - [@nested](#nested)
  - [@ignore](#ignore)
  - [@ref](#ref)
  - [@index](#index)
  - [@indexes](#indexes)
- [Repository<T>](#Repository<T>)
  - [constructor](#constructor)
  - [c](#c)
  - [count](#count)
  - [createIndexes](#createIndexes)
  - [insert](#insert)
  - [update](#update)
  - [save](#save)
  - [findOne](#findOne)
  - [findById](#findById)
  - [findManyById](#findManyById)
  - [find](#find)
  - [populate](#populate)
  - [populateMany](#populateMany)
  - [hydrate](#hydrate)
  - [dehydrate](#dehydrate)

### Entity definition

#### @id

Required. Defines primary id that will be used as `_id` of the mongo collection.

```ts
class Post {
  @id myId: ObjectId;
}
```

#### @objectId

All properties except ones decorated with `@id` that are of type ObjectId (from `bson` package) must have `@objectId` because underlying package `class-transformer` does not handle it correctly.

```ts
class Post {
  ...

  @objectId authorId: ObjectId;
}
```

#### @nested

Used to mark nested entity or array of entities.

| Parameter    |                                              |
| ------------ | -------------------------------------------- |
| typeFunction | Function that returns type of nested entity  |


Example usage:

```ts
class Texts {
  main: string;
  doc: string;
}

class Comment {
  text: string;
}

class Post {
  @id id: ObjectId;
  title: string;

  @nested(() => Texts) text: Texts;
  @nested(() => Comment) comments: Comment[]
}
```

This would represent following mongo document:
```ts
{
  "_id": ObjectId("5b27c8da65ec1b5c0c0e8ed4"),
  "title": "My new post",
  "timestamps": {
    "postedAt": ISODate("2018-09-15T10:50:38.718Z"),
    "lastUpdateAt": ISODate("2018-09-15T10:50:38.718Z"),
  },
  "comments": [
    { "text": "This is good." },
    { "text": "This is bad." }
  ]
}
```

#### @ignore

Used to mark a property as ignored so it will not ba saved in the database.

Example usage:
```ts
class User {
  @id id: ObjectId;
  name: string;
  @ignore onlyImportantAtRuntime: number;
}
```

This would represent following mongo document:
```ts
// user
{
  "_id": ObjectId("5b27d15bfab97f681aac2862"),
  "name": "gregory"
}
```

#### @ref

Used to define an entity or array of entities that will not be saved into another collection and only have a key or array of keys saved on referencing entity's collection.

This key will be saved in a field named `{@ref field name}Id` or `{@ref field name}Ids`.

To access this key directly or apply a custom name you can pass a parameter with name of your key field. See example below.

| Parameter    |                                                       |
| ------------ | ----------------------------------------------------- |
| refId        | Optional. Name of field should hold referencing key   |


Example usage:

```ts
class User {
  @id id: ObjectId;
  name: string;
}

class Post {
  @id id: ObjectId;
  title: string;

  @ref() author: User;
}
```

This would represent following mongo documents:
```ts
// post
{
  "_id": ObjectId("5b27c8da65ec1b5c0c0e8ed4"),
  "title": "My new post",
  "authorId": ObjectId("5b27d15bfab97f681aac2862")
}

// user
{
  "_id": ObjectId("5b27d15bfab97f681aac2862"),
  "name": "gregory"
}
```

Custom referencing key:
```ts
class Post {
  ...

  @objectId author_key: ObjectId;
  @ref('author_key') author: User;
}
```

#### @index

Used to define an index on a field.

*does not actually create the index. Use Repository.createIndexes to do so.*

Parameters:

| parameter    |                                                                  |
| ------------ | ---------------------------------------------------------------- |
| type         | Type of index. Use 1 or -1 for ascending or descending order, respectively. Use string value for other index types (eg. '2dsphere' for geo spacial index). Defaults to 1 |
| options      | Optional. SimpleIndexOptions. See table below, SimpleIndexOptions interface or [mongodb docs](http://docs.mongodb.org/manual/reference/command/createIndexes/) |


SimpleIndexOptions:

| field                  | type     |                                                                 |
| ----------------------- | -------- | --------------------------------------------------------------- |
| name                    | string   | Name of the index. Defaults to field name.                      |
| background              | boolean  |                                                                 |
| unique                  | boolean  |                                                                 |
| partialFilterExpression | document |                                                                 |
| sparse                  | boolean  |                                                                 |
| expireAfterSeconds      | number   |                                                                 |
| storageEngine           | document |                                                                 |
| weights                 | document |                                                                 |
| default_language        | string   |                                                                 |
| language_override       | string   |                                                                 |
| textIndexVersion        | number   |                                                                 |
| 2dsphereIndexVersion    | number   |                                                                 |
| bits                    | number   |                                                                 |
| min                     | number   |                                                                 |
| max                     | number   |                                                                 |
| bucketSize              | number   |                                                                 |
| collation               | Object   |                                                                 |


Example usage:

```ts
class User {
  ...
  @index(1, { unique: true, sparse: true, name: 'email_unique_index' }) email: string;

  @index() someId: number;
}
```

#### @indexes

Used to define an indexes on a entity (most likely compound).

*does not actually create the index. Use Repository.createIndexes to do so.*

Parameters:

| parameter | type |
| --- | --- |
| indexes | IndexOptions[] |


IndexOptions:

| field | type | |
| --- | --- | --- |
| name | string   | Required. Name of the index |
| key | document | A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of 1; for descending index, specify a value of -1. See [mongodb documentation](https://docs.mongodb.com/manual/indexes/#index-types)  |
| ... |  | All properties of `SimpleIndexOptions` |



### Repository<T>

Reference to `mongodb` collection that handles hydration and de-hydration of documents into entities and vice-versa.

Repository is a generic class that requires type parameter T should be type of entity that is stored in referenced collection.

Different repositories may reference collections in different databases at different hosts.

#### constructor

| parameter | type | |
| --- | --- | --- |
| entity | type | type of stored entities. Must equal T |
| mongoClient | MongoClient | mongo client to use for all requests |
| collection | string | name of collection to reference |

```ts
const userRepo = new Repository<User>(User, mongoClient, 'users');
```

---

#### c

`mongodb` collection used to make all the requests to the database.  
Can be used to access all features of mongodb, but returns non-hydrated (plain) objects.

```ts
const raw = await userRepo.c.findOne({ name: 'tom' });
```

---

#### count

Gets number of documents matching the filter.

| parameter | type | |
| --- | --- | --- |
| filter | Filter | Optional mongodb filter |

```ts
const total = await userRepo.count();
const adults = await userRepo.count({ age: { $gte: 18 } });
```

---

#### createIndexes

Creates all indexes defined using `@index` and `@indexes` decorators on entity.

| parameter | type | |
| --- | --- | --- |
| forceBackground | boolean | Forces background index creation |

```ts
await userRepo.createIndexes();
await userRepo.createIndexes(true);
```

---

#### insert

Inserts a new entity into database and assigns generated `_id` back to entity.

| parameter | type | |
| --- | --- | --- |
| entity | T | Entity to insert |

```ts
const user = new User();
user.name = 'tom';

await userRepo.insert(user);

// user.id is now populated
```

---

#### update

Replaces an existing entity in database.

| parameter | type | |
| --- | --- | --- |
| entity | T | Entity to update |
| options | ReplaceOptions | Options passed to `replaceOne` |

```ts
await userRepo.update(user);
await userRepo.update(user, { upsert: true });
```

---

#### save

Inserts or updates entity depending on presence of id.

```ts
await userRepo.save(user);
```

---

#### findOne

Finds a single document and returns hydrated entity.

| parameter | type | |
| --- | --- | --- |
| filter | Filter | mongodb filter |

```ts
const user = await userRepo.findOne({ name: 'tom' });
```

---

#### findById

Finds entity by its id.

| parameter | type | |
| --- | --- | --- |
| id | ObjectId | Entity id |

```ts
const user = await userRepo.findById(userId);
```

---

#### findManyById

Finds multiple entities by their ids.

| parameter | type | |
| --- | --- | --- |
| ids | ObjectId[] | Array of ids |

```ts
const users = await userRepo.findManyById([id1, id2]);
```

---

#### find

Returns mongodb cursor that hydrates entities automatically.

| parameter | type | |
| --- | --- | --- |
| filter | Filter | mongodb filter |

```ts
const cursor = userRepo.find({ age: { $gte: 18 } });

const users = await cursor.toArray();
```

---

#### populate

Populates a reference field on a single entity.

Works for both single and array references.

| parameter | type | |
| --- | --- | --- |
| entity | object | Entity instance |
| refName | string | Name of reference field |

```ts
await userRepo.populate(post, 'author');
await userRepo.populate(post, 'pinnedBy');
```

---

#### populateMany

Populates a reference field on multiple entities in a single batch query.

This is more efficient than calling `populate` in a loop.

| parameter | type | |
| --- | --- | --- |
| entities | object[] | Array of entities |
| refName | string | Name of reference field |

```ts
await userRepo.populateMany(posts, 'author');
await userRepo.populateMany(comments, 'commentator');
```

---

#### hydrate

Converts a plain object from database into typed entity with functions, typed nested entities and correctly named `_id` field.

Use this function when fetching documents via vanilla `mongodb` collection.

```ts
const raw = await userRepo.c.findOne({});
const entity = userRepo.hydrate(raw);
```

---

#### dehydrate

Returns plain object that can be saved to database.  
Handles custom `_id` names, nested entities and dereferencing of referenced objects.

> This is a standalone function and does not require associated repository.

```ts
const plain = dehydrate(entity);
```

*Inspired by [Typegoose](https://www.npmjs.com/package/typegoose) and [TypeORM](http://typeorm.io)*