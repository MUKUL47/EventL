import { EventFluxFlow as EventFlux } from "../eventfluxflow";

const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("Namespace", () => {
  test("Should emit all the decendants of the namespace prefix", async () => {
    const E = new EventFlux<{
      ADMIN: any;
      "ADMIN:USER": any;
      "ADMIN:USER:CREATE": any;
    }>();
    const fn = jest.fn();
    E.on("ADMIN", () => fn("ADMIN"));
    E.on("ADMIN:USER", () => fn("ADMIN:USER"));
    E.on("ADMIN:USER:CREATE", () => fn("ADMIN:USER:CREATE"));
    E.emit("ADMIN", true, { namespace: true }); //all decendants except ADMIN
    await delay();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("ADMIN:USER:CREATE");
    expect(fn).toHaveBeenCalledWith("ADMIN:USER");
    fn.mockReset();
    E.emit("ADMIN:USER", true, { namespace: true }); //all decendants except ADMIN
    await delay();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("ADMIN:USER:CREATE");
    fn.mockReset();
    E.emit("ADMIN", true); //without namespace -> only that event is invoked
    await delay();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("ADMIN");
  });
});
