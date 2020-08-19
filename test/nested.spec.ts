import { MongoClient, ObjectId } from 'mongodb';

import { id, ignore, nested, ref, Repository } from '../src';
import { clean, close, connect } from './_mongo';

class Settings {
  colorScheme: string;
  articlesPerPage: number;
}

class Category {
  @id id: ObjectId;
  name: string;
}

class Article {
  title: string;

  @ignore ignoredField: string;

  @ref() category: Category;
}

class User {
  @id id: ObjectId;

  name: string;

  @nested(() => Article)
  articles: Article[];

  @nested(() => Settings)
  settings: Settings;
}

let client: MongoClient;
let userRepo: Repository<User>;
let categoryRepo: Repository<Category>;

beforeAll(async () => {
  client = await connect();
  userRepo = new Repository<User>(User, client, 'users');
  categoryRepo = new Repository<Category>(Category, client, 'categories');
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

    const saved = await userRepo.findById(user.id);

    expect(saved).toHaveProperty('name', 'hal');
    expect(saved).toHaveProperty('id');
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

    const saved = await userRepo.findById(user.id);

    expect(saved).toHaveProperty('name', 'bay');
    expect(saved).toHaveProperty('id');
    expect(saved).toHaveProperty('articles');
    expect(saved.articles).toHaveLength(2);

    expect(saved).not.toHaveProperty('settings');
  });

  test('falsy values', async () => {
    const user = new User();
    user.name = 'james';
    user.articles = [null, undefined];
    await userRepo.insert(user);

    const saved = await userRepo.findById(user.id);

    expect(saved).toHaveProperty('articles');
    expect(saved.articles).toHaveLength(2);
    expect(saved.articles[0]).toBeNull();
    expect(saved.articles[1]).toBeNull();
  });

  test('nested ignored properties', async () => {
    const article = new Article();
    article.title = 'How to sleep at night';
    article.ignoredField = 'blah';
    
    const user = new User();
    user.name = 'james';
    user.articles = [article];
    await userRepo.insert(user);

    const saved = await userRepo.findById(user.id);

    expect(saved).toHaveProperty('articles');
    expect(saved.articles).toHaveLength(1);
    expect(saved.articles[0].title).toEqual(article.title);
    expect(saved.articles[0]).not.toHaveProperty('ignoredField');
  });

  test('nested referenced entities', async () => {
    const category = new Category();
    category.name = 'Lifestyle';
    
    await categoryRepo.save(category);

    
    const article = new Article();
    article.title = 'How to sleep at night';
    article.category = category;
    
    const user = new User();
    user.name = 'tommy';
    user.articles = [article];
    await userRepo.insert(user);

    expect(user.articles).toHaveLength(1);
    expect(user.articles[0]).toHaveProperty('categoryId');
    expect(user.articles[0].category).toHaveProperty('id', category.id);

    const saved = await userRepo.findById(user.id);

    expect(saved).toHaveProperty('articles');
    expect(saved.articles).toHaveLength(1);
    expect(saved.articles[0]).toHaveProperty('categoryId');
    expect(saved.articles[0]).not.toHaveProperty('category');
  });
});

afterAll(() => close(client));
