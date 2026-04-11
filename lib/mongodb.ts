import { MongoClient, type MongoClientOptions } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoClientCacheKey?: string;
};

let prodClientPromise: Promise<MongoClient> | null = null;
let prodCacheKey: string | null = null;

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing environment variable: "MONGODB_URI"');
  }
  return uri;
}

function tlsBypassRequested(): boolean {
  const v = process.env.MONGODB_TLS_ALLOW_INVALID_CERTS;
  return v === "true" || v === "1";
}

function mongoClientOptions(): MongoClientOptions {
  if (!tlsBypassRequested()) {
    return {};
  }
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[mongodb] Refusing MONGODB_TLS_ALLOW_INVALID_CERTS in production. Fix TLS (clock, VPN, Node) instead."
    );
    return {};
  }
  console.warn(
    "[mongodb] TLS verification relaxed (MONGODB_TLS_ALLOW_INVALID_CERTS). Use only for local debugging."
  );
  // tlsInsecure sets rejectUnauthorized=false and skips hostname checks (cannot combine with tlsAllowInvalid* per driver).
  return { tlsInsecure: true };
}

function cacheKey(uri: string, options: MongoClientOptions): string {
  const insecure = options.tlsInsecure === true ? "1" : "0";
  return `${insecure}|${uri}`;
}

async function replaceDevClient(uri: string, options: MongoClientOptions, key: string): Promise<MongoClient> {
  const prev = globalForMongo._mongoClientPromise;
  const prevKey = globalForMongo._mongoClientCacheKey;

  if (prev && prevKey !== key) {
    void prev
      .then((c) => c.close())
      .catch(() => {
        /* ignore */
      });
  }

  globalForMongo._mongoClientCacheKey = key;
  globalForMongo._mongoClientPromise = new MongoClient(uri, options).connect();
  return globalForMongo._mongoClientPromise;
}

export function getMongoClientPromise(): Promise<MongoClient> {
  const uri = requireUri();
  const options = mongoClientOptions();
  const key = cacheKey(uri, options);

  if (process.env.NODE_ENV === "development") {
    if (!globalForMongo._mongoClientPromise || globalForMongo._mongoClientCacheKey !== key) {
      return replaceDevClient(uri, options, key);
    }
    return globalForMongo._mongoClientPromise;
  }

  if (!prodClientPromise || prodCacheKey !== key) {
    if (prodClientPromise && prodCacheKey !== key) {
      void prodClientPromise
        .then((c) => c.close())
        .catch(() => {
          /* ignore */
        });
    }
    prodCacheKey = key;
    prodClientPromise = new MongoClient(uri, options).connect();
  }
  return prodClientPromise;
}

export async function getDb() {
  const client = await getMongoClientPromise();
  return client.db(process.env.MONGODB_DB_NAME ?? "hackdartmouth");
}
