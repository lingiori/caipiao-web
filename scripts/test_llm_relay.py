"""本地自测 llm_relay.py：mock Kimi 上游 + 起中转 + 四类用例"""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

MOCK_PORT = 19443
RELAY_PORT = 12052
SECRET = "test-secret-0123456789abcdef"


class MockKimi(BaseHTTPRequestHandler):
    def do_POST(self):
        auth = self.headers.get("Authorization", "")
        assert auth == "Bearer sk-kimi-testkey", auth
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        assert body.get("stream") is True
        # 确认字段白名单生效：注入的 url 字段应被中转丢弃
        assert "url" not in body, "url field leaked through relay"
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        for i in range(3):
            chunk = {"choices": [{"delta": {"content": f"片段{i}"}, "finish_reason": None}]}
            self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode())
            self.wfile.flush()
            time.sleep(0.05)
        tc = {"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "c1", "function": {"name": "query_draws", "arguments": "{\"limit\":5}"}}]}, "finish_reason": None}]}
        self.wfile.write(f"data: {json.dumps(tc)}\n\n".encode())
        fin = {"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}
        self.wfile.write(f"data: {json.dumps(fin)}\n\n".encode())
        self.wfile.write(b"data: [DONE]\n\n")
        self.wfile.flush()

    def log_message(self, *a):
        pass


def post(path, secret, body):
    req = urllib.request.Request(
        f"http://127.0.0.1:{RELAY_PORT}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "X-Relay-Secret": secret},
        method="POST",
    )
    return urllib.request.urlopen(req, timeout=10)


def main():
    mock = HTTPServer(("127.0.0.1", MOCK_PORT), MockKimi)
    threading.Thread(target=mock.serve_forever, daemon=True).start()

    env = {**os.environ, "RELAY_SECRET": SECRET, "KIMI_API_KEY": "sk-kimi-testkey",
           "KIMI_UPSTREAM": f"http://127.0.0.1:{MOCK_PORT}", "RELAY_PORT": str(RELAY_PORT)}
    relay = subprocess.Popen([sys.executable, "scripts/llm_relay.py"], env=env,
                             stderr=subprocess.PIPE)
    try:
        # 等中转起来（健康检查免密钥）
        for _ in range(50):
            try:
                r = urllib.request.urlopen(f"http://127.0.0.1:{RELAY_PORT}/healthz", timeout=2)
                assert json.loads(r.read())["status"] == "ok"
                break
            except Exception:
                time.sleep(0.1)
        else:
            raise RuntimeError("relay 未启动: " + relay.stderr.read(4000).decode(errors="replace"))

        msg = {"model": "k3", "messages": [{"role": "user", "content": "hi"}],
               "tools": [], "url": "http://evil.example"}

        # 1. 正确密钥 → 200 + 完整 SSE
        res = post("/v1/chat/completions", SECRET, msg)
        data = res.read().decode()
        assert res.status == 200, res.status
        parts = [json.loads(p.split("\n")[0]) for p in data.split("data: ")[1:]
                 if p.strip() and not p.startswith("[DONE]")]
        texts = [p["choices"][0]["delta"].get("content") for p in parts if p.get("choices")]
        assert texts == ["片段0", "片段1", "片段2", None, None], texts  # 后两条是 tool_calls/finish
        assert parts[3]["choices"][0]["delta"]["tool_calls"][0]["function"]["name"] == "query_draws"
        assert parts[4]["choices"][0]["finish_reason"] == "tool_calls"
        assert "[DONE]" in data, data[-200:]
        print("PASS 1: 正确密钥，SSE 流式透传完整")

        # 2. 错误密钥 → 401
        try:
            post("/v1/chat/completions", "wrong-secret-xxxxxxxxxxxx", msg)
            raise AssertionError("应 401")
        except urllib.error.HTTPError as e:
            assert e.code == 401, e.code
        print("PASS 2: 错误密钥被拒 401")

        # 3. 其他路径 → 404
        try:
            post("/v1/keys", SECRET, msg)
            raise AssertionError("应 404")
        except urllib.error.HTTPError as e:
            assert e.code == 404, e.code
        print("PASS 3: 非 chat/completions 路径 404")

        # 4. 上游报错 → 状态码透传（用错上游路径的 mock 会 501，这里模拟 502 路径）
        req = urllib.request.Request(f"http://127.0.0.1:{RELAY_PORT}/v1/chat/completions",
                                     data=b"{not json",
                                     headers={"Content-Type": "application/json",
                                              "X-Relay-Secret": SECRET}, method="POST")
        try:
            urllib.request.urlopen(req, timeout=5)
            raise AssertionError("应 400")
        except urllib.error.HTTPError as e:
            assert e.code == 400, e.code
        print("PASS 4: 非法 JSON → 400")

        print("全部通过")
    finally:
        relay.terminate()


if __name__ == "__main__":
    main()
