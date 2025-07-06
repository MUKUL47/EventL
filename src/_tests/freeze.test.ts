import { EventFluxFlow as EventFlux } from "../eventfluxflow";

const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("Freeze", () => {
  test("should freeze and unfreeze events", async () => {
    const E = new EventFlux<{
      ADMIN: any;
    }>();
    const fn = jest.fn();
    const { freeze, unFreeze } = E.on("ADMIN", fn);
    E.emit("ADMIN", true);
    E.emit("ADMIN", true);
    freeze();
    E.emit("ADMIN", true);
    expect(fn).toHaveBeenCalledTimes(2);
    unFreeze();
    jest.resetAllMocks();
    E.emit("ADMIN", true);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
