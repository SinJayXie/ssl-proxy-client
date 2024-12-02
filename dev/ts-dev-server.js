const childProcess = require('child_process');
const path = require('path');
const fs = require('fs');
const projectDir = path.join(__dirname, '..');
const process_ = {
  tsHandle: null,
  nodeHandle: null
};
createProcess();

const argv = process.argv.slice(2);


function createProcess() {
  try {
    process_.tsHandle = childProcess.spawn(path.join(__dirname, '../node_modules/.bin/tsc.cmd'), ['-w']);
    process_.tsHandle.stdout.on('data', (buffer) => {
      const str = buffer.toString();
      // console.log("---------" + str)
      if (str.indexOf('File change detected. Starting incremental compilation') !== -1) {
        process.stdout.clearScreenDown();
        print_warn('\n\n[Dev Server]: Hot update rebuilding typescript file...');
      } else if (str.indexOf('Starting compilation in watch mode') !== -1) {
        print_warn('[Dev Server]: Starting compilation in watch mode...');
      } else if (/(.*?):\serror\s(.*?):\s(.*?)/g.test(str)) {
        print_error(str);
        killNode();
      } else if (str.indexOf('Found 0 error') !== -1) {
        console.log('\x1B[32m[Dev Server]: Build ok...\x1B[39m');
        killNode();
        createNode();
      }
    });
  } catch (e) {
    console.warn(e);
    // eslint-disable-next-line no-process-exit
    process.exit(-1);
  }
}

function createNode() {
  print_warn('[Dev Server]: Starting Node...');
  try {
    process_.nodeHandle = childProcess.spawn('node', [path.join(projectDir, 'dist/interface.js'), ...argv,'--development']);
    process_.nodeHandle.stdout.on('data', (chunk) => {
      console.log(chunk.toString());
    });
    process_.nodeHandle.stderr.on('data', (chunk) => {
      print_error(chunk.toString());
      killNode();
    });
  } catch (e) {
    print_error(e.message);
  }
}

function copy(src, dst) {
  // 读取目录
  fs.readdir(src, function(err, paths) {
    if (err) {
      throw err;
    }
    paths.forEach(function(path) {
      const _src = src + '/' + path;
      const _dst = dst + '/' + path;
      let readable;
      let writable;
      fs.stat(_src, function(err, st) {
        if (err) {
          throw err;
        }

        if (st.isFile()) {
          readable = fs.createReadStream(_src);// 创建读取流
          writable = fs.createWriteStream(_dst);// 创建写入流
          readable.pipe(writable);
        } else if (st.isDirectory()) {
          exists(_src, _dst, copy);
        }
      });
    });
  });
}

function exists(src, dst, callback) {
  // 测试某个路径下文件是否存在
  fs.exists(dst, function(exists) {
    if (exists) { // 不存在
      callback(src, dst);
    } else { // 存在
      fs.mkdir(dst, function() { // 创建目录
        callback(src, dst);
      });
    }
  });
}

function killNode() {
  print_warn('[Dev Server]: kill Node...');
  if (process_.nodeHandle !== null) {
    process_.nodeHandle.kill();
    process_.nodeHandle = null;
  }
}

function print_warn(msg) {
  console.log('\x1B[33m' + msg + '\x1B[39m');
}

function print_error(msg) {
  console.log('\x1B[31m' + msg + '\x1B[39m');
}
