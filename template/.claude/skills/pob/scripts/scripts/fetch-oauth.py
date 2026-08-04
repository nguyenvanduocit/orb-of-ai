#!/usr/bin/env python3
"""fetch-oauth.py — OAuth self-flow (client_id=pob, PKCE) to fetch a FULL POE2
charData from api.pathofexile.com/character/poe2/<name>, then hand it to
export-pob.sh (which reuses PoB's own import + SaveDB) to emit a PoB code.

This replicates exactly what Path of Building's desktop "Import Character" does:
client_id=pob is a public PKCE client (no client_secret), and GGG registers the
loopback redirect http://localhost:{49082,49083,49084} for it. The only manual
step is YOU clicking "Authorize" once in a browser on this machine.

Powers `pob-cli.sh --oauth`. Owner-authorised direct GGG call: PoB-style UA,
single rate-limited requests. Token cached in tmp/.poe-oauth.json (gitignored).

Usage:
  fetch-oauth.py                       # auth only (get/refresh token)
  fetch-oauth.py <character> [realm]   # auth + fetch char + export to PoB code
  fetch-oauth.py --list [realm]        # auth + list characters
  fetch-oauth.py --token <bearer> <character> [realm]   # reuse a pasted token
"""

import sys, os, json, time, base64, hashlib, secrets, socket, subprocess, urllib.parse

CLIENT_ID = "pob"
SCOPES = "account:profile account:leagues account:characters account:trade"
PORTS = [49082, 49083, 49084]
AUTH_URL = "https://www.pathofexile.com/oauth/authorize"
TOKEN_URL = "https://www.pathofexile.com/oauth/token"
API_BASE = "https://api.pathofexile.com"
UA = "Path of Building/2.0 (+https://pathofbuilding.community)"

HERE = os.path.dirname(os.path.abspath(__file__))
# HERE = <root>/.claude/skills/pob/scripts/scripts → climb 5 to project root.
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))
TMP = os.path.join(ROOT, "tmp")
EXPORT_DIR = os.path.join(ROOT, "data", "character-exports")
EXPORT_POB = os.path.join(ROOT, "data", "pob-source", "export-pob.sh")
TOKEN_FILE = os.path.join(TMP, ".poe-oauth.json")
os.makedirs(TMP, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)


def log(*a):
    print("[fetch-oauth]", *a, file=sys.stderr, flush=True)


def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def curl(args):
    """Run curl with PoB UA; return (body, http_code). curl gets through
    Cloudflare's bot filtering where urllib/WebFetch are blocked."""
    full = [
        "curl",
        "-s",
        "--max-time",
        "30",
        "-H",
        "User-Agent: " + UA,
        "-w",
        "\n%{http_code}",
    ] + args
    out = subprocess.run(full, capture_output=True, text=True).stdout
    code = out.rsplit("\n", 1)[-1].strip()
    body = out.rsplit("\n", 1)[0]
    return body, code


# ── Token storage ────────────────────────────────────────────────────────────
def save_token(tok):
    tok.setdefault("obtained_at", int(time.time()))
    json.dump(tok, open(TOKEN_FILE, "w"))
    log("token saved →", TOKEN_FILE)


def load_token():
    return json.load(open(TOKEN_FILE)) if os.path.exists(TOKEN_FILE) else None


def token_valid(tok):
    return bool(
        tok
        and tok.get("access_token")
        and tok.get("obtained_at", 0) + tok.get("expires_in", 0) > time.time() + 60
    )


def refresh_token(tok):
    log("access token expired — refreshing via refresh_token...")
    body, code = curl(
        [
            "-X",
            "POST",
            TOKEN_URL,
            "--data-urlencode",
            "client_id=" + CLIENT_ID,
            "--data-urlencode",
            "grant_type=refresh_token",
            "--data-urlencode",
            "refresh_token=" + tok["refresh_token"],
        ]
    )
    if code != "200":
        raise SystemExit(f"refresh failed (HTTP {code}): {body[:200]}")
    new = json.loads(body)
    save_token(new)
    return new


# ── Interactive PKCE authorize (the one manual step) ──────────────────────────
def bind_catcher():
    for p in PORTS:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
            s.bind(("127.0.0.1", p))
            s.listen(1)
            return s, p
        except OSError:
            try:
                s.close()
            except Exception:
                pass
    raise SystemExit(
        "ERROR: localhost ports 49082-49084 all busy (close PoB desktop if open)."
    )


def wait_for_redirect(sock, expect_state, timeout=300):
    sock.settimeout(timeout)
    end = time.time() + timeout
    while time.time() < end:
        try:
            cli, _ = sock.accept()
        except socket.timeout:
            break
        cli.settimeout(5)
        try:
            req = cli.recv(8192).decode("latin1")
        except Exception:
            cli.close()
            continue
        first = req.split("\r\n", 1)[0]
        parts = first.split(" ")
        path = parts[1] if len(parts) > 1 else ""
        params = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(path).query))
        if "code" in params:
            html = (
                "<!doctype html><meta charset=utf-8>"
                "<body style='font-family:sans-serif;background:#121212;color:#fff;"
                "text-align:center;padding-top:18vh'>"
                "<h1 style='color:#4CAF50'>✅ Auth complete</h1>"
                "<p>Quay lại terminal được rồi.</p>"
            )
            cli.send(
                b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n\r\n"
                + html.encode()
            )
            cli.close()
            return params.get("code"), params.get("state")
        if "error" in params:
            cli.send(
                b"HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n<h1>Auth failed</h1>"
            )
            cli.close()
            raise SystemExit(
                "OAuth error: %s %s"
                % (params.get("error"), params.get("error_description", ""))
            )
        cli.send(b"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n")
        cli.close()
    raise SystemExit("Timeout (%ds) waiting for the OAuth redirect." % timeout)


