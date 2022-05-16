import { MongoClient, ObjectId } from 'mongodb';

import { id, index, indexes, objectId, Repository } from '../src';
import { clean, close, connect } from './_mongo';

let client: MongoClient;

beforeAll(async () => {
  client = await connect();
});

describe('basic', () => {

  class User {
    @id id: ObjectId;
    name: string;
    age: number;
    @objectId someIds: ObjectId[];

    hello() {
      return `Hello, my name is ${this.name} and I am ${this.age} years old`;
    }
  }

  class UserRepo extends Repository<User> {
    findAllByName(name: string) {
      return this.find({ name }).toArray();
    }
  }

  let userRepo: UserRepo;

  beforeAll(async () => {
    await clean(client);
    userRepo = new UserRepo(User, client, 'users');
  });

  test('insert and findOne', async () => {
    const user = new User();
    user.name = 'tom';
    user.age = 15;
    await userRepo.insert(user);

    const saved = await userRepo.findById(user.id);

    expect(saved).toHaveProperty('name', 'tom');
    expect(saved).toHaveProperty('id');
  });

  test('update', async () => {
    const user = await userRepo.findOne();

    expect(user).not.toBeNull();
    user.age = Math.floor(Math.random() * 30);

    await userRepo.update(user);

    const saved = await userRepo.findById(user.id);
    expect(saved).toHaveProperty('age', user.age);
  });

  test('save', async () => {
    const user = new User();
    user.name = 'ben';
    user.age = 15;
    await userRepo.save(user);

    expect(user.id).not.toBeUndefined();
    const initialUserId = user.id;

    user.age = Math.floor(Math.random() * 30);
    await userRepo.save(user);

    const saved = await userRepo.findById(user.id);
    expect(saved).toHaveProperty('id', initialUserId);
  });

  test('proper hydration', async () => {

    const saved = await userRepo.findOne();

    expect(saved).toHaveProperty('hello');
    expect(saved.hello()).toContain('Hello, my name is ');
    expect(saved.id).toBeInstanceOf(ObjectId);
  });

  test('custom repository function', async () => {
    const user = new User();
    user.name = 'tom';
    user.age = 22;
    await userRepo.c.insertOne(user);

    const users = await userRepo.findAllByName('tom');

    expect(users).toHaveLength(2);
    users.forEach(user => expect(user).toHaveProperty('name', 'tom'));
  });

  test('count', async () => {
    const count = await userRepo.count();

    const user = new User();
    user.name = 'tina';
    user.age = 21;
    await userRepo.save(user);

    const newCount = await userRepo.count();
    expect(newCount).toBe(count + 1);
  });

  test('array of ObjectIds', async () => {
    const user = new User();
    user.name = 'perry';
    user.age = 21;
    user.someIds = [new ObjectId(), new ObjectId()];

    await userRepo.save(user);

    const saved = await userRepo.findById(user.id);
    expect(saved.someIds).toHaveLength(2);
    expect(saved.someIds).toContainEqual(user.someIds[0]);
    expect(saved.someIds).toContainEqual(user.someIds[1]);
  });

  test('remove', async () => {
    const count = await userRepo.count();

    const saved = await userRepo.findOne();
    await userRepo.remove(saved);

    const newCount = await userRepo.count();
    expect(newCount).toBe(count - 1);
  });

  test('Find and Update', async () => {
    const user = new User();
    user.name = 'Katy';
    user.age = 21;
    user.someIds = [new ObjectId(), new ObjectId()];

    await userRepo.save(user);
    const res = await userRepo.findOneAndUpdate({_id: user.id}, {$inc: {age: 1}}, {returnDocument: 'after'})

    expect(res.age).toBe(22);
  });

  test('Find and Update', async () => {
    const user = new User();
    user.name = 'Katy2';
    user.age = 21;
    user.someIds = [new ObjectId(), new ObjectId()];

    await userRepo.save(user);
    const res = await userRepo.findOneAndUpdate({_id: user.id}, {$set: {age: 33}}, {returnDocument: 'after'})

    expect(res.age).toBe(33);
  });

  test('Find and Delete', async () => {
    const user = new User();
    user.name = 'Katy3';
    user.age = 15;
    user.someIds = [new ObjectId(), new ObjectId()];

    await userRepo.save(user);
    await userRepo.findOneAndDelete({_id: user.id})
    const res = await userRepo.findById(user.id);

    expect(res).toBe(null);
  });
});

