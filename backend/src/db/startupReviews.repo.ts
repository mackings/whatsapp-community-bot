import { getDb } from "./mongoClient.js";

export type ReviewTurnRole = "user" | "model";

export interface ReviewTurn {
  role: ReviewTurnRole;
  text: string;
}

export type ReviewStatus = "active" | "completed" | "greeted";

export interface StartupReview {
  id: string;
  chatJid: string;
  senderJid: string;
  senderName: string;
  status: ReviewStatus;
  turns: ReviewTurn[];
  createdAt: number;
  updatedAt: number;
}

interface StartupReviewDoc extends Omit<StartupReview, "id"> {
  _id: string;
}

const reviews = () => getDb().collection<StartupReviewDoc>("startup_reviews");

function toReview(doc: StartupReviewDoc): StartupReview {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function reviewId(chatJid: string, senderJid: string): string {
  return `${chatJid}:${senderJid}`;
}

export async function getActiveReview(chatJid: string, senderJid: string): Promise<StartupReview | null> {
  const doc = await reviews().findOne({ _id: reviewId(chatJid, senderJid), status: "active" });
  return doc ? toReview(doc) : null;
}

/** True once anything at all is on record for this sender in this chat — used to decide whether PromptCraft has ever introduced itself to them. */
export async function hasAnyRecord(chatJid: string, senderJid: string): Promise<boolean> {
  const doc = await reviews().findOne({ _id: reviewId(chatJid, senderJid) }, { projection: { _id: 1 } });
  return doc !== null;
}

/** Marks a sender as greeted without starting a real review — used when their first-ever message doesn't read as a pitch, so the intro still only ever happens once. */
export async function markGreeted(chatJid: string, senderJid: string, senderName: string): Promise<void> {
  const now = Date.now();
  await reviews().updateOne(
    { _id: reviewId(chatJid, senderJid) },
    { $setOnInsert: { chatJid, senderJid, senderName, status: "greeted", turns: [], createdAt: now, updatedAt: now } },
    { upsert: true }
  );
}

export async function startReview(params: {
  chatJid: string;
  senderJid: string;
  senderName: string;
  turns: ReviewTurn[];
  completed: boolean;
}): Promise<void> {
  const now = Date.now();
  await reviews().replaceOne(
    { _id: reviewId(params.chatJid, params.senderJid) },
    {
      chatJid: params.chatJid,
      senderJid: params.senderJid,
      senderName: params.senderName,
      status: params.completed ? "completed" : "active",
      turns: params.turns,
      createdAt: now,
      updatedAt: now,
    },
    { upsert: true }
  );
}

export async function appendTurns(id: string, newTurns: ReviewTurn[], completed: boolean): Promise<void> {
  await reviews().updateOne(
    { _id: id },
    {
      $push: { turns: { $each: newTurns } },
      $set: { status: completed ? "completed" : "active", updatedAt: Date.now() },
    }
  );
}
