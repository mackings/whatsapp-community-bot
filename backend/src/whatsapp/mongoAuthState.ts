import { proto } from "@whiskeysockets/baileys";
import type { AuthenticationCreds, SignalDataTypeMap, SignalKeyStore } from "@whiskeysockets/baileys";
import { initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
import { getDb } from "../db/mongoClient.js";

interface AuthDoc {
  _id: string;
  data: unknown;
}

const COLLECTION = "auth_state";

// Round-trips through Baileys' own BufferJSON replacer/reviver so Buffers
// inside creds/keys survive being stored as plain MongoDB documents —
// same trick useMultiFileAuthState uses for JSON files, applied to Mongo.
function toStorable(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, BufferJSON.replacer));
}

function fromStorable<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value), BufferJSON.reviver) as T;
}

async function readDoc<T>(id: string): Promise<T | null> {
  const doc = await getDb().collection<AuthDoc>(COLLECTION).findOne({ _id: id });
  return doc ? fromStorable<T>(doc.data) : null;
}

async function writeDoc(id: string, value: unknown): Promise<void> {
  await getDb()
    .collection<AuthDoc>(COLLECTION)
    .replaceOne({ _id: id }, { data: toStorable(value) }, { upsert: true });
}

async function removeDoc(id: string): Promise<void> {
  await getDb().collection<AuthDoc>(COLLECTION).deleteOne({ _id: id });
}

/**
 * Baileys auth state backed by MongoDB instead of local files — same
 * contract as useMultiFileAuthState, so the WhatsApp session survives
 * restarts/redeploys even on hosts with no persistent disk.
 */
export async function useMongoDBAuthState(): Promise<{
  state: { creds: AuthenticationCreds; keys: SignalKeyStore };
  saveCreds: () => Promise<void>;
}> {
  const creds = (await readDoc<AuthenticationCreds>("creds")) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: Record<string, SignalDataTypeMap[typeof type]> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readDoc<SignalDataTypeMap[typeof type]>(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(
                  value as Record<string, unknown>
                ) as unknown as SignalDataTypeMap[typeof type];
              }
              if (value) data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category as keyof typeof data]) {
              const value = data[category as keyof typeof data]?.[id];
              const docId = `${category}-${id}`;
              tasks.push(value ? writeDoc(docId, value) : removeDoc(docId));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: async () => {
      await writeDoc("creds", creds);
    },
  };
}

/** Wipes the stored WhatsApp session — used when logging out to force a fresh QR/pairing flow. */
export async function clearAuthState(): Promise<void> {
  await getDb().collection<AuthDoc>(COLLECTION).deleteMany({});
}
