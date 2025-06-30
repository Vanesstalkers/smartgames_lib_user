({
  access: 'public',
  method: async (context, { token, windowTabId, demo, login, password, tutorial }) => {
    const userClass = (domain.user.class || lib.user.class)();
    const sessionClass = (domain.user.session || lib.user.session)();
    const session = new sessionClass({ client: context.client });
    if (token) {
      let sessionLoadResult;
      sessionLoadResult = await session
        .load({
          fromDB: { query: { token, windowTabId } },
        })
        .catch(async (err) => {
          // любая ошибка, кроме ожидаемых
          if (err !== 'not_found' && err !== 'user_not_found') throw err;
          if (err === 'user_not_found') token = null; // удалили из БД - нужно пересоздавать сессию (не учитывает подгруженные в store.user и redis данные - нужна перезагрузка процесса, либо удаление соответствующих данных)

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
        sessionLoadResult.reconnect.ports = [config.server.balancer].concat(config.server.ports);
        return { reconnect: sessionLoadResult.reconnect };
      }
    }

    if (login || password !== undefined) {
      await session.login({ login, password, windowTabId });
    } else {
      if (!token) {
        if (demo) {
          const user = await new userClass().create({}, { demo }).catch((err) => {
            if (err === 'not_created') throw new Error('Ошибка создания демо-пользователя');
            else throw err;
          });

          if (tutorial) {
            if (typeof tutorial === 'string') tutorial = { tutorial };
            await lib.helper.updateTutorial(user, tutorial);
          }

          session.removeChannel(); // если отработала "user_not_found", то сама сессия могла была быть корректно инициализирована (нужно удалить канал, чтобы повторно произошла подписка на юзера)
          await session.create({
            userId: user.id(),
            userLogin: user.login,
            token: user.token,
            windowTabId,
          });
        } else throw 'new_user';
      }
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

    const availableLobbies = Array.from(lib.store.lobby.keys());
    return {
      token: session.token,
      userId: session.userId,
      lobbyId: session.lobbyId, // ??? как будто lobbyId всегда пустое
      availableLobbies,
    };
  },
});
