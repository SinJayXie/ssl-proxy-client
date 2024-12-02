import { getParametric } from './index';
import { join as pathJoin } from 'path';

export const PARAMETRIC = process.argv.slice(2);
export const PROXY_SERVER_HOST = getParametric('host');
export const PROXY_SERVER_PORT = Number(getParametric('port')) || 0;
export const PROXY_SERVER_PASSWORD = getParametric('auth');
export const SNAPSHOT_PATH = pathJoin(__dirname, '../..');
