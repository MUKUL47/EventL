# EventFluxFlow

## A feature-rich event orchestration library that goes far beyond just a "Event Emitter"

## Features

- [**Emit** ](#simple-sync-emission)
  Synchronous emission to all listeners with invokerLimit, middlewares & interceptors. Skips debounce, queues, and async.

- [**emitAsync** ](#emitasync)
  Async emission. Executes all registered listeners, supports middlewares, interceptors, debounce, invokerLimit and queues.

- [**emitAll**](#emitAll)  
  Waits until all registered listeners for an event (including async ones) are completed (i.e., Promise.all).

- [**debounce** ](#debounce)  
  Debounced invocation per listener. Prevents multiple rapid emissions from reaching the handler.

- [**InvokeLimit** ](#invokelimit)
  Limit number of invocations for a event handler.

- [**Priority** ](#priority)
  Controls the order in which listeners are executed. Lower numbers run earlier. Only SYNC

- [**Queues** ](#queue)  
  Ensures all emissions of an event are processed in order. Each emission waits for the previous one to complete (useful for async sequencing).

- [**Middlewares**](#middlewares)([**Async**](#middlewares-with-async))
  Transform, inspect, or block event payloads before reaching any listener. Runs per event type.

- [**Interceptors**](#interceptors)
  Advanced control layer for observing, modifying, or stopping emissions. Can be dynamically registered/unregistered. Support both mutable and immutable arguments.

- [**Freeze / Unfreeze** ](#freeze-unfreeze)
  Temporarily toggle between freeze/unfreeze processing events for a specific event.

- [**Namespaces**](#namespaces)
  Logical grouping of listeners. Enables easier management (Support all features).

- [**Fine grain controls** ](#controller)
  event registration returns variety of controls like freeze, unfreeze, updatePriority, toggleQueue, updateDebounce during runtime

---

### Emission Feature Matrix

| Feature             | `emit` | `emitAsync` | `emitAll` |
| ------------------- | ------ | ----------- | --------- |
| Sync                | ✅     | ❌          | ❌        |
| Async               | ❌     | ✅          | ✅        |
| Debounce            | ❌     | ✅          | ✅        |
| Queued              | ❌     | ✅          | ❌        |
| InvokeLimit         | ✅     | ✅          | ✅        |
| Priority            | ✅     | ❌          | ❌        |
| Middlewares         | ✅     | ✅          | ✅        |
| Interceptors        | ✅     | ✅          | ✅        |
| Freeze/Unfreeze     | ✅     | ✅          | ✅        |
| Namespace           | ✅     | ✅          | ✅        |
| Waits all Listeners | ❌     | ❌          | ✅        |

## API

### Simple sync emission

```ts
import { EventFluxFlow } from "eventfluxflow";

const E = new EventFluxFlow<{ EVENT: string }>({
  suppressWarnings: true,
  suppressErrors: true,
});
const handler = (arg: string) => {
  //event & callback infered
  //do something
};
const controls = E.on("EVENT", handler);

E.emit("HELLO");

//freeze emission
controls.freeze();
E.emit("Hey"); // this wont be emitted
//ufreeze emission
controls.unFreeze();
E.emit("Hey"); // continue as usual
E.off("EVENT", handler); //should be referenced callback
```

### Middlewares

```ts
const E = new EventFluxFlow<{ EVENT: { v: string } }>();
const controls = E.on(
  "EVENT",
  (arg: { v: string }) => {
    //do something
  },
  {
    middleware: [
      (eventName, arg) => {
        arg.v = arg.v + "_modify_something";
      },
      (eventName, arg) => {
        arg.v = arg.v + "_modify_something1";
      },
    ],
  }
);

E.emit("HELLO"); // handler will invoke with "HELLO_modify_something_modify_something1"

const E = new EventFluxFlow<{ ONLY_ODD: { resp: number } }>();
E.on("ONLY_ODD", console.log, {
  middlewares: [
    (a, c) => {
      if (c.resp % 2 != 0) {
        return false; // returning false halts middleware execution for this event
      }
      //here middleware will continue execution
    },
  ],
});
E.emit("ONLY_ODD", { resp: 12 }); //stopped at middleware
E.emit("ONLY_ODD", { resp: 11 }); //emitted

const E = new EventFluxFlow<{ ODD_LESS_THAN_10: { resp: number } }>();
E.on("ODD_LESS_THAN_10", console.log, {
  middlewares: [(a, c) => c.resp % 2 != 0, (a, c) => c.resp < 10],
});
E.emit("ODD_LESS_THAN_10", { resp: 2 });
E.emit("ODD_LESS_THAN_10", { resp: 13 });
E.emit("ODD_LESS_THAN_10", { resp: 9 }); //correct
```

### Middlewares with async

```ts
const E = new EventFluxFlow<{ TEST: { resp: number } }>();
const fn = jest.fn();
const fnMiddle = jest.fn();
E.on(
  "TEST",
  (r) => {
    //this will be invoked once all middleware are executed sequencially
  },
  {
    middlewares: [
      //middlewares are by processed sync or async based on emission
      //.emit() all middlewares are executed as sync
      //.emitAsync() all middlewares are executed as async
      ...Array.from({ length: 2 }).map((_, idx) => async (e, c) => {
        await new Promise((resolve) => setTimeout(resolve, idx * 100));
        c.resp++;
      }),
    ],
  }
);
E.emitAsync("TEST", { resp: 10 }); //12
```

### EmitAsync

```ts
//  Async emission. Executes all registered listeners, supports middlewares, interceptors, debounce, invokerLimit and queues.

const E = new EventFlux<{ TEST: number }>({ suppressWarnings: true });
E.on("TEST", console.log, {
  debounce: 50,
  invokeLimit: 2,
});

E.emitAsync("TEST", 2);
setTimeout(() => E.emitAsync("TEST", 1), 100);
E.emitAsync("TEST", 5);
setTimeout(() => E.emitAsync("TEST", 57), 80);
setTimeout(() => E.emitAsync("TEST", 212), 120);
await delay(500);
//80 & 120
```

### Interceptors

```ts
//with mutable interceptor
const E = new EventFluxFlow<{ TEST: { resp: number } }>();
E.intercept(
  "TEST",
  (arg) => {
    arg.resp *= arg.resp;
  },
  true
);
E.on("TEST", console.log); //64
E.emit("TEST", { resp: 8 });

//with immutable interceptor
const E = new EventFluxFlow<{ TEST: { resp: number } }>();
const fn = jest.fn();
E.intercept("TEST", (arg: any) => {
  try {
    arg.resp *= arg.resp;
  } catch (e) {
    //Tried modifying frozen object supress error while in use strict mode
  }
});
E.on("TEST", fn);
E.emit("TEST", { resp: 2 }); //2

//with both
const E = new EventFluxFlow<{ TEST: { resp: number } }>();
E.intercept(
  "TEST",
  (arg: any) => {
    arg.resp++;
  },
  true
);
E.intercept("TEST", (arg: any) => {
  try {
    arg.resp *= arg.resp;
  } catch (e) {
    //Tried modifying frozen object supress error while in use strict mode
  }
});
E.intercept(
  "TEST",
  (arg: any) => {
    arg.resp++; //continue mutating
  },
  true
);
E.on("TEST", console.log);
E.emit("TEST", { resp: 2 }); //4
```

### Namespaces

```ts
const E = new EventFluxFlow<{
  ADMIN: any;
  "ADMIN:USER": any;
  "ADMIN:USER:CREATE": any;
}>();
const fn = jest.fn();
E.on("ADMIN", () => fn("ADMIN"));
E.on("ADMIN:USER", () => fn("ADMIN:USER"));
E.on("ADMIN:USER:CREATE", () => fn("ADMIN:USER:CREATE"));
// with namespace all children with event prefix are invoked
E.emit("ADMIN", true, { namespace: true }); //ADMIN:USER:CREATE & ADMIN:USER
E.emit("ADMIN:USER", true, { namespace: true }); //ADMIN:USER:CREATE
E.emit("ADMIN", true); //ADMIN
```

### Priority

```ts
//only supported for .emit sync events
const E = new EventFluxFlow<{
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
//[1,2,3]
```

### InvokeLimit

```ts
const E = new EventFluxFlow<{ TEST: number }>({ suppressWarnings: true });
E.on("TEST", console.log, {
  invokeLimit: 2,
});

E.emit("TEST", 2);
E.emit("TEST", 21);
E.emit("TEST", 5); //this wont be invoked since limit reacted
```

### Debounce

```ts
const E = new EventFluxFlow<{ SEARCH: string }>({ suppressWarnings: true });
E.on("SEARCH", console.log, {
  debounce: 300,
});

setTimeout(() => E.emitAsync("SEARCH", "a"), 100);
setTimeout(() => E.emitAsync("SEARCH", "ab"), 250);
setTimeout(() => E.emitAsync("SEARCH", "abbc"), 650);
await delay(1000);
//ab
//abbc

const E = new EventFluxFlow<{ SEARCH: string }>({ suppressWarnings: true });
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
//"XYZ"
//"ABC"

const E = new EventFluxFlow<{ TEST: number }>({ suppressWarnings: true });
const fn = jest.fn();
E.on("TEST", fn, {
  debounce: 300,
  invokeLimit: 5,
});

E.emitAll("TEST", 2);
E.emitAll("TEST", 21);
E.emitAll("TEST", 5);
//nothing will be called since emitAll is not supported with debounce
```

### Queue

```ts
//simple queue
let p = "";
const E = new EventFluxFlow<{
  ADMIN: {
    delay: number;
    data: number;
  };
}>();
E.on(
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
//only emitAsync supports queue since its async
E.emitAsync("ADMIN", { delay: 500, data: 1 });
E.emitAsync("ADMIN", { delay: 100, data: 2 });
E.emitAsync("ADMIN", { delay: 20, data: 3 });
E.emitAsync("ADMIN", { delay: 0, data: 4 });
E.emitAsync("ADMIN", { delay: 100, data: 5 });
await delay(750);
//p = '12345'

//with invoke limit

let out = "";
const E = new EventFluxFlow<{
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

E.emitAsync("JOB", { delay: 100, data: "A" });
E.emitAsync("JOB", { delay: 100, data: "B" });
E.emitAsync("JOB", { delay: 100, data: "C" });

await delay(350);
//out = "AB"

//with debounce

const E = new EventFluxFlow<{
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

E.emitAsync("SEARCH", "a");
E.emitAsync("SEARCH", "ab");
E.emitAsync("SEARCH", "abc");
E.emitAsync("SEARCH", "abcd");

await delay(120);

E.emitAsync("SEARCH", "X");
E.emitAsync("SEARCH", "XY");
E.emitAsync("SEARCH", "XYZ");

await delay(120);

//output = abcd|XYZ|
```

### emitAll

```ts
//emit all will wait for all the handlers to complete - failed middlewares will be ignored in the promise pool
const E = new EventFluxFlow<{
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
//post above await
// {
//   TASK1: true,
//   TASK2: true,
//   TASK3: true,
// }

//with independent invokerLimits
const E = new EventFluxFlow<{
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
//{
//   TASK1: true,
//   TASK2: true,
// }
obj = {};
await E.emitAll("ADMIN", true); //only task is stil active since limit is 1
//{ TASK1: true }
obj = {};
await E.emitAll("ADMIN", true);
//{}

//with middlewares
const E = new EventFluxFlow<{ ADMIN: any }>({});
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
//one middleware failed that handler is ignored
//{ handler1: false, handler2: true }
```

### Freeze Unfreeze

```ts
const E = new EventFlux<{
  ADMIN: any;
}>();
const { freeze, unFreeze } = E.on("ADMIN", console.log);
E.emit("ADMIN", true);
E.emit("ADMIN", true);
//true
//true
freeze();
E.emit("ADMIN", true);
//no more emission
unFreeze(); //unpause emission
jest.resetAllMocks();
E.emit("ADMIN", true);
//true
```

### Controller

```ts
//Very fine grain control over event attributes via controller

//attach middleware from controls
import { EventFluxFlow as EventFlux } from "../eventfluxflow";
const E = new EventFlux<{
  ADMIN: any;
}>();
let f = {};
const controls = E.on("ADMIN", (c) => (f = c));
E.emit("ADMIN", {});
controls.useMiddleware((a, c) => (c.value = true));
controls.useMiddleware((a, c) => {
  if (c.block) return false;
  c.value1 = true;
});
E.emit("ADMIN", {});
//f = { value: true, value1: true }
f = {};
E.emit("ADMIN", { block: true });
//f = {}

//update invoke limit on the fly
const E = new EventFlux();
let s = [];
const c = E.on("1", (v) => s.push(v), { invokeLimit: 2 });
E.emit("1", 1);
E.emit("1", 2);
E.emit("1", 3);
//s = [1, 2];
c.updateInvokerLimit(1);
E.emit("1", 3);
//s = [1, 2, 3];
E.emit("1", 3);
//s = [1, 2, 3];

// update debounce with ease :)
const E = new EventFlux<{ TEST: number }>({ suppressWarnings: true });
const c = E.on("TEST", console.log, {
  debounce: 60,
});
setTimeout(() => E.emitAsync("TEST", 2), 55);
setTimeout(() => E.emitAsync("TEST", 5), 22);
await delay(120);
//2
c.updateDebounce(20);
setTimeout(() => E.emitAsync("TEST", 2), 55);
setTimeout(() => E.emitAsync("TEST", 5), 25);
await delay(100);
//5 & 2

//transform ordinary event to queue
let out = "";
const E = new EventFlux<{
  JOB: { delay: number; data: string };
}>();

const c = E.on(
  "JOB",
  async (arg) => {
    out += arg.data;
  },
  {
    middlewares: [
      async (_, arg) => {
        await delay(arg.delay);
      },
    ],
  }
);

E.emitAsync("JOB", { delay: 100, data: "A" });
E.emitAsync("JOB", { delay: 5, data: "B" });
await delay(350);
//"BA"
out = "";
c.toggleQueue(true);
E.emitAsync("JOB", { delay: 100, data: "A" });
E.emitAsync("JOB", { delay: 5, data: "B" });
E.emitAsync("JOB", { delay: 1, data: "C" });
await delay(350);
//"ABC"
```
