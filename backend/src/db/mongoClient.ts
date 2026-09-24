import { MongoClient, type Db } from "mongodb";
import { env } from "../config/env.js";
import { logger } from "../whatsapp/logger.js";

const client = new MongoClient(env.mongoUri);
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  await client.connect();
  db = client.db(env.mongoDbName);
  logger.info(`Connected to MongoDB (db: ${env.mongoDbName})`);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("MongoDB not connected yet — call connectMongo() before using any repo");
  return db;
}
