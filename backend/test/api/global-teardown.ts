/** Stops the backend global-setup.ts started; one that was already running is left alone. */
export default async function globalTeardown(): Promise<void> {
  const shared: any = globalThis;
  shared.__BACKEND__?.kill();
}
