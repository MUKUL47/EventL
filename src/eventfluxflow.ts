import { Logger } from "./logger";

export class EventFluxFlow<T extends EventRecord> {
  private events: Map<keyof T, Array<EventData<T, keyof T>>>;
  private interceptors: Map<keyof T, Interceptors<T, keyof T>>;
  private id: number;
  private logger: Logger;
  constructor(options?: Partial<ConstructorParameters<typeof Logger>["0"]>) {
    this.logger = new Logger({
      suppressWarnings: !!options?.suppressWarnings,
      supressErrors: !!options?.supressErrors,
    });
    this.events = new Map();
    this.interceptors = new Map();
    this.id = 0;
  }

  get #newId() {
    return ++this.id;
  }

  #updateInvoker(event: EventData<T, keyof T>) {
    const { invokerFinished, invokerLimit } = event;
    if (
      invokerFinished ||
      (event.hasInvokerLimit &&
        !isNaN(+invokerLimit) &&
        event.invokerLimit!-- === 0)
    ) {
      event.invokerFinished = true;
      return false;
    }
    return true;
  }

  async #invokeMiddlewaresAsync<V extends keyof T>(
    resp: MiddlewareInterceptorsArgs<T, V>,
    listeners?: AsyncListenerType
  ): Promise<boolean> {
    const { eventName, middlewares, args, status, id } = resp;
    let idx = 0;
    for (const c of middlewares ?? []) {
      idx++;
      try {
        if (!!status?.isFrozen) return false;
        const resp = await c(eventName, args);
        if (resp === false) {
          listeners?.onMiddlewareHalt?.(id, idx);
          return false;
        }
      } catch (e) {
        this.logger.warn(e);
        return false;
      }
    }
    return true;
  }

  #invokeMiddlewares<V extends keyof T>(
    resp: MiddlewareInterceptorsArgs<T, V>
  ): boolean {
    const { eventName, middlewares, args, status } = resp;
    for (const c of middlewares ?? []) {
      try {
        if (!!status?.isFrozen) return false;
        const resp = c(eventName, args);
        if (resp === false) return false;
      } catch (e) {
        this.logger.warn(e);
        return false;
      }
    }
    return true;
  }

  #invokeInterceptors<V extends keyof T>(
    resp: MiddlewareInterceptorsArgs<T, V>
  ): void {
    const { eventName, args } = resp;
    (this.interceptors.get(eventName) ?? []).forEach(({ invoker, mutable }) => {
      if (mutable) {
        invoker(args);
        return;
      }
      if (typeof structuredClone === "undefined") {
        this.logger.warn(
          "[interceptor] structuredClone not supported for immutable arguments : falling back to mutuable"
        );
        invoker(args);
        return;
      }
      invoker?.(Object.freeze(structuredClone(args)));
    });
  }

  async #invokeMiddlewareInterceptorsAsync<V extends keyof T>(
    resp: MiddlewareInterceptorsArgs<T, V>,
    listeners?: AsyncListenerType
  ) {
    if (!(await this.#invokeMiddlewaresAsync(resp, listeners))) return false;
    if (!!resp?.status?.isFrozen) return false;
    this.#invokeInterceptors(resp);
    return true;
  }

  #invokeMiddlewareInterceptors<V extends keyof T>(
    resp: MiddlewareInterceptorsArgs<T, V>
  ) {
    if (!this.#invokeMiddlewares(resp) || !!resp?.status?.isFrozen)
      return false;
    this.#invokeInterceptors(resp);
    return true;
  }

  #getEvents<V extends keyof T>(
    eventName: V,
    options?: Partial<{ namespace: boolean; debounceOnly: boolean }>
  ): Array<EventData<T, keyof T>> {
    const currentEvents: Array<EventData<T, keyof T>> = [];
    for (let [name, e] of this.events) {
      if (
        (!!options?.namespace &&
          (name as string)?.startsWith(eventName as string) &&
          eventName !== name) ||
        (!options?.namespace && eventName === name)
      ) {
        if (!options?.debounceOnly) {
          currentEvents.push(...e);
          continue;
        }
        const debouncedEvents = e.filter((v) => !!v.debouceFactory?.debounce);
        if (debouncedEvents.length > 0) {
          currentEvents.push(...debouncedEvents);
        }
      }
    }
    return currentEvents;
  }

  async #emitQueue<V extends keyof T>(
    event: EventData<T, keyof T>,
    args: T[V],
    eventName: V,
    asyncListeners: AsyncListenerType
  ) {
    if (!event.queue || event.status?.isFrozen) return;
    if (!this.#updateInvoker(event)) return;
    event.queue.invokers.push({
      args,
      cb: event.invoker,
    });
    asyncListeners?.onQueued?.(event.id, event.queue.invokers.length - 1);
    if (event.queue.inProgress) return;
    while (event.queue.invokers.length > 0) {
      event.queue.inProgress = true;
      const current = event.queue.invokers.shift()!;
      if (event.status?.isFrozen) return;
      if (
        !(await this.#invokeMiddlewareInterceptorsAsync(
          {
            eventName,
            middlewares: event.middlewares ?? [],
            args: current?.args,
            status: event.status,
            id: event.id,
          },
          asyncListeners
        ))
      ) {
        continue;
      }
      if (event.status?.isFrozen) return;
      asyncListeners?.onInvoke?.(event.id);
      await event.invoker(current.args);
    }
    event.queue.inProgress = false;
  }

  #handleDebouce(event: EventData<T, keyof T>, fn: () => any) {
    const { debouceFactory } = event;
    if (!!debouceFactory) {
      if (debouceFactory?.lastDebouncedReference) {
        clearTimeout(debouceFactory?.lastDebouncedReference);
      }
      event.debouceFactory!.lastDebouncedReference = setTimeout(() => {
        fn();
      }, debouceFactory.debounce);
      return;
    }
    fn();
  }

  /**
   * @template T - Event map
   * @template V - event key
   * @description Register invocation for an event
   * @param {V} eventName - The event name to register
   * @param {Invoker<T, V>} invoker - The callback function to be invoked
   * @param {Partial<EventDataOnParam<T, V>>} [options] - Options like debounce, priority, withQueue, middlewares and invokeLimit.
   * @returns {{ cancel: () => void, id: number }} - unique ID and cancel event callback
   */
  on<V extends keyof T>(
    eventName: V,
    invoker: Invoker<T, V>,
    options?: EventDataOnParam<T, V>
  ): EventDataOnReturn {
    let isNew: Array<EventData<T, keyof T>> | undefined;
    if (!this.events.has(eventName)) {
      isNew = [];
      this.events.set(eventName, isNew);
    }
    const currentEvent = isNew ?? this.events.get(eventName);
    const status: EventData<T, V>["status"] = {
      isFrozen: false,
    };
    const invokerLimit =
      !options?.invokeLimit || options?.invokeLimit === 0
        ? -1
        : options?.invokeLimit;
    const id = this.#newId;
    const addDebounce = (n?: number) =>
      n && !isNaN(n)
        ? {
            debounce: n ?? 0,
            lastDebouncedReference: null,
          }
        : null;

    const addQueue = (flag?: boolean) =>
      !!flag
        ? {
            finished: false,
            inProgress: false,
            invokers: [],
          }
        : null;
    const finalEvent = {
      invoker: invoker as Invoker<T, keyof T>,
      debouceFactory: addDebounce(options?.debounce),
      id,
      status,
      invokerLimit,
      hasInvokerLimit: invokerLimit !== -1,
      invokerFinished: false,
      isQueue: !!options?.withQueue,
      priority: options?.priority ?? Infinity,
      queue: addQueue(!!options?.withQueue),

      middlewares: options?.middlewares ?? [],
    };
    currentEvent?.push(finalEvent);

    options?.priority
      ? this.events.set(
          eventName,
          currentEvent!.sort((a, b) => a?.priority - b.priority)
        )
      : this.events.set(eventName, currentEvent!);

    return {
      freeze: () => (status.isFrozen = true),
      unFreeze: () => (status.isFrozen = false),
      toggleQueue: (flag) => {
        if (finalEvent.isQueue == flag) return;
        finalEvent.isQueue = flag;
        finalEvent.queue = addQueue(!!flag);
      },
      updateDebounce: (n) => (finalEvent.debouceFactory = addDebounce(n)),
      updateInvokerLimit: (n) => {
        finalEvent.invokerLimit = n;
        finalEvent.hasInvokerLimit = n !== -1;
        finalEvent.invokerFinished = !finalEvent.hasInvokerLimit;
      },
      useMiddleware: (...m) => finalEvent.middlewares?.push(...m),
      id,
      off: () => this.off(eventName, invoker),
    };
  }

  /**
   * @template T - Event map
   * @template V - event key
   * @description Register interception invocation for an event
   * @param {V} eventName - The event name to intercept
   * @param {(args: F extends true ? T[V] : Readonly<T[V]>) => unknown} invoker - The callback function to be invoked during interception
   * @param {boolean} mutable - while intercepting arguments can be both immutable or mutable
   * @returns {void}
   */
  intercept<V extends keyof T, F extends boolean>(
    eventName: V,
    invoker: (args: F extends true ? T[V] : Readonly<T[V]>) => unknown,
    mutable?: F
  ) {
    this.interceptors.set(eventName, [
      ...(this.interceptors.get(eventName) ?? []),
      { invoker, mutable: !!mutable },
    ] as Interceptors<T, keyof T>);
  }

  /**
   * @template T - Event map
   * @template V - event key
   * @description emission an event invocation synchronously - middlewares & interceptors are executed synchronously, debouce & queues are ignored
   * @param {V} eventName - The event name for emission
   * @param {any} args - argument of the registered event
   * @param {{namespace: boolean}} [options] - if true emit all events with eventName prefix
   * @returns {void}
   */
  emit<V extends keyof T>(
    eventName: V,
    args: T[V],
    options?: Partial<{
      namespace: boolean;
    }>
  ): void {
    const currentEvents: Array<EventData<T, keyof T>> = this.#getEvents(
      eventName,
      {
        namespace: !!options?.namespace,
      }
    );
    currentEvents.forEach(async (eventBlob) => {
      const { middlewares, invoker, status } = eventBlob;

      if (!!status?.isFrozen) return;
      if (!this.#updateInvoker(eventBlob)) return;
      if (
        !this.#invokeMiddlewareInterceptors({
          eventName,
          middlewares: middlewares ?? [],
          args,
          status: eventBlob.status,
          id: eventBlob.id,
        })
      ) {
        return;
      }
      invoker(args);
    });
  }

  /**
   * @template T - Event map
   * @template V - event key
   * @description emission an event invocation asynchronously - middlewares & interceptors are executed async
   * @param {V} eventName - The event name to emit async
   * @param {any} args - argument of the registered event
   * @param {{namespace: boolean}} [options] - if true emit all events with eventName prefix
   * @returns {Promise<void>} - irrelvant return promise
   */
  emitAsync<V extends keyof T, R extends unknown | never>(
    eventName: V,
    args: T[V],
    options?: {
      namespace?: boolean;
      isAtomic?: R;
    }
  ): R extends any ? Promise<R> : EmitAsyncReturn {
    const currentEvents: Array<EventData<T, keyof T>> = this.#getEvents(
      eventName,
      {
        namespace: !!options?.namespace,
      }
    );
    if (!!options?.isAtomic && currentEvents.length !== 0) {
      this.logger.throw(
        "[emitAsync] with atomic response should only have 1 registered handler, for more than 1 handlers in Promise.all mode use emitAll"
      );
      return;
    }
    const listeners: AsyncListenerType = {};
    let atomicPromiseFn = {
      resolve: (r: ConstructorParameters<typeof Promise>["0"]) => {},
      reject: (r: string) => {},
    };
    const atomicPromise = new Promise((r, reject) => {
      atomicPromiseFn.resolve = r;
      atomicPromiseFn.reject = reject;
    });
    currentEvents.forEach(async (eventBlob) => {
      const { middlewares, invoker, status, debouceFactory, queue } = eventBlob;
      if (!!status?.isFrozen) {
        if (!!options?.isAtomic) {
          atomicPromiseFn.reject("[Reject][emitAsync] handler is frozen");
        }
        return;
      }
      if (!!queue) {
        if (!!debouceFactory) {
          this.#handleDebouce(eventBlob, () =>
            this.#emitQueue(eventBlob, args, eventName, listeners)
          );
          return;
        }
        this.#emitQueue(eventBlob, args, eventName, listeners);
        return;
      }

      this.#handleDebouce(eventBlob, async () => {
        if (!this.#updateInvoker(eventBlob)) return;
        if (
          !(await this.#invokeMiddlewareInterceptorsAsync(
            {
              eventName,
              middlewares: middlewares ?? [],
              args,
              status: eventBlob.status,
              id: eventBlob.id,
            },
            listeners
          ))
        ) {
          return;
        }

        if (!!options?.isAtomic) {
          Promise.resolve(invoker(args))
            .then(atomicPromiseFn.resolve)
            .catch(atomicPromiseFn.reject);
          return;
        }
        listeners.onInvoke?.(eventBlob.id);
      });
    });

    if (!!options?.isAtomic) {
      return atomicPromise as any;
    }
    return {
      onInvoke: (cb) => (listeners.onInvoke = cb),
      onMiddlewareHalt: (cb) => (listeners.onMiddlewareHalt = cb),
      onQueued: (cb) => (listeners.onQueued = cb),
    } as any;
  }

  /**
   * @template V - event key
   * @template R - promise response
   * @description all registered events are executed then promise is completed, debouce is ignored(warning)
   * @param {V} eventName - The event name for emission
   * @param {any} args - argument of the registered event
   * @param {{namespace: boolean}} [options] - if true emit all events with eventName prefix
   * @returns {Promise<void>} - once all registered events are completed promise is then resolved
   */
  async emitAll<V extends keyof T>(
    eventName: V,
    args: T[V],
    options?: Partial<{
      namespace: string;
    }>
  ): Promise<unknown[]> {
    const currentEvents: Array<EventData<T, keyof T>> = this.#getEvents(
      eventName,
      {
        namespace: !!options?.namespace && options?.namespace.length > 0,
      }
    );
    const filteredEvents = currentEvents.filter((event) => {
      if (!!event?.debouceFactory) {
        this.logger.warn(
          `[asyncEmit] ${eventName.toString()}: cannot execute debouce with emitAll - ignoring invocation`
        );
        return false;
      }
      if (!this.#updateInvoker(event)) return false;
      return true;
    });
    return await Promise.all(
      (
        await Promise.all(
          filteredEvents.map((currentEvent) =>
            this.#invokeMiddlewareInterceptorsAsync({
              eventName,
              middlewares: currentEvent?.middlewares ?? [],
              args,
              status: currentEvent.status,
              id: currentEvent.id,
            })
          )
        )
      )
        .map((a, idx) => (a ? currentEvents[idx]?.invoker(args) : false))
        .filter((v) => !!v)
    );
  }

  /**
   * @template T - Event map
   * @template V - event key
   * @description remove specific event type
   * @param {V} e - The event name
   * @param {Function} fn - referenced function
   * @returns {void}
   */
  off<V extends keyof T>(e: V, fn: Function): void {
    if (typeof fn != "function") {
      this.logger.throw("[off] expected function as an argument");
      return;
    }
    if (fn.name.length === 0) {
      this.logger.throw(
        "[off] anonymous function do not hold references to the events map pool, pass referenced functions"
      );
      return;
    }
    this.events.set(
      e,
      this.events.get(e).filter((a) => a.invoker != fn)
    );
  }

  /**
   * @template T - Event map
   * @template V - event key
   * @description deregister interception invocation for an event
   * @param {V} eventName - The event name to intercept
   * @param {Function} invoker - The callback function to be removed - must be referenced
   * @returns {void}
   */
  interceptOff<V extends keyof T>(e: V, fn: Function) {
    if (typeof fn != "function") {
      this.logger.throw("[off] expected function as an argument");
      return;
    }
    if (fn.name.length === 0) {
      this.logger.throw(
        "[off] anonymous function do not hold references to the events map pool, pass referenced functions"
      );
      return;
    }
    this.interceptors.set(
      e,
      this.interceptors.get(e).filter((a) => a.invoker != fn)
    );
  }
}
