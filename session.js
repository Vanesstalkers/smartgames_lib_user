() =>
  class Session extends lib.store.class(class {}, { broadcastEnabled: true }) {
    #user;

    constructor({ id, client } = {}) {
      super({ col: 'session', id, client });
    }
    user(user) {
      if (user !== undefined) return (this.#user = user);
      return this.#user;
    }
    getUserClass() {
      return lib.user.Class();
    }

    async init({ context, data }) {
      const { windowTabId, demo, login, password, tutorial } = data;
      let token = data.token;

      if (token) {
        let sessionLoadResult;
        sessionLoadResult = await this
          .load({
            fromDB: { query: { token, windowTabId } },
          })
          .catch(async (err) => {
            // любая ошибка, кроме ожидаемых
            if (err !== 'not_found' && err !== 'user_not_found') throw err;
            if (err === 'user_not_found') {
              /* удалили из БД - нужно пересоздавать сессию
              (не учитывает подгруженные в store.user и redis данные -
              нужна перезагрузка процесса, либо удаление соответствующих данных)*/
              token = null;
            }

            // возможно сессия открыта в другом окне
            sessionLoadResult = await this
              .load(
                { fromDB: { query: { token } } },
                {
                  initStore: false,
                  linkSessionToUser: false,
                }
              )
              .then(async () => {
                await this.create({ userId: this.userId, userLogin: this.userLogin, token, windowTabId });
              })
              .catch((err) => {
                // любая ошибка, кроме ожидаемых
                if (err !== 'not_found' && err !== 'user_not_found') throw err;
                token = null;
              });

            return sessionLoadResult;
          });
      }

      if (login || password !== undefined) {
        await this.login({ login, password, windowTabId });
      } else if (!token) {
        if (demo) {
          const UserClass = this.getUserClass();
          const user = await new UserClass().create({}, { demo }).catch((err) => {
            if (err === 'not_created') throw new Error('Ошибка создания демо-пользователя');
            else throw err;
          });

          if (tutorial) {
            await lib.helper.updateTutorial(user, typeof tutorial === 'string' ? { tutorial } : tutorial);
          }

          /* если отработала "user_not_found", то сама сессия могла была быть корректно инициализирована
          (нужно удалить канал, чтобы повторно произошла подписка на юзера) */
          this.removeChannel();

          await this.create({
            userId: user.id(),
            userLogin: user.login,
            token: user.token,
            windowTabId,
          });
        } else throw 'new_user';
      }

      this.onClose = [];
      context.client.addListener('close', async () => {
        if (this.onClose.length) for (const f of this.onClose) await f();

        const user = this.user();
        await user.unlinkSession(this);

        // удаляем из store и broadcaster
        this.remove();
        if (!user.sessions().length) user.remove();

        console.log(`session disconnected (token=${this.token}, windowTabId=${windowTabId}`);
      });

      context.client.startSession(this.token, {
        sessionId: this.id(),
        userId: this.userId,
      }); // данные попадут в context (в следующих вызовах)

      return { token: this.token, userId: this.userId };
    }

    async create({ userId, userLogin, token, windowTabId }) {
      if (!userId) throw new Error('Ошибка создания сессии (empty userId)');

      const user = lib.store('user').get(userId);
      await super.create({ token, windowTabId, userId, userLogin });
      await user.linkSession(this);

      return this;
    }
    async load(from, config = { linkSessionToUser: true }) {
      await super.load(from, config);

      let user;
      const userOnline = await db.redis.hget('users', this.userId, { json: true });
      if (userOnline) {
        user = lib.store('user').get(userOnline.id);
      } else {
        const UserClass = this.getUserClass();
        user = await new UserClass().load({ fromDB: { id: this.userId } }).catch((err) => {
          if (err === 'not_found') throw 'user_not_found';
          // должно отличаться от not_found самой сессии
          else throw err;
        });
      }

      if (config.linkSessionToUser) await user.linkSession(this);

      return this;
    }
    async login({ login, password, windowTabId }) {
      if (!login || password === undefined) throw new Error('Неправильный логин или пароль');

      const user = await db.mongo.findOne('user', { login });
      if (!user) throw new Error('Неправильный логин или пароль');

      let userOnline = await db.redis.hget('users', user._id.toString(), { json: true });
      if (!userOnline) {
        const UserClass = this.getUserClass();
        const user = await new UserClass()
          .load({
            fromDB: { query: { login } },
          })
          .catch((err) => {
            if (err === 'not_found') throw new Error('Неправильный логин или пароль');
            else throw err;
          });
        const valid = await metarhia.metautil.validatePassword(password, user.password);
        if (!valid) throw new Error('Неправильный логин или пароль');
        userOnline = { id: user.id(), token: user.token };
      } else {
        const valid = await metarhia.metautil.validatePassword(password, userOnline.password);
        if (!valid) throw new Error('Неправильный логин или пароль');
      }
      // если тут добавлять условия, то проследить, что во всех случаях отрабатывает user.linkSession
      await this.create({ userId: userOnline.id, userLogin: login, token: userOnline.token, windowTabId });
    }

    /**
     * Базовая функция класса для сохранения данных при получении обновлений
     * @param {*} data
     */
    processData(data) {
      const client = this.client();
      try {
        client.emit('action/emit', { eventName: 'updateStore', data });
      } catch (err) {
        // ошибки быть не должно, строчка ниже лежит как пример обработчика
        // for (const callback of client.events.close) callback();
      }
    }
    emit(eventName, data = {}, config = {}) {
      const client = this.client();
      try {
        client.emit('action/emit', { eventName, data, config });
      } catch (err) {
        // ошибки быть не должно, строчка ниже лежит как пример обработчика
        // for (const callback of client.events.close) callback();
      }
    }
  };
