async (context, {} = {}) => {
  const { userId, sessionId } = context.session.state;
  const session = lib.store('session').get(sessionId);
  const { lobbyId } = session;
  const user = lib.store('user').get(userId);

  console.log('generateAvatar login', user.login);

  const balance = (user.money || 0) - 1000000;
  if (balance < 0) throw new Error('Недостаточно денег (требуется 1.000.000 ₽)');
  user.set({ money: balance });
  await user.saveChanges();

  lib.store.broadcaster.publishAction(`lobby-${lobbyId}`, 'userGenerateAvatar', {
    userId,
    userGender: user.gender,
    userInfo: user.info,
    currentUserAvatarCode: user.avatarCode,
    newDefaultAvatars: user.avatars,
  });

  return { status: 'ok' };
};
