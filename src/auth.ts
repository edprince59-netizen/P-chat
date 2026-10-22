import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

type AuthMode = 'login' | 'signup' | 'recovery' | 'new-password' | 'mfa' | 'enroll' | 'account'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

let activeUser: User | null = null
let authMode: AuthMode = 'login'
let mfaFactorId = ''
let enrollmentQrCode = ''
let enrollmentSecret = ''
let previousFocus: HTMLElement | null = null

function setupAuth(app: HTMLElement) {
  const modalRoot = app.querySelector<HTMLDivElement>('#auth-root')
  if (!modalRoot) return

  app.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const openButton = target.closest<HTMLButtonElement>('[data-auth-open]')
    if (!openButton) return
    if (!modalRoot.hasChildNodes()) previousFocus = openButton
    showModal((openButton.dataset.authOpen as AuthMode | undefined) ?? 'login')
  })

  app.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !modalRoot.hasChildNodes()) return
    closeModal()
  })

  modalRoot.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.matches('[data-auth-close]') || target.classList.contains('auth-backdrop')) {
      closeModal()
      return
    }

    const actionButton = target.closest<HTMLButtonElement>('[data-auth-action]')
    if (!actionButton) return

    if (actionButton.dataset.authAction === 'recovery') showModal('recovery')
    if (actionButton.dataset.authAction === 'resend-confirmation') void resendConfirmation(actionButton)
    if (actionButton.dataset.authAction === 'enroll') void beginEnrollment()
    if (actionButton.dataset.authAction === 'disable-mfa') void disableMfa()
    if (actionButton.dataset.authAction === 'signout') void signOut()
  })

  modalRoot.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return
    event.preventDefault()
    void submitForm(form)
  })

  modalRoot.addEventListener('invalid', () => {
    const validationMessage = authMode === 'signup'
      ? 'Please complete all fields. Use a valid email, a 3–24 character username, and a password of at least 12 characters.'
      : authMode === 'login'
        ? 'Enter your account email and password to sign in.'
        : authMode === 'recovery'
          ? 'Enter a valid email address to request a password reset.'
          : 'Please complete the required field before continuing.'
    setMessage(validationMessage, 'error')
  }, true)

  modalRoot.addEventListener('input', (event) => {
    if (!(event.target instanceof HTMLInputElement)) return
    setMessage('')
    const actions = modalRoot!.querySelector<HTMLDivElement>('#auth-actions')
    if (actions) actions.innerHTML = ''
  })

  if (supabase) {
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        showAuthError(error.message)
        return
      }
      activeUser = data.user
      updateAuthButtons()
    })

    supabase.auth.onAuthStateChange((event, session) => {
      activeUser = session?.user ?? null
      updateAuthButtons()

      if (event === 'PASSWORD_RECOVERY') showModal('new-password')
      if (event === 'SIGNED_OUT') closeModal()
    })
  }

  updateAuthButtons()

  function showModal(mode: AuthMode) {
    authMode = mode
    const configured = Boolean(supabase)
    modalRoot!.innerHTML = `
      <div class="auth-backdrop" role="presentation">
        <section class="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button class="auth-close" type="button" data-auth-close aria-label="Close">×</button>
          <div class="auth-brand"><span class="brand-mark">P</span><span>P chat</span></div>
          ${configured ? renderMode(mode) : `
            <div class="auth-message error" role="alert">
              Authentication is not configured yet. Add your Supabase project URL and publishable key
              to the local <code>.env</code> file, then restart the development server.
            </div>
          `}
          <p class="auth-message" id="auth-message" role="status" aria-live="polite"></p>
          <div id="auth-actions"></div>
        </section>
      </div>
    `

    if (mode === 'enroll') {
      const qrCode = modalRoot!.querySelector<HTMLImageElement>('#mfa-qr')
      if (qrCode && enrollmentQrCode) qrCode.src = enrollmentQrCode
      const secret = modalRoot!.querySelector<HTMLElement>('#mfa-secret')
      if (secret) secret.textContent = enrollmentSecret
    }

    if (mode === 'account' && activeUser) {
      const identity = modalRoot!.querySelector<HTMLElement>('#account-identity')
      if (identity) {
        identity.textContent = `${String(activeUser.user_metadata.username ?? 'P chat member')} · ${activeUser.email ?? ''}`
      }
      void updateMfaStatus()
    }

    const firstInput = modalRoot!.querySelector<HTMLInputElement>('input')
    const focusTarget = firstInput ?? modalRoot!.querySelector<HTMLButtonElement>('[data-auth-close]')
    focusTarget?.focus()
  }

  function renderMode(mode: AuthMode) {
    if (mode === 'login') {
      return `
        <p class="auth-eyebrow">Welcome back</p>
        <h2 id="auth-title">Sign in to P chat</h2>
        <p class="auth-intro">Continue connecting, creating, and growing with your community.</p>
        <form class="auth-form">
          <label>Email address<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="btn btn-primary auth-submit" type="submit">Sign in</button>
        </form>
        <button class="text-button" type="button" data-auth-action="recovery">Forgot your password?</button>
        <button class="text-button" type="button" data-auth-action="resend-confirmation">Resend confirmation email</button>
        <p class="auth-switch">New to P chat? <button type="button" data-auth-open="signup">Create an account</button></p>
      `
    }

    if (mode === 'signup') {
      return `
        <p class="auth-eyebrow">Join the community</p>
        <h2 id="auth-title">Create your account</h2>
        <p class="auth-intro">Choose a unique username, enter a valid email, and use a password of at least 12 characters. After signup, check your email to verify your account.</p>
        <form class="auth-form">
          <label>Username<input name="username" type="text" autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" title="Use 3–24 letters, numbers, or underscores." required /></label>
          <label>Email address<input name="email" type="email" autocomplete="email" required /></label>
          <label>Password<input name="password" type="password" autocomplete="new-password" minlength="12" required /><span class="field-hint">Use at least 12 characters.</span></label>
          <button class="btn btn-primary auth-submit" type="submit">Create account</button>
        </form>
        <p class="auth-switch">Already have an account? <button type="button" data-auth-open="login">Sign in</button></p>
      `
    }

    if (mode === 'recovery') {
      return `
        <p class="auth-eyebrow">Account recovery</p>
        <h2 id="auth-title">Reset your password</h2>
        <p class="auth-intro">We’ll email you a secure link to choose a new password.</p>
        <form class="auth-form">
          <label>Email address<input name="email" type="email" autocomplete="email" required /></label>
          <button class="btn btn-primary auth-submit" type="submit">Send recovery link</button>
        </form>
        <p class="auth-switch"><button type="button" data-auth-open="login">Back to sign in</button></p>
      `
    }

    if (mode === 'new-password') {
      return `
        <p class="auth-eyebrow">Account recovery</p>
        <h2 id="auth-title">Choose a new password</h2>
        <form class="auth-form">
          <label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" required /><span class="field-hint">Use at least 12 characters.</span></label>
          <button class="btn btn-primary auth-submit" type="submit">Update password</button>
        </form>
      `
    }

    if (mode === 'mfa') {
      return `
        <p class="auth-eyebrow">Two-factor authentication</p>
        <h2 id="auth-title">Enter your authenticator code</h2>
        <p class="auth-intro">Open your authenticator app and enter the current 6-digit P chat code.</p>
        <form class="auth-form">
          <label>6-digit code<input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required /></label>
          <button class="btn btn-primary auth-submit" type="submit">Verify and sign in</button>
        </form>
      `
    }

    if (mode === 'enroll') {
      return `
        <p class="auth-eyebrow">Optional security</p>
        <h2 id="auth-title">Set up two-factor authentication</h2>
        <p class="auth-intro">Scan this QR code with an authenticator app, then enter its 6-digit code.</p>
        <img id="mfa-qr" class="mfa-qr" alt="Authenticator setup QR code" />
        <p class="field-hint">Can’t scan it? Enter this setup key manually:</p>
        <code id="mfa-secret" class="mfa-secret"></code>
        <form class="auth-form">
          <label>6-digit code<input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required /></label>
          <button class="btn btn-primary auth-submit" type="submit">Enable two-factor authentication</button>
        </form>
      `
    }

    return `
      <p class="auth-eyebrow">Your P chat account</p>
      <h2 id="auth-title">Account and security</h2>
      <p class="auth-intro" id="account-identity"></p>
      <div class="security-card">
        <strong>Two-factor authentication</strong>
        <span id="mfa-status">Checking your security settings…</span>
        <div class="security-actions" id="mfa-actions"></div>
      </div>
      <button class="btn btn-secondary auth-submit" type="button" data-auth-action="signout">Sign out</button>
    `
  }

  async function submitForm(form: HTMLFormElement) {
    if (!supabase) return
    const formData = new FormData(form)
    const submitButton = form.querySelector<HTMLButtonElement>('[type="submit"]')
    if (submitButton) {
      submitButton.disabled = true
      submitButton.textContent = 'Please wait…'
    }
    setMessage('')
    const authActions = modalRoot!.querySelector<HTMLDivElement>('#auth-actions')
    if (authActions) authActions.innerHTML = ''

    try {
      if (authMode === 'signup') {
        const username = String(formData.get('username') ?? '').trim().toLowerCase()
        const email = String(formData.get('email') ?? '').trim()
        const password = String(formData.get('password') ?? '')
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: window.location.origin,
          },
        })
        if (error) throw error
        if (data.session) {
          activeUser = data.user
          updateAuthButtons()
          showModal('account')
          setMessage('Account created. Your email has been verified.', 'success')
        } else {
          setMessage('Account created. Check your email for the verification link before signing in.', 'success')
          form.reset()
        }
        return
      }

      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: String(formData.get('email') ?? '').trim(),
          password: String(formData.get('password') ?? ''),
        })
        if (error) throw error
        activeUser = data.user
        updateAuthButtons()

        const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assuranceError) {
          await supabase.auth.signOut()
          showModal('login')
          throw assuranceError
        }
        if (assurance.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
          if (factorsError) {
            await supabase.auth.signOut()
            showModal('login')
            throw factorsError
          }
          const factor = factors.totp.find((entry) => entry.status === 'verified')
          if (!factor) {
            await supabase.auth.signOut()
            showModal('login')
            throw new Error('Your account requires two-factor authentication, but no verified authenticator is available.')
          }
          mfaFactorId = factor.id
          showModal('mfa')
          return
        }

        showModal('account')
        setMessage('You are signed in.', 'success')
        return
      }

      if (authMode === 'recovery') {
        const { error } = await supabase.auth.resetPasswordForEmail(
          String(formData.get('email') ?? '').trim(),
          { redirectTo: `${window.location.origin}/` },
        )
        if (error) throw error
        setMessage('If an account exists for that address, a password recovery link has been sent.', 'success')
        form.reset()
        return
      }

      if (authMode === 'new-password') {
        const { error } = await supabase.auth.updateUser({
          password: String(formData.get('password') ?? ''),
        })
        if (error) throw error
        setMessage('Your password has been updated.', 'success')
        showModal('account')
        setMessage('Your password has been updated.', 'success')
        return
      }

      if (authMode === 'mfa' || authMode === 'enroll') {
        const code = String(formData.get('code') ?? '').trim()
        const factorId = mfaFactorId
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
        if (challengeError) throw challengeError
        const { error } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code,
        })
        if (error) throw error

        if (authMode === 'enroll') {
          showModal('account')
          setMessage('Two-factor authentication is now enabled.', 'success')
        } else {
          showModal('account')
          setMessage('Two-factor authentication verified. You are signed in.', 'success')
        }
        return
      }
    } catch (error) {
      setMessage(authErrorMessage(error), 'error')
    } finally {
      if (submitButton?.isConnected) {
        submitButton.disabled = false
        submitButton.textContent = submitLabel(authMode)
      }
    }
  }

  function submitLabel(mode: AuthMode) {
    if (mode === 'signup') return 'Create account'
    if (mode === 'login') return 'Sign in'
    if (mode === 'recovery') return 'Send recovery link'
    if (mode === 'new-password') return 'Update password'
    if (mode === 'mfa') return 'Verify and sign in'
    if (mode === 'enroll') return 'Enable two-factor authentication'
    return 'Continue'
  }

  function authErrorMessage(error: unknown) {
    if (typeof error === 'object' && error !== null) {
      const status = 'status' in error ? error.status : undefined
      const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
      if (status === 429 || /rate.?limit|too many requests/i.test(message)) {
        return 'Supabase is temporarily limiting sign-up requests. Wait a few minutes before trying again, and avoid clicking Create account repeatedly. If it continues, check Supabase Auth rate limits and email/SMTP settings.'
      }
      if (authMode === 'recovery' && /already.?confirmed|email.?confirmed|user.?confirmed/i.test(message)) {
        return 'This account is already confirmed. Return to sign in; if you do not know the password, use the password reset option.'
      }
      if (/user already registered|already been registered/i.test(message)) {
        return 'An account may already exist for this email. Try signing in or use “Forgot your password?” to recover access.'
      }
      if (/invalid login credentials|email not confirmed/i.test(message)) {
        return 'We could not sign you in. Check that you are using the correct email and password. If this is your new account, confirm your email first. If you forgot the password, use “Forgot your password?” to reset it.'
      }
    }
    return error instanceof Error ? error.message : 'The request could not be completed. Please try again.'
  }

  async function resendConfirmation(button: HTMLButtonElement) {
    if (!supabase) return
    const emailInput = modalRoot!.querySelector<HTMLInputElement>('.auth-form input[name="email"]')
    const email = emailInput?.value.trim()
    if (!email) {
      setMessage('Enter your email address first, then choose Resend confirmation email.', 'error')
      emailInput?.focus()
      return
    }

    button.disabled = true
    button.textContent = 'Sending…'
    setMessage('')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw error
      setMessage('If this address has an unconfirmed P chat account, a new confirmation email has been sent. Check your inbox and spam folder.', 'success')
    } catch (error) {
      setMessage(authErrorMessage(error), 'error')
      if (button.isConnected) {
        button.disabled = false
        button.textContent = 'Resend confirmation email'
      }
    }
  }

  async function beginEnrollment() {
    if (!supabase || !activeUser) return
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'P chat authenticator',
      })
      if (error) throw error
      mfaFactorId = data.id
      enrollmentQrCode = data.totp.qr_code
      enrollmentSecret = data.totp.secret
      showModal('enroll')
    } catch (error) {
      setMessage(authErrorMessage(error), 'error')
    }
  }

  async function disableMfa() {
    if (!supabase || !activeUser || !window.confirm('Turn off two-factor authentication for this account?')) return
    try {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) throw error
      const factor = data.totp.find((entry) => entry.status === 'verified')
      if (!factor) throw new Error('No verified authenticator factor was found.')
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
      if (unenrollError) throw unenrollError
      showModal('account')
      setMessage('Two-factor authentication has been turned off.', 'success')
    } catch (error) {
      setMessage(authErrorMessage(error), 'error')
    }
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      setMessage(error.message, 'error')
      return
    }
    activeUser = null
    updateAuthButtons()
    closeModal()
  }

  function updateAuthButtons() {
    const navActions = app.querySelector<HTMLElement>('.nav-actions')
    if (!navActions) return
    navActions.innerHTML = activeUser
      ? '<button class="btn btn-secondary" type="button" data-auth-open="account">Account</button>'
      : '<button class="btn btn-secondary" type="button" data-auth-open="login">Log in</button><button class="btn btn-primary" type="button" data-auth-open="signup">Join now</button>'

    if (authMode === 'account' && modalRoot!.isConnected) {
      const identity = modalRoot!.querySelector<HTMLElement>('#account-identity')
      if (identity && activeUser) {
        identity.textContent = `${String(activeUser.user_metadata.username ?? 'P chat member')} · ${activeUser.email ?? ''}`
      }
      void updateMfaStatus()
    }
  }

  async function updateMfaStatus() {
    if (!supabase || !activeUser) return
    const status = modalRoot!.querySelector<HTMLElement>('#mfa-status')
    const actions = modalRoot!.querySelector<HTMLElement>('#mfa-actions')
    if (!status || !actions) return
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) {
      status.textContent = error.message
      return
    }
    const verifiedFactor = data.totp.find((factor) => factor.status === 'verified')
    status.textContent = verifiedFactor
      ? 'Enabled · authenticator app'
      : 'Not enabled · add an authenticator app for extra account protection'
    actions.innerHTML = verifiedFactor
      ? '<button class="text-button danger" type="button" data-auth-action="disable-mfa">Turn off two-factor authentication</button>'
      : '<button class="text-button" type="button" data-auth-action="enroll">Set up authenticator app</button>'
  }

  function setMessage(text: string, kind: 'success' | 'error' | '' = '') {
    const message = modalRoot!.querySelector<HTMLElement>('#auth-message')
    if (!message) return
    message.textContent = text
    message.className = kind ? `auth-message ${kind}` : 'auth-message'
  }

  function showAuthError(text: string) {
    if (authMode === 'account') setMessage(text, 'error')
  }

  function closeModal() {
    modalRoot!.innerHTML = ''
    if (previousFocus?.isConnected) previousFocus.focus()
    previousFocus = null
  }
}

export { setupAuth }
