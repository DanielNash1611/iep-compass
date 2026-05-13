export type ModelDownloadNetworkState = 'allowed' | 'blocked' | 'unknown'

export interface NetworkConnectionSnapshot {
  effectiveType?: string
  saveData?: boolean
  type?: string
}

export interface ModelDownloadNetworkStatus {
  canDownload: boolean
  detail: string
  label: string
  state: ModelDownloadNetworkState
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkConnectionSnapshot
  mozConnection?: NetworkConnectionSnapshot
  webkitConnection?: NetworkConnectionSnapshot
}

const DOWNLOAD_FRIENDLY_TYPES = new Set(['ethernet', 'wifi'])
const MOBILE_DATA_TYPES = new Set(['bluetooth', 'cellular', 'wimax'])

function isMobileUserAgent(userAgent: string) {
  return /Android|Mobile|iPhone|iPad|iPod/i.test(userAgent)
}

export function classifyModelDownloadNetwork(
  connection: NetworkConnectionSnapshot | undefined,
  userAgent: string,
): ModelDownloadNetworkStatus {
  if (connection?.saveData) {
    return {
      canDownload: false,
      detail:
        'Data Saver is turned on, so IEP Compass will wait before starting a multi-gigabyte model download.',
      label: 'Data Saver is on',
      state: 'blocked',
    }
  }

  const connectionType = connection?.type?.toLowerCase()

  if (connectionType && DOWNLOAD_FRIENDLY_TYPES.has(connectionType)) {
    return {
      canDownload: true,
      detail:
        'This browser reports a Wi-Fi or wired connection, so it is okay to fetch the browser model.',
      label: connectionType === 'wifi' ? 'Wi-Fi detected' : 'Wired connection detected',
      state: 'allowed',
    }
  }

  if (connectionType && MOBILE_DATA_TYPES.has(connectionType)) {
    return {
      canDownload: false,
      detail:
        'This browser reports a mobile-data connection. Connect to Wi-Fi, then re-check before downloading Gemma.',
      label: 'Mobile data detected',
      state: 'blocked',
    }
  }

  if (!connectionType && isMobileUserAgent(userAgent)) {
    return {
      canDownload: false,
      detail:
        'This mobile browser did not confirm Wi-Fi. Connect to Wi-Fi, then tap re-check so the app can safely get the model.',
      label: 'Wi-Fi not confirmed',
      state: 'unknown',
    }
  }

  return {
    canDownload: true,
    detail:
      'This browser did not expose a precise network type, but it is not reporting mobile data or Data Saver.',
    label: 'Network looks okay',
    state: 'allowed',
  }
}

export function getModelDownloadNetworkStatus(): ModelDownloadNetworkStatus {
  const navigatorWithConnection = navigator as NavigatorWithConnection
  const connection =
    navigatorWithConnection.connection
    ?? navigatorWithConnection.mozConnection
    ?? navigatorWithConnection.webkitConnection

  return classifyModelDownloadNetwork(connection, navigator.userAgent)
}
