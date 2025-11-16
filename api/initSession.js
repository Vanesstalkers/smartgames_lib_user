({
  access: 'public',
  method: async (context, { token, windowTabId, demo, login, password, tutorial }) => {
    const UserClass = domain.user.Class || lib.user.Class();
    const SessionClass = domain.user.Session || lib.user.Session();
    const session = new SessionClass({ client: context.client });

    if (token) {
      let sessionLoadResult;
      sessionLoadResult = await session
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
          sessionLoadResult = await session
            .load(
              { fromDB: { query: { token } } },
              {
                initStore: false,
                linkSessionToUser: false,
              }
            )
            .then(async (res) => {
              if (res.reconnect) {
                return { ...res };
              } else {
                await session.create({ userId: session.userId, userLogin: session.userLogin, token, windowTabId });
              }
            })
            .catch((err) => {
              // любая ошибка, кроме ожидаемых
              if (err !== 'not_found' && err !== 'user_not_found') throw err;
              token = null;
            });

          return sessionLoadResult;
        });
      if (sessionLoadResult?.reconnect) {
        sessionLoadResult.reconnect.ports = [config.server.balancer].concat(config.server.ports).filter((port) => port);
        return { reconnect: sessionLoadResult.reconnect };
      }
    }

    if (login || password !== undefined) {
      await session.login({ login, password, windowTabId });
    } else if (!token) {
      if (demo) {
        const user = await new UserClass().create({}, { demo }).catch((err) => {
          if (err === 'not_created') throw new Error('Ошибка создания демо-пользователя');
          else throw err;
        });

        if (tutorial) {
          if (typeof tutorial === 'string') tutorial = { tutorial };
          await lib.helper.updateTutorial(user, tutorial);
        }

        /* если отработала "user_not_found", то сама сессия могла была быть корректно инициализирована
        (нужно удалить канал, чтобы повторно произошла подписка на юзера) */
        session.removeChannel();

        await session.create({
          userId: user.id(),
          userLogin: user.login,
          token: user.token,
          windowTabId,
        });
      } else throw 'new_user';
    }

    session.onClose = [];
    context.client.addListener('close', async () => {
      if (session.onClose.length) for (const f of session.onClose) await f();

      const user = session.user();
      await user.unlinkSession(session);

      // удаляем из store и broadcaster
      session.remove();
      if (!user.sessions().length) user.remove();

      console.log(`session disconnected (token=${session.token}, windowTabId=${windowTabId}`);
    });

    context.client.startSession(session.token, {
      sessionId: session.id(),
      userId: session.userId,
    }); // данные попадут в context (в следующих вызовах)

    const availableLobbies = Array.from(lib.store('lobby').keys());
    const lobbyId = session.lobbyId || availableLobbies[0];
    return {
      token: session.token,
      userId: session.userId,
      lobbyId
    };
  },
});
