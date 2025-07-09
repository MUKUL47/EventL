import { EventFluxFlow } from "../eventfluxflow";

describe("EmitAsyncListeners", () => {
  describe("onInvoke", () => {
    it("should invoke on completion", async () => {
      const e = new EventFluxFlow();
      const fn = jest.fn();
      const h = e.on("", () => {}, {
        middlewares: [
          async (a, c) => {
            await new Promise((r) => setTimeout(r, 500));
          },
        ],
      });
      const h1 = e.on("", () => {}, {
        middlewares: [
          async (a, c) => {
            await new Promise((r) => setTimeout(r, 100));
          },
        ],
      });
      const c = e.emitAsync("", 2);
      c.onInvoke(fn);
      await new Promise((r) => setTimeout(r, 700));
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith(h1.id);
      expect(fn).toHaveBeenCalledWith(h.id);
    });
    it("should not invoke if not completed", async () => {
      const e = new EventFluxFlow();
      const fn = jest.fn();
      const h = e.on("", () => {}, {
        middlewares: [async (a, c) => false],
      });
      const c = e.emitAsync("", 2);
      c.onInvoke(fn);
      await new Promise((r) => setTimeout(r, 10));
      expect(fn).toHaveBeenCalledTimes(0);
    });
  });
  describe("onMiddlewareHalt", () => {
    it("should invoke on onMiddlewareHalt", async () => {
      const e = new EventFluxFlow();
      const fn = jest.fn();
      const h = e.on("", () => {}, {
        middlewares: [(a, c) => {}, (a, c) => {}, (a, c) => false],
      });
      const h2 = e.on("", () => {}, {
        middlewares: [(a, c) => {}, (a, c) => false, (a, c) => false],
      });
      const c = e.emitAsync("", 2);
      c.onMiddlewareHalt(fn);
      await new Promise((r) => setTimeout(r, 10));
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith(h.id, 2);
      expect(fn).toHaveBeenCalledWith(h2.id, 1);
    });
    it("should not onMiddlewareHalt", async () => {
      const e = new EventFluxFlow();
      const fn = jest.fn();
      const h = e.on("", () => {}, {
        middlewares: [
          async (a, c) => {},
          async (a, c) => {},
          async (a, c) => {},
        ],
      });
      const c = e.emitAsync("", 2);
      c.onMiddlewareHalt(fn);
      await new Promise((r) => setTimeout(r, 10));
      expect(fn).toHaveBeenCalledTimes(0);
    });
  });
});
