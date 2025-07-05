type EventRecord = Record<string | symbol, unknown>;

type Interceptor<
  T extends EventRecord,
  V extends keyof T,
  M extends boolean = false | undefined
> = {
  mutable: boolean;
  invoker: (args: M extends true ? T[V] : Readonly<T[V]>) => unknown;
};

type Interceptors<T extends EventRecord, V extends keyof T> = Array<
  Interceptor<T, V>
>;

type Middleware<T extends EventRecord, V extends keyof T> =
  | ((eventName: V, args: T[V]) => Promise<boolean | undefined | void>)
  | ((eventName: V, args: T[V]) => boolean | undefined | void);

type Middlewares<T extends EventRecord, V extends keyof T> = Array<
  Middleware<T, V>
>;

type Invoker<T extends EventRecord, V extends keyof T> = (
  args: T[V]
) => unknown;

type EventData<T extends EventRecord, V extends keyof T> = {
  invoker: Invoker<T, V>;
  middlewares?: Middlewares<T, V>;
  status: {
    isCancelled: boolean;
    isPaused: boolean;
  };
  id: number;

  //debouce
  debouce?: number;
  debouceFactory: null | {
    debounce: number;
    lastDebouncedReference: null | ReturnType<typeof setTimeout>;
  };

  //queue
  isQueue?: boolean;
  queue: {
    inProgress: boolean;
    invokers: Array<{
      cb: Invoker<T, V>;
      args: T[V];
    }>;
    finished: boolean;
  } | null;

  //invoker limit
  hasInvokerLimit?: boolean;
  invokerLimit?: number;
  invokerFinished?: boolean;

  //priority
  priority: number;
};

type EventDataOnReturn = {
  cancel: () => void;
};
type EventDataOnParam<T extends EventRecord, V extends keyof T> = {
  middlewares?: Middlewares<T, V>;
  invokeLimit?: number;
  withQueue?: boolean;
  debounce?: number;
  priority?: number;
};
