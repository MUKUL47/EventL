import { EventFlux } from "../eventflux";

const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("Queue", () => {
  test("should emit queue in a sequence", async () => {
    const fn = jest.fn();
    let p = "";
    const E = new EventFlux<{
      ADMIN: {
        delay: number;
        data: number;
      };
    }>();
    E.on(
      "ADMIN",
      (arg) => {
        p = p + `${arg.data}`;
      },
      {
        middlewares: [
          async (_, resp) => {
            await delay(resp.delay);
          },
        ],
        withQueue: true,
      }
    );
    E.emitAsync("ADMIN", { delay: 500, data: 1 });
    E.emitAsync("ADMIN", { delay: 100, data: 2 });
    E.emitAsync("ADMIN", { delay: 20, data: 3 });
    E.emitAsync("ADMIN", { delay: 0, data: 4 });
    E.emitAsync("ADMIN", { delay: 100, data: 5 });
    await delay(750);
    expect(p).toBe("12345");
  });
  test("should respect invokeLimit inside queue", async () => {
    let out = "";
    const E = new EventFlux<{
      JOB: { delay: number; data: string };
    }>();

    E.on(
      "JOB",
      async (arg) => {
        out += arg.data;
      },
      {
        withQueue: true,
        invokeLimit: 2,
        middlewares: [
          async (_, arg) => {
            await delay(arg.delay);
          },
        ],
      }
    );

    E.emitAsync("JOB", { delay: 100, data: "A" });
    E.emitAsync("JOB", { delay: 100, data: "B" });
    E.emitAsync("JOB", { delay: 100, data: "C" });

    await delay(350);
    expect(out).toBe("AB");
  });

  test("should enqueue only last value after debounce delay", async () => {
    const E = new EventFlux<{
      SEARCH: string;
    }>();
    let output = "";

    E.on(
      "SEARCH",
      (query) => {
        output += query + "|";
      },
      {
        debounce: 100,
        withQueue: true,
      }
    );

    E.emitAsync("SEARCH", "a");
    E.emitAsync("SEARCH", "ab");
    E.emitAsync("SEARCH", "abc");
    E.emitAsync("SEARCH", "abcd");

    await delay(120);

    E.emitAsync("SEARCH", "X");
    E.emitAsync("SEARCH", "XY");
    E.emitAsync("SEARCH", "XYZ");

    await delay(120);

    expect(output).toBe("abcd|XYZ|");
  });
  test("should skip first emit and process only 2 and 3", async () => {
    let output = "";
    const E = new EventFlux<{ ADMIN: number }>();

    E.on(
      "ADMIN",
      (arg) => {
        output += arg;
      },
      {
        debounce: 100,
        withQueue: true,
      }
    );

    E.emitAsync("ADMIN", 1);
    setTimeout(() => E.emitAsync("ADMIN", 2), 50);

    setTimeout(() => E.emitAsync("ADMIN", 3), 200);

    await delay(500);

    expect(output).toBe("23");
  });
  test("should cancel queue in between and stop emission aftewards", async () => {
    const fn = jest.fn();
    let p = "";
    const E = new EventFlux<{
      ADMIN: {
        delay: number;
        data: number;
      };
    }>();
    const { freeze } = E.on(
      "ADMIN",
      (arg) => {
        p = p + `${arg.data}`;
      },
      {
        middlewares: [
          async (_, resp) => {
            await delay(resp.delay);
          },
        ],
        withQueue: true,
      }
    );
    setTimeout(freeze, 620);
    E.emitAsync("ADMIN", { delay: 500, data: 1 });
    E.emitAsync("ADMIN", { delay: 100, data: 2 });
    E.emitAsync("ADMIN", { delay: 20, data: 3 });
    E.emitAsync("ADMIN", { delay: 0, data: 4 });
    E.emitAsync("ADMIN", { delay: 100, data: 5 });
    await delay(750);
    expect(p).toBe("12");
  });
  test("should queue emits even if previous is running", async () => {
    const E = new EventFlux<{ TASK: number }>();
    let result = "";

    E.on(
      "TASK",
      async (n) => {
        result += n;
        await delay(100);
      },
      { withQueue: true }
    );

    E.emitAsync("TASK", 1);
    setTimeout(() => E.emitAsync("TASK", 2), 20);
    setTimeout(() => E.emitAsync("TASK", 3), 40);

    await delay(400);
    expect(result).toBe("123");
  });
});
