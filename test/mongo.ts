import * as mongodb from 'mongodb';

export async function connect() {
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017/mongodb-typescript';
  return await mongodb.connect(url, { useNewUrlParser: true });
}

export async function clean(mongo: mongodb.MongoClient) {
  await mongo.db().dropDatabase();
}

export async function close(mongo: mongodb.MongoClient) {
  await mongo.close();
}