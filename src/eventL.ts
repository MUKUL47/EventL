export class EventL<T extends EventRecord> {
  private events: Map<keyof T, Array<EventData<T, keyof T>>>;
  private interceptors: Map<keyof T, Interceptors<T, keyof T>>;
  private id: number;
  constructor() {
    this.events = new Map();
    this.interceptors = new Map();
    this.id = 0;
  }

  get newId() {
    return ++this.id;
  }

  private updateInvoker(event: EventData<T, keyof T>) {
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
      isCancelled: false,
      isPaused: false,
    };
    const invokerLimit =
      !options?.invokeLimit || options?.invokeLimit === 0
        ? -1
        : options?.invokeLimit;

    currentEvent?.push({
      invoker: invoker as Invoker<T, keyof T>,
      debouceFactory:
        options?.debounce && !isNaN(options?.debounce)
          ? {
              debounce: options?.debounce ?? 0,
              lastDebouncedReference: null,
            }
          : null,
      id: this.newId,
      status,
      invokerLimit,
      hasInvokerLimit: invokerLimit !== -1,
      invokerFinished: false,
      isQueue: !!options?.withQueue,
      priority: options?.priority ?? Infinity,
      queue: options?.withQueue
        ? {
            finished: false,
            inProgress: false,
            invokers: [],
          }
        : null,

      middlewares: options?.middlewares ?? [],
    });

    options?.priority
      ? this.events.set(
          eventName,
          currentEvent!.sort((a, b) => a?.priority - b.priority)
        )
      : this.events.set(eventName, currentEvent!);

    return {
      cancel: () => (status.isCancelled = true),
    };
  }

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

  private async invokeMiddlewareInterceptors<V extends keyof T>({
    eventName,
    middlewares,
    args,
    status,
  }: {
    eventName: V;
    middlewares: Middlewares<T, V>;
    args: T[V];
    status: EventData<T, V>["status"];
  }) {
    for (const c of middlewares ?? []) {
      try {
        if (!!status?.isCancelled) return false;
        const resp = await c(eventName, args);
        if (resp === false) return false;
      } catch (e) {
        return false;
      }
    }
    if (!!status?.isCancelled) return false;
    (this.interceptors.get(eventName) ?? []).forEach(({ invoker, mutable }) => {
      if (mutable) {
        invoker(args);
        return;
      }
      if (typeof structuredClone === "undefined") {
        console.warn(
          "[interceptor] structuredClone not supported for immutable arguments : falling back to mutuable"
        );
        invoker(args);
        return;
      }
      invoker?.(Object.freeze(structuredClone(args)));
    });
    return true;
  }

  private getEvents<V extends keyof T>(
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

  async emitDebounce<V extends keyof T>(
    eventName: V,
    args: T[V],
    options?: Partial<{
      namespace: string;
    }>
  ): Promise<void> {
    const currentEvents: Array<EventData<T, keyof T>> = this.getEvents(
      eventName,
      {
        debounceOnly: true,
        namespace: !!options?.namespace,
      }
    );

    for (const eventBlob of currentEvents) {
      const { invoker, status, debouceFactory } = eventBlob;
      if (!!status?.isCancelled) return;
      debouceFactory?.lastDebouncedReference &&
        clearTimeout(debouceFactory?.lastDebouncedReference);
      eventBlob.debouceFactory!.lastDebouncedReference = setTimeout(() => {
        invoker(args);
      }, debouceFactory!.debounce);
    }
  }

  private async emitQueue<V extends keyof T>(
    event: EventData<T, keyof T>,
    args: T[V],
    eventName: V
  ) {
    if (!event.queue) return;
    event.queue.invokers.push({
      args,
      cb: event.invoker,
    });
    if (event.queue.inProgress) return;
    while (event.queue.invokers.length > 0) {
      event.queue.inProgress = true;
      const current = event.queue.invokers.shift()!;
      if (event.status?.isCancelled) return;
      if (
        !(await this.invokeMiddlewareInterceptors({
          eventName,
          middlewares: event.middlewares ?? [],
          args: current?.args,
          status: event.status,
        }))
      ) {
        continue;
      }
      if (event.status?.isCancelled) return;
      await event.invoker(current.args);
    }
    event.queue.inProgress = false;
  }

  private handleDebouce(event: EventData<T, keyof T>, fn: () => any) {
    const { debouceFactory } = event;
    if (!!debouceFactory) {
      debouceFactory?.lastDebouncedReference &&
        clearTimeout(debouceFactory?.lastDebouncedReference);
      event.debouceFactory!.lastDebouncedReference = setTimeout(
        fn,
        debouceFactory.debounce
      );
    }
  }

  async emit<V extends keyof T>(
    eventName: V,
    args: T[V],
    options?: Partial<{
      namespace: boolean;
    }>
  ): Promise<void> {
    const currentEvents: Array<EventData<T, keyof T>> = this.getEvents(
      eventName,
      {
        namespace: !!options?.namespace,
      }
    );
    currentEvents.forEach(async (eventBlob) => {
      const {
        middlewares,
        invoker,
        status,
        debouceFactory,
        queue,
        hasInvokerLimit,
      } = eventBlob;
      if (debouceFactory && hasInvokerLimit) {
        console.warn(
          `[emit] ${eventName.toString()}: cannot execute debouce with invokerLimit - ignoring invocation`
        );
        return;
      }
      if (!this.updateInvoker(eventBlob)) return;
      if (!!status?.isCancelled) return;
      if (!!queue) {
        if (!!debouceFactory) {
          this.handleDebouce(eventBlob, () =>
            this.emitQueue(eventBlob, args, eventName)
          );
          return;
        }
        this.emitQueue(eventBlob, args, eventName);
        return;
      }
      if (
        !(await this.invokeMiddlewareInterceptors({
          eventName,
          middlewares: middlewares ?? [],
          args,
          status: eventBlob.status,
        }))
      ) {
        return;
      }
      if (!!debouceFactory) {
        this.handleDebouce(eventBlob, () => invoker(args));
      } else {
        invoker(args);
      }
    });
  }

  async asyncEmit<V extends keyof T>(
    eventName: V,
    args: T[V],
    options?: Partial<{
      namespace: string;
    }>
  ) {
    const currentEvents: Array<EventData<T, keyof T>> = this.getEvents(
      eventName,
      {
        namespace: !!options?.namespace,
      }
    );
    const filteredEvents = currentEvents.filter((event) => {
      if (!!event?.debouceFactory) {
        console.warn(
          `[asyncEmit] ${eventName.toString()}: cannot execute debouce with asyncEmit - ignoring invocation`
        );
        return false;
      }
      if (!this.updateInvoker(event)) return false;
      return true;
    });
    await Promise.all(
      (
        await Promise.all(
          filteredEvents.map((currentEvent) =>
            this.invokeMiddlewareInterceptors({
              eventName,
              middlewares: currentEvent?.middlewares ?? [],
              args,
              status: currentEvent.status,
            })
          )
        )
      )
        .map((a, idx) => (a ? currentEvents[idx]?.invoker(args) : false))
        .filter((v) => !!v)
    );
  }

  off<V extends keyof T>(e: V, fn: Function): void {
    if (typeof fn != "function") {
      throw new Error("[off] expected function as an argument");
    }
    if (fn.name.length === 0) {
      throw new Error(
        "[off] anonymous function do not hold references to the events map pool, pass referenced functions"
      );
    }
    this.events.set(
      e,
      this.events.get(e).filter((a) => a.invoker != fn)
    );
  }
}
