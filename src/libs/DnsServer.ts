import * as dns from 'dns';

dns.setServers(['8.8.8.8', '114.114.114.114']);

class DnsServer {
  private dnsCache: Map<string, string>;
  constructor() {
    this.dnsCache = new Map();
  }

  public deleteCache() {
    this.dnsCache.clear();
  }

  public lookup(domain: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.dnsCache.has(domain)) {
        resolve(this.dnsCache.get(domain));
      } else {
        dns.lookup(domain, (err, address, family) => {
          if (err) {
            reject(err);
          } else {
            this.dnsCache.set(domain, address);
            resolve(address);
          }
        });
      }
    });
  }
}

export default DnsServer;
