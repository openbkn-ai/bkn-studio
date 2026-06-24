#!/usr/bin/env bash
# install.sh — deploy bkn-studio in one of two topologies against a BKN Foundry.
#
#   cluster  Install the Helm chart INTO the Foundry's k8s cluster. The studio
#            ingress joins the existing gateway (class-443) and serves /studio on
#            the SAME host as /api, /oauth2, /.well-known, /userinfo — so the SPA
#            is same-origin and the OAuth callback (https://<gateway>/studio/
#            callback) is already seeded by bkn-safe. Nothing to register.
#
#   local    Run the studio image as a local container whose nginx ALSO reverse-
#            proxies /api, /oauth2, /.well-known, /userinfo to a remote Foundry
#            URL. The browser stays same-origin against the local container, so
#            there is no CORS and the OAuth token exchange resolves locally. The
#            local callback (http://<this-host>:<port>/studio/callback) must be
#            registered with bkn-safe unless it is the pre-seeded localhost:8000.
#
# Usage:
#   deploy/install.sh cluster [--namespace openbkn] [--version 0.1.0]
#                             [--chart <ref>] [--kube-context <ctx>] [--no-auth]
#   deploy/install.sh local --foundry https://10.211.55.4 [--port 8080]
#                           [--version 0.1.0] [--image <ref>] [--register]
#                           [--no-auth] [--no-compose]
#   deploy/install.sh uninstall cluster [--namespace openbkn] [--kube-context <ctx>]
#   deploy/install.sh uninstall local   [--name bkn-studio]
#
# local mode runs via docker compose when available (lifecycle + logs), else a
# plain `docker run`; force the latter with --no-compose.
#
# --no-auth: deploy WITHOUT bkn-safe — turns off the in-SPA OAuth gate (injects
#            config.js with mode:"hosted"), so studio runs gate-less as the
#            default local-admin user with no login and no callback to register.
#
# Callback registration (local, non-standard origin):
#   --register        register <origin>/studio/callback via the bkn-safe admin
#                     API (RequireAdmin). Token from $BKN_ADMIN_TOKEN, else the
#                     `openbkn auth token` CLI session. Ephemeral — a bkn-safe
#                     `helm upgrade` re-seeds clients and wipes it; for a durable
#                     address put it in bkn-safe's clientSeed.extraWebRedirectUris.
set -euo pipefail

CHART_NAME="bkn-studio"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_CHART_OCI="oci://ghcr.io/openbkn-ai/charts/${CHART_NAME}"
DEFAULT_IMAGE_REPO="ghcr.io/openbkn-ai/${CHART_NAME}"
# Pre-seeded by bkn-safe (clientSeed.extraWebRedirectUris default) — login works
# on this origin with zero registration.
SEEDED_LOCAL_ORIGIN="http://localhost:8000"
# Gateway path prefixes the local container must proxy to the remote Foundry so
# the browser stays same-origin. Mirrors the vite dev-server proxy set.
PROXY_PATHS=(/api /oauth2 /.well-known /userinfo)

die() { echo "error: $*" >&2; exit 1; }
info() { echo "[install] $*" >&2; }

# Default version = the chart's own version when run from a checkout.
default_version() {
  local cy="${SCRIPT_DIR}/charts/${CHART_NAME}/Chart.yaml"
  [ -f "$cy" ] && sed -n 's/^version:[[:space:]]*//p' "$cy" | head -1 || true
}

# Print the header comment block (line 2 until the first non-comment line).
usage() { awk 'NR>=2{ if(/^#/){sub(/^# ?/,"");print} else exit }' "$0"; exit "${1:-0}"; }

