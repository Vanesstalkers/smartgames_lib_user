() =>
  class User extends lib.store.class(class { }, { broadcastEnabled: true }) {
    #sessions = new Map();

    constructor({ id } = {}) {
      super({ col: 'user', id });

      this.broadcastableFields([
        ...['gameId', 'playerId', 'name', 'login'],
        ...['tgUsername', 'gender', 'info', 'avatarCode'],
        ...['avatars', 'lobbyPinnedItems', 'lobbyGameConfigs'],
        ...['currentTutorial', 'helper', 'helperLinks', 'finishedTutorials'],
        'rankings',
        'personalChatMap',
        'money',
      ]);
    }
    async create({ login, password, token, gender = 'male' }, { demo = false } = {}) {
      if (demo) {
        if (!login) login = 'demo' + Math.random();
        if (!password) password = '';
      }
      password = await metarhia.metautil.hashPassword(password);
      if (!token) {
        const { characters, secret, length } = config.sessions;
        token = metarhia.metautil.generateToken(secret, characters, length);
      }

      await super.create({ login, password, token, gender });

      const initiatedUser = await db.redis.hget('users', this.id());
      if (!initiatedUser) await this.addUserToCache();

      return this;
    }

    async load(from, config) {
      await super.load(from, config);
      const initiatedUser = await db.redis.hget('users', this.id());
      if (!initiatedUser) await this.addUserToCache();
      return this;
    }

    async addUserToCache() {
      await db.redis.hset(
        'users',
        this.id(),
        {
          id: this.id(),
          login: this.login,
          password: this.password,
          token: this.token,
          workerId: application.worker.id,
          port: application.server.port,
        },
        { json: true }
      );
    }
    async updateUserCache(data) {
      if (!Object.keys(data).length) return;
      const cacheData = await db.redis.hget('users', this.id(), { json: true });
      await db.redis.hset('users', this.id(), { ...cacheData, ...data }, { json: true });
    }

    async processAction(data) {
      try {
        await super.processAction(data);
      } catch (exception) {
        // делаем отправку в user, а не в gameuser, чтобы сообщение было видно в лобби (если ошибка в gameFinished)
        lib.store.broadcaster.publishAction.call(this, `user-${this.id()}`, 'broadcastToSessions', {
          data: { message: exception.message, stack: exception.stack }, config: { hideTime: 0 }
        });
      }
    }

    /**
     * Сохраняет данные при получении обновлений
     * @param {*} data
     */
    async processData(data) {
      this.set(data, { removeEmptyObject: true });
      await this.saveChanges();
    }

    async linkSession(session) {
      this.#sessions.set(session.id(), session);
      session.user(this);
      session.linkTime = Date.now(); // время последнего create или load

      await session.subscribe(this.channelName(), {
        rule: 'fields',
        fields: this.broadcastableFields(),
      });
    }
    async unlinkSession(session) {
      this.#sessions.delete(session.id());
      if (this.#sessions.size === 0) await db.redis.hdel('users', this.id());
      session.user(null);

      await session.unsubscribe(this.channelName());
    }
    sessions() {
      return this.#sessions.values();
    }
    online() {
      return this.#sessions.size > 0;
    }

    async broadcastToSessions({ data, config, type = 'alert' } = {}) {
      for (const session of this.sessions()) {
        session.emit(type, data, config);
      }
    }
    async logout() {
      for (const session of this.sessions()) {
        await this.unlinkSession(session);
        session.emit('logout');
      }
    }

    getName() {
      return this.name || this.login;
    }
  };
