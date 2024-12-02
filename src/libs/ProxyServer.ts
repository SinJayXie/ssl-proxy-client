import * as tls from 'tls';
import CertificateManager from './CertificateManager';
import { getRequestHeader } from '../utils';

class ProxyServer {
  private readonly certificate: CertificateManager;
  private readonly tlsSocket: tls.Server;

  constructor() {
    this.certificate = new CertificateManager();
    this.certificate.loadSelf();
    this.tlsSocket = tls.createServer({
      cert: this.certificate.getCAOption().cert,
      key: this.certificate.getCAOption().key,
      SNICallback: (servername, cb) => {
        this.certificate.issueCertificateToDomain(servername).then(cert => {
          cb(null, tls.createSecureContext(cert));
        }).catch(err => cb(err));
      }
    }, this.createProxyConnect.bind(this));
  }

  private createProxyConnect(socket: tls.TLSSocket) {
    socket.once('data', (protocolBuffer: Buffer) => {
      const protocol = getRequestHeader(protocolBuffer.toString());
      if (protocol.host) {
        const [host, port] = protocol.host.split(':');
        const clientSocket = tls.connect({
          port: Number(port) || 443,
          host,
          rejectUnauthorized: false
        }, () => {
          socket.write(Buffer.from([0x01, 0x02]));
          clientSocket.write(protocolBuffer);
          clientSocket.pipe(socket).pipe(clientSocket);
        });
        clientSocket.once('close', () => socket.destroy());
        socket.once('close', () => clientSocket.destroy());
        clientSocket.once('error', () => socket.destroy());
        socket.once('error', () => clientSocket.destroy());
      } else { // 未知协议
        socket.destroy();
      }
    });
    socket.once('error', () => {});
  }

  public listen(port?: number) {
    this.tlsSocket.listen(port || 4443, 'localhost', () => console.log('[Proxy Server]: Listening on port %d', port || 4443));
  }
}

export default ProxyServer;
