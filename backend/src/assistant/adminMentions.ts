import type { GroupAdmin } from "../types/index.js";

export function buildAdminPromptFragment(admins: GroupAdmin[]): string {
  if (admins.length === 0) return "";

  const list = admins.map((a) => `${a.name} (tag as @${a.jid.split("@")[0]})`).join(", ");
  return `\n\nGroup admins: ${list}. If your answer should tell someone to inform, check with, or
get approval from an admin (e.g. before deploying or submitting something), reference the
specific admin(s) by inserting their exact tag, like "@${admins[0].jid.split("@")[0]}", at that
point in your reply — use that tag format exactly, not just their plain name. Only tag an admin
when it's actually relevant to the answer, never by default.`;
}

export function extractAdminMentions(text: string, admins: GroupAdmin[]): string[] {
  return admins.filter((a) => text.includes(`@${a.jid.split("@")[0]}`)).map((a) => a.jid);
}
