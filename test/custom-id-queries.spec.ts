import { FilterQuery, MongoClient } from 'mongodb';

import { id, Repository } from '../src';
import { clean, close, connect } from './_mongo';

let client: MongoClient;

beforeAll(async () => {
  client = await connect();
});

describe('custom-id-queries', () => {

  class User {
    @id name: string;
    age: number;
    favoriteWord?: string;
    books: string[];
  }

  class UserRepo extends Repository<User> {
    async replaceIdWrapper(a?: FilterQuery<User | { _id: any }>) {
      return this.replaceIdFieldWithId(a);
    }
  }

  let userRepo: UserRepo;

  beforeAll(async () => {
    await clean(client);
    userRepo = new UserRepo(User, client, 'users');

    const user1 = new User();
    user1.name = 'Tom';
    user1.age = 15;
    user1.favoriteWord = 'ambiguous';
    user1.books = ['The Hobbit', 'Lord of the Rings']
    await userRepo.insert(user1);

    const user2 = new User();
    user2.name = 'Bombadil';
    user2.age = 35454;
    user2.favoriteWord = 'name';
    user2.books = ['Lord of the Rings', 'The Silmarillion', '$name']
    await userRepo.insert(user2);
  });

  test('query using custom id field', async () => {
    const original = { name: 'Tom' };
    const query = await userRepo.replaceIdWrapper(original);

    expect(query).toMatchObject({ _id: 'Tom' });

    const result = await userRepo.find(original).toArray();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('name', 'Tom');
    expect(result[0]).toHaveProperty('age', 15);
  });

  test('query with arrays using custom id field', async () => {
    const original = { $and: [{ name: 'Tom' }, { age: 15 }] };
    const query = await userRepo.replaceIdWrapper(original);

    expect(query).toMatchObject({ $and: [{ _id: 'Tom' }, { age: 15 }] });

    const result = await userRepo.find(original).toArray();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('name', 'Tom');
    expect(result[0]).toHaveProperty('age', 15);
  });

  test('more queries', async () => {
    const original = { books: { $all: ['Lord of the Rings', '$name'] } };
    const query = await userRepo.replaceIdWrapper(original);

    expect(query).toMatchObject({ books: { $all: ['Lord of the Rings', '$name'] } });

    const result = await userRepo.find(original).toArray();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('name', 'Bombandil');
  });

  test('advanced queries using custom id fields', async () => {
    // find users whose name is longer than 4 characters
    const original = { $expr: { $gt: [{ $strLenCP: '$name' }, 4] } };
    const query = await userRepo.replaceIdWrapper(original);

    expect(query).toMatchObject({ $expr: { $gt: [{ $strLenCP: '$_id' }, 4] } });

    const result = await userRepo.find(original).toArray();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('name', 'Bombandil');
  });

  test('weird, but valid queries', async () => {
    // find users whose name equals '$name'
    const original = { $expr: { $eq: ["$name", { $literal: "$name" }] } };
    const query = await userRepo.replaceIdWrapper(original);

    expect(query).toMatchObject({ $expr: { $eq: ["$_id", { $literal: "$name" }] } });

    const result = await userRepo.find(original).toArray();
    expect(result).toHaveLength(0);
  });

});

afterAll(() => close(client));