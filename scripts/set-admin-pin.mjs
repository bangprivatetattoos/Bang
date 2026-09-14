// One-time / rotation utility. Run only in a trusted terminal after applying migrations:
// node scripts/set-admin-pin.mjs
// It never logs, saves, or accepts a PIN from source control.
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function readPin() {
  if (!process.stdin.isTTY) throw new Error("Run this command from an interactive trusted terminal; stdin must be a TTY.");
  process.stdout.write("Enter a fresh six-digit admin PIN: ");
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let value = "";
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") { process.exitCode = 1; finish(""); return; }
        if (character === "\r" || character === "\n") { finish(value); return; }
        if (character === "\u007f" || character === "\b") { value = value.slice(0, -1); continue; }
        if (/\d/.test(character) && value.length < 6) value += character;
      }
    };
    const finish = (pin) => { process.stdin.off("data", onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); resolve(pin); };
    process.stdin.on("data", onData);
  });
}

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pepper = process.env.ADMIN_PIN_PEPPER;
if (!url || !serviceRole || !pepper) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ADMIN_PIN_PEPPER must be set in the trusted server environment.");
const pin = await readPin();
if (!/^\d{6}$/.test(pin)) throw new Error("PIN must contain exactly six digits.");
const salt = randomBytes(16).toString("hex");
const hash = Buffer.from(await scrypt(`${pin}:${pepper}`, salt, 64, SCRYPT_OPTIONS)).toString("hex");
const client = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await client.from("admin_security").upsert({ singleton: true, pin_hash: hash, pin_salt: salt, security_version: randomUUID(), updated_at: new Date().toISOString() }, { onConflict: "singleton" });
if (error) throw new Error(`Could not store the PIN hash: ${error.message}`);
console.log("Admin PIN hash stored and existing admin sessions invalidated.");
