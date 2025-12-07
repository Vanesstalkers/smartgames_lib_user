({
  access: 'public',
  method: async (context, data) => {
    const SessionClass = domain.user.Session || lib.user.Session();
    const session = new SessionClass({ client: context.client });

    return await session.init({ context, data });
  },
});