describe('default values', () => {
  class Star {
    @id _id: ObjectId;
    age: number = 1215432154;
  }

  let starRepo: Repository<Star>;

  beforeAll(async () => {
    await clean(client);
    starRepo = new Repository<Star>(Star, client, 'stars');
  });

  test('default value when creating new entity', async () => {
    const star = new Star();
    expect(star).toHaveProperty('age', 1215432154);
    await starRepo.insert(star);

    const saved = await starRepo.findById(star._id);

    expect(saved).toHaveProperty('age', 1215432154);
  });

  test('default value when fetching an entity', async () => {
    let res = await starRepo.c.insertOne({});

    const saved = await starRepo.findById(res.insertedId);

    expect(saved).toHaveProperty('_id');
    expect(saved).toHaveProperty('age', 1215432154);
  });
});

describe('indexes', () => {
  class Cat {
    @id id: ObjectId
    @index() name: string;
  }

  class House {
    @id id: ObjectId;

    @index('2dsphere', { name: 'location_1' })
    location: number[];
  }

  @indexes<HouseCat>([
    { key: { houseId: 1, catId: 1 }, name: 'house_cat', unique: true }
  ])
  class HouseCat {
    @id _id: ObjectId;

    @objectId houseId: ObjectId;
    @objectId catId: ObjectId;
  }

  let houseRepo: Repository<House>;
  let catRepo: Repository<Cat>;
  let houseCatRepo: Repository<HouseCat>;

  beforeAll(async () => {
    houseRepo = new Repository<House>(House, client, 'houses');
    catRepo = new Repository<Cat>(Cat, client, 'cats');
    houseCatRepo = new Repository<HouseCat>(HouseCat, client, 'house_cats');
    await clean(client);
  });

  test('add simple string index', async () => {
    const cat = new Cat();
    cat.name = 'kimmy';
    await catRepo.save(cat);

    const res = await catRepo.createIndexes();
    expect(res.length).toEqual(1);
  });

  test('do not re-add existing index', async () => {
    const res = await catRepo.createIndexes();
    expect(res.length).toEqual(1);
  });

  test('location index', async () => {

    const house = new House();
    house.location = [45.15453, 12.354654];

    await houseRepo.save(house);

    await houseRepo.createIndexes();

  });

  test('location index', async () => {

    const house = new House();
    house.location = [45.15453, 12.354654];

    await houseRepo.save(house);

    await houseRepo.createIndexes();
  });

  test('compound index', async () => {
    const cat = await catRepo.findOne();
    const house = await houseRepo.findOne();

    const houseCat = new HouseCat();
    houseCat.catId = cat.id;
    houseCat.houseId = house.id;
    await houseCatRepo.save(houseCat);

    // create unique compound index
    const res = await houseCatRepo.createIndexes();
    expect(res.length).toEqual(1);

    await expect((async () => {
      const anotherHouseCat = new HouseCat();
      anotherHouseCat.catId = cat.id;
      anotherHouseCat.houseId = house.id;
      await houseCatRepo.save(anotherHouseCat);

    })()).rejects.toThrow(/E11000 duplicate key error/);
  });

});

describe('multiple databases', () => {
  class Entity1 {
    @id id: ObjectId
  }

  class Entity2 {
    @id id: ObjectId;
  }

  let repo1: Repository<Entity1>;
  let repo2: Repository<Entity2>;

  const CUSTOM_DATABASE_NAME = 'mongodb-typescript-custom-database';

  beforeAll(async () => {
    repo1 = new Repository<Entity1>(Entity1, client, 'entity1'); // database from URL
    repo2 = new Repository<Entity2>(Entity2, client, 'entity2', { databaseName: CUSTOM_DATABASE_NAME });
    await clean(client);
    await clean(client, CUSTOM_DATABASE_NAME);
  });

  test('create entity in default database', async () => {
    const entity1 = new Entity1();
    await repo1.save(entity1);

    const count1 = await client.db().collection('entity1').countDocuments();
    expect(count1).toBe(1);
  });

  test('create entity in custom database', async () => {
    const entity2 = new Entity2();
    await repo2.save(entity2);

    const count2 = await client.db(CUSTOM_DATABASE_NAME).collection('entity2').countDocuments();
    expect(count2).toBe(1);
  });
});

afterAll(() => close(client));
