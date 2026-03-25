export interface ApiContextLike {
  client: {
    emit(eventName: string, payload: any): void;
    addListener(eventName: string, handler: (...args: any[]) => void | Promise<void>): void;
    startSession(token: string, data: { sessionId: string | undefined; userId: string }): void;
  };
  session: {
    state: {
      userId: string;
      sessionId: string;
    };
  };
}

export interface InitSessionData {
  windowTabId?: string;
  demo?: boolean;
  login?: string;
  password?: string;
  tutorial?: string | Record<string, any> | boolean;
  token?: string;
}

export interface InitSessionResult {
  token: string;
  userId: string;
}

export interface UpdateUserData {
  login?: string;
  password?: string;
  name?: string;
  tgUsername?: string;
  gender?: string;
  info?: any;
  avatarCode?: string | number;
  lobbyConfigs?: Record<string, any>;
}

export interface StatusOkResult {
  status: 'ok';
}

export interface GenerateAvatarResult extends StatusOkResult {}
export interface LogoutResult extends StatusOkResult {}
export interface UpdateUserResult extends StatusOkResult {}

export type InitSessionMethod = (context: ApiContextLike, data: InitSessionData) => Promise<InitSessionResult>;
export type UpdateMethod = (context: ApiContextLike, data: UpdateUserData) => Promise<UpdateUserResult>;
export type LogoutMethod = (context: ApiContextLike) => Promise<LogoutResult>;
export type GenerateAvatarMethod = (context: ApiContextLike) => Promise<GenerateAvatarResult>;

export interface UserApiMethods {
  initSession: InitSessionMethod;
  update: UpdateMethod;
  logout: LogoutMethod;
  generateAvatar: GenerateAvatarMethod;
}
