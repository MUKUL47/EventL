import { EventL } from "../eventL";

const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("Queue", () => {
  test("should emit queue in a sequence", async () => {
    const fn = jest.fn();
    let p = "";
    const E = new EventL<{
      ADMIN: {
        delay: number;
        data: number;
      };
    }>();
    const { cancel } = E.on(
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
    E.emit("ADMIN", { delay: 500, data: 1 });
    E.emit("ADMIN", { delay: 100, data: 2 });
    E.emit("ADMIN", { delay: 20, data: 3 });
    E.emit("ADMIN", { delay: 0, data: 4 });
    E.emit("ADMIN", { delay: 100, data: 5 });
    await delay(750);
    expect(p).toBe("12345");
  });
  test("should respect invokeLimit inside queue", async () => {
    let out = "";
    const E = new EventL<{
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

    E.emit("JOB", { delay: 100, data: "A" });
    E.emit("JOB", { delay: 100, data: "B" });
    E.emit("JOB", { delay: 100, data: "C" });

    await delay(350);
    expect(out).toBe("AB");
  });

  test("should enqueue only last value after debounce delay", async () => {
    const E = new EventL<{
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

    E.emit("SEARCH", "a");
    E.emit("SEARCH", "ab");
    E.emit("SEARCH", "abc");
    E.emit("SEARCH", "abcd");

    await delay(120);

    E.emit("SEARCH", "X");
    E.emit("SEARCH", "XY");
    E.emit("SEARCH", "XYZ");

    await delay(120);

    expect(output).toBe("abcd|XYZ|");
  });
  test("should skip first emit and process only 2 and 3", async () => {
    let output = "";
    const E = new EventL<{ ADMIN: number }>();

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

    E.emit("ADMIN", 1);
    setTimeout(() => E.emit("ADMIN", 2), 50);

    setTimeout(() => E.emit("ADMIN", 3), 200);

    await delay(500);

    expect(output).toBe("23");
  });
  test("should cancel queue in between and stop emission aftewards", async () => {
    const fn = jest.fn();
    let p = "";
    const E = new EventL<{
      ADMIN: {
        delay: number;
        data: number;
      };
    }>();
    const { cancel } = E.on(
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
    E.emit("ADMIN", { delay: 500, data: 1 });
    E.emit("ADMIN", { delay: 100, data: 2 });
    setTimeout(cancel, 610);
    E.emit("ADMIN", { delay: 20, data: 3 });
    E.emit("ADMIN", { delay: 0, data: 4 });
    E.emit("ADMIN", { delay: 100, data: 5 });
    await delay(750);
    expect(p).toBe("12");
  });
  test("should queue emits even if previous is running", async () => {
    const E = new EventL<{ TASK: number }>();
    let result = "";

    E.on(
      "TASK",
      async (n) => {
        result += n;
        await delay(100);
      },
      { withQueue: true }
    );

    E.emit("TASK", 1);
    setTimeout(() => E.emit("TASK", 2), 20);
    setTimeout(() => E.emit("TASK", 3), 40);

    await delay(400);
    expect(result).toBe("123");
  });
});
