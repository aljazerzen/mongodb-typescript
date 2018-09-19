import { MongoClient, ObjectId } from 'mongodb';

import { Entity, prop, Repository } from '../src';
import { clean, close, connect } from './mongo';

class User implements Entity {

  @prop()
  _id: ObjectId;

  @prop()
  name: string;

  @prop()
  age: number;

  hello() {
    return `Hello, my name is ${this.name} and I am ${this.age} years old`;
  }
}

class UserRepo extends Repository<User> {
  findAllByName(name: string) {
    return this.find({ name }).toArray();
  }
}

let client: MongoClient;
let userRepo: UserRepo

beforeAll(async () => {
  client = await connect();
  userRepo = new UserRepo(User, client, 'users');
});

describe('basic', () => {

  beforeAll(() => clean(client));

  test('insert and findOne', async () => {
    const user = new User();
    user.name = 'tom';
    user.age = 15;
    await userRepo.insert(user);

    const saved = await userRepo.findById(user._id);

    expect(saved).toHaveProperty('name', 'tom');
    expect(saved).toHaveProperty('_id');
  });

  test('update', async () => {
    const user = await userRepo.findOne();

    expect(user).not.toBeNull();
    user.age = Math.floor(Math.random() * 30);

    await userRepo.update(user);

    const saved = await userRepo.findById(user._id);
    expect(saved).toHaveProperty('age', user.age);
  });

  test('save', async () => {
    const user = new User();
    user.name = 'ben';
    user.age = 15;
    await userRepo.save(user);

    expect(user._id).not.toBeUndefined();
    const initialUserId = user._id;

    user.age = Math.floor(Math.random() * 30);
    await userRepo.save(user);

    const saved = await userRepo.findById(user._id);
    expect(saved).toHaveProperty('_id', initialUserId);
  });

  test('proper hydration', async () => {

    const saved = await userRepo.findOne();

    expect(saved).toHaveProperty('hello');
    expect(saved.hello()).toContain('Hello, my name is ');
    expect(saved._id).toBeInstanceOf(ObjectId);
  });

  test('custom repository function', async () => {
    const user = new User();
    user.name = 'tom';
    user.age = 22;
    await userRepo.collection.insertOne(user);

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

});

afterAll(() => close(client));