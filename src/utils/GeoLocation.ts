import { existsSync, readFileSync } from 'fs';
import { isIPInCIDR } from './index';
import { gunzipSync } from 'zlib';
import CountryCode, { CountryCodeItem } from './CountryCode';

const ipCache: Map<string, number> = new Map();

class GeoLocation {
  private readonly geoPath: string;
  private geoBuffer: Buffer;
  private readonly ipCache: Map<string, number>;
  private readonly countryManage: CountryCode;

  constructor() {
    this.geoPath = process.cwd() + '/GeoDB.dat';
    this.geoBuffer = Buffer.alloc(0);
    this.ipCache = ipCache;
    this.countryManage = new CountryCode();
    this.init();
  }

  /**
   * 初始化地理位置 IP 数据库
   * @private
   */
  private init() {
    if (existsSync(this.geoPath)) {
      try {
        this.geoBuffer = gunzipSync(readFileSync(this.geoPath));
        console.log('[Geo Location]: loaded dat successfully CIDR:' + (this.geoBuffer.length / 9 | 0));
      } catch (e) {
        console.log(e.message);
      }
    }
  }

  public codeGetCountry(countryCode: number): CountryCodeItem {
    return this.countryManage.getByNumeric(countryCode);
  }

  /**
   * 获取IP的国家
   * @param ip
   */
  public getCountry(ip: string) {
    if (ipCache.has(ip)) return ipCache.get(ip); // 直接拿缓存
    let offset = 0;
    do {
      const buf = this.geoBuffer.subarray(offset, offset + 9);
      if (buf[0] !== 10 && buf[1] !== 240) { // Dat file buffer [0] = 0a and [1] = f0 is not this , file error
        throw new Error(`GeoLocation dat file error.`);
      } else {
        // 分割IP和掩码的Buffer
        const ipBuffer = buf.subarray(2, 7);
        const ipMask: number[] = [];
        ipBuffer.forEach(value => {
          const num = Buffer.alloc(1, value);
          ipMask.push(num.readUint8());
        });
        if (isIPInCIDR(ip, `${ipMask[0]}.${ipMask[1]}.${ipMask[2]}.${ipMask[3]}/${ipMask[4]}`)) {
          const countryCode = buf.subarray(7, 9).readInt16BE();
          ipCache.set(ip, countryCode);
          return countryCode;
        }
        offset += 9; // 每一条 9 字节
      }
    } while (offset < this.geoBuffer.length);
    return -1; // 不在 GeoIP 返回-1
  }
}

export default GeoLocation;
