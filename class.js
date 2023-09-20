() =>
  class User extends lib.store.class(class {}, { broadcastEnabled: true }) {
    #sessions = new Map();
    #externalSessions = [];
    constructor({ id } = {}) {
      super({ col: 'user', id });
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

    /**
     * Сохраняет данные при получении обновлений
     * @param {*} data
     */
    async processData(data) {
      this.set(data);
      await this.saveChanges();
    }

    linkSession(session) {
      this.#sessions.set(session.id(), session);
      session.user(this);
      session.linkTime = Date.now(); // время последнего create или load
    }
    async unlinkSession(session) {
      this.#sessions.delete(session.id());
      if (this.#sessions.size === 0) await db.redis.hdel('users', this.id());
      session.user(null);
    }
    sessions() {
      return this.#sessions.values();
    }
    online() {
      return this.#sessions.size > 0;
    }

    addExternalSession(sessionChannel) {
      console.info('addExternalSession', sessionChannel);
      this.#externalSessions.push(sessionChannel);
    }
    async broadcastToSessions({ data, type = 'session/error' } = {}) {
      for (const session of this.sessions()) {
        session.send(type, data);
      }
      if (this.#externalSessions.length) {
        const deadSessions = [];
        for (const sessionChannel of this.#externalSessions) {
          const result = await lib.store.broadcaster.publishAction(sessionChannel, 'send', [type, data]);
          if (result) deadSessions.push(sessionChannel);
        }
        if (deadSessions.length) {
          this.#externalSessions = this.#externalSessions.filter((session) => !deadSessions.includes(session));
        }
      }
    }
    logout() {
      for (const session of this.sessions()) {
        this.unlinkSession(session);
        session.send('session/logout');
      }
    }
  };
