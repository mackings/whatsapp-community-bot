import { connectMongo } from "./db/mongoClient.js";
import { initConnection } from "./whatsapp/connectionManager.js";
import { registerMessageHandler } from "./whatsapp/messageHandler.js";
import { registerMentionHandler } from "./whatsapp/mentionHandler.js";
import { registerAutoAnswerHandler } from "./whatsapp/autoAnswerHandler.js";
import { registerReminderHandler } from "./whatsapp/reminderHandler.js";
import { startReminderScheduler } from "./whatsapp/reminderScheduler.js";
import { startDigestScheduler } from "./whatsapp/digestScheduler.js";
import { setActiveSocket } from "./whatsapp/activeSocket.js";
import { createCategorizer } from "./categorizer/index.js";
import { startApiServer } from "./api/server.js";
import { apiLogger } from "./api/requestLogger.js";

async function main() {
  await connectMongo();

  let connectionStatus = "connecting";
  const realtime = startApiServer(() => connectionStatus);
  startReminderScheduler();
  startDigestScheduler();

  const categorizer = createCategorizer();

  await initConnection({
    onStatusChange: (status) => {
      connectionStatus = status;
      realtime.broadcastStatus(status);
    },
    onSocketReady: (sock) => {
      setActiveSocket(sock);
      registerMessageHandler(sock, categorizer, (message) => {
        realtime.broadcastMessage(message);
      });
      registerMentionHandler(sock);
      registerAutoAnswerHandler(sock);
      registerReminderHandler(sock);
    },
    onQrCode: (dataUrl) => {
      realtime.broadcastQr(dataUrl);
    },
  });
}

main().catch((error) => {
  apiLogger.error({ error }, "fatal error starting bot");
  process.exit(1);
});
