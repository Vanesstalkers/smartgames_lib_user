import type { StoreBaseMethods, StoreBroadcastMethods } from '../../store/types/Class';

export interface UserCreateData {
  login?: string;
  password?: string;
  token?: string;
  gender?: string;
}

export interface UserCreateConfig {
  demo?: boolean;
}

export interface UserCacheData {
  id: string | undefined;
  login?: string;
  password?: string;
  token?: string;
  workerId?: string | number;
  port?: string | number;
}

export interface UserSessionLike {
  id(): string;
  user(value: UserInstance | null): void;
  subscribe(channelName: string, accessConfig?: { rule?: 'fields' | string; fields?: string[] }): Promise<void>;
  unsubscribe(channelName: string): Promise<void>;
  emit(type: string, data?: any, config?: any): void;
  linkTime?: number;
}

export interface BroadcastToSessionsParams {
  data?: any;
  config?: any;
  type?: string;
}

/** Рантайм: `lib.store.Class(class {}, { broadcastEnabled: true })` */
export type UserStoreBase = Omit<StoreBaseMethods, 'create'> & {
  create(data: UserCreateData, config?: UserCreateConfig): Promise<this>;
};

export interface UserInstance extends UserStoreBase, StoreBroadcastMethods {
  login?: string;
  password?: string;
  token?: string;
  gender?: string;
  name?: string;

  addUserToCache(): Promise<void>;
  updateUserCache(data: Partial<UserCacheData>): Promise<void>;

  linkSession(session: UserSessionLike): Promise<void>;
  unlinkSession(session: UserSessionLike): Promise<void>;
  sessions(): IterableIterator<UserSessionLike>;
  online(): boolean;

  broadcastToSessions(data?: BroadcastToSessionsParams): Promise<void>;
  returnToLobby(): Promise<void>;

  getName(): string | undefined;
}

export interface UserClass {
  new (data?: { id?: string }): UserInstance;
}

declare function createUserClass(): UserClass;

export = createUserClass;
