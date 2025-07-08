import { EventFluxFlow } from "./eventfluxflow";

export * from "./eventfluxflow";
const e = new EventFluxFlow();
e.on(
  "job",
  async (val) => {
    return await new Promise((r) => setTimeout(() => r(123), 1000));
  },
  { debounce: 10 }
);

e.emitAsync("job", {}, { isAtomic: true }).then(console.log);
