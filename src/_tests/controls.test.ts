import { EventFluxFlow as EventFlux } from "../eventfluxflow";

const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("Controls", () => {
  test("should update middleware via controls", async () => {
    const E = new EventFlux<{
      ADMIN: any;
    }>();
    const fn = jest.fn();
    let f = {};
    const controls = E.on("ADMIN", (c) => (f = c));
    E.emit("ADMIN", {});
    expect(f).toStrictEqual({});
    controls.useMiddleware((a, c) => (c.value = true));
    controls.useMiddleware((a, c) => {
      if (c.block) return false;
      c.value1 = true;
    });
    E.emit("ADMIN", {});
    expect(f).toStrictEqual({ value: true, value1: true });
    f = {};
    E.emit("ADMIN", { block: true });
    expect(f).toStrictEqual({});
  });
  test("should sort via priority", async () => {
    const E = new EventFlux();
    let s = [];
    const c = E.on("1", (v) => s.push(v), { invokeLimit: 2 });
    E.emit("1", 1);
    E.emit("1", 2);
    E.emit("1", 3);
    expect(s[0]).toBe(1);
    expect(s[1]).toBe(2);
    expect(s[2]).toBe(undefined);
    c.updateInvokerLimit(1);
    E.emit("1", 3);
    expect(s[2]).toBe(3);
    E.emit("1", 3);
    expect(s[3]).toBe(undefined);
  });
  test("should update debounce ", async () => {
    const E = new EventFlux<{ TEST: number }>({ suppressWarnings: true });
    const fn = jest.fn();
    const c = E.on("TEST", fn, {
      debounce: 60,
    });
    setTimeout(() => E.emitAsync("TEST", 2), 55);
    setTimeout(() => E.emitAsync("TEST", 5), 22);
    await delay(120);
    expect(fn).toHaveBeenCalledWith(2);
    expect(fn).toHaveBeenCalledTimes(1);
    c.updateDebounce(20);
    setTimeout(() => E.emitAsync("TEST", 2), 55);
    setTimeout(() => E.emitAsync("TEST", 5), 25);
    await delay(100);
    expect(fn).toHaveBeenCalledWith(5);
    expect(fn).toHaveBeenCalledWith(2);
  });
  test("should update queue ", async () => {
    let out = "";
    const E = new EventFlux<{
      JOB: { delay: number; data: string };
    }>();

    const c = E.on(
      "JOB",
      async (arg) => {
        out += arg.data;
      },
      {
        middlewares: [
          async (_, arg) => {
            await delay(arg.delay);
          },
        ],
      }
    );

    E.emitAsync("JOB", { delay: 100, data: "A" });
    E.emitAsync("JOB", { delay: 5, data: "B" });
    await delay(350);
    expect(out).toBe("BA");
    out = "";
    c.toggleQueue(true);
    E.emitAsync("JOB", { delay: 100, data: "A" });
    E.emitAsync("JOB", { delay: 5, data: "B" });
    E.emitAsync("JOB", { delay: 1, data: "C" });
    await delay(350);
    expect(out).toBe("ABC");
  });
});
