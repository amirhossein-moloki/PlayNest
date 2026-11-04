export const initMocks = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MSW Mocking is strictly forbidden and disabled in production environment');
  }
  if (typeof window === 'undefined') {
    const { server } = await import('./server');
    server.listen();
  } else {
    const { worker } = await import('./browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
    });
  }
};