# ---------------------------------------------------------------- cluster ----
cmd_cluster() {
  local namespace="openbkn" version="" chart="$DEFAULT_CHART_OCI" kube_context="" no_auth="false"
  while [ $# -gt 0 ]; do
    case "$1" in
      --namespace) namespace="$2"; shift 2;;
      --version) version="$2"; shift 2;;
      --chart) chart="$2"; shift 2;;
      --kube-context) kube_context="$2"; shift 2;;
      --no-auth) no_auth="true"; shift;;
      -h|--help) usage 0;;
      *) die "unknown flag for 'cluster': $1";;
    esac
  done
  version="${version:-$(default_version)}"
  [ -n "$version" ] || die "specify --version (chart + image tag to install)"
  command -v helm >/dev/null 2>&1 || die "helm not found"
  command -v kubectl >/dev/null 2>&1 || die "kubectl not found"
  local kctx=(); [ -n "$kube_context" ] && kctx=(--kube-context "$kube_context")
  # --set image.tag pins the tag even when installing a local chart dir whose
  # values.yaml still carries the __VERSION__ placeholder. --no-auth flips the
  # chart's auth.enabled so studio installs gate-less (no bkn-safe).
  local sets=(--set image.tag="$version")
  [ "$no_auth" = "true" ] && sets+=(--set auth.enabled=false)

  info "helm upgrade --install ${CHART_NAME} ${chart} (v${version}) -n ${namespace}${no_auth:+ (no-auth=$no_auth)}"
  helm upgrade --install "$CHART_NAME" "$chart" \
    "${kctx[@]}" \
    --namespace "$namespace" --create-namespace \
    --version "$version" \
    "${sets[@]}"

  info "waiting for rollout..."
  kubectl "${kctx[@]}" -n "$namespace" rollout status "deployment/${CHART_NAME}" --timeout=120s

  if [ "$no_auth" = "true" ]; then
    cat >&2 <<EOF

[install] done (no-auth). studio served at  https://<gateway-host>/studio
[install] OAuth gate OFF — no login, runs as default local-admin. No bkn-safe needed.
EOF
  else
    cat >&2 <<EOF

[install] done. studio served at  https://<gateway-host>/studio
[install] same gateway as /api + /oauth2 → same-origin; OAuth callback
          https://<gateway-host>/studio/callback is already seeded by bkn-safe
          (accessAddress-derived). No callback registration needed.
EOF
  fi
}

# ------------------------------------------------------------------ local ----
emit_local_nginx() { # $1=foundry-url  -> writes a proxying nginx conf to stdout
  local foundry="${1%/}" host
  host="${foundry#*://}"; host="${host%%/*}"   # strip scheme + any path
  cat <<EOF
# Generated by install.sh — serves /studio AND reverse-proxies the gateway paths
# to ${foundry} so the browser is same-origin against this container.
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    location = /healthz { access_log off; add_header Content-Type text/plain; return 200 "ok\n"; }
    location = / { return 302 /studio/; }

    location /studio/assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    location = /studio/index.html { add_header Cache-Control "no-cache"; }
    location /studio/ { try_files \$uri \$uri/ /studio/index.html; }

EOF
  local p
  for p in "${PROXY_PATHS[@]}"; do
    cat <<EOF
    location ${p} {
        proxy_pass ${foundry};
        proxy_http_version 1.1;
        proxy_set_header Host ${host};
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_ssl_server_name on;
        proxy_ssl_verify off;
    }
EOF
  done
  echo "}"
}

register_callback() { # $1=foundry  $2=callback-uri
  local foundry="${1%/}" cb="$2" token
  token="${BKN_ADMIN_TOKEN:-}"
  if [ -z "$token" ] && command -v openbkn >/dev/null 2>&1; then
    token="$(openbkn auth token 2>/dev/null || true)"
  fi
  [ -n "$token" ] || die "no admin token — set BKN_ADMIN_TOKEN or run 'openbkn auth login ${foundry}' as a super-admin"
  info "registering callback ${cb} on openbkn-studio (bkn-safe admin API)"
  curl -fsSk -X POST "${foundry}/api/safe/v1/admin/clients/openbkn-studio/redirect-uris" \
    -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
    -d "{\"redirect_uri\":\"${cb}\"}" >/dev/null \
    && info "callback registered (ephemeral — wiped by a bkn-safe helm upgrade)" \
    || die "callback registration failed (need a super-admin token?)"
}

