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
    isFrozen: boolean;
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
  freeze: () => void;
  unFreeze: () => void;
  useMiddleware: (...middlewares: Middleware<T, V>[]) => void;
  toggleQueue: (flag: boolean) => void;
  updateInvokerLimit: (limit: number) => void;
  updateDebounce: (P: number) => void;
  id: number;
  off: () => void;
};
type EventDataOnParam<T extends EventRecord, V extends keyof T> = {
  middlewares?: Middlewares<T, V>;
  invokeLimit?: number;
  withQueue?: boolean;
  debounce?: number;
  priority?: number;
};

type MiddlewareInterceptorsArgs<T, V> = {
  eventName: V;
  middlewares: Middlewares<T, V>;
  args: T[V];
  status: EventData<T, V>["status"];
  id: number;
};

type EmitAsyncListenerArgs<T extends keyof EmitAsyncListeners> = Parameters<
  EmitAsyncListeners[T]
>;

type EmitAsyncListeners = {
  onInvoke: (handlerId: number) => void;
  onMiddlewareHalt: (handlerId: number, middlewareIndex: number) => void;
  onQueued: (handlerId: number, queueIdx: number) => void;
};

type AsyncListenerType = {
  [P in keyof EmitAsyncListeners]?: (
    ...cb: EmitAsyncListenerArgs<P>
  ) => any | undefined;
};

type EmitAsyncReturn = {
  [P in keyof EmitAsyncListeners]: (
    cb: (...arg: EmitAsyncListenerArgs<P>) => any
  ) => any;
};
type EmitAsync<Response extends boolean = false, V extends keyof T = any> = (
  eventName: V,
  args: T[V],
  options?: {
    namespace?: boolean;
    isAtomic?: Response;
  }
) => Response extends true ? Promise<any> : EmitAsyncReturn;
