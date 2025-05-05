async (context) => {
  const { userId } = context.session.state;
  const user = lib.store('user').get(userId);

  await user.logout();

  return { status: 'ok' };
};
