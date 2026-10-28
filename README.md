# GapPGP Web

**Hardware-backed OpenPGP identities with Keycard Shell.**

GapPGP Web is an experimental, browser-based companion for [Keycard Shell](https://github.com/keycard-tech/keycard-shell).

It helps users create OpenPGP identities, exchange QR requests and responses with their hardware device, and inspect, validate, and export public certificates.

No account, backend, or private-key import is required. Private signing-key operations remain on Keycard Shell.

**[Launch GapPGP Web](https://0xterricola.github.io/gappgp-web/)**

## What is OpenPGP?

OpenPGP is an open standard for cryptographic signatures and encryption.

Digital signatures let others verify that content was signed by the holder of a particular private key and has not been modified.

An OpenPGP identity has two important components:

- **Private key:** Used to create signatures. With Keycard Shell, the private signing key stays on the hardware.
- **Public certificate:** Contains your public key and identity information. Others use it to verify your signatures.

Your public certificate can be shared freely. Your private key should never be shared.

A valid certificate does not independently prove ownership of the name or email address it contains.

GapPGP Web currently focuses on identity setup and certificate management, not encryption.

## Features

| Feature | Status |
|---|---|
| Guided OpenPGP onboarding | Available |
| Create identity QR requests | Available |
| CBOR and UR:BYTES encoding | Available |
| QR response decoding | Experimental |
| Browser camera QR scanning | Experimental |
| Upload public certificates | Available |
| OpenPGP certificate validation | Experimental |
| Display identity and fingerprint | Available |
| Export public certificates (.asc) | Available |
| Hardware key-possession verification | Planned |
| Message and document signing | Planned |
| Native Thunderbird integration | Separate project |
| Encryption | Not implemented |

Hardware certificate round trips and cryptographic validation still require further end-to-end testing.

## Getting Started

### Requirements

- Keycard Shell with GapPGP-capable firmware (v1.5.0 or later)
- Initialized Keycard Shell device
- Modern browser
- Camera access for scanning response QR codes

### 1. Create your identity

Open [GapPGP Web](https://0xterricola.github.io/gappgp-web/) and select **Get Started**.

Enter your name and email address.

For example:

`Alice Example <alice@example.com>`

Select **Generate identity QR**.

GapPGP Web creates a versioned OpenPGP identity request encoded using CBOR and UR:BYTES.

The current implementation accepts printable ASCII identity text.

### 2. Approve on Keycard Shell

On your Keycard Shell:

1. Open Extras and navigate to OpenPGP.
2. Scan the identity request QR.
3. Review the identity details on the device.
4. Approve the operation.

Keycard Shell processes the identity request and generates the hardware-backed OpenPGP identity and public certificate.

The private signing key remains on the hardware.

### 3. Receive your certificate

In GapPGP Web, select **Scan response QR**.

Scan the QR displayed by Keycard Shell, or paste its UR:BYTES response manually.

GapPGP Web decodes the response and attempts to validate the resulting public certificate.

After successful validation, the application displays:

- OpenPGP User ID
- Public-key fingerprint
- Certificate creation date

Select **Download public certificate (.asc)** to export your public certificate.

### 4. Validate an existing certificate

Open the **Certificate Tools** tab.

Upload a public certificate in one of these formats:

- `.asc` — ASCII-armored OpenPGP certificate
- `.pgp` — Binary OpenPGP certificate
- `.gpg` — Binary OpenPGP certificate

The application parses the certificate and performs its supported cryptographic validity checks using OpenPGP.js.

The current validator expects a public certificate containing one User ID.

Validation does not independently establish hardware origin, current possession of the corresponding private key, or email ownership.

### 5. Use your certificate

You can share your public certificate with others so they can verify signatures associated with your key.

For example, inspect and import it with GnuPG:

```bash
gpg --show-keys public-key.asc
gpg --import public-key.asc
```

Importing a public certificate does not grant access to the private key or automatically configure hardware-backed signing.

For experimental hardware-backed email signing, see [GapPGP for Thunderbird](https://github.com/0xterricola/gappgp-thunderbird).

## How It Works

```text
GapPGP Web
    |
    | CREATE_IDENTITY request
    | CBOR -> UR:BYTES -> QR
    v
Keycard Shell
    |
    | Device review and approval
    | Hardware-backed key operations
    v
OpenPGP Public Certificate
    |
    | UR:BYTES response
    v
GapPGP Web
    |
    | Decode and validate
    v
Export Public Certificate (.asc)
```

The browser prepares requests and processes public certificate data.

Keycard Shell performs private-key operations.

GapPGP Web does not require a backend server.

## Development

Built using:

- TypeScript
- Vite
- OpenPGP.js
- CBOR
- Blockchain Commons UR
- QRCode
- jsQR

### Run locally

Use Node.js 24 and npm.

```bash
git clone https://github.com/0xterricola/gappgp-web.git
cd gappgp-web

npm ci --legacy-peer-deps
npm run dev
```

Open the local URL reported by Vite.

### Production build

```bash
npm run build
npm run preview
```

Production assets are generated in `dist/`.

## Project Structure

| File | Purpose |
|---|---|
| `src/main.ts` | Identity request generation and QR rendering |
| `src/certificate.ts` | OpenPGP certificate validation |
| `src/certificate-ui.ts` | QR scanning, uploads, and certificate export |
| `src/onboarding.ts` | Guided interface and educational content |
| `src/style.css` | Interface styling |
| `vite.config.ts` | Build and browser compatibility configuration |
| `.github/workflows/deploy.yml` | GitHub Pages deployment |

## Security Model

GapPGP Web follows a browser-local architecture.

- No accounts or authentication service.
- No server-side private-key operations.
- No private-key upload required.
- Hardware-backed signing keys remain on Keycard Shell.
- Certificate parsing and verification run in the browser.
- Public certificates may be freely exported and shared.

### Important limitations

GapPGP Web is experimental software and has not undergone an independent security audit.

Certificate validation does not prove real-world identity, email ownership, or current control of a private key.

A hardware signing challenge is required to demonstrate possession of the corresponding private key. That functionality is planned.

QR scanning depends on browser camera support.

The complete identity-creation workflow still requires validation against hardware-generated certificates, including malformed and tampered inputs.

Do not upload private or secret-key files.

## Deployment

GapPGP Web is hosted through GitHub Pages.

Commits pushed to `main` automatically trigger the GitHub Actions deployment workflow.

**Live website:** https://0xterricola.github.io/gappgp-web/

## Related Projects

- [Keycard Shell](https://github.com/keycard-tech/keycard-shell) — Hardware firmware and device functionality.
- [Keycard OpenPGP](https://github.com/0xterricola/keycard-openpgp) — Protocol documentation, reference implementations, and interoperability research.
- [GapPGP for Thunderbird](https://github.com/0xterricola/gappgp-thunderbird) — Experimental hardware-backed email signing.

## Roadmap

The next development milestones include:

1. Test complete Keycard Shell identity-creation round trips.
2. Verify valid and tampered public certificates.
3. Improve multi-frame UR response handling.
4. Add hardware-backed signing challenges and verification.
5. Support message and document signing workflows.
6. Expand interoperability with additional OpenPGP applications.

## About GapPGP

GapPGP is an open integration initiative for hardware-backed OpenPGP using Keycard Shell.

The goal is to make OpenPGP easier to use while preserving hardware-backed private-key security and interoperability with existing applications.

GapPGP Web provides a browser-based interface for that ecosystem.
