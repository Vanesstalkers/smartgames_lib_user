import { StoreClass, BroadcasterClass } from '../store/types';

export interface User extends StoreClass, BroadcasterClass {
  id: () => string;
  name: () => string;
  email: () => string;
  password: () => string;
  token: () => string;
}

export type UserModule = {
  class: new (storeData?: any) => User;
  create: (options: { login: string; password: string; token: string; gender: string }) => Promise<User>;
  load: (options: { fromData?: any; fromDB?: any }) => Promise<User>;
  addUserToCache: () => Promise<void>;
  updateUserCache: (data: any) => Promise<void>;
  processAction: (data: any) => Promise<void>;
  processData: (data: any) => Promise<void>;
  linkSession: (session: any) => Promise<void>;
  unlinkSession: (session: any) => Promise<void>;
  sessions: () => any;
  online: () => boolean;
  broadcastToSessions: (options: { data: any; config: any; type: string }) => Promise<void>;
  logout: () => Promise<void>;
  getName: () => string;
};