export function setupOnboardingUI() {
  const main = document.querySelector('main')!
  const header = main.querySelector('header')!
  const footer = main.querySelector('footer')!

  const identitySection = main.querySelector('section')!
  const requestSection = document.getElementById('result')!
  const receiveSection = document
    .getElementById('response-ur')!
    .closest('section')!

  const uploadInput =
    document.getElementById('certificate-file')!
  const uploadDescription = uploadInput.previousElementSibling!
  const uploadHeading = uploadDescription.previousElementSibling!

  if (
    uploadHeading.textContent?.trim() !==
    'Validate existing certificate'
  ) {
    throw new Error('Unexpected certificate UI structure.')
  }

  const certificateStatus =
    document.getElementById('certificate-status')!
  const certificateResult =
    document.getElementById('certificate-result')!

  document.title = 'GapPGP | OpenPGP for Keycard Shell'

  header.insertAdjacentHTML('afterend', `
    <section class="intro-panel">
      <div class="intro-label">UNDERSTANDING OPENPGP</div>
      <h2>Your cryptographic identity, secured by hardware.</h2>
      <p>
        OpenPGP lets you digitally sign messages and documents.
        Others can verify that your key signed something and
        that the signed content hasn't changed.
      </p>
      <p>
        Keycard Shell keeps your private signing key on the
        device. GapPGP helps applications communicate with
        the hardware through QR codes.
      </p>
      <div class="security-note">
        <strong>Public certificate</strong>
        <span>Share it so others can verify your signatures.</span>
        <strong>Private key</strong>
        <span>Keep it on your Keycard Shell.</span>
      </div>
      <p class="important-note">
        A certificate does not independently prove that
        someone owns the name or email address it contains.
      </p>
    </section>
  `)

  identitySection.insertAdjacentHTML('afterbegin', `
    <p class="step-index">STEP 01 / CREATE IDENTITY</p>
  `)

  identitySection.insertAdjacentHTML('beforeend', `
    <p class="why-text">
      <strong>Why?</strong> Your name and email become the
      identity associated with your public signing key.
      They are not independently verified.
    </p>
  `)

  requestSection.insertAdjacentHTML('beforeend', `
    <p class="why-text">
      The QR transfers your request to Keycard Shell.
      Review the details on the device before approval.
    </p>
  `)

  receiveSection.insertAdjacentHTML('afterbegin', `
    <p class="step-index">STEP 02 / RECEIVE CERTIFICATE</p>
  `)

  receiveSection.insertAdjacentHTML('beforeend', `
    <p class="why-text">
      <strong>Why?</strong> Your public certificate allows
      other people and applications to verify signatures
      made with your corresponding private key.
      After verification, download and save your public
      certificate (.asc) so you can share it later.
    </p>
  `)

  const uploadSection = document.createElement('section')
  uploadSection.id = 'certificate-tools-section'

  const uploadLabel = document.createElement('label')
  uploadLabel.htmlFor = 'certificate-file'
  uploadLabel.textContent = 'Public certificate file'

  uploadSection.append(
    uploadHeading,
    uploadDescription,
    uploadLabel,
    uploadInput
  )

  uploadSection.insertAdjacentHTML('beforeend', `
    <div class="security-note">
      <strong>What gets checked?</strong>
      <span>
        OpenPGP certificate validity, including the
        supported cryptographic integrity checks.
      </span>
      <strong>What doesn't this prove?</strong>
      <span>
        Current possession of the private key, hardware
        origin, or ownership of the listed email address.
      </span>
    </div>
    <p class="important-note">
      Upload public certificates only. Never upload
      private or secret key files.
    </p>
  `)

  const startPanel = document.createElement('div')
  startPanel.id = 'start-panel'
  startPanel.append(
    identitySection,
    requestSection,
    receiveSection
  )

  const toolsPanel = document.createElement('div')
  toolsPanel.id = 'tools-panel'
  toolsPanel.hidden = true
  toolsPanel.append(uploadSection)

  const feedback = document.createElement('div')
  feedback.id = 'certificate-feedback'
  feedback.append(certificateStatus, certificateResult)

  const tabs = document.createElement('nav')
  tabs.className = 'mode-tabs'
  tabs.setAttribute('aria-label', 'GapPGP tools')
  tabs.innerHTML = `
    <button id="mode-start" type="button"
      aria-pressed="true" aria-controls="start-panel">
      Get Started
    </button>
    <button id="mode-tools" type="button"
      aria-pressed="false" aria-controls="tools-panel">
      Certificate Tools
    </button>
  `

  const uses = document.createElement('section')
  uses.className = 'use-cases'
  uses.innerHTML = `
    <h2>What can I do with OpenPGP?</h2>

    <div class="use-case">
      <span class="use-icon">✉</span>
      <div>
        <strong>Sign emails</strong>
        <p>
          Let recipients verify your email signatures.
          GapPGP Thunderbird is an experimental integration
          for hardware-backed email signing.
        </p>
      </div>
    </div>

    <div class="use-case">
      <span class="use-icon">✓</span>
      <div>
        <strong>Sign messages and documents</strong>
        <p>
          Create signatures that compatible OpenPGP
          software can independently verify.
        </p>
      </div>
    </div>

    <div class="use-case">
      <span class="use-icon">⌁</span>
      <div>
        <strong>Prove control of your signing key</strong>
        <p>
          Sign a unique challenge and verify it against
          your public certificate. This is a planned
          GapPGP Web feature.
        </p>
      </div>
    </div>
  `

  header.nextElementSibling!.after(
    tabs,
    startPanel,
    toolsPanel,
    feedback,
    uses
  )

  const startButton =
    document.getElementById('mode-start') as HTMLButtonElement
  const toolsButton =
    document.getElementById('mode-tools') as HTMLButtonElement

  function setMode(mode: 'start' | 'tools') {
    const isStart = mode === 'start'
    startPanel.hidden = !isStart
    toolsPanel.hidden = isStart

    startButton.setAttribute(
      'aria-pressed', String(isStart)
    )
    toolsButton.setAttribute(
      'aria-pressed', String(!isStart)
    )

    certificateStatus.textContent = ''
    ;(certificateResult as HTMLElement).hidden = true
  }

  startButton.addEventListener(
    'click', () => setMode('start')
  )
  toolsButton.addEventListener(
    'click', () => setMode('tools')
  )

  footer.insertAdjacentHTML('beforebegin', `
    <p class="footer-note">
      GapPGP is experimental software.
      OpenPGP signing is distinct from encryption;
      encryption is not implemented in this web app.
    </p>
  `)
}
