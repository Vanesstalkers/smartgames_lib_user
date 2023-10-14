async (
  context,
  { login, password, name, tgUsername, gender, info, avatarCode, lobbyPinnedItems, lobbyGameConfigs }
) => {
  const { userId } = context.session.state;
  const user = lib.store('user').get(userId);

  const setData = {};
  const cacheData = {};
  if (login !== undefined) {
    const dbData = await db.mongo.findOne('user', { login });
    if (dbData !== null) throw new Error('Данный логин не может быть установлен');
    setData.login = login;
    cacheData.login = setData.login;
  }
  if (password !== undefined) {
    setData.password = await metarhia.metautil.hashPassword(password);
    cacheData.password = setData.password;
  }
  if (name !== undefined) setData.name = name;
  if (tgUsername !== undefined) setData.tgUsername = tgUsername;
  if (gender !== undefined) setData.gender = gender;
  if (info !== undefined) setData.info = info;
  if (avatarCode !== undefined) setData.avatarCode = avatarCode;
  // !!! перенести в lobby.user
  if (lobbyPinnedItems !== undefined) setData.lobbyPinnedItems = lobbyPinnedItems;
  if (lobbyGameConfigs !== undefined) setData.lobbyGameConfigs = lobbyGameConfigs;

  if (Object.keys(setData).length) {
    user.set(setData);
    await user.saveChanges();
    await user.updateUserCache(cacheData);
  }
  return { status: 'ok' };
};
