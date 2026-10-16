import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "courant";
const clientOptions = {
  serverSelectionTimeoutMS: 5_000,
  maxPoolSize: 10,
  maxIdleTimeMS: 30_000,
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function getClientPromise() {
  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add your MongoDB Atlas connection string to .env.local.");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri, clientOptions).connect();
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri, clientOptions).connect();
  }
  return clientPromise;
}

export async function getDatabase(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(databaseName);
}
