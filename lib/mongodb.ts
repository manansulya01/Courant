import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "courant";

if (!uri && process.env.NODE_ENV === "production") {
  // Fail at connection time with a useful message rather than during build.
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function getClientPromise() {
  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add your MongoDB Atlas connection string to .env.local.");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const client = new MongoClient(uri, { maxPoolSize: 10, minPoolSize: 0, maxIdleTimeMS: 30_000, serverSelectionTimeoutMS: 5_000 });
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri, { maxPoolSize: 10, minPoolSize: 0, maxIdleTimeMS: 30_000, serverSelectionTimeoutMS: 5_000 }).connect();
  }
  return clientPromise;
}

export async function getDatabase(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(databaseName);
}
