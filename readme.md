# EventL - Event Emitter with Advanced Features

`EventL` is a generic event management class implemented in TypeScript. It supports features like event subscription with priorities, debounce, invocation limits, middleware, interceptors, namespaces, asyncEmit(Promise.all of events) and event queues

## Usage

```ts
interface MyEvents {
  eventName1: { foo: string };
  eventName2: number;
}

const eventL = new EventL<MyEvents>();

// Subscribe to an event
eventL.on(
  "eventName1",
  (args) => {
    console.log("Handler:", args.foo);
  },
  {
    invokeLimit: 3,
    priority: 10,
    withQueue: true,
    middlewares: [
      async (event, args) => {
        console.log("Middleware before handler");
        args.foo = "John"; //mutuate
        /**
         * return false//block flow
         * return undefined | true = continue
         **/
      },
    ],
  }
);

// Emit an event
eventL.emit("eventName1", { foo: "bar" });

// Emit an event asynchronously and wait for handlers
await eventL.asyncEmit("eventName1", { foo: "bar" });

// Emit an event with debounce
eventL.emitDebounce("eventName1", { foo: "bar" });

// Intercept event arguments (immutable by default)
eventL.intercept("eventName1", (args) => {
  console.log("Intercepted args:", args);
});

// Remove event listener (function must be named)
function handler(args: { foo: string }) {
  console.log("Named handler:", args.foo);
}
eventL.on("eventName1", handler);
eventL.off("eventName1", handler);
```

## Multiple Listeners with Priorities, Invoke Limits, and Middleware

```ts
interface MyEvents {
  ORDER_PLACED: { orderId: number; userId: string };
}

const events = new EventL<MyEvents>();

events.on(
  "ORDER_PLACED",
  async (order) => {
    console.log(
      "High priority handler - sending confirmation email:",
      order.orderId
    );
  },
  {
    priority: 20,
    invokeLimit: 2,
    middlewares: [
      async (event, args) => {
        console.log(
          `[Middleware] Logging event: ${event}, orderId: ${args.orderId}`
        );
        return true; // allow handler execution
      },
    ],
  }
);

events.on(
  "ORDER_PLACED",
  (order) => {
    console.log("Low priority handler - updating stats:", order.orderId);
  },
  { priority: 5 }
);

await events.asyncEmit("ORDER_PLACED", { orderId: 123, userId: "userA" }); //completed both registered events before resolving the promise
await events.asyncEmit("ORDER_PLACED", { orderId: 124, userId: "userB" });
await events.asyncEmit("ORDER_PLACED", { orderId: 125, userId: "userC" });
// Only the first handler will run twice (invokeLimit=2), low priority runs every time
```

## Queue + Middlewares

```ts
interface MyEvents {
  PROCESS_TASK: { taskId: number; data: string };
}

const events = new EventL<MyEvents>();

// Middleware: logs event before processing
const loggerMiddleware = async (
  eventName: keyof MyEvents,
  args: MyEvents["PROCESS_TASK"]
) => {
  console.log(`[Middleware] Starting ${eventName} with task ${args.taskId}`);
  // allow continue
  return true;
};

// Middleware: simulate async delay & blocking certain tasks
const delayMiddleware = async (
  eventName: keyof MyEvents,
  args: MyEvents["PROCESS_TASK"]
) => {
  if (args.taskId === 2) {
    console.log(`[Middleware] Blocking task ${args.taskId}`);
    return false; // cancel this task
  }
  // simulate delay 50ms
  await new Promise((res) => setTimeout(res, 50));
  //do not return anything = continue
};

// Register with queue enabled and middlewares, priority set to 1
events.on(
  "PROCESS_TASK",
  async ({ taskId, data }) => {
    console.log(`[Handler] Processing task ${taskId} with data: ${data}`);
    // Simulate processing delay
    await new Promise((res) => setTimeout(res, 100));
  },
  {
    withQueue: true,
    middlewares: [loggerMiddleware, delayMiddleware],
  }
);

// Emit multiple tasks rapidly — will queue & process sequentially skipping blocked tasks
events.emit("PROCESS_TASK", { taskId: 1, data: "First" });
events.emit("PROCESS_TASK", { taskId: 2, data: "Second (blocked)" });
events.emit("PROCESS_TASK", { taskId: 3, data: "Third" });

/* Expected console output:
[Middleware] Starting PROCESS_TASK with task 1
[Handler] Processing task 1 with data: First
[Middleware] Starting PROCESS_TASK with task 2
[Middleware] Blocking task 2
[Middleware] Starting PROCESS_TASK with task 3
[Handler] Processing task 3 with data: Third
*/
```

