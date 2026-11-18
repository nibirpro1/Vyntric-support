import dotenv from "dotenv";
dotenv.config();
import {
  isRecentChatWelcome,
  markChatWelcomeSent,
  scheduleChatWelcomeDeletion,
  initChatWelcomeCleaner,
} from "../lib/chatWelcomeCleaner";

async function main() {
  console.log("=== Testing Chat Welcome Auto-Delete & De-duplication ===");

  // 1. Test de-duplication
  const testUserId = "999888777666555444";
  if (isRecentChatWelcome(testUserId)) {
    throw new Error("User should not be marked recent before sending");
  }

  markChatWelcomeSent(testUserId);
  if (!isRecentChatWelcome(testUserId)) {
    throw new Error("User should be marked recent after sending");
  }
  console.log("1. De-duplication filter (prevents double-welcome spam): PASS ✅");

  // 2. Test auto-delete scheduler with a mock client
  let deletedMessageId: string | null = null;
  const mockClient: any = {
    channels: {
      fetch: async () => ({
        isTextBased: () => true,
        name: "test-chat",
        messages: {
          fetch: async (id: string) => ({
            id,
            delete: async () => {
              deletedMessageId = id;
            },
          }),
        },
      }),
    },
  };

  scheduleChatWelcomeDeletion(
    mockClient,
    "123456789012345678",
    "1560688449353420930",
    "1507706011622965258",
    1000 // 1000ms test delay
  );

  console.log("2. Scheduled 1000ms auto-deletion: PASS ✅");

  await new Promise((r) => setTimeout(r, 1300));

  if (deletedMessageId !== "123456789012345678") {
    throw new Error("Message was not auto-deleted as expected");
  }
  console.log("3. Message auto-deletion executed on timer: PASS ✅");

  console.log("\nALL CHAT WELCOME AUTO-DELETE TESTS PASSED 100%! 🚀🎉");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
