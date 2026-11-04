import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "courant";

if (!uri && process.env.NODE_ENV === "production") {
  // Fail at connection time with a useful message rather than during build.
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

const clientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  maxIdleTimeMS: 30_000,
  serverSelectionTimeoutMS: 5_000,
};

function getClientPromise() {
  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add your MongoDB Atlas connection string to .env.local.");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      const pending = new MongoClient(uri, clientOptions).connect();
      global._mongoClientPromise = pending.catch((error: unknown) => {
        // A failed connection must not poison the development process forever.
        global._mongoClientPromise = undefined;
        throw error;
      });
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    const pending = new MongoClient(uri, clientOptions).connect();
    clientPromise = pending.catch((error: unknown) => {
      // Allow a later request to retry after transient DNS/network/Atlas failures.
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}

export async function getMongoClient(): Promise<MongoClient> {
  return getClientPromise();
}

export async function getDatabase(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(databaseName);
}
