/**
 * ==================== Voice WebSocket Proxy ====================
 * 浏览器 WebSocket 不支持自定义 HTTP Header，
 * 而 DashScope FunASR 要求在 Header 中传递 Authorization。
 * 此代理脚本在本地转发 WebSocket 连接，自动添加 Authorization Header。
 *
 * 纯 Node.js 内置模块实现，无需 npm install。
 *
 * 用法: node voice-proxy.js
 * 前端连接: ws://localhost:53857
 */

const http = require('http');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');

const PORT = 53857;
const DASHSCOPE_HOST = 'dashscope.aliyuncs.com';
const DASHSCOPE_PATH = '/api-ws/v1/inference';

// 从 llm.js 中提取 API Key
function getApiKey() {
  try {
    const llmPath = path.join(__dirname, 'js', 'llm.js');
    const content = fs.readFileSync(llmPath, 'utf-8');
    const match = content.match(/apiKey:\s*['"]([^'"]+)['"]/);
    if (match) return match[1];
  } catch (e) {
    console.error('[Proxy] 无法从 llm.js 读取 API Key:', e.message);
  }
  return process.env.DASHSCOPE_API_KEY || '';
}

const API_KEY = getApiKey();
if (!API_KEY) {
  console.error('[Proxy] 未找到 API Key，请在 llm.js 中配置或设置 DASHSCOPE_API_KEY 环境变量');
  process.exit(1);
}
console.log('[Proxy] API Key:', API_KEY.substring(0, 15) + '...');

// ==================== WebSocket 帧编解码 ====================
// 代理服务器作为 DashScope 的客户端，发送的帧必须带 mask（RFC 6455 规定）
function encodeFrame(opcode, payload) {
  const mask = crypto.randomBytes(4);
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) {
    masked[i] ^= mask[i % 4];
  }
  const len = masked.length; // payload length（不含 mask key）
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | len; // 设置 mask 位
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126; // 设置 mask 位
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127; // 设置 mask 位
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, mask, masked]);
}

function parseFrame(buf) {
  const results = [];
  let offset = 0;
  while (offset < buf.length) {
    if (buf.length - offset < 2) break;
    const b0 = buf[offset];
    const b1 = buf[offset + 1];
    const fin = (b0 & 0x80) !== 0;
    const opcode = b0 & 0x0F;
    const masked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7F;
    let headerLen = 2;

    if (payloadLen === 126) {
      if (buf.length - offset < 4) break;
      payloadLen = buf.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (buf.length - offset < 10) break;
      payloadLen = Number(buf.readBigUInt64BE(offset + 2));
      headerLen = 10;
    }

    if (masked) {
      headerLen += 4;
    }

    if (buf.length - offset < headerLen + payloadLen) break;

    let payload = buf.slice(offset + headerLen, offset + headerLen + payloadLen);

    if (masked) {
      const mask = buf.slice(offset + headerLen - 4, offset + headerLen);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= mask[i % 4];
      }
    }

    results.push({ fin, opcode, payload });
    offset += headerLen + payloadLen;
  }
  return { frames: results, consumed: offset };
}

