import { EventFluxFlow as EventFlux } from "../eventfluxflow";

const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("Off", () => {
  test("should remove a registered event", async () => {
    const E = new EventFlux<{
      ADMIN: any;
    }>();
    const fn = jest.fn();
    E.on("ADMIN", fn);
    E.emit("ADMIN", true);
    E.emit("ADMIN", true);
    E.off("ADMIN", fn);
    E.emit("ADMIN", true);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
