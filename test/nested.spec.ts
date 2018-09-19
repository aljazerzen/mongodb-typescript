import { MongoClient, ObjectId } from 'mongodb';

import { Entity, nested, prop, Repository } from '../src';
import { clean, close, connect } from './mongo';

class Settings {
  @prop() colorScheme: string;
  @prop() articlesPerPage: number;
}

class Article {
  @prop() title: string;
}

class User implements Entity {

  @prop()
  _id: ObjectId;

  @prop()
  name: string;

  @nested(() => Article)
  articles: Article[];

  @nested(() => Settings)
  settings: Settings;
}

let client: MongoClient;
let userRepo: Repository<User>;

beforeAll(async () => {
  client = await connect();
  userRepo = new Repository<User>(User, client, 'users');
});

describe('nested objects', () => {
  beforeAll(() => clean(client));

  test('insert entity with nested object', async () => {
    const settings = new Settings();
    settings.articlesPerPage = 10;
    settings.colorScheme = 'BLACK_AND_YELLOW';

    const user = new User();
    user.name = 'hal';
    user.settings = settings;
    await userRepo.insert(user);

    const saved = await userRepo.findById(user._id);

    expect(saved).toHaveProperty('name', 'hal');
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
    user.name = 'bay';
    user.articles = [article1, article2];
    await userRepo.insert(user);

    const saved = await userRepo.findById(user._id);

    expect(saved).toHaveProperty('name', 'bay');
    expect(saved).toHaveProperty('_id');
    expect(saved).toHaveProperty('articles');
    expect(saved.articles).toHaveLength(2);

    expect(saved).not.toHaveProperty('settings');
  });
});

afterAll(() => close(client));
