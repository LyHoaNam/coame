import { createGameServer } from './server.js';
import { BUILD_VERSION, PROTOCOL_VERSION } from '@ga-com/protocol';
const server = createGameServer();
const origin = await server.listen(Number(process.env.PORT ?? 2567), process.env.HOST ?? '0.0.0.0');
console.log(JSON.stringify({ event: 'listening', origin, buildVersion: BUILD_VERSION, protocolVersion: PROTOCOL_VERSION }));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void server.close(); });
