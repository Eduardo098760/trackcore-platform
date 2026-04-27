import { getTenantConfig } from "@/config/tenants"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "")
}

function isPrivateIpv4Host(hostname: string) {
  if (/^10\./.test(hostname)) return true
  if (/^192\.168\./.test(hostname)) return true
  const match = hostname.match(/^172\.(\d{1,3})\./)
  if (match) {
    const secondOctet = Number(match[1])
    return secondOctet >= 16 && secondOctet <= 31
  }
  return false
}

export function isPrivateNetworkAppUrl(url: string) {
  try {
    const parsed = new URL(url)
    return LOCAL_HOSTS.has(parsed.hostname) || isPrivateIpv4Host(parsed.hostname)
  } catch {
    return false
  }
}

export function getPublicAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (typeof window !== "undefined") {
    const runtimeOrigin = normalizeBaseUrl(window.location.origin)

    if (!configuredUrl) {
      return runtimeOrigin
    }

    const normalizedConfiguredUrl = normalizeBaseUrl(configuredUrl)
    if (isPrivateNetworkAppUrl(normalizedConfiguredUrl) && !isPrivateNetworkAppUrl(runtimeOrigin)) {
      return runtimeOrigin
    }

    return normalizedConfiguredUrl
  }

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl)
  }

  return "http://localhost:3000"
}

export function getPublicGatewayAppUrl() {
  const appUrl = getPublicAppUrl()

  if (!isPrivateNetworkAppUrl(appUrl)) {
    return appUrl
  }

  if (typeof window !== "undefined") {
    const tenantWebsite = getTenantConfig(window.location.hostname).metadata?.website?.trim()
    if (tenantWebsite && !isPrivateNetworkAppUrl(tenantWebsite)) {
      return normalizeBaseUrl(tenantWebsite)
    }
  }

  return appUrl
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
