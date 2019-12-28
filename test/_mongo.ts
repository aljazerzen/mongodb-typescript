import * as mongodb from 'mongodb';

export async function connect() {
  const url = process.env.MONGO_URL || 'mongodb://localhost:27017/mongodb-typescript';
  return new mongodb.MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true }).connect();
}

export async function clean(mongo: mongodb.MongoClient, databaseName?: string) {
  await mongo.db(databaseName).dropDatabase();
}

export async function close(mongo: mongodb.MongoClient) {
  await mongo.close();
}