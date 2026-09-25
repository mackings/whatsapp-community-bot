import { getDb } from "./mongoClient.js";

export type ReviewTurnRole = "user" | "model";

export interface ReviewTurn {
  role: ReviewTurnRole;
  text: string;
}

export type ReviewStatus = "active" | "completed";

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
