import type { StoreBaseMethods, StoreBroadcastMethods, StoreLoadParams } from '../../store/types/Class';
import type { UserClass, UserInstance } from './Class';

export interface SessionClientLike {
  emit(eventName: string, payload: any): void;
  addListener(eventName: string, handler: (...args: any[]) => void | Promise<void>): void;
  startSession(token: string, data: { sessionId: string | undefined; userId: string }): void;
}

export interface SessionContextLike {
  client: SessionClientLike;
}

export interface SessionInitData {
  windowTabId?: string;
  demo?: boolean;
  login?: string;
  password?: string;
  tutorial?: string | Record<string, any> | boolean;
  token?: string;
}

export interface SessionCreateData {
  userId: string;
  userLogin: string;
  token: string;
  windowTabId?: string;
}

export interface SessionLoadConfig {
  initStore?: boolean;
  linkSessionToUser?: boolean;
}

export interface SessionLoginData {
  login: string;
  password: string;
  windowTabId?: string;
}

/** Рантайм: `lib.store.Class(class {}, { broadcastEnabled: true })` */
export type SessionStoreBase = Omit<StoreBaseMethods, 'create' | 'load'> & {
  create(data: SessionCreateData): Promise<this>;
  load(from: StoreLoadParams, config?: SessionLoadConfig): Promise<this>;
};

export interface SessionInstance extends SessionStoreBase, StoreBroadcastMethods {
  token?: string;
  userId?: string;
  userLogin?: string;
  windowTabId?: string;
  onClose?: Array<() => void | Promise<void>>;
  linkTime?: number;

  user(user?: UserInstance | null): UserInstance | null | undefined;
  getUserClass(): UserClass;

  init(data: { context: SessionContextLike; data: SessionInitData }): Promise<{ token: string; userId: string }>;
  login(data: SessionLoginData): Promise<void>;

  emit(eventName: string, data?: any, config?: any): void;
}

export interface SessionClass {
  new (data?: { id?: string; client?: SessionClientLike }): SessionInstance;
}

declare function createSessionClass(): SessionClass;

export = createSessionClass;
