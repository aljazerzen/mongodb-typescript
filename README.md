# mongodb-typescript

> Define MongoDB entities with TypeScript classes

## Basic usage

```typescript
// define your entity
@entity('user')
class User implements Entity {
  @prop()
  _id: ObjectId;

  @prop()
  name: string;

  hello() {
    return `Hello, my name is ${this.name} and I am ${this.age} years old`;
  }
}


async function start() {
  const mongodb = await mongodb.connect('[your database url]');
  const userRepo = new Repository<User>(User, client);

  // create new user entity (mongodb document)
  const user = new User();
  user.name = 'tom';
  user.age = 15;

  // insert it into collection
  await userRepo.insert(user);

  const saved = await userRepo.findById(user._id);
  saved.hello(); // prints `Hello, my name is tom and I am 15 years old`
}
```

*Inspired by [Typegoose](https://www.npmjs.com/package/typegoose)*