## asyncEmit with invokeLimit + middlewares + interceptors

```ts
interface AsyncEvents {
  DATA_RECEIVED: { data: string };
}

const asyncEvents = new EventL<AsyncEvents>();

// Middleware that transforms data to uppercase
const uppercaseMiddleware = async (
  eventName: keyof AsyncEvents,
  args: AsyncEvents["DATA_RECEIVED"]
) => {
  args.data = args.data.toUpperCase();
  return true;
};

// Interceptor to log (immutable) args after middleware
asyncEvents.intercept(
  "DATA_RECEIVED",
  (args) => {
    console.log("[Interceptor] Immutable data received:", args.data);
  },
  false
);

// Register listener with invokeLimit of 2
asyncEvents.on(
  "DATA_RECEIVED",
  async ({ data }) => {
    console.log("[Listener] Handling data:", data);
    await new Promise((res) => setTimeout(res, 100));
  },
  {
    invokeLimit: 2,
    middlewares: [uppercaseMiddleware],
  }
);

// Emit three times — only two should invoke the handler because of invokeLimit
await asyncEvents.asyncEmit("DATA_RECEIVED", { data: "first" });
await asyncEvents.asyncEmit("DATA_RECEIVED", { data: "second" });
await asyncEvents.asyncEmit("DATA_RECEIVED", { data: "third" });

/* Expected output:
[Interceptor] Immutable data received: FIRST
[Listener] Handling data: FIRST
[Interceptor] Immutable data received: SECOND
[Listener] Handling data: SECOND
// third emit ignored due to invokeLimit
*/
```

## emit with debounce + interceptors + middleware

```ts
interface DebounceEvents {
  USER_TYPING: { text: string };
}

const debounceEvents = new EventL<DebounceEvents>();

// Middleware to block empty strings
const blockEmptyMiddleware = async (
  eventName: keyof DebounceEvents,
  args: DebounceEvents["USER_TYPING"]
) => {
  if (!args.text.trim()) {
    console.log("[Middleware] Ignoring empty input");
    return false;
  }
  return true;
};

// Interceptor to log immutable input after middleware
debounceEvents.intercept(
  "USER_TYPING",
  (args) => {
    console.log("[Interceptor] User typed:", args.text);
  },
  false
);

// Register with debounce 200ms (invokeLimit not allowed with debounce)
debounceEvents.on(
  "USER_TYPING",
  (args) => {
    console.log("[Handler] Processing user input:", args.text);
  },
  {
    debounce: 200,
    middlewares: [blockEmptyMiddleware],
  }
);

// Simulate rapid typing
debounceEvents.emit("USER_TYPING", { text: "H" });
debounceEvents.emit("USER_TYPING", { text: "He" });
debounceEvents.emit("USER_TYPING", { text: "Hel" });
debounceEvents.emit("USER_TYPING", { text: "Hell" });
debounceEvents.emit("USER_TYPING", { text: "Hello" });

// Wait 300ms for debounce to trigger (in real code you'd await or delay here)

/* Expected console output after ~200ms debounce delay:
[Middleware] Ignoring empty input  // Not shown because inputs are not empty
[Interceptor] User typed: Hello
[Handler] Processing user input: Hello
*/
```
