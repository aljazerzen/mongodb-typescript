import { MongoClient, ObjectId } from 'mongodb';

import { Entity, prop, Repository } from '../src';
import { clean, connect } from './mongo';

class User implements Entity {
  @prop()
  _id: ObjectId;

  @prop()
  name: string = 'tom';
}

let client: MongoClient;
let userRepo: Repository<User>;

beforeAll(async () => {
  client = await connect();
  userRepo = new Repository<User>(User, client, 'users');
});

describe('options', () => {
  beforeAll(() => clean(client));

  test('default value when creating new entity', async () => {
    const user = new User();
    expect(user).toHaveProperty('name', 'tom');
    await userRepo.insert(user);

    const saved = await userRepo.findById(user._id);

    expect(saved).toHaveProperty('name', 'tom');
  });

  test('default value when fetching an entity', async () => {
    let res = await userRepo.collection.insertOne({ });

    const saved = await userRepo.findById(res.insertedId);

    expect(saved).toHaveProperty('_id');
    expect(saved).toHaveProperty('name', 'tom');
  });
});
