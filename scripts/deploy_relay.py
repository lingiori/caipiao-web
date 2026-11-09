"""一次性部署脚本：把 llm_relay.py 部署到阿里云 47.95.219.76（ling 账号）。
密码从环境变量 RELAY_SSH_PASSWORD 读取；共享密钥从 RELAY_SECRET 读取；
Kimi key 从仓库 ai.config.json 读取。"""
import base64
import json
import os
import sys
import time

import paramiko

HOST, USER = "47.95.219.76", "ling"
PASSWORD = os.environ["RELAY_SSH_PASSWORD"]
SECRET = os.environ["RELAY_SECRET"]
assert len(SECRET) >= 16, "RELAY_SECRET 过短"
REPO = r"D:\workspace\caipiao-web"

kimi_key = json.load(open(f"{REPO}\\ai.config.json", encoding="utf-8"))["providers"]["kimi"]["apiKey"]
assert kimi_key.startswith("sk-kimi-"), "ai.config.json 里没读到 kimi key"

relay_src = open(f"{REPO}\\scripts\\llm_relay.py", "rb").read()

cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect(HOST, username=USER, password=PASSWORD, timeout=15)


def run(cmd: str, sudo: bool = False, timeout: int = 30):
    if sudo:
        cmd = f"echo {sh_quote(PASSWORD)} | sudo -S -p '' bash -c {sh_quote(cmd)}"
    _, out, err = cli.exec_command(cmd, timeout=timeout)
    o, e = out.read().decode(errors="replace"), err.read().decode(errors="replace")
    rc = out.channel.recv_exit_status()
    return rc, o, e


def sh_quote(s: str) -> str:
    return "'" + s.replace("'", "'\\''") + "'"


def write_file(path: str, content: str, sudo: bool = False, mode: str = "644"):
    b64 = base64.b64encode(content.encode()).decode()
    cmd = f"echo {b64} | base64 -d > /tmp/_w.tmp && chmod {mode} /tmp/_w.tmp && mv /tmp/_w.tmp {sh_quote(path)}"
    rc, o, e = run(cmd, sudo=sudo)
    assert rc == 0, f"写 {path} 失败: {o}{e}"


print("== 服务器信息 ==")
rc, o, e = run("hostname; whoami; python3 --version; sudo -n true 2>/dev/null && echo SUDO_NOPASS || echo SUDO_NEED_PASS")
print(o, e)
py = "/usr/bin/python3"
if "python3:" in (o + e) or "command not found" in (o + e):
    sys.exit("服务器没有 python3，终止")
sudo_nopass = "SUDO_NOPASS" in o
sudo_need = "SUDO_NEED_PASS" in o
if sudo_need:
    # 测试 sudo -S 是否可用
    rc, o2, e2 = run("true", sudo=True)
    if rc != 0:
        sys.exit(f"sudo 不可用: {e2}")
    sudo = True
elif sudo_nopass:
    sudo = True
else:
    sudo = False

print("== 创建目录 ==")
run("mkdir -p ~/.llm-relay")

print("== 上传 llm_relay.py ==")
b64 = base64.b64encode(relay_src).decode()
write_file("/home/ling/.llm-relay/llm_relay.py", relay_src.decode())

env_content = (
    f"RELAY_SECRET={SECRET}\n"
    f"KIMI_API_KEY={kimi_key}\n"
    "KIMI_UPSTREAM=https://api.kimi.com/coding/v1\n"
)
write_file("/home/ling/.llm-relay/env", env_content, mode="600")

print("== 安装 systemd 服务 ==")
unit = f"""[Unit]
Description=Kimi LLM relay
After=network.target

[Service]
EnvironmentFile=/home/ling/.llm-relay/env
ExecStart={py} /home/ling/.llm-relay/llm_relay.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""

installed = False
if sudo:
    write_file("/etc/systemd/system/llm-relay.service", unit, sudo=True)
    rc, o, e = run("systemctl daemon-reload && systemctl enable --now llm-relay", sudo=True)
    print("system:", o, e)
    if rc == 0:
        installed = True

if not installed:
    print("回退到 user-level systemd")
    rc, o, e = run("systemctl --user --version >/dev/null 2>&1 && echo OK || echo NOUSER")
    write_file("/home/ling/.config/systemd/user/llm-relay.service", unit)
    rc, o, e = run(
        "systemctl --user daemon-reload && systemctl --user enable --now llm-relay; "
        "systemctl --user is-enabled llm-relay; loginctl enable-linger $USER 2>/dev/null"
    )
    print("user:", rc, o, e)

time.sleep(2)
print("== 健康检查 ==")
rc, o, e = run("curl -s -m 5 http://127.0.0.1:18080/healthz; echo; ss -ltn 2>/dev/null | grep 18080 || netstat -ltn 2>/dev/null | grep 18080")
print(o, e)

print("== 中转 → Kimi 连通性（真实 chat 请求）==")
body = json.dumps({"model": "k3", "messages": [{"role": "user", "content": "回复：OK"}], "stream": True})
b64b = base64.b64encode(body.encode()).decode()
rc, o, e = run(
    f"echo {b64b} | base64 -d | curl -s -m 60 -N -X POST http://127.0.0.1:18080/v1/chat/completions "
    f"-H 'Content-Type: application/json' -H 'X-Relay-Secret: {SECRET}' --data-binary @- | head -c 600"
)
print(o, e)
if '"content"' in o or "data:" in o:
    print("\n✅ 中转工作正常：服务器 → Kimi 已通")
else:
    print("\n⚠️ 上游请求未拿到流，看上面报错")

cli.close()
