import * as net from 'net';
import { createProtocolHeader, domainVerify } from '../utils';
import * as tls from 'tls';
import { PROXY_SERVER_HOST, PROXY_SERVER_PASSWORD, PROXY_SERVER_PORT } from '../utils/Config';
import GeoLocation from '../utils/GeoLocation';
import DnsServer from './DnsServer';

export type AuthMethods = {
  noAuth: number;
  userPass: number;
}

class Socket5Server {
  private readonly socketServer: net.Server;
  private readonly authMethods: AuthMethods;
  private readonly geoLocation: GeoLocation;
  private readonly dnsServer: DnsServer;
  private readonly isConfigureProxy: boolean;

  constructor() {
    this.socketServer = net.createServer(this.socketListenerHandler.bind(this));
    this.geoLocation = new GeoLocation();
    this.dnsServer = new DnsServer();
    this.isConfigureProxy = !!(PROXY_SERVER_HOST && PROXY_SERVER_PORT && PROXY_SERVER_PASSWORD);
    this.authMethods = {
      noAuth: 0,
      userPass: 2
    };
  }

  public socketListenerHandler(socket: net.Socket) {
    socket.once('error', () => {
    });
    socket.once('data', data => this.authHandler(data, socket));
  }

  /**
   * 处理验证模式
   * @param data
   * @param socket
   * @private
   */
  private authHandler(data: Buffer, socket: net.Socket) {
    const version: number = data[0]; // Socket 版本
    if (version === 5) {
      const methods = Array.from(data.subarray(2));
      const kind = methods.find(method => method === this.authMethods.userPass || method === this.authMethods.noAuth);

      if (kind === this.authMethods.userPass) {
        socket.write(Buffer.from([version, this.authMethods.userPass]));
        socket.once('data', (chunk) => this.passwordAuthHandler(chunk, socket));
      } else if (kind === this.authMethods.noAuth) {
        socket.write(Buffer.from([version, this.authMethods.noAuth]));
        socket.once('data', (chunk) => this.requestHandler(chunk, socket));
      } else {
        socket.write(Buffer.from([version, 0xff]));
      }
    } else {
      socket.end();
      socket.destroyed || socket.destroy(); // 不支持Socket5以外的协议
    }
  }

  /**
   * 密码认证处理方法
   * @param data
   * @param socket
   * @private
   */
  private passwordAuthHandler(data: Buffer, socket: net.Socket) {
    const uLength: number = data[1];
    const username = data.subarray(2, 2 + uLength).toString('utf-8');
    const password = data.subarray(3 + uLength).toString('utf-8');
    if (username === 'admin' && password === 'admin') {
      socket.write(Buffer.from([5, 0])); // 认证通过
      socket.once('data', arg => this.requestHandler(arg, socket));
    } else {
      socket.write(Buffer.from([5, 1])); // 账号密码错误
    }
  }

  /**
   * 处理客户端的请求
   * @param data
   * @param socket
   * @private
   */
  private requestHandler(data: Buffer, socket: net.Socket) {
    const version = data[0];
    const cmd = data[1]; // 0x01 CONNECT 连接

    if (cmd !== 1) {
      console.log('[Socket 5 Service]: Unsupported connection： %d', cmd);
      socket.end();
      socket.destroyed || socket.destroy();
    } else {
      if (version === 5 && cmd < 4 && data[2] === 0) {
        const type = data[3];
        const port = data.readUInt16BE(data.length - 2);
        const copyBuf = Buffer.from(data);

        if (type === 1) {
          const host = this.hostname(data.subarray(4, 8));
          this.createConnect(host, port, copyBuf, socket);
        } else if (type === 3) {
          const len = data[4];
          const host = data.subarray(5, 5 + len).toString('utf8');
          if (domainVerify(host)) { // 验证域名
            this.createConnect(host, port, copyBuf, socket);
          } else {
            socket.end();
            socket.destroyed || socket.destroy();
          }
        }
      } else { // 不知道的请求方式直接抛弃
        socket.end();
        socket.destroyed || socket.destroy();
      }
    }
  }

  /**
   * 所有操作通过开始建立代理连接
   * @param host
   * @param port
   * @param data
   * @param socket
   * @private
   */
  private createConnect(host: string, port: number, data: Buffer, socket: net.Socket) {
    let startTime = Date.now();
    this.dnsServer.lookup(host).then(ipv4 => {
      const country = this.geoLocation.codeGetCountry(this.geoLocation.getCountry(ipv4));

      if (port < 0 || host === '127.0.0.1') return;

      if (['PRIVATE', 'CN'].includes(country.alpha2Code) || !this.isConfigureProxy) {
        const clientSocket = new net.Socket();
        clientSocket.connect({
          port: country.alpha2Code === 'PRIVATE' ? port : 4443,
          host: country.alpha2Code === 'PRIVATE' ? host : 'localhost'
        }, () => {
          socket.pipe(clientSocket).pipe(socket);
          data[1] = 0x00;
          socket.write(data); // 认证通过
          console.log('[%s] Direct Connect %s:%d -> IPv4:%s -> Country: %s -> Delay: %dms', new Date().toLocaleTimeString(), host, port, ipv4, country.country, Date.now() - startTime);
        });
        clientSocket.once('error', () => socket.destroy());
        clientSocket.once('close', () => socket.destroy());
        socket.once('close', () => clientSocket.destroy());
      } else { // proxy
        const clientSocket = tls.connect(PROXY_SERVER_PORT, PROXY_SERVER_HOST, {
          rejectUnauthorized: false,
          servername: 'www.baidu.com'
        }, () => {
          clientSocket.write(createProtocolHeader(host, port, PROXY_SERVER_PASSWORD));

          clientSocket.once('data', (protocolBuf: Buffer) => {
            if (protocolBuf[0] === 16 && protocolBuf[1] === 255) { // 返回创建连接成功
              data[1] = 0x00;
              socket.write(data); // 认证通过

              socket.pipe(clientSocket).pipe(socket);
              console.log('[%s] Proxy Connect %s:%d -> IPv4:%s -> Country: %s -> Delay: %dms', new Date().toLocaleTimeString(), host, port, ipv4, country.country, Date.now() - startTime);
            } else {
              clientSocket.destroy();
            }
          });
          // clientSocket.end();
        }); // 客户端连接

        clientSocket.once('error', () => socket.destroy());
        clientSocket.once('close', () => socket.destroy());
        socket.once('close', () => clientSocket.destroy());
      }
    }).catch(err => {
      console.log(err.message);
    });
  }

  /**
   * 获取主机名
   * @param buf
   * @private
   */
  private hostname(buf: Buffer) {
    if (buf.length === 4) {
      return buf.join('.');
    } else if (buf.length === 16) {
      return Array.from({ length: 8 }, (_, i) => buf.readUInt16BE(i * 2).toString(16)).join(':');
    }
    return '';
  };

  /**
   * 监听端口启动服务
   * @param port
   */
  public listen(port?: number) {
    this.socketServer.listen(port || 1080, () => {
      console.log('[Socket 5 Service]: Proxy configuration status: [%s]', this.isConfigureProxy ? 'Available' : 'Not available');
      if (this.isConfigureProxy) {
        console.log('[Socket 5 Service]: Proxy Host: %s, Port: %s, Password: %s', PROXY_SERVER_HOST, PROXY_SERVER_PORT, PROXY_SERVER_PASSWORD);
      }
      console.log('[Socket 5 Service]: Socket listening on ' + (port || 1080));
    });
  }
}

export default Socket5Server;
