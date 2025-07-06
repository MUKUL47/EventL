import { EventFluxFlow as EventFlux } from "../eventfluxflow";

const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("AsyncEmit", () => {
  it("should complete emit promise when all registered invokers are completed", async () => {
    const E = new EventFlux<{
      ADMIN: any;
    }>();
    const fn = jest.fn();
    let obj: any = {};
    E.on(
      "ADMIN",
      async () => {
        await delay(200);
        obj.TASK1 = true;
      },
      {
        middlewares: [
          async () => {
            await delay(1000);
          },
        ],
      }
    );
    E.on("ADMIN", async () => {
      await delay(100);
      obj.TASK2 = true;
    });
    E.on("ADMIN", async () => {
      await delay(50);
      obj.TASK3 = true;
    });
    await E.emitAll("ADMIN", true);
    expect(obj).toMatchObject({
      TASK1: true,
      TASK2: true,
      TASK3: true,
    });
  });

  it("should complete emit promise when all registered invokers are completed with 1 failed middleware", async () => {
    const E = new EventFlux<{
      ADMIN: any;
    }>();
    const fn = jest.fn();
    let obj: any = {};
    E.on(
      "ADMIN",
      async () => {
        await delay(200);
        obj.TASK1 = true;
      },
      {
        middlewares: [
          async () => {
            await delay(1000);
          },
        ],
      }
    );
    E.on(
      "ADMIN",
      async () => {
        await delay(100);
        obj.TASK2 = true;
      },
      {
        middlewares: [
          async () => {
            await delay(1000);
            return false; //stop further
          },
        ],
      }
    );
    E.on("ADMIN", async () => {
      await delay(50);
      obj.TASK3 = true;
    });
    await E.emitAll("ADMIN", true);
    expect(obj).toMatchObject({
      TASK1: true,
      TASK3: true,
    });
  });
  it("should proceed when one middleware throws error", async () => {
    const E = new EventFlux<{ ADMIN: any }>({});
    let ran = { handler1: false, handler2: false };

    E.on(
      "ADMIN",
      async () => {
        ran.handler1 = true;
      },
      {
        middlewares: [
          async () => {
            throw new Error("Middleware failure");
          },
        ],
      }
    );

    E.on("ADMIN", async () => {
      ran.handler2 = true;
    });

    await E.emitAll("ADMIN", true);
    expect(ran).toEqual({ handler1: false, handler2: true });
  });

  it("should run multiple middlewares in sequence before handler", async () => {
    const E = new EventFlux<{ ADMIN: { val: number } }>();
    let order: string[] = [];

    E.on(
      "ADMIN",
      async (arg) => {
        order.push("handler");
        expect(arg.val).toBe(3);
      },
      {
        middlewares: [
          async (_, arg) => {
            order.push("mw1");
            arg.val++;
          },
          async (_, arg) => {
            order.push("mw2");
            arg.val++;
          },
        ],
      }
    );

    E.on(
      "ADMIN",
      async (arg) => {
        order.push("handler1");
        expect(arg.val).toBe(3);
      },
      {
        middlewares: [
          async (_, arg) => {
            order.push("mw11");
          },
          async (_, arg) => {
            order.push("mw21");
          },
        ],
      }
    );
    await E.emitAll("ADMIN", { val: 1 });
    expect(order).toMatchObject([
      "mw1",
      "mw11",
      "mw2",
      "mw21",
      "handler",
      "handler1",
    ]);
  });

  it("should work as intened with invoker", async () => {
    const E = new EventFlux<{
      ADMIN: any;
    }>();
    const fn = jest.fn();
    let obj: any = {};
    E.on(
      "ADMIN",
      async () => {
        await delay(100);
        obj.TASK1 = true;
      },
      { invokeLimit: 2 }
    );
    E.on(
      "ADMIN",
      async () => {
        await delay(50);
        obj.TASK2 = true;
      },
      { invokeLimit: 1 }
    );
    await E.emitAll("ADMIN", true);
    expect(obj).toMatchObject({
      TASK1: true,
      TASK2: true,
    });
    obj = {};
    await E.emitAll("ADMIN", true); //only task is stil active since limit is 1
    expect(obj).toMatchObject({
      TASK1: true,
    });
    obj = {};
    await E.emitAll("ADMIN", true);
    expect(obj).toMatchObject({});
  });
});