def interactive_auth():
    verifier = b64url(secrets.token_bytes(32))
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    state = secrets.token_hex(8)
    sock, port = bind_catcher()
    redirect = "http://localhost:%d" % port
    q = urllib.parse.urlencode(
        {
            "client_id": CLIENT_ID,
            "response_type": "code",
            "scope": SCOPES,
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "redirect_uri": redirect,
        },
        quote_via=urllib.parse.quote,
    )
    url = AUTH_URL + "?" + q
    # Machine-readable line the wrapper/agent relays to the user:
    print("OAUTH_URL: " + url, flush=True)
    log(
        "Catcher listening on %s. Open the OAUTH_URL above in a browser on THIS Mac"
        % redirect
    )
    log("(logged into pathofexile.com), click Authorize. Waiting up to 300s...")
    code, rstate = wait_for_redirect(sock, state)
    sock.close()
    if rstate != state:
        raise SystemExit("OAuth state mismatch — aborting (possible forged redirect).")
    body, hc = curl(
        [
            "-X",
            "POST",
            TOKEN_URL,
            "--data-urlencode",
            "client_id=" + CLIENT_ID,
            "--data-urlencode",
            "grant_type=authorization_code",
            "--data-urlencode",
            "code=" + code,
            "--data-urlencode",
            "redirect_uri=" + redirect,
            "--data-urlencode",
            "scope=" + SCOPES,
            "--data-urlencode",
            "code_verifier=" + verifier,
        ]
    )
    if hc != "200":
        raise SystemExit(f"token exchange failed (HTTP {hc}): {body[:300]}")
    tok = json.loads(body)
    save_token(tok)
    log("authenticated; token expires in %ss" % tok.get("expires_in"))
    return tok


def ensure_token(explicit=None):
    if explicit:
        tok = {
            "access_token": explicit,
            "expires_in": 36000,
            "obtained_at": int(time.time()),
        }
        save_token(tok)
        return tok
    tok = load_token()
    if token_valid(tok):
        log("reusing cached token")
        return tok
    if tok and tok.get("refresh_token"):
        try:
            return refresh_token(tok)
        except SystemExit as e:
            log(str(e), "→ falling back to interactive auth")
    return interactive_auth()


# ── Character API ──────────────────────────────────────────────────────────--
def char_path(name, realm):
    seg = "" if realm == "pc" else "/" + realm
    return "%s/character%s/%s" % (API_BASE, seg, urllib.parse.quote(name))


def fetch_char(tok, name, realm):
    log("fetching %s (realm=%s)..." % (name, realm))
    body, code = curl(
        ["-H", "Authorization: Bearer " + tok["access_token"], char_path(name, realm)]
    )
    if code != "200":
        raise SystemExit(f"character fetch failed (HTTP {code}): {body[:300]}")
    data = json.loads(body)
    char = data.get("character", data)
    out = os.path.join(EXPORT_DIR, "oauth-%s.json" % name)
    json.dump({"character": char}, open(out, "w"))
    log(
        "charData → %s (equipment=%d, passives=%s, skills=%d)"
        % (
            out,
            len(char.get("equipment", [])),
            "yes" if char.get("passives") else "no",
            len(char.get("skills", [])),
        )
    )
    return out


def list_chars(tok, realm):
    body, code = curl(
        [
            "-H",
            "Authorization: Bearer " + tok["access_token"],
            "%s/character%s" % (API_BASE, "" if realm == "pc" else "/" + realm),
        ]
    )
    if code != "200":
        raise SystemExit(f"list failed (HTTP {code}): {body[:300]}")
    data = json.loads(body)
    chars = data.get("characters", data)
    print(
        json.dumps(
            [
                {k: c.get(k) for k in ("name", "class", "level", "league")}
                for c in chars
            ],
            indent=2,
        )
    )


# ── Main ─────────────────────────────────────────────────────────────────────
def main(argv):
    explicit_token = None
    args = []
    i = 0
    while i < len(argv):
        if argv[i] == "--token" and i + 1 < len(argv):
            explicit_token = argv[i + 1]
            i += 2
            continue
        args.append(argv[i])
        i += 1

    if args and args[0] == "--list":
        realm = args[1] if len(args) > 1 else "poe2"
        list_chars(ensure_token(explicit_token), realm)
        return

    character = args[0] if args else None
    realm = args[1] if len(args) > 1 else "poe2"

    tok = ensure_token(explicit_token)
    if not character:
        log("token ready (no character given — nothing to fetch).")
        return
    char_file = fetch_char(tok, character, realm)
    log("exporting via PoB import/export...")
    r = subprocess.run(["bash", EXPORT_POB, char_file], capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
