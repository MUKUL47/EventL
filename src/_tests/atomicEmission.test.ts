import { EventFluxFlow } from "../eventfluxflow";

describe("Atomic Emissions", () => {
  describe("Async", () => {
    it("should emit atomic response for a async handler", async () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      e.on("A", async (delay) => {
        await new Promise((rr) => setTimeout(rr, delay));
        return delay;
      });
      expect(await e.emitAsync("A", 500, { atomic: true })).toBe(500);
    });
    it("should throw error for more than 1 handlers", async () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      e.on("A", async (delay) => {
        await new Promise((rr) => setTimeout(rr, delay));
        return delay;
      });
      const hand = async (delay) => {
        await new Promise((rr) => setTimeout(rr, delay));
        return delay;
      };
      const c = e.on("A", hand);
      try {
        await e.emitAsync("A", 500, { atomic: true });
        fail("Expected error to be thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
      c.off();
      expect(await e.emitAsync("A", 500, { atomic: true })).toBe(500);
    });
    it("should throw error if frozen", async () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      const hand = async (delay) => {
        await new Promise((rr) => setTimeout(rr, delay));
        return delay;
      };
      const c = e.on("A", hand);
      c.freeze();
      try {
        await e.emitAsync("A", 500, { atomic: true });
        fail("Expected error to be thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
      c.unFreeze();
      expect(await e.emitAsync("A", 500, { atomic: true })).toBe(500);
    });
    it("should catch on reject", async () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      const c = e.on("A", async (delay) => {
        throw new Error("");
      });
      try {
        await e.emitAsync("A", 500, { atomic: true });
        fail("Expected error to be thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
    it("should throw on failed or stop middleware propagation", async () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      const c = e.on("A", (c) => {
        return c;
      });
      c.useMiddleware((a, c) => {
        return c % 2 == 0;
      });
      c.useMiddleware(async (a, c) => {
        await new Promise((r) => setTimeout(r, 500));
      });
      try {
        await e.emitAsync("A", 1, { atomic: true });
        fail("Expected error to be thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
      expect(await e.emitAsync("A", 2, { atomic: true })).toBe(2);
    });

    it("should work as intended with queues", async () => {
      const e = new EventFluxFlow<{ a: number }, { a: number }>();
      e.on("a", (a) => a, {
        middlewares: [
          async (a, v) => {
            if (v >= 500) return false;
            await new Promise((r) => setTimeout(r, v));
          },
        ],
        withQueue: true,
      });
      let s = "";
      e.emitAsync("a", 300, { atomic: true }).then((v) => (s += v));
      e.emitAsync("a", 200, { atomic: true }).then((v) => (s += v));
      e.emitAsync("a", 100, { atomic: true }).then((v) => (s += v));
      await new Promise((r) => setTimeout(r, 610));
      expect(s).toBe("300200100");
      s = "";
      e.emitAsync("a", 500, { atomic: true })
        .then((v) => (s += v))
        .catch((v) => {});
      e.emitAsync("a", 200, { atomic: true }).then((v) => (s += v));
      e.emitAsync("a", 100, { atomic: true }).then((v) => (s += v));
      await new Promise((r) => setTimeout(r, 1000));
      expect(s).toBe("200100");
    });
  });

  describe("Sync", () => {
    it("should emit atomic response", () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      e.on("A", (delay) => {
        return delay / 2;
      });
      expect(e.emit("A", 500, { atomic: true })).toBe(250);
    });
    it("should throw error for more than 1 handlers", async () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      e.on("A", (delay) => {
        return delay;
      });
      const hand = (delay) => delay;
      const c = e.on("A", hand);
      try {
        e.emit("A", 500, { atomic: true });
        fail("Expected error to be thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
      c.off();
      expect(e.emit("A", 500, { atomic: true })).toBe(500);
    });
    it("should throw error if frozen", () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      const hand = (delay) => delay;
      const c = e.on("A", hand);
      c.freeze();
      try {
        e.emit("A", 500, { atomic: true });
        fail("Expected error to be thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
      c.unFreeze();
      expect(e.emit("A", 500, { atomic: true })).toBe(500);
    });
    it("should catch on reject", () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      const c = e.on("A", (delay) => {
        throw new Error("");
      });
      try {
        e.emit("A", 500, { atomic: true });
        fail("Expected error to be thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
    });
    it("should throw on failed or stop middleware propagation", () => {
      const e = new EventFluxFlow<{ A: number }, { A: number }>();
      const c = e.on("A", (c) => {
        return c;
      });
      c.useMiddleware((a, c) => {
        return c % 2 == 0;
      });
      try {
        e.emit("A", 1, { atomic: true });
        fail("Expected error to be thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
      }
      expect(e.emit("A", 2, { atomic: true })).toBe(2);
    });
  });
});
