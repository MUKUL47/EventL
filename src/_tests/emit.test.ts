import { EventFluxFlow as EventFlux } from "../eventfluxflow";
const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("Emission", () => {
  test("should emit simple invocation", async () => {
    const E = new EventFlux<{ TEST: any }>();
    const fn = jest.fn();
    E.on("TEST", () => fn());
    E.emit("TEST", 2);
    setTimeout(() => expect(fn).toHaveBeenCalled());
  });

  test("should emit multiple invocation", () => {
    const E = new EventFlux<{ TEST: any }>();
    const fn = jest.fn();
    E.on("TEST", () => fn());
    E.emit("TEST", 2);
    E.emit("TEST", 2);
    E.emit("TEST", 2);
    E.emit("TEST", 2);
    setTimeout(() => expect(fn).toHaveBeenCalledTimes(4));
  });

  describe("middlewares", () => {
    test("should execute middlewares without fail before invokation", async () => {
      const E = new EventFlux<{ TEST: { resp: number } }>();
      const fn = jest.fn();
      const fnMiddle = jest.fn();
      E.on(
        "TEST",
        (r) => {
          fn(r.resp);
        },
        {
          middlewares: [
            ...Array.from({ length: 2 }).map((_, idx) => async (e, c) => {
              await new Promise((resolve) => setTimeout(resolve, idx * 100));
              c.resp++;
            }),
          ],
        }
      );
      E.emitAsync("TEST", { resp: 10 });
      await delay(1000);
      expect(fn).toHaveBeenCalledWith(12);
    });

    test("should execute middlewares and stop the invocation", async () => {
      const E = new EventFlux<{ ONLY_ODD: { resp: number } }>();
      const fn = jest.fn();
      E.on(
        "ONLY_ODD",
        (r) => {
          fn(r.resp);
        },
        {
          middlewares: [(a, c) => c.resp % 2 != 0],
        }
      );
      E.emitAsync("ONLY_ODD", { resp: 12 });
      E.emitAsync("ONLY_ODD", { resp: 11 });
      await delay();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(11);
    });

    test("should execute middlewares and stop the invocation with conditions", async () => {
      const E = new EventFlux<{ ODD_LESS_THAN_10: { resp: number } }>();
      const fn = jest.fn();
      E.on(
        "ODD_LESS_THAN_10",
        (r) => {
          fn(r.resp);
        },
        {
          middlewares: [(a, c) => c.resp % 2 != 0, (a, c) => c.resp < 10],
        }
      );
      E.emitAsync("ODD_LESS_THAN_10", { resp: 2 });
      E.emitAsync("ODD_LESS_THAN_10", { resp: 13 });
      E.emitAsync("ODD_LESS_THAN_10", { resp: 9 });
      await delay();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(9);
    });
  });
});
