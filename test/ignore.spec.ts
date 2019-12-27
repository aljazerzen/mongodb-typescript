import { MongoClient, ObjectId } from "mongodb";

import { id, Repository, ignore } from "../src";
import { clean, close, connect } from "./_mongo";

class OnlyImportantAtRuntime {
  @id id: ObjectId;
  superSecretNumber: number;
  nuclearLaunchCodes: number[];
  currentThreadId: number;
  someText: string;
  maybeABoolean: boolean;
}

class UserWithIgnoredPrimitive {
  @id id: ObjectId;

  name: string;

  @ignore
  sensitiveInformation: string;
}

class UserWithIgnoredObject {
  @id id: ObjectId;

  name: string;

  @ignore
  sensitiveInformation: OnlyImportantAtRuntime;
}

let client: MongoClient;
let userRepo: Repository<UserWithIgnoredPrimitive>;
let userWithIgnoredObjectRepo: Repository<UserWithIgnoredObject>;

beforeAll(async () => {
  client = await connect();
  userRepo = new Repository<UserWithIgnoredPrimitive>(
    UserWithIgnoredPrimitive,
    client,
    "users"
  );
  userWithIgnoredObjectRepo = new Repository<UserWithIgnoredObject>(
    UserWithIgnoredObject,
    client,
    "userwithignoredobjects"
  );
});

describe("ignored objects", () => {
  beforeAll(() => clean(client));

  test("insert entity with ignored primitive", async () => {
    const user = new UserWithIgnoredPrimitive();
    user.name = "hal";
    user.sensitiveInformation = "Don't save me";
    await userRepo.insert(user);

    const saved = await userRepo.findById(user.id);

    expect(saved).toHaveProperty("name", "hal");
    expect(saved).toHaveProperty("id");
    expect(saved).not.toHaveProperty("sensitiveInformation");
  });

  test("insert entity with ignored object", async () => {
    const user = new UserWithIgnoredObject();
    user.name = "hal";
    user.sensitiveInformation = new OnlyImportantAtRuntime();
    user.sensitiveInformation.currentThreadId = 1;
    user.sensitiveInformation.maybeABoolean = false;
    user.sensitiveInformation.nuclearLaunchCodes = [1, 2, 3];
    user.sensitiveInformation.someText = "If you save me, the world will end!";
    user.sensitiveInformation.superSecretNumber = 2;
    await userWithIgnoredObjectRepo.insert(user);

    const saved = await userWithIgnoredObjectRepo.findById(user.id);

    expect(saved).toHaveProperty("name", "hal");
    expect(saved).toHaveProperty("id");
    expect(saved).not.toHaveProperty("sensitiveInformation");
  });
});

afterAll(() => close(client));
