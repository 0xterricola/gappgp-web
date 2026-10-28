import { URDecoder } from '@ngraveio/bc-ur'
import jsQR from 'jsqr'
import { validateCertificate } from './certificate'
import type { CertificateInfo } from './certificate'

export function setupCertificateUI() {
  document.querySelector('footer')!.insertAdjacentHTML(
    'beforebegin',
    `
    <section>
      <h2>Receive certificate</h2>
      <p>Scan the response QR displayed by Keycard Shell,
      or paste its UR:BYTES data.</p>

      <button id="start-camera">Scan response QR</button>
      <button id="stop-camera" class="secondary">
        Stop camera
      </button>
      <video id="scan-video" autoplay muted playsinline hidden></video>

      <label for="response-ur">Response UR</label>
      <textarea id="response-ur" rows="4"
        placeholder="ur:bytes/..."></textarea>
      <button id="decode-response" class="secondary">
        Decode response
      </button>

      <h2>Validate existing certificate</h2>
      <p>Select a public .asc, .pgp, or .gpg certificate.
      The file is processed locally.</p>

      <input id="certificate-file" type="file"
        accept=".asc,.pgp,.gpg">

      <p id="certificate-status" role="status"></p>
    </section>

    <section id="certificate-result" hidden>
      <h2>Certificate verified</h2>
      <p id="certificate-identity"></p>
      <p><strong>Fingerprint</strong></p>
      <p id="certificate-fingerprint"></p>
      <p id="certificate-created"></p>
      <button id="download-certificate">
        Download public certificate (.asc)
      </button>
      <p>Valid self-certification does not prove hardware
      possession or email ownership.</p>
    </section>
    `
  )

  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T

  const status = $<HTMLElement>('certificate-status')
  const result = $<HTMLElement>('certificate-result')
  const video = $<HTMLVideoElement>('scan-video')
  const responseText = $<HTMLTextAreaElement>('response-ur')

  let decoder = new URDecoder()
  let current: CertificateInfo | null = null
  let stream: MediaStream | null = null
  let frameID = 0
  let busy = false

  const showError = (error: unknown) => {
    status.textContent = error instanceof Error
      ? error.message : String(error)
  }

  function display(info: CertificateInfo) {
    current = info
    $('certificate-identity').textContent = info.userID
    $('certificate-fingerprint').textContent = info.fingerprint
    $('certificate-created').textContent =
      `Created: ${info.created}`

    result.hidden = false
    status.textContent = 'Public certificate validated successfully.'
  }

  function stopCamera() {
    cancelAnimationFrame(frameID)
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    video.srcObject = null
    video.hidden = true
  }

  async function receiveUR(text: string) {
    const parts = text.trim().split(/\s+/).filter(Boolean)
    if (!parts.length) {
      throw new Error('No response UR provided.')
    }

    for (const part of parts) {
      if (!/^ur:bytes\//i.test(part)) {
        throw new Error('Expected UR:BYTES response.')
      }

      decoder.receivePart(part)

      if (!decoder.isComplete()) {
        status.textContent = 'Response frame received. Continue scanning.'
        continue
      }

      if (!decoder.isSuccess()) {
        throw new Error('Invalid UR response.')
      }

      const ur = decoder.resultUR()
      if (ur.type !== 'bytes') {
        throw new Error('Unexpected UR type.')
      }

      const bytes = new Uint8Array(ur.decodeCBOR())

      const requestVisible =
        !$<HTMLElement>('result').hidden
      const expectedUID = requestVisible
        ? $('identity').textContent ?? undefined
        : undefined

      const info = await validateCertificate(bytes, expectedUID)
      display(info)
      decoder = new URDecoder()
      stopCamera()
      return
    }
  }

  $('decode-response').addEventListener('click', async () => {
    result.hidden = true
    current = null
    try {
      await receiveUR(responseText.value)
    } catch (error) {
      decoder = new URDecoder()
      showError(error)
    }
  })

  $<HTMLInputElement>('certificate-file')
    .addEventListener('change', async event => {
      result.hidden = true
      current = null

      try {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        if (!file) return
        if (file.size > 131072) {
          throw new Error('Certificate file exceeds 128 KiB.')
        }

        const bytes = new Uint8Array(await file.arrayBuffer())
        const isArmored = new TextDecoder()
          .decode(bytes.subarray(0, 48))
          .startsWith('-----BEGIN PGP')

        const source = isArmored
          ? new TextDecoder().decode(bytes)
          : bytes

        display(await validateCertificate(source))
      } catch (error) {
        showError(error)
      }
    })

  $('download-certificate').addEventListener('click', () => {
    if (!current) return

    const blob = new Blob([current.armored], {
      type: 'application/pgp-keys',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download =
      `gappgp-${current.fingerprint.slice(-16)}.asc`
    link.click()

    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })

  async function scanFrame() {
    if (!stream) return

    if (!busy && video.readyState >= 2) {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d', {
        willReadFrequently: true,
      })

      if (context) {
        context.drawImage(video, 0, 0)
        const image = context.getImageData(
          0, 0, canvas.width, canvas.height
        )
        const qr = jsQR(image.data, image.width, image.height)

        if (qr) {
          busy = true
          try {
            await receiveUR(qr.data)
          } catch (error) {
            decoder = new URDecoder()
            showError(error)
          } finally {
            busy = false
          }
        }
      }
    }

    if (stream) {
      frameID = requestAnimationFrame(scanFrame)
    }
  }

  $('start-camera').addEventListener('click', async () => {
    try {
      stopCamera()
      decoder = new URDecoder()
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })

      video.srcObject = stream
      video.hidden = false
      await video.play()
      status.textContent = 'Point camera at Keycard Shell QR.'
      frameID = requestAnimationFrame(scanFrame)
    } catch (error) {
      stopCamera()
      showError(error)
    }
  })

  $('stop-camera').addEventListener('click', stopCamera)
  window.addEventListener('pagehide', stopCamera)
}
