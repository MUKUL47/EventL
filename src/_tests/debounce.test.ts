import { EventL } from "../eventL";
const delay = async (n = 0) =>
  await new Promise((resolve) => setTimeout(resolve, n));

describe("Debounce", () => {
  test("Should delay event emission until after the specified debounce interval", async () => {
    const E = new EventL<{ TEST: number }>();
    const fn = jest.fn();
    E.on("TEST", fn, {
      debounce: 300,
    });

    E.emit("TEST", 2);
    E.emit("TEST", 21);
    E.emit("TEST", 5);
    await delay(500);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(5);
  });

  test("Should reset debounce timer if events keep firing within the debounce window", async () => {
    const E = new EventL<{ SEARCH: string }>();
    const fn = jest.fn();
    E.on("SEARCH", fn, {
      debounce: 300,
    });

    setTimeout(() => E.emit("SEARCH", "a"), 100);
    setTimeout(() => E.emit("SEARCH", "ab"), 250);
    setTimeout(() => E.emit("SEARCH", "abbc"), 650);
    await delay(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("ab");
    expect(fn).toHaveBeenCalledWith("abbc");
  });

  test("should debounce multiple emit bursts independently", async () => {
    const E = new EventL<{ SEARCH: string }>();
    const fn = jest.fn();

    E.on("SEARCH", fn, {
      debounce: 200,
    });

    E.emit("SEARCH", "A");
    E.emit("SEARCH", "AB");
    E.emit("SEARCH", "ABC");

    setTimeout(() => {
      E.emit("SEARCH", "X");
      E.emit("SEARCH", "XY");
      E.emit("SEARCH", "XYZ");
    }, 400);
    await delay(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith("XYZ");
    expect(fn).toHaveBeenCalledWith("ABC");
  });

  test("Should not invoke with asyncEmit", async () => {
    const E = new EventL<{ TEST: number }>();
    const fn = jest.fn();
    E.on("TEST", fn, {
      debounce: 300,
      invokeLimit: 5,
    });

    E.asyncEmit("TEST", 2);
    E.asyncEmit("TEST", 21);
    E.asyncEmit("TEST", 5);
    await delay();
    expect(fn).toHaveBeenCalledTimes(0);
  });

  test("Should not invoke with invokerLimit", async () => {
    const E = new EventL<{ TEST: number }>();
    const fn = jest.fn();
    E.on("TEST", fn, {
      debounce: 300,
      invokeLimit: 5,
    });

    E.emit("TEST", 2);
    E.emit("TEST", 21);
    E.emit("TEST", 5);
    await delay();
    expect(fn).toHaveBeenCalledTimes(0);
  });
});
