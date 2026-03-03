type GoogleCredentialResponse = {
  credential?: string
}

type GooglePromptNotification = {
  isNotDisplayed?: () => boolean
  isSkippedMoment?: () => boolean
  isDismissedMoment?: () => boolean
  getNotDisplayedReason?: () => string
  getSkippedReason?: () => string
  getDismissedReason?: () => string
}

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
  }) => void
  prompt: (listener?: (notification: GooglePromptNotification) => void) => void
}

type GoogleNamespace = {
  accounts?: {
    id?: GoogleAccountsId
  }
}

const getGoogleAccounts = () => {
  const scopedWindow = window as Window & { google?: GoogleNamespace }
  return scopedWindow.google?.accounts?.id
}

const readPromptReason = (notification: GooglePromptNotification) => {
  if (notification.isNotDisplayed?.()) {
    return notification.getNotDisplayedReason?.() ?? 'not_displayed'
  }
  if (notification.isSkippedMoment?.()) {
    return notification.getSkippedReason?.() ?? 'skipped'
  }
  if (notification.isDismissedMoment?.()) {
    return notification.getDismissedReason?.() ?? 'dismissed'
  }
  return null
}

export const requestIdToken = () =>
  new Promise<string>((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      reject(new Error('Google login is not configured.'))
      return
    }

    const accounts = getGoogleAccounts()
    if (!accounts) {
      reject(new Error('Google Identity Services is unavailable.'))
      return
    }

    let settled = false
    const complete = (fn: () => void) => {
      if (settled) {
        return
      }
      settled = true
      fn()
    }

    const timeoutId = window.setTimeout(() => {
      complete(() => {
        reject(
          new Error(
            'Google login timed out. Check VITE_GOOGLE_CLIENT_ID and authorized origins in Google Cloud Console.',
          ),
        )
      })
    }, 120_000)

    accounts.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: false,
      callback: (response) => {
        window.clearTimeout(timeoutId)
        if (typeof response.credential === 'string' && response.credential.trim()) {
          complete(() => {
            resolve(response.credential as string)
          })
          return
        }
        complete(() => {
          reject(new Error('Google login failed.'))
        })
      },
    })

    accounts.prompt((notification) => {
      if (!notification) {
        return
      }
      const reason = readPromptReason(notification)
      if (reason) {
        window.clearTimeout(timeoutId)
        complete(() => {
          reject(new Error(`Google login was not completed (${reason}).`))
        })
      }
    })
  })