have_compose() { docker compose version >/dev/null 2>&1; }

write_compose() { # $1=file $2=image $3=name $4=port $5=conf [$6=configjs]
  {
    cat <<EOF
# Generated by install.sh. Lifecycle: docker compose -f $1 -p $3 {logs -f | down}
services:
  $3:
    image: $2
    container_name: $3
    restart: unless-stopped
    ports:
      - "$4:80"
    volumes:
      - "$5:/etc/nginx/conf.d/default.conf:ro"
EOF
    [ -n "${6:-}" ] && echo "      - \"$6:/usr/share/nginx/html/studio/config.js:ro\""
  } > "$1"
}

emit_noauth_configjs() { # gate-less runtime config (no bkn-safe)
  cat <<'EOF'
// Injected by install.sh --no-auth: gate-less, no bkn-safe. studio boots as the
// default local-admin user with no login.
window.__BKN_STUDIO_RUNTIME__ = { mode: "hosted" };
EOF
}

cmd_local() {
  local foundry="" port="8080" version="" image="" do_register="false" name="bkn-studio" use_compose="true" no_auth="false"
  while [ $# -gt 0 ]; do
    case "$1" in
      --foundry) foundry="$2"; shift 2;;
      --port) port="$2"; shift 2;;
      --version) version="$2"; shift 2;;
      --image) image="$2"; shift 2;;
      --name) name="$2"; shift 2;;
      --register) do_register="true"; shift;;
      --no-auth) no_auth="true"; shift;;
      --no-compose) use_compose="false"; shift;;
      -h|--help) usage 0;;
      *) die "unknown flag for 'local': $1";;
    esac
  done
  [ -n "$foundry" ] || die "local mode needs --foundry <url> (the BKN Foundry gateway base URL)"
  [[ "$foundry" =~ ^https?:// ]] || die "--foundry must be an http(s) URL"
  command -v docker >/dev/null 2>&1 || die "docker not found"
  version="${version:-$(default_version)}"
  if [ -z "$image" ]; then
    [ -n "$version" ] || die "specify --version or --image (no Chart.yaml to default from)"
    image="${DEFAULT_IMAGE_REPO}:${version}"
  fi

  local conf_dir="${BKN_STUDIO_HOME:-$HOME/.openbkn-ai/${CHART_NAME}}"
  mkdir -p "$conf_dir"
  local conf="${conf_dir}/nginx.conf"
  emit_local_nginx "$foundry" > "$conf"
  info "wrote proxying nginx conf -> ${conf}"

  # No-auth: drop a config.js that turns the in-SPA OAuth gate OFF (mode:hosted),
  # mounted over the image's baked no-op config.js.
  local cfg=""
  if [ "$no_auth" = "true" ]; then
    cfg="${conf_dir}/config.js"
    emit_noauth_configjs > "$cfg"
    info "no-auth: wrote gate-less config.js -> ${cfg}"
  fi

  local compose="${conf_dir}/docker-compose.yml"
  info "(re)starting container ${name} on :${port} (image ${image})"
  if [ "$use_compose" = "true" ] && have_compose; then
    write_compose "$compose" "$image" "$name" "$port" "$conf" "$cfg"
    docker compose -f "$compose" -p "$name" up -d --force-recreate >/dev/null
    info "managed by compose: ${compose}"
  else
    docker rm -f "$name" >/dev/null 2>&1 || true
    local vargs=(-v "${conf}:/etc/nginx/conf.d/default.conf:ro")
    [ -n "$cfg" ] && vargs+=(-v "${cfg}:/usr/share/nginx/html/studio/config.js:ro")
    docker run -d --name "$name" --restart unless-stopped \
      -p "${port}:80" "${vargs[@]}" "$image" >/dev/null
  fi

  local origin="http://localhost:${port}" cb logs_hint stop_hint
  cb="${origin}/studio/callback"
  if [ "$use_compose" = "true" ] && have_compose; then
    logs_hint="docker compose -f ${compose} -p ${name} logs -f"
  else
    logs_hint="docker logs -f ${name}"
  fi
  stop_hint="deploy/install.sh uninstall local --name ${name}"

  cat >&2 <<EOF

[install] studio up at  ${origin}/studio   (proxying /api,/oauth2,/.well-known,/userinfo -> ${foundry})
[install] logs:  ${logs_hint}
[install] stop:  ${stop_hint}
EOF

  if [ "$no_auth" = "true" ]; then
    info "no-auth mode: OAuth gate OFF (mode:hosted) — no login, runs as default local-admin; no callback to register."
  elif [ "$origin" = "$SEEDED_LOCAL_ORIGIN" ]; then
    info "OAuth callback ${cb} is the pre-seeded origin — already registered, nothing to do."
  elif [ "$do_register" = "true" ]; then
    register_callback "$foundry" "$cb"
  else
    cat >&2 <<EOF
[install] OAuth callback for this origin: ${cb}
[install] this origin is NOT pre-seeded → login fails with 'redirect_uri mismatch'
          until it is registered with bkn-safe. Pick one:
  • re-run with --register (ephemeral; needs a super-admin token), or
  • durable: add it to bkn-safe clientSeed.extraWebRedirectUris + helm upgrade, or
  • serve on ${SEEDED_LOCAL_ORIGIN} (already seeded) via --port 8000, or
  • no bkn-safe at all → re-run with --no-auth (no login).
EOF
  fi
}

# -------------------------------------------------------------- uninstall ----
cmd_uninstall() {
  local topo="${1:-}"; shift || true
  case "$topo" in
    cluster)
      local namespace="openbkn" kube_context=""
      while [ $# -gt 0 ]; do case "$1" in
        --namespace) namespace="$2"; shift 2;;
        --kube-context) kube_context="$2"; shift 2;;
        *) die "unknown flag for 'uninstall cluster': $1";;
      esac; done
      command -v helm >/dev/null 2>&1 || die "helm not found"
      local kctx=(); [ -n "$kube_context" ] && kctx=(--kube-context "$kube_context")
      info "helm uninstall ${CHART_NAME} -n ${namespace}"
      helm uninstall "$CHART_NAME" "${kctx[@]}" -n "$namespace"
      ;;
    local)
      local name="bkn-studio"
      while [ $# -gt 0 ]; do case "$1" in
        --name) name="$2"; shift 2;;
        *) die "unknown flag for 'uninstall local': $1";;
      esac; done
      command -v docker >/dev/null 2>&1 || die "docker not found"
      local compose="${BKN_STUDIO_HOME:-$HOME/.openbkn-ai/${CHART_NAME}}/docker-compose.yml"
      if [ -f "$compose" ] && have_compose; then
        info "docker compose down (${compose})"
        docker compose -f "$compose" -p "$name" down
      else
        info "docker rm -f ${name}"
        docker rm -f "$name" >/dev/null 2>&1 || true
      fi
      info "uninstalled. (OAuth redirect_uris registered with --register are not removed here;"
      info " use bkn-redirect.sh del / drop from clientSeed if you want them gone.)"
      ;;
    ""|-h|--help) die "usage: install.sh uninstall <cluster|local> [flags]";;
    *) die "unknown uninstall topology '$topo' (use: cluster | local)";;
  esac
}

# ------------------------------------------------------------------- main ----
[ $# -ge 1 ] || usage 1
sub="$1"; shift
case "$sub" in
  cluster) cmd_cluster "$@";;
  local)   cmd_local "$@";;
  uninstall) cmd_uninstall "$@";;
  -h|--help|help) usage 0;;
  *) die "unknown command '$sub' (use: cluster | local | uninstall)";;
esac
