export function setupProgressUI() {
  const start = document.getElementById('start-panel')!
  const tools = document.getElementById('tools-panel')!
  const name = document.getElementById('name') as HTMLInputElement
  const email = document.getElementById('email') as HTMLInputElement
  const request = document.getElementById('result')!
  const receive = document.getElementById('response-ur')!
    .closest('section') as HTMLElement
  const certificate = document.getElementById('certificate-result')!

  let requestReady = false
  let responseVerified = false
  let downloadStarted = false
  let uploadVerified = false

  const stages = [
    ['Identity details', 'Enter a valid name and email'],
    ['Identity request', 'Generate the QR request'],
    ['Public certificate checked', 'Validate the certificate returned by Keycard Shell'],
    ['Public certificate export', 'Download the validated certificate'],
  ]

  const progress = document.createElement('section')
  progress.className = 'setup-progress'
  progress.innerHTML = `
    <div class="progress-header">
      <h2>Your setup progress</h2>
      <span id="progress-count">0 / 4</span>
    </div>
    <ol class="progress-steps">
      ${stages.map(([title, description], index) => `
        <li class="progress-step" data-progress-step="${index}">
          <span class="progress-marker">${index + 1}</span>
          <div>
            <strong>${title}</strong>
            <p>${description}</p>
          </div>
        </li>
      `).join('')}
    </ol>
    <p id="progress-next" role="status" aria-live="polite"></p>
  `
  start.prepend(progress)

  const toolStatus = document.createElement('div')
  toolStatus.className = 'tool-validation'
  toolStatus.setAttribute('role', 'status')
  toolStatus.setAttribute('aria-live', 'polite')
  tools.prepend(toolStatus)

  const markers = [...progress.querySelectorAll<HTMLElement>(
    '.progress-step'
  )]

  const next = document.getElementById('progress-next')!
  const count = document.getElementById('progress-count')!

  function detailsValid(): boolean {
    const n = name.value.trim()
    const e = email.value.trim()
    const uid = `${n} <${e}>`

    return Boolean(
      n && e &&
      email.checkValidity() &&
      !/[<>]/.test(n) &&
      /^[\x20-\x7e]+$/.test(uid) &&
      new TextEncoder().encode(uid).length <= 255
    )
  }

  function render() {
    const complete = [
      detailsValid(),
      requestReady,
      responseVerified,
      downloadStarted,
    ]

    const active = complete.indexOf(false)
    count.textContent = `${complete.filter(Boolean).length} / 4`

    markers.forEach((element, index) => {
      const done = complete[index]
      element.classList.toggle('is-done', done)
      element.classList.toggle('is-active', index === active)

      element.querySelector('.progress-marker')!.textContent =
        done ? '✓' : String(index + 1)
    })

    if (!complete[0]) {
      next.textContent = 'Next: enter your name and email.'
    } else if (!requestReady) {
      next.textContent = 'Next: generate your identity QR.'
    } else if (!responseVerified) {
      next.textContent =
        'Next: scan the QR with Keycard Shell, approve on the device, then scan its response.'
    } else if (!downloadStarted) {
      next.textContent =
        'Certificate checks passed. Next: download your public certificate (.asc).'
    } else {
      next.textContent =
        'Download started. Your public certificate is ready to share.'
    }

    receive.hidden = !requestReady

    toolStatus.classList.toggle('is-done', uploadVerified)
    toolStatus.textContent = uploadVerified
      ? '✓ Public certificate passed validation.'
      : '○ Upload a public certificate to check its integrity.'
  }

  function reset() {
    requestReady = false
    responseVerified = false
    downloadStarted = false
    request.hidden = true
    certificate.hidden = true
    render()
  }

  for (const input of [name, email]) {
    input.addEventListener('input', () => {
      if (requestReady) {
        document.dispatchEvent(new Event('gappgp:request-reset'))
      }
      render()
    })
  }

  document.addEventListener('gappgp:request-reset', reset)

  document.addEventListener('gappgp:request-ready', () => {
    requestReady = true
    responseVerified = false
    downloadStarted = false
    render()
    request.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  document.addEventListener('gappgp:response-verified', () => {
    if (!requestReady) return
    responseVerified = true
    render()
    certificate.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })

  document.addEventListener('gappgp:download-started', event => {
    const source = (event as CustomEvent<{ source: string }>).detail?.source
    if (source === 'response' && responseVerified) {
      downloadStarted = true
    }
    render()
  })

  document.addEventListener('gappgp:upload-started', () => {
    uploadVerified = false
    render()
  })

  document.addEventListener('gappgp:upload-verified', () => {
    uploadVerified = true
    render()
  })

  document.addEventListener('gappgp:upload-failed', () => {
    uploadVerified = false
    render()
  })

  render()
}
