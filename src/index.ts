import { EventFluxFlow } from "./eventfluxflow";

export * from "./eventfluxflow";
const e = new EventFluxFlow<{ a: number }, { a: number }>();

e.on(
  "a",
  (a) => {
    return a;
  },
  {
    middlewares: [
      async (a, v) => {
        await new Promise((r) => setTimeout(r, v));
      },
    ],
    withQueue: true,
  }
);
e.emitAsync("a", 300, { atomic: true }).then(console.log);
e.emitAsync("a", 200, { atomic: true }).then(console.log);
e.emitAsync("a", 100, { atomic: true }).then(console.log);
