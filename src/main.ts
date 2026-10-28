import './style.css'
import { encode } from 'cbor2'
import { UR, UREncoder, URDecoder } from '@ngraveio/bc-ur'
import { Buffer } from 'buffer'
import * as QRCode from 'qrcode'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main>
    <header>
      <span class="eyebrow">KEYCARD SHELL / OPENPGP</span>
      <h1>GapPGP</h1>
      <p>Hardware-backed OpenPGP identities.</p>
    </header>

    <section>
      <h2>Create identity</h2>
      <p>Generate an identity request for your Keycard Shell.</p>

      <label for="name">Name</label>
      <input id="name" placeholder="Alice Example" autocomplete="name">

      <label for="email">Email</label>
      <input id="email" type="email" placeholder="alice@example.com"
        autocomplete="email">

      <button id="create">Generate identity QR</button>
      <p id="status" role="status"></p>
    </section>

    <section id="result" hidden>
      <h2>Scan with Keycard Shell</h2>
      <p>Open Extras → OpenPGP, scan this QR,
        review the identity, and approve on the device.</p>

      <img id="qr" alt="OpenPGP identity request QR">
      <p id="identity"></p>
      <button id="copy" class="secondary">Copy UR request</button>
    </section>

    <footer>
      No accounts. No private keys in the browser.
      Signing authorization stays on your hardware.
    </footer>
  </main>
`

const nameInput = document.querySelector<HTMLInputElement>('#name')!
const emailInput = document.querySelector<HTMLInputElement>('#email')!
const status = document.querySelector<HTMLElement>('#status')!
const result = document.querySelector<HTMLElement>('#result')!
const image = document.querySelector<HTMLImageElement>('#qr')!
const identity = document.querySelector<HTMLElement>('#identity')!

let currentUR = ''

document.querySelector<HTMLButtonElement>('#create')!
  .addEventListener('click', async () => {
    try {
      result.hidden = true
      status.textContent = ''

      const name = nameInput.value.trim()
      const email = emailInput.value.trim()

      if (!name || !emailInput.checkValidity() || !email) {
        throw new Error('Enter a valid name and email.')
      }

      if (/[<>]/.test(name)) {
        throw new Error('Name cannot contain angle brackets.')
      }

      const uid = `${name} <${email}>`
      const uidBytes = new TextEncoder().encode(uid)

      if (uidBytes.length < 1 || uidBytes.length > 255 ||
          !/^[\x20-\x7e]+$/.test(uid)) {
        throw new Error('Identity must be 1–255 printable ASCII bytes.')
      }

      const timestamp = Math.floor(Date.now() / 1000)
      if (timestamp <= 0 || timestamp > 0xffffffff) {
        throw new Error('Invalid creation timestamp.')
      }

      const request = new Map<number, number | Uint8Array>([
        [1, 1],
        [2, 1],
        [3, uidBytes],
        [4, timestamp],
      ])

      const cbor = encode(request)
      const ur = UR.fromBuffer(Buffer.from(cbor))
      const encoder = new UREncoder(ur, 400, 0)
      const urText = encoder.nextPart()

      const decoder = new URDecoder()
      decoder.receivePart(urText)

      if (!decoder.isComplete() || !decoder.isSuccess() ||
          !Buffer.from(decoder.resultUR().decodeCBOR())
            .equals(Buffer.from(cbor))) {
        throw new Error('UR round-trip validation failed.')
      }

      currentUR = urText
      image.src = await QRCode.toDataURL(urText, {
        errorCorrectionLevel: 'M',
        width: 360,
        margin: 4,
      })

      identity.textContent = uid
      result.hidden = false
      status.textContent = 'Identity request ready.'
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : String(error)
    }
  })

document.querySelector<HTMLButtonElement>('#copy')!
  .addEventListener('click', async () => {
    if (!currentUR) return
    try {
      await navigator.clipboard.writeText(currentUR)
      status.textContent = 'UR request copied.'
    } catch {
      status.textContent = 'Clipboard access failed.'
    }
  })
