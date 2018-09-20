import { MongoClient, ObjectId } from 'mongodb';

import { Entity, nested, objectId, ref, Repository } from '../src';
import { clean, close, connect } from './_mongo';

class User implements Entity {
  @objectId() _id: ObjectId;
  name: string;
}

class Comment {
  @objectId() _id: ObjectId;
  text: string;

  @ref() commentator: User;
}

class Page implements Entity {
  @objectId() _id: ObjectId;
  text: string;

  @ref() author: User;
  @objectId() authorId: ObjectId;

  @nested(() => Comment) comments: Comment[];

  @ref() pinnedBy: User[];
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

  let user1: User, user2: User, user3: User;

  beforeAll(async () => {
    user1 = new User();
    user1.name = 'Elijah';
    await userRepo.insert(user1);

    user2 = new User();
    user2.name = 'Lisa';
    await userRepo.insert(user2);

    user3 = new User();
    user3.name = 'Mike';
    await userRepo.insert(user3);
  });

  test('insert entity referencing another entity', async () => {
    let page = new Page();
    page.text = 'this is my home page!';
    page.author = user1;

    await pageRepo.insert(page);

    expect(page).toHaveProperty('_id');
    expect(page).toHaveProperty('author');
    expect(page.author).toHaveProperty('name', user1.name);
    expect(page).toHaveProperty('authorId', user1._id);

    const raw = await pageRepo.collection.findOne({ _id: page._id });
    expect(raw).not.toHaveProperty('author');
    expect(raw).toHaveProperty('authorId');

    const saved = await pageRepo.findOne({});
    expect(saved).toHaveProperty('authorId', user1._id);
    expect(saved).not.toHaveProperty('author');
  });

  test('populate', async () => {
    const page = await pageRepo.findOne({});
    expect(page).not.toHaveProperty('author');
    await userRepo.populate(page, 'author');
    expect(page).toHaveProperty('author');
  });

  test('populate many', async () => {
    let page = new Page();
    page.text = 'this is a sub page!';
    page.author = user1;

    let comment1 = new Comment();
    comment1.text = 'This is great!';
    comment1.commentator = user1;

    let comment2 = new Comment();
    comment2.text = 'This sucks';
    comment2.commentator = user1;

    page.comments = [comment1, comment2];

    await pageRepo.save(page);

    let saved = await pageRepo.findById(page._id);
    expect(saved).not.toBeNull();

    await userRepo.populateMany(page.comments, 'commentator');
    for (let comment of page.comments) {
      expect(comment).toHaveProperty('commentator');
    }
  });

  test('reference many', async () => {
    let page = new Page();
    page.text = 'this is a another sub page!';
    page.author = user1;

    page.pinnedBy = [user1, user2];
    await pageRepo.save(page);

    let saved = await pageRepo.findById(page._id);
    expect(saved).not.toBeNull();

    expect(saved).not.toHaveProperty('pinnedBy');
    expect(saved).toHaveProperty('pinnedByIds');
    expect((saved as any).pinnedByIds).toHaveLength(2);

    await userRepo.populate(saved, 'pinnedBy');
    expect(saved).toHaveProperty('pinnedBy');
    expect(saved.pinnedBy).toHaveLength(2);

    for (let pinnedBy of saved.pinnedBy) {
      expect(pinnedBy).not.toBeNull();
    }
  });
});

afterAll(() => close(client));
