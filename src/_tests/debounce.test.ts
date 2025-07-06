import { EventFlux } from "../eventflux";
const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("Debounce", () => {
  test("Should delay event emission until after the specified debounce interval", async () => {
    const E = new EventFlux<{ TEST: number }>({ suppressWarnings: true });
    const fn = jest.fn();
    E.on("TEST", fn, {
      debounce: 300,
    });

    E.emitAsync("TEST", 2);
    E.emitAsync("TEST", 21);
    E.emitAsync("TEST", 5);
    await delay(500);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(5);
  });

  test("Should reset debounce timer if events keep firing within the debounce window", async () => {
    const E = new EventFlux<{ SEARCH: string }>({ suppressWarnings: true });
    const fn = jest.fn();
    E.on("SEARCH", fn, {
      debounce: 300,
    });

    setTimeout(() => E.emitAsync("SEARCH", "a"), 100);
    setTimeout(() => E.emitAsync("SEARCH", "ab"), 250);
    setTimeout(() => E.emitAsync("SEARCH", "abbc"), 650);
    await delay(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("ab");
    expect(fn).toHaveBeenCalledWith("abbc");
  });

  test("should debounce multiple emit bursts independently", async () => {
    const E = new EventFlux<{ SEARCH: string }>({ suppressWarnings: true });
    const fn = jest.fn();

    E.on("SEARCH", fn, {
      debounce: 200,
    });

    E.emitAsync("SEARCH", "A");
    E.emitAsync("SEARCH", "AB");
    E.emitAsync("SEARCH", "ABC");

    setTimeout(() => {
      E.emitAsync("SEARCH", "X");
      E.emitAsync("SEARCH", "XY");
      E.emitAsync("SEARCH", "XYZ");
    }, 400);
    await delay(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("XYZ");
    expect(fn).toHaveBeenCalledWith("ABC");
  });

  test("Should not invoke with emitAll", async () => {
    const E = new EventFlux<{ TEST: number }>({ suppressWarnings: true });
    const fn = jest.fn();
    E.on("TEST", fn, {
      debounce: 300,
      invokeLimit: 5,
    });

    E.emitAll("TEST", 2);
    E.emitAll("TEST", 21);
    E.emitAll("TEST", 5);
    await delay();
    expect(fn).toHaveBeenCalledTimes(0);
  });

  test("Should invoke with invokerLimit", async () => {
    const E = new EventFlux<{ TEST: number }>({ suppressWarnings: true });
    const fn = jest.fn();
    E.on("TEST", fn, {
      debounce: 50,
      invokeLimit: 2,
    });

    E.emitAsync("TEST", 2);
    setTimeout(() => E.emitAsync("TEST", 1), 100);
    E.emitAsync("TEST", 5);
    setTimeout(() => E.emitAsync("TEST", 57), 80);
    setTimeout(() => E.emitAsync("TEST", 212), 120);
    await delay(500);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
