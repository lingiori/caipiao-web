/**
 * AI 问答页的账号密码认证（edge 运行时安全，仅用 Web Crypto）。
 *
 * 账号来自 ai.config.json 的 auth.users，密码以 SHA-256 十六进制存储（passHash）。
 * 登录成功后签发 HMAC-SHA256 签名cookie，middleware 校验该 cookie 放行页面与 API。
 */
import aiConfig from "@/ai.config.json";

/** cookie 名 */
export const AUTH_COOKIE = "kl8_chat_auth";
/** 会话有效期（秒） */
export const SESSION_MAX_AGE = 7 * 24 * 3600;

type AuthUser = { user: string; passHash: string };

/**
 * 解析会话签名密钥：环境变量优先，其次 ai.config.json。
 * 返回 null 表示未配置（此时禁止登录与一切会话校验）。
 */
function getSessionSecret(): string | null {
  const s = process.env.AUTH_SESSION_SECRET || aiConfig.auth.sessionSecret;
  return s && s.length > 0 ? s : null;
}

/** 计算字符串的 SHA-256 十六进制摘要 */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 恒定时间比较两个字符串，避免计时侧信道 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** 导入签名密钥（HMAC-SHA256）；未配置密钥时返回 null */
async function importSignKey(): Promise<CryptoKey | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * 校验用户名密码，成功返回 true。
 */
export async function verifyCredentials(
  user: string,
  password: string
): Promise<boolean> {
  const record = aiConfig.auth.users.find(
    (u: AuthUser) => u.user === user
  );
  if (!record) return false;
  const hash = await sha256Hex(password);
  return timingSafeEqual(hash, record.passHash);
}

/**
 * 签发会话 cookie 值：`${user}.${过期时间戳}.${HMAC签名}`。
 *
 * @throws 未配置会话签名密钥时抛出错误
 */
export async function createSessionToken(user: string): Promise<string> {
  const key = await importSignKey();
  if (!key) {
    throw new Error(
      "未配置会话签名密钥，请设置环境变量 AUTH_SESSION_SECRET 或 ai.config.json 的 auth.sessionSecret"
    );
  }
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${user}.${expires}`;
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const sigHex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${payload}.${sigHex}`;
}

/**
 * 校验会话 cookie：签名有效且未过期。未配置密钥时一律拒绝。
 */
export async function verifySessionToken(token: string): Promise<boolean> {
  const key = await importSignKey();
  if (!key) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [user, expiresStr, sigHex] = parts;
  const expires = Number(expiresStr);
  if (!user || !Number.isFinite(expires) || expires < Date.now()) return false;

  const sig = new Uint8Array(
    (sigHex.match(/.{1,2}/g) ?? []).map((h) => parseInt(h, 16))
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    sig,
    new TextEncoder().encode(`${user}.${expiresStr}`)
  );
}
