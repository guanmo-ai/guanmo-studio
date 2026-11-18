export async function withCancellation(task) {
  const controller = new AbortController();
  const handlers = new Map(['SIGINT', 'SIGTERM'].map(signal => [signal, () => {
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    controller.abort(new Error('已取消，保留上一次完成的输出'));
  }]));
  for (const [signal, handler] of handlers) process.once(signal, handler);
  try { return await task(controller.signal); }
  finally { for (const [signal, handler] of handlers) process.removeListener(signal, handler); }
}
