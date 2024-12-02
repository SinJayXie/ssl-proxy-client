import { join as pathJoin } from 'path';
import { existsSync } from 'fs';
import { gunzipSync } from 'zlib';
import { readFileSync } from 'fs';

export type CountryCodeItem = {
    country: string,
    alpha2Code: string,
    alpha3Code: string,
    numeric: number
}

const unknownCountry = {
  country: 'UNKNOWN',
  alpha2Code: 'UNKNOWN',
  alpha3Code: 'UNKNOWN',
  numeric: -1
};

const COUNTRY_SOURCE_DAT = pathJoin(process.cwd(), 'countryCode.dat');

class CountryCode {
  private country: CountryCodeItem[];

  constructor() {
    this.country = [];
    this.init();
  }

  private init() {
    if (existsSync(COUNTRY_SOURCE_DAT)) {
      const buf = gunzipSync(readFileSync(COUNTRY_SOURCE_DAT));
      const callback = new Function(buf.toString());
      this.country = callback.call([]) as CountryCodeItem[];
    } else {
      console.log('[Country Manage]: Could not find country');
      process.exit(-1);
    }
  }

  public buildRule() {
    return JSON.stringify(this.country.map(item => item.alpha2Code + ',PROXY'), null, 2);
  }

  public getByNumeric(num: number) {
    return this.country.find(item => item.numeric === num) || unknownCountry;
  }

  public getByAlpha2Code(code: string) {
    return this.country.find(item => item.alpha2Code === code) || unknownCountry;
  }

  public getByAlpha3Code(code: string) {
    return this.country.find(item => item.alpha3Code === code) || unknownCountry;
  }
}

export default CountryCode;
