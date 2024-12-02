import * as fs from 'fs';
import * as pem from 'pem';
import { getDomain, getSubdomain } from 'tldts';
import * as os from 'os';
import { join as pathJoin } from 'path';
import { existsSync } from 'fs';

const CA_PASSWORD: string = '5E603946CDC54C';
const SUB_CERT_PASSWORD: string = '474C883A85C6EC';

export type CertificateOption = {
    cert: string,
    key: string,
    password?: string
}

const ROOT_CWD = process.cwd();

const CERT_PATH = pathJoin(ROOT_CWD, 'cert');
const userName = os.userInfo().username;

const certCache: Map<string, CertificateOption> = new Map();

pem.config({
  pathOpenSSL: pathJoin(ROOT_CWD, '/openssl/openssl.exe')
});

export type CaOption = {
    key: string;
    cert: string;
    password: string
}

const createSubjectOption = function(commonName: string) {
  return {
    country: 'CN',
    state: 'GD',
    locality: 'ZhaoQing',
    organization: 'TlsProxy',
    organizationUnit: 'TlsProxy',
    commonName
  };
};

const createCertExt = function(domain = '') {
  return [
    '[v3_req]',
    'subjectAltName=DNS:' + domain + ',DNS:' + domain.replace('*.', '')
  ].join('\r\n');
};

const createRootExt = function(san: string) {
  return [
    '[v3_req]',
    'subjectAltName=DNS:' + san,
    'basicConstraints = CA:true',
    'keyUsage = digitalSignature, keyCertSign, keyEncipherment, cRLSign',
    'extendedKeyUsage = 1.3.6.1.5.5.7.3.1',
    'subjectKeyIdentifier=hash',
    'authorityKeyIdentifier=keyid:always,issuer'
  ].join('\r\n');
};

class CertificateManager {
  private readonly ca: CaOption;

  constructor() {
    this.ca = {
      key: '',
      cert: '',
      password: ''
    };
    this.init();
  }

  private init() {
    if (!fs.existsSync(CERT_PATH)) {
      fs.mkdirSync(CERT_PATH);
    }
  }

  /**
     * 获取CA证书信息
     */
  public getCAOption() {
    return this.ca;
  }

  private getCache(domain: string) {
    if (certCache.has(domain)) {
      return true;
    } else if (fs.existsSync(pathJoin(CERT_PATH, domain + '.crt')) && fs.existsSync(pathJoin(CERT_PATH, domain + '.key'))) {
      const certBuffer = fs.readFileSync(pathJoin(CERT_PATH, domain + '.crt'));
      const ketBuffer = fs.readFileSync(pathJoin(CERT_PATH, domain + '.key'));
      certCache.set(domain, {
        cert: certBuffer.toString(),
        key: ketBuffer.toString()
      });
      return true;
    }
    return false;
  }

  /**
     * 向域颁发证书
     * @param domain
     */
  public async issueCertificateToDomain(domain: string): Promise<CertificateOption> {
    const subDomain = getSubdomain(domain).split('.');
    subDomain.shift();
    const baseDomain = (subDomain.length > 0 ? (subDomain.join('.') + '.') : '') + getDomain(domain);
    const commonName = '*.' + baseDomain;
    return new Promise((resolve, reject) => {
      if (this.getCache(baseDomain)) {
        resolve(certCache.get(baseDomain));
      } else if (this.ca.cert && this.ca.key && this.ca.password) {
        pem.createPrivateKey({
          cipher: 'aes256',
          password: SUB_CERT_PASSWORD
        }, (keyErr, { key: privateKey }) => {
          if (keyErr) {
            reject(keyErr);
          } else {
            pem.createCSR({
              clientKey: privateKey,
              clientKeyPassword: SUB_CERT_PASSWORD,
              ...createSubjectOption(commonName)
            }, (csrErr, csrResult) => {
              if (csrErr) {
                reject(csrErr);
              } else {
                pem.createCertificate({
                  csr: csrResult.csr,
                  days: 365 * 5,
                  serviceKey: this.ca.key,
                  serviceKeyPassword: CA_PASSWORD,
                  serviceCertificate: this.ca.cert,
                  config: createCertExt(commonName)
                }, (certErr, certResult) => {
                  if (certErr) {
                    reject(csrErr);
                  } else {
                    fs.writeFileSync(pathJoin(CERT_PATH, `${baseDomain}.crt`), certResult.certificate);
                    fs.writeFileSync(pathJoin(CERT_PATH, `${baseDomain}.key`), csrResult.clientKey);
                    certCache.set(baseDomain, {
                      key: csrResult.clientKey,
                      cert: certResult.certificate
                    });
                    resolve({
                      key: csrResult.clientKey,
                      cert: certResult.certificate,
                      password: SUB_CERT_PASSWORD
                    });
                  }
                });
              }
            });
          }
        });
      } else {
        reject(new Error('[CertificateManager] No load Certificate or key'));
      }
    });
  }

  /**
     * 生成根证书
     */
  public generateRootCertificate(): Promise<CaOption> {
    return new Promise((resolve, reject) => {
      pem.createPrivateKey({
        cipher: 'aes256',
        password: CA_PASSWORD
      }, (keyErr, { key: privateKey }) => {
        if (keyErr) {
          reject(keyErr);
        } else {
          pem.createCSR({
            clientKey: privateKey,
            clientKeyPassword: CA_PASSWORD,
            ...createSubjectOption(`TlsProxy CA (${userName})`)
          }, (csrErr, csrResult) => {
            if (csrErr) {
              reject(csrErr);
            } else {
              pem.createCertificate({
                csr: csrResult.csr,
                days: 365 * 5,
                serial: (Math.random() * 1000000 | 0).toString(),
                serviceKey: csrResult.clientKey,
                serviceKeyPassword: 'dishuyl',
                config: createRootExt(`TlsProxy CA (${userName})`)

              }, (certErr, certResult) => {
                if (certErr) {
                  reject(csrErr);
                } else {
                  fs.writeFileSync(pathJoin(CERT_PATH, `TlsProxyCA_${userName}.crt`), certResult.certificate);
                  fs.writeFileSync(pathJoin(CERT_PATH, `TlsProxyCA_${userName}.key`), csrResult.clientKey);
                  resolve({
                    key: csrResult.clientKey,
                    cert: certResult.certificate,
                    password: CA_PASSWORD
                  });
                }
              });
            }
          });
        }
      });
    });
  }

  /**
     * 加载CA根证书
     * @param certPath
     * @param keyPath
     * @param password
     */
  public load(certPath: string, keyPath: string, password: string) {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const keyBuffer = fs.readFileSync(keyPath);
      const certBuffer = fs.readFileSync(certPath);
      this.ca.key = keyBuffer.toString();
      this.ca.cert = certBuffer.toString();
      this.ca.password = password;
    } else {
      throw new Error('[CertificateManager] Certificate or Key does not exist');
    }
  }

  public loadSelf() {
    const certPath = pathJoin(process.cwd(), 'Root.crt');
    const keyPath = pathJoin(process.cwd(), 'Root.key');

    if (!(certPath && keyPath) || !(existsSync(certPath) && existsSync(keyPath))) throw new Error('[Server]: certificate or key error');

    this.load(certPath, keyPath, CA_PASSWORD);
  }

  public verifyCertificate(cert?: string): Promise<pem.CertificateSubjectReadResult> {
    return new Promise((resolve, reject) => {
      pem.readCertificateInfo(cert || this.ca.cert, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }
}

export default CertificateManager;
