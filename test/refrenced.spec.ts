import { MongoClient, ObjectId } from 'mongodb';

import { Entity, objectId, referenced, Repository } from '../src';
import { clean, close, connect } from './mongo';

class User implements Entity {
  @objectId() _id: ObjectId;
  name: string;
}

class Page implements Entity {
  @objectId() _id: ObjectId;
  text: string;

  @referenced(() => User, 'userId') user: User;
  @objectId() userId: ObjectId;
}

let client: MongoClient;
let userRepo: Repository<User>, pageRepo: Repository<Page>;

beforeAll(async () => {
  client = await connect();
  userRepo = new Repository<User>(User, client, 'users');
  pageRepo = new Repository<Page>(Page, client, 'pages');
});

describe('referenced objects', () => {
  beforeAll(() => clean(client));

  let user: User;

  beforeAll(async () => {
    user = new User();
    user.name = 'tom';
    await userRepo.insert(user);
  });

  test('insert entity referencing another entity', async () => {
    let page = new Page();
    page.text = 'this is my home page!';
    page.user = user;

    await pageRepo.insert(page);

    expect(page).toHaveProperty('_id');
    expect(page).toHaveProperty('user');
    expect(page.user).toHaveProperty('name', 'tom');
    expect(page).toHaveProperty('userId', user._id);

    const raw = await pageRepo.collection.findOne({ _id: page._id });
    expect(raw).not.toHaveProperty('user');
    expect(raw).toHaveProperty('userId');

    const saved = await pageRepo.findOne({});
    expect(saved).toHaveProperty('userId', user._id);
    expect(saved).not.toHaveProperty('user');
  });

  test('populate', async () => {
    const page = await pageRepo.findOne({});
    expect(page).not.toHaveProperty('user');
    await userRepo.populate(Page, page, 'user');
    console.log(page);
    expect(page).toHaveProperty('user');
  });
});

afterAll(() => close(client));
