import { EventFlux } from "../eventflux";

describe("Priorty", () => {
  test("should sort via priority", async () => {
    const E = new EventFlux<{
      ADMIN: any;
      "ADMIN:USER": any;
      "ADMIN:USER:CREATE": any;
    }>();
    const s = [];
    E.on("ADMIN", () => s.push(3), { priority: 3 });
    E.on("ADMIN", () => s.push(2), { priority: 2 });
    E.on("ADMIN", () => s.push(1), { priority: 1 });
    E.emit("ADMIN", true);
    E.emit("ADMIN", true);
    E.emit("ADMIN", true);
    expect(s[0]).toBe(1);
    expect(s[1]).toBe(2);
    expect(s[2]).toBe(3);
  });
});
