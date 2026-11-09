#!/usr/bin/env python3
"""
Kimi 大模型中转服务（方案 B）。

背景：Cloudflare Workers 出口 IP 被 Kimi WAF 拦截（403），
而本服务器在国内可直连 api.kimi.com。Workers 改为调本中转，
中转用本机网络转发到 Kimi，并原样回传 SSE 流。

安全设计：
- 仅监听 POST /v1/chat/completions，其余路径 404；
- 每个请求必须带 X-Relay-Secret 头，值等于环境变量 RELAY_SECRET（恒定时间比较）；
- Kimi 真实 key 只存在本服务器（环境变量 KIMI_API_KEY），Workers 侧不再持有；
- 无状态、不落盘、不记录请求体。

只用标准库（无需 pip 安装任何东西），任何 python3 均可运行：

  RELAY_SECRET=<共享密钥> KIMI_API_KEY=sk-kimi-... \
  KIMI_UPSTREAM=https://api.kimi.com/coding/v1 RELAY_PORT=18080 \
  python3 llm_relay.py
"""
import hmac
import json
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM = os.environ.get(
    "KIMI_UPSTREAM", "https://api.kimi.com/coding/v1"
).rstrip("/")
RELAY_SECRET = os.environ.get("RELAY_SECRET", "")
KIMI_API_KEY = os.environ.get("KIMI_API_KEY", "")
PORT = int(os.environ.get("RELAY_PORT", "18080"))
# 上游首字节可能较慢（智能体多轮），给足超时
UPSTREAM_TIMEOUT = int(os.environ.get("RELAY_TIMEOUT", "300"))

ENDPOINT = "/v1/chat/completions"
# 透传允许出现的请求字段，其余（如注入的 url 等）丢弃，避免被当作开放代理探测上游
ALLOWED_FIELDS = {
    "model", "messages", "tools", "tool_choice", "parallel_tool_calls",
    "stream", "temperature", "top_p", "max_tokens", "stop", "presence_penalty",
    "frequency_penalty", "n", "user", "seed", "response_format",
}


class RelayHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send(self, status: int, payload: bytes, ctype: str = "application/json"):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_err(self, status: int, message: str):
        self._send(status, json.dumps(
            {"error": {"message": message, "type": "relay_error"}},
            ensure_ascii=False,
        ).encode("utf-8"))

    def do_POST(self):  # noqa: N802
        if self.path.split("?")[0] != ENDPOINT:
            return self._send_err(404, "not found")
        if not RELAY_SECRET:
            # 服务端没配密钥 → 拒绝一切请求，防止裸奔
            return self._send_err(500, "relay misconfigured: RELAY_SECRET unset")
        secret = self.headers.get("X-Relay-Secret", "")
        if not hmac.compare_digest(secret, RELAY_SECRET):
            return self._send_err(401, "invalid relay secret")

        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0 or length > 4 * 1024 * 1024:
            return self._send_err(400, "bad request size")
        try:
            body = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, ValueError):
            return self._send_err(400, "invalid JSON body")
        if not isinstance(body, dict) or "messages" not in body:
            return self._send_err(400, "body must contain messages")

        body = {k: v for k, v in body.items() if k in ALLOWED_FIELDS}
        body["stream"] = True  # 本中转固定流式

        req = urllib.request.Request(
            f"{UPSTREAM}/chat/completions",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
                "Authorization": f"Bearer {KIMI_API_KEY}",
            },
            method="POST",
        )

        try:
            upstream = urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT)
        except urllib.error.HTTPError as e:
            # 上游报错（401/429/403…）原样状态码 + body 回传给 Workers，方便页面展示
            err_body = e.read(3000)
            return self._send(e.code, err_body or b"{}")
        except Exception as e:  # 网络不通、超时等
            return self._send_err(502, f"upstream unreachable: {e}")

        # 流式透传：逐块读出并立即 flush，保证 SSE 不被缓冲
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        try:
            while True:
                chunk = upstream.read(4096)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass  # 客户端中止，正常现象
        except Exception as e:
            try:
                self.wfile.write(
                    f"data: {json.dumps({'error': str(e)})}\n\n".encode()
                )
            except Exception:
                pass
        finally:
            upstream.close()

    def do_GET(self):  # noqa: N802
        # 健康检查（不带密钥，只回 alive，不泄露任何配置）
        if self.path.split("?")[0] in ("/healthz", "/"):
            return self._send(200, b'{"status":"ok"}')
        self._send_err(404, "not found")

    def log_message(self, fmt, *args):  # 精简日志：只记时间 + 状态行
        sys.stderr.write(
            "%s %s\n" % (self.log_date_time_string(), fmt % args)
        )


def main():
    if not KIMI_API_KEY:
        sys.exit("KIMI_API_KEY 未设置，拒绝启动")
    if not RELAY_SECRET or len(RELAY_SECRET) < 16:
        sys.exit("RELAY_SECRET 未设置或过短（至少16字符），拒绝启动")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), RelayHandler)
    print(f"LLM relay listening on :{PORT} -> {UPSTREAM}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
