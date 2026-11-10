import type { Server } from 'node:http';

export function createServer(options: { dir: string }): Server;
