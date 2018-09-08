import { MongoClient, ObjectId } from 'mongodb';

import { Entity, entity, prop, Repository } from '../src';
import { clean, close, connect } from './mongo';

class Settings {
  @prop() colorScheme: string;
  @prop() articlesPerPage: number;
}

@entity('user')
class User implements Entity {

  @prop()
  _id: ObjectId;

  @prop()
  name: string;

  @prop()
  age: number;

  @prop(() => Article)
  articles: Article[];

  @prop(() => Settings)
  settings: Settings;

  hello() {
    return `Hello, my name is ${this.name} and I am ${this.age} years old`;
  }
}

@entity('page')
class Page implements Entity {
  @prop()
  _id: ObjectId;

  @prop()
  text: string;

  @prop(() => User, 'userId')
  user: User;

  @prop()
  userId: ObjectId;
}

class Article {
  @prop() title: string;
}

class UserRepo extends Repository<User> {
  findAllByName(name: string) {
    return this.find({ name });
  }
}

let client: MongoClient;
let userRepo: UserRepo, pageRepo: Repository<Page>;

beforeAll(async () => {
  client = await connect();
  userRepo = new UserRepo(User, client);
  pageRepo = new Repository<Page>(Page, client);
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

});

describe('nested objects', () => {
  beforeAll(() => clean(client));

  test('insert entity with nested object', async () => {
    const settings = new Settings();
    settings.articlesPerPage = 10;
    settings.colorScheme = 'BLACK_AND_YELLOW';

    const user = new User();
    user.name = 'tom';
    user.age = 15;
    user.settings = settings;
    await userRepo.insert(user);

    const saved = await userRepo.findById(user._id);

    expect(saved).toHaveProperty('name', 'tom');
    expect(saved).toHaveProperty('_id');
    expect(saved).toHaveProperty('settings');
    expect(saved.settings).toHaveProperty('articlesPerPage', 10);
    expect(saved.settings).toHaveProperty('colorScheme', 'BLACK_AND_YELLOW');

    expect(saved).not.toHaveProperty('articles');
  });

  test('insert nested array of objects', async () => {
    const article1 = new Article();
    article1.title = 'How to be a better JavaScript programmer';

    const article2 = new Article();
    article2.title = 'JavaScript and other bad choices';

    const user = new User();
    user.name = 'tom';
    user.age = 15;
    user.articles = [article1, article2];
    await userRepo.insert(user);

    const saved = await userRepo.findById(user._id);

    expect(saved).toHaveProperty('name', 'tom');
    expect(saved).toHaveProperty('_id');
    expect(saved).toHaveProperty('articles');
    expect(saved.articles).toHaveLength(2);

    expect(saved).not.toHaveProperty('settings');
  });
});

describe('referenced objects', () => {
  beforeAll(() => clean(client));

  let user: User;

  beforeAll(async () => {
    user = new User();
    user.name = 'tom';
    user.age = 15;
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
    expect(page).toHaveProperty('user');
  });
});

afterAll(() => close(client));