// ==================== HTTP 服务器 + WebSocket 握手 ====================
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'voice-proxy' }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.on('upgrade', (req, socket, head) => {
  console.log('[Proxy] 客户端 WebSocket 握手请求');

  // 计算 Sec-WebSocket-Accept
  const key = req.headers['sec-websocket-key'];
  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  // 回复握手
  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];
  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
  console.log('[Proxy] 握手完成，正在连接 DashScope...');

  // 连接 DashScope WebSocket（TLS）
  const tlsSocket = tls.connect({
    host: DASHSCOPE_HOST,
    port: 443,
    servername: DASHSCOPE_HOST
  }, () => {
    console.log('[Proxy] TLS 连接已建立，发送 DashScope WebSocket 握手');

    // 发送 DashScope WebSocket 握手请求（带 Authorization Header）
    const dashRequest = [
      `GET ${DASHSCOPE_PATH} HTTP/1.1`,
      `Host: ${DASHSCOPE_HOST}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}`,
      'Sec-WebSocket-Version: 13',
      `Authorization: Bearer ${API_KEY}`,
      '',
      ''
    ].join('\r\n');

    tlsSocket.write(dashRequest);
  });

  let dashHandshakeDone = false;
  let dashBuf = Buffer.alloc(0);

  // DashScope → 客户端
  tlsSocket.on('data', (chunk) => {
    if (!dashHandshakeDone) {
      dashBuf = Buffer.concat([dashBuf, chunk]);
      const headerEnd = dashBuf.indexOf('\r\n\r\n');
      if (headerEnd !== -1) {
        const headers = dashBuf.slice(0, headerEnd).toString();
        if (headers.includes('101')) {
          dashHandshakeDone = true;
          dashReady = true;
          console.log('[Proxy] DashScope 握手成功');

          // 发握手响应后的剩余数据
          const remaining = dashBuf.slice(headerEnd + 4);
          dashBuf = Buffer.alloc(0);

          if (remaining.length > 0) {
            socket.write(remaining);
          }

          // 发送缓存的客户端帧
          if (pendingFrames.length > 0) {
            console.log('[Proxy] 发送', pendingFrames.length, '个缓存的帧到 DashScope');
            for (const f of pendingFrames) {
              if (tlsSocket.writable) tlsSocket.write(f);
            }
            pendingFrames.length = 0;
          }
        } else {
          console.error('[Proxy] DashScope 握手失败:', headers.split('\r\n')[0]);
          socket.destroy();
          return;
        }
      }
    } else {
      // 透传 DashScope → 客户端的 WebSocket 帧
      // DashScope 发的帧无 mask，需要 encode 为无 mask 的帧再发给浏览器（服务器→客户端不需要mask）
      // 先攒 buffer，按帧解析后重新封装
      dashBuf = Buffer.concat([dashBuf, chunk]);
      while (dashBuf.length > 0) {
        const { frames, consumed } = parseFrame(dashBuf);
        if (consumed === 0) break;

        for (const frame of frames) {
          // 打印来自 DashScope 的文本消息（方便排查）
          if (frame.opcode === 1 && frame.payload.length > 0) {
            try {
              const msg = JSON.parse(frame.payload.toString('utf8'));
              const ev = msg.header?.event;
              const taskId = msg.header?.task_id;
              if (ev) {
                if (ev === 'result-generated') {
                  const output = msg.payload?.output;
                  const txt = output?.sentence?.text || output?.text || output?.transcript;
                  const isFinal = output?.sentence?.final || output?.is_final || false;
                  console.log(`[Proxy] DashScope → 客户端: ${ev} final=${isFinal} text="${txt}"`);
                } else {
                  console.log(`[Proxy] DashScope → 客户端: ${ev} id=${taskId || ''}`);
                }
              }
            } catch (_e) {
              console.log(`[Proxy] DashScope → 客户端: opcode=${frame.opcode} len=${frame.payload.length}`);
            }
          } else if (frame.opcode === 8) {
            // Close 帧
            let reason = '';
            if (frame.payload.length >= 2) {
              const code = frame.payload.readUInt16BE(0);
              reason = frame.payload.slice(2).toString('utf8');
              console.log(`[Proxy] DashScope → 客户端: Close code=${code} reason="${reason}"`);
            } else {
              console.log(`[Proxy] DashScope → 客户端: Close (no payload)`);
            }
          }
          // 直接发送原帧给客户端（服务器→客户端无mask，帧格式保持不变）
          if (socket.writable) {
            // 构造无mask的帧
            const noMaskFrame = Buffer.alloc(2);
            noMaskFrame[0] = (frame.fin ? 0x80 : 0x00) | (frame.opcode & 0x0F);
            const len = frame.payload.length;
            let header;
            if (len < 126) {
              header = Buffer.alloc(2);
              header[0] = (frame.fin ? 0x80 : 0x00) | (frame.opcode & 0x0F);
              header[1] = len;
              socket.write(Buffer.concat([header, frame.payload]));
            } else if (len < 65536) {
              header = Buffer.alloc(4);
              header[0] = (frame.fin ? 0x80 : 0x00) | (frame.opcode & 0x0F);
              header[1] = 126;
              header.writeUInt16BE(len, 2);
              socket.write(Buffer.concat([header, frame.payload]));
            } else {
              header = Buffer.alloc(10);
              header[0] = (frame.fin ? 0x80 : 0x00) | (frame.opcode & 0x0F);
              header[1] = 127;
              header.writeBigUInt64BE(BigInt(len), 2);
              socket.write(Buffer.concat([header, frame.payload]));
            }
          }
        }

        dashBuf = dashBuf.slice(consumed);
      }
    }
  });

  // 客户端 → DashScope
  // 客户端发来的帧是带 mask 的，代理解 mask 后重新编码为带 mask 的帧发给 DashScope
  // （RFC 6455: 客户端→服务器的帧必须带 mask，DashScope 严格要求此规则）
  let clientBuf = Buffer.alloc(0);
  let dashReady = false;

  // 等待 DashScope 握手完成后再转发客户端数据
  const pendingFrames = [];

  socket.on('data', (chunk) => {
    clientBuf = Buffer.concat([clientBuf, chunk]);

    while (clientBuf.length > 0) {
      const { frames, consumed } = parseFrame(clientBuf);
      if (consumed === 0) break;

      for (const frame of frames) {
        // 重新编码为带 mask 的帧（DashScope 要求客户端帧必须带 mask），发给 DashScope
        const encoded = encodeFrame(frame.opcode, frame.payload);
        if (dashReady && tlsSocket.writable) {
          tlsSocket.write(encoded);
          console.log('[Proxy] 客户端 → DashScope: opcode=', frame.opcode, ', len=', frame.payload.length);
        } else {
          // DashScope 还没准备好，缓存
          pendingFrames.push(encoded);
          console.log('[Proxy] DashScope 未就绪，缓存帧 (共', pendingFrames.length, '帧)');
        }
      }

      clientBuf = clientBuf.slice(consumed);
    }
  });

  socket.on('close', () => {
    console.log('[Proxy] 客户端断开');
    tlsSocket.destroy();
  });

  socket.on('error', (err) => {
    console.error('[Proxy] 客户端错误:', err.message);
    tlsSocket.destroy();
  });

  tlsSocket.on('error', (err) => {
    console.error('[Proxy] DashScope TLS 错误:', err.message);
    socket.destroy();
  });

  tlsSocket.on('close', () => {
    console.log('[Proxy] DashScope 连接关闭');
    socket.destroy();
  });
});

server.listen(PORT, () => {
  console.log(`[Proxy] 语音识别代理已启动: ws://localhost:${PORT}`);
  console.log('[Proxy] 按 Ctrl+C 停止');
});
