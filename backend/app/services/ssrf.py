"""SSRF gate — MANDATORY before any outbound fetch (spec §46).

Blocks non-http(s) schemes and any host that resolves to a private, loopback,
link-local, reserved, multicast, CGNAT, or cloud-metadata address. Must be called
again on every redirect hop — the first validation is never assumed sufficient.
"""
from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

from app.core.errors import AppError

# Carrier-grade NAT range (not flagged private by `ipaddress`).
_CGNAT = ipaddress.ip_network("100.64.0.0/10")


class SSRFError(AppError):
    status_code = 400
    code = "SSRF_BLOCKED"


def _ip_blocked(ip: ipaddress._BaseAddress) -> bool:
    # Unwrap IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1).
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    if (
        ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved
        or ip.is_multicast or ip.is_unspecified
    ):
        return True
    if ip.version == 4 and ip in _CGNAT:
        return True
    # Belt-and-suspenders: anything not globally routable is blocked.
    if not ip.is_global:
        return True
    return False


def resolve_ips(host: str, port: int) -> list[ipaddress._BaseAddress]:
    try:
        return [ipaddress.ip_address(host)]
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise SSRFError("The host could not be resolved.") from exc
    return [ipaddress.ip_address(info[4][0]) for info in infos]


def assert_url_allowed(url: str) -> str:
    """Validate a URL for outbound fetching. Returns the normalized URL or raises
    SSRFError. Call this for the initial URL AND for every redirect target."""
    target = url if "://" in url else f"http://{url}"
    p = urlparse(target)
    if p.scheme not in ("http", "https"):
        raise SSRFError("Only http and https URLs can be analyzed.")
    host = p.hostname
    if not host:
        raise SSRFError("The URL has no host.")

    port = p.port or (443 if p.scheme == "https" else 80)
    for ip in resolve_ips(host, port):
        if _ip_blocked(ip):
            raise SSRFError("The URL resolves to a disallowed (internal) address.")
    return target
