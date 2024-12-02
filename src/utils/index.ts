export const domainVerify = (host: string) => /^([a-zA-Z0-9|\-|_]+\.)?[a-zA-Z0-9|\-|_]+\.[a-zA-Z0-9|\-|_]+(\.[a-zA-Z0-9|\-|_]+)*$/.test(host);

/**
 * 创建连接协议头
 * @param host
 * @param port
 * @param password
 */
export const createProtocolHeader = (host: string, port: number, password: string) => {
  const type = Buffer.from([0x10, 0xff]); // 协议头固定 0x10 0xff
  const portBuf = Buffer.alloc(2); // 端口号 buffer
  portBuf.writeUInt16BE(port || 443);
  const hostBuf = Buffer.from(host); // 域名或IP buffer
  const passwordBuf = Buffer.from(password); // 协议密码 buffer
  return Buffer.concat([type, portBuf, Buffer.from([hostBuf.length]), hostBuf, passwordBuf]);
};

export const isIPInCIDR = function(ip: string, cidr: string): boolean {
  // 将IP地址转换为数值
  function ipToNumber(ip: string) {
    const parts = ip.split('.');
    return (parseInt(parts[0]) << 24) + (parseInt(parts[1]) << 16) + (parseInt(parts[2]) << 8) + parseInt(parts[3]);
  }

  // 解析CIDR范围
  const [range, bits] = cidr.split('/');
  const rangeNumber = ipToNumber(range);
  const mask = -1 << (32 - parseInt(bits)); // 创建掩码
  const ipNumber = ipToNumber(ip);

  // 判断IP数值是否在掩码范围内
  return (ipNumber & mask) === rangeNumber;
};

export const shuffleString = function(str: string) {
  let chars = str.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    let temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }
  return chars.join('');
};

export const getRequestHeader = (data: string) => {
  const headersLine = data.split('\r\n');
  const headers: Record<string, any> = { protocol: headersLine.shift().split(' ') };
  headersLine.forEach((header: string) => {
    const [key, value] = header.split(': ');
    if (key && value) headers[key.toLowerCase()] = value;
  });
  return headers;
};

export const getParametric = (key: string) => {
  const findParam = process.argv.slice(2).find(param => param.indexOf('--' + key) === 0) || '';
  return findParam.split('=').pop();
};
