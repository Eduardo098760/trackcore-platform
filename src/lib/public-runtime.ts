const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "")
}

export function getPublicAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl)
  }

  if (typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin)
  }

  return "http://localhost:3000"
}

export function getSocketUrl() {
  const configuredSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim()
  if (configuredSocketUrl) {
    return configuredSocketUrl
  }

  if (typeof window !== "undefined") {
    const appUrl = new URL(getPublicAppUrl())
    const socketProtocol = appUrl.protocol === "https:" ? "https:" : "http:"
    const socketPort = process.env.NEXT_PUBLIC_SOCKET_PORT?.trim() || "3001"
    return `${socketProtocol}//${appUrl.hostname}:${socketPort}`
  }

  return "http://localhost:3001"
}

export function isLocalhostAppUrl(url: string) {
  try {
    const parsed = new URL(url)
    return LOCAL_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}
