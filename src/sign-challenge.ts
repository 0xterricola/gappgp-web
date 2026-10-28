import { encode } from 'cbor2'
import { UR, UREncoder, URDecoder } from '@ngraveio/bc-ur'
import { Buffer } from 'buffer'
import * as QRCode from 'qrcode'
import type { CertificateInfo } from './certificate'

export function setupSignChallengeUI() {
  const tools = document.getElementById('tools-panel')
  if (!tools) throw new Error('Certificate Tools panel missing')

  const section = document.createElement('section')
  section.id = 'sign-challenge'
  section.innerHTML = `
    <h2>Prove control of your signing key</h2>
    <p>
      After validating your public certificate, generate
      a unique challenge for Keycard Shell to sign.
    </p>
    <p>
      A valid signature can prove control of the
      corresponding private key. It does not establish
      email ownership or independently attest hardware origin.
    </p>

    <p id="sign-status" role="status">
      First, upload and validate a public certificate above.
    </p>

    <button id="sign-generate" type="button" disabled>
      Generate signing challenge QR
    </button>

    <div id="sign-request" hidden>
      <h3>Sign with Keycard Shell</h3>
      <p>
        Scan this QR using Extras → OpenPGP on your
        Keycard Shell. Review the request and approve it.
      </p>
      <img id="sign-qr" alt="OpenPGP signing challenge QR">
      <label for="sign-ur">Signing request (diagnostic)</label>
      <textarea id="sign-ur" rows="4" readonly></textarea>
      <p id="sign-fingerprint"></p>
      <p>
        Keep the response QR displayed on your Keycard.
        Signature-response verification is the next
        implementation step.
      </p>
    </div>
  `
  tools.append(section)

  const button = document.getElementById(
    'sign-generate'
  ) as HTMLButtonElement

  const status = document.getElementById('sign-status')!
  const requestPanel = document.getElementById('sign-request')!
  const qr = document.getElementById('sign-qr') as HTMLImageElement
  const fingerprint = document.getElementById('sign-fingerprint')!

  let certificate: CertificateInfo | null = null

  function clearCertificate() {
    document.dispatchEvent(new Event('gappgp:challenge-reset'))
    certificate = null
    button.disabled = true
    requestPanel.hidden = true
    status.textContent =
      'Upload and validate your public certificate first.'
  }

  function acceptCertificate(event: Event) {
    const info = (event as CustomEvent<CertificateInfo>).detail
    if (!info?.fingerprint || !info?.armored || !info?.created) {
      return
    }

    certificate = info
    button.disabled = false
    requestPanel.hidden = true
    status.textContent =
      `Certificate validated: ${info.fingerprint}`
  }

  document.addEventListener(
    'gappgp:upload-verified', acceptCertificate
  )
  document.addEventListener(
    'gappgp:response-verified', acceptCertificate
  )
  document.addEventListener(
    'gappgp:upload-started', clearCertificate
  )
  document.addEventListener(
    'gappgp:request-reset', clearCertificate
  )

  button.addEventListener('click', async () => {
    if (!certificate) return

    requestPanel.hidden = true
    document.dispatchEvent(new Event('gappgp:challenge-reset'))

    try {
      const keyCreationTime = Math.floor(
        new Date(certificate.created).getTime() / 1000
      )
      const signatureCreationTime = Math.floor(Date.now() / 1000)

      if (
        !Number.isInteger(keyCreationTime) ||
        keyCreationTime <= 0 ||
        signatureCreationTime < keyCreationTime ||
        signatureCreationTime > 0xffffffff
      ) {
        throw new Error('Invalid signing timestamps.')
      }

      const nonce = new Uint8Array(16)
      crypto.getRandomValues(nonce)

      const nonceHex = Array.from(nonce)
        .map(value => value.toString(16).padStart(2, '0'))
        .join('')

      const message = `GapPGP verify:${nonceHex}`

      const messageBytes = new TextEncoder().encode(message)

      if (messageBytes.length === 0 || messageBytes.length > 255) {
        throw new Error('Challenge exceeds firmware message limit.')
      }

      const request = new Map<number, number | Uint8Array>([
        [1, 1],
        [2, 2],
        [3, messageBytes],
        [4, keyCreationTime],
        [5, signatureCreationTime],
      ])

      const cbor = encode(request)
      const payload = Buffer.from(cbor)
      const length = payload.length

      if (length > 65535) {
        throw new Error('Signing request too large.')
      }

      const prefix = length < 24
        ? Buffer.from([0x40 | length])
        : length <= 255
          ? Buffer.from([0x58, length])
          : Buffer.from([0x59, length >> 8, length & 255])

      const ur = new UR(
        Buffer.concat([prefix, payload]),
        'bytes'
      )
      const encoder = new UREncoder(ur, 400, 0)
      const urText = encoder.nextPart()
      const urField = document.getElementById('sign-ur') as HTMLTextAreaElement
      urField.value = urText

      const decoder = new URDecoder()
      decoder.receivePart(urText)

      if (
        !decoder.isComplete() ||
        !decoder.isSuccess() ||
        !Buffer.from(decoder.resultUR().decodeCBOR())
          .equals(Buffer.from(cbor))
      ) {
        throw new Error('Signing request round-trip check failed.')
      }

      qr.src = await QRCode.toDataURL(urText, {
        scale: 6,
        margin: 4,
        errorCorrectionLevel: 'M',
      })

      fingerprint.textContent =
        `Certificate fingerprint: ${certificate.fingerprint}`

      requestPanel.hidden = false
      document.dispatchEvent(new CustomEvent('gappgp:challenge-ready', {
        detail: {
          certificate: { ...certificate },
          message,
          signTime: signatureCreationTime,
          issuedAt: Date.now(),
        },
      }))
      status.textContent =
        `Signing request ready (${messageBytes.length} message bytes). ` +
        'Scan with Keycard Shell. Signature verification is still pending.'
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : String(error)
    }
  })
}
