import * as openpgp from 'openpgp'
import { URDecoder } from '@ngraveio/bc-ur'
import jsQR from 'jsqr'
import { validateCertificate } from './certificate'
import type { CertificateInfo } from './certificate'

type Challenge = {
  certificate: CertificateInfo
  message: string
  signTime: number
  issuedAt: number
}

export function setupSignResponseUI() {
  const section = document.getElementById('sign-challenge')!
  section.insertAdjacentHTML('beforeend', `
    <div id="sign-response" hidden>
      <h3>Verify your Keycard signature</h3>
      <p>
        After approving the signing request, scan the
        response QR displayed on Keycard Shell.
        Keep it visible until verification completes.
      </p>

      <button id="signature-scan">Scan signature QR</button>
      <button id="signature-stop" class="secondary">
        Stop camera
      </button>
      <video id="signature-video" autoplay muted playsinline hidden></video>

      <p id="signature-scanner-status" role="status"></p>

      <label for="signature-ur">Or paste signature response</label>
      <textarea id="signature-ur" rows="4"
        placeholder="ur:bytes/..."></textarea>
      <button id="signature-decode" class="secondary">
        Verify pasted response
      </button>

      <div id="signature-success" hidden>
        <h3>✓ Signing key possession verified</h3>
        <p id="signature-details"></p>
        <p>
          The signature matches this session's challenge
          and the selected OpenPGP public certificate.
        </p>
        <p>
          This proves control of the corresponding private
          signing key at signing time. It does not independently
          prove hardware origin or email ownership.
        </p>
      </div>
    </div>
  `)

  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T

  const panel = $<HTMLElement>('sign-response')
  const video = $<HTMLVideoElement>('signature-video')
  const status = $<HTMLElement>('signature-scanner-status')
  const input = $<HTMLTextAreaElement>('signature-ur')
  const success = $<HTMLElement>('signature-success')
  const details = $<HTMLElement>('signature-details')

  let challenge: Challenge | null = null
  let decoder = new URDecoder()
  let frames = new Set<string>()
  let stream: MediaStream | null = null
  let frameID = 0
  let revision = 0

  function stopCamera() {
    cancelAnimationFrame(frameID)
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    video.srcObject = null
    video.hidden = true
  }

  function reset() {
    revision++
    stopCamera()
    decoder = new URDecoder()
    frames.clear()
    challenge = null
    panel.hidden = true
    success.hidden = true
    input.value = ''
    status.textContent = ''
  }

  document.addEventListener('gappgp:challenge-reset', reset)

  document.addEventListener('gappgp:challenge-ready', event => {
    reset()
    challenge = (event as CustomEvent<Challenge>).detail
    panel.hidden = false
    status.textContent =
      'Challenge ready. Approve signing on Keycard Shell, then scan the response.'
  })

  async function verifySignature(bytes: Uint8Array) {
    const active = challenge
    const currentRevision = revision

    if (!active) throw new Error('Generate a challenge first.')
    if (bytes.length < 1 || bytes.length > 8192) {
      throw new Error('Invalid detached signature size.')
    }
    if (Date.now() - active.issuedAt > 10 * 60 * 1000) {
      throw new Error('Challenge expired. Generate a new one.')
    }

    const validated = await validateCertificate(
      active.certificate.armored
    )
    if (validated.fingerprint !== active.certificate.fingerprint) {
      throw new Error('Signing certificate changed.')
    }

    const key = await openpgp.readKey({
      armoredKey: validated.armored,
    })

    const signature = await openpgp.readSignature({
      binarySignature: bytes,
    })

    const packets = (signature as unknown as {
      packets: Array<{
        version: number
        signatureType: number
        publicKeyAlgorithm: number
        hashAlgorithm: number
        created: Date
      }>
    }).packets

    if (packets?.length !== 1) {
      throw new Error('Expected one detached OpenPGP signature.')
    }

    const packet = packets[0]
    if (packet.version !== 4 ||
        packet.signatureType !== 1 ||
        packet.publicKeyAlgorithm !== 19 ||
        packet.hashAlgorithm !== 8) {
      throw new Error('Unexpected OpenPGP signature format.')
    }

    const signatureTime = Math.floor(
      packet.created.getTime() / 1000
    )
    if (signatureTime !== active.signTime) {
      throw new Error('Signature timestamp does not match the challenge.')
    }

    const config = {
      rejectCurves: new Set(
        [...openpgp.config.rejectCurves].filter(
          curve => curve !== openpgp.enums.curve.secp256k1
        )
      ),
    }

    const message = await openpgp.createMessage({
      text: active.message,
    })

    const result = await openpgp.verify({
      message,
      signature,
      verificationKeys: key,
      config,
    })

    if (result.signatures.length !== 1) {
      throw new Error('Expected exactly one signature.')
    }

    const verification = result.signatures[0]
    await verification.verified

    if (verification.keyID.toHex() !== key.getKeyID().toHex()) {
      throw new Error('Signature belongs to a different key.')
    }

    if (currentRevision !== revision || challenge !== active) {
      throw new Error('Challenge changed during verification.')
    }

    stopCamera()
    success.hidden = false
    details.textContent =
      `Verified fingerprint: ${validated.fingerprint}`
    status.textContent = '✓ Cryptographic signature verification passed.'
    status.dataset.state = 'complete'
  }

  async function receive(text: string) {
    if (!challenge) throw new Error('No active challenge.')
    if (text.length > 65536) {
      throw new Error('Response is too large.')
    }

    for (const part of text.trim().split(/\s+/).filter(Boolean)) {
      if (!/^ur:bytes\//i.test(part)) {
        throw new Error('Expected UR:BYTES signature response.')
      }

      frames.add(part)
      decoder.receivePart(part)

      if (!decoder.isComplete()) {
        status.textContent =
          `QR detected · ${frames.size} distinct frame(s) received. Keep scanning.`
        continue
      }

      if (!decoder.isSuccess()) {
        throw new Error('Signature response decoding failed.')
      }

      const ur = decoder.resultUR()
      if (ur.type !== 'bytes') {
        throw new Error('Unexpected response type.')
      }

      const signatureBytes = new Uint8Array(ur.decodeCBOR())
      await verifySignature(signatureBytes)
      return
    }
  }

  async function processResponse(text: string) {
    try {
      await receive(text)
    } catch (error) {
      decoder = new URDecoder()
      frames.clear()
      success.hidden = true
      status.dataset.state = 'error'
      status.textContent =
        error instanceof Error ? error.message : String(error)
    }
  }

  $<HTMLButtonElement>('signature-decode')
    .addEventListener('click', () => {
      void processResponse(input.value)
    })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  })

  async function scanFrame() {
    if (!stream) return

    if (context && video.readyState >= 2 &&
        video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0)

      const image = context.getImageData(
        0, 0, canvas.width, canvas.height
      )
      const qr = jsQR(image.data, image.width, image.height)

      if (qr) {
        await processResponse(qr.data)
      }
    }

    if (stream) frameID = requestAnimationFrame(scanFrame)
  }

  $<HTMLButtonElement>('signature-scan')
    .addEventListener('click', async () => {
      try {
        stopCamera()
        decoder = new URDecoder()
        frames.clear()
        success.hidden = true
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        video.srcObject = stream
        video.hidden = false
        await video.play()
        status.dataset.state = 'waiting'
        status.textContent =
          'Camera ready. Hold the Keycard response QR in view.'
        frameID = requestAnimationFrame(scanFrame)
      } catch (error) {
        stopCamera()
        status.textContent =
          error instanceof Error ? error.message : String(error)
      }
    })

  $<HTMLButtonElement>('signature-stop')
    .addEventListener('click', stopCamera)

  window.addEventListener('pagehide', stopCamera)
}
