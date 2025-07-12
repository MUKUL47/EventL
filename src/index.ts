import { EventFluxFlow } from "./eventfluxflow";

export * from "./eventfluxflow";
async function a() {
  const E = new EventFluxFlow<{
    SERVER_RESPONSE: { status: string };
  }>();

  // Listener 1 — succeeds
  E.on("SERVER_RESPONSE", async (payload) => {
    if (payload.status === "fail") {
      throw new Error("Listener 1 failed due to failed status");
    }
    return "Listener 1 OK";
  });

  // Listener 2 — fails intentionally
  E.on("SERVER_RESPONSE", async () => {
    throw new Error("Listener 2 crashed");
  });

  // Middleware — halts if status is "halt"
  E.on("SERVER_RESPONSE", async (payload) => {
    if (payload.status === "halt") return false;
    // allow emission to continue
  });

  const results = await E.emitAll("SERVER_RESPONSE", { status: "fail" });

  // Inspect all results
  results.forEach((result, index) => {
    if (result instanceof Error) {
      console.error(`❌ Listener ${index + 1} failed: ${result.message}`);
    } else {
      console.log(`✅ Listener ${index + 1} succeeded:`, result);
    }
  });
}
a();
