import Socket5Server from './libs/Socket5Server';
import ProxyServer from './libs/ProxyServer';
import * as fs from 'fs';
import { SNAPSHOT_PATH } from './utils/Config';

const packageJson = JSON.parse(fs.readFileSync(SNAPSHOT_PATH + '/package.json').toString());
console.log('[SSL Proxy]: Version: %s', packageJson.version);
console.log('[SSL Proxy]: Create by: Dishuyl');

new Socket5Server().listen();

new ProxyServer().listen();
