import { useEffect, useRef } from 'react'

// Cloudflare Turnstile, the bot check on the sign-up form. Shown only when the
// server has a site key (TURNSTILE_SITE_KEY). onToken gets the token when the
// check passes, and null when it expires.
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptLoading = null
const loadScript = () => {
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => {
      scriptLoading = null
      reject(new Error('Turnstile could not be loaded'))
    }
    document.head.appendChild(script)
  })
  return scriptLoading
}

const TurnstileWidget = ({ siteKey, language, onToken }) => {
  const container = useRef(null)
  // The latest callback, without rendering the widget again when it changes.
  const tokenHandler = useRef(onToken)
  useEffect(() => {
    tokenHandler.current = onToken
  })

  useEffect(() => {
    let widgetId = null
    let cancelled = false
    loadScript()
      .then((turnstile) => {
        if (cancelled || !container.current) return
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          language,
          callback: (token) => tokenHandler.current(token),
          'expired-callback': () => tokenHandler.current(null),
          'error-callback': () => tokenHandler.current(null)
        })
      })
      .catch(() => tokenHandler.current(null))
    return () => {
      cancelled = true
      if (widgetId !== null) window.turnstile?.remove(widgetId)
    }
  }, [siteKey, language])

  return <div ref={container} className="turnstile" />
}

export default TurnstileWidget
