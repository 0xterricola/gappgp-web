# GapPGP Web

**Hardware-backed OpenPGP identities with Keycard Shell.**

GapPGP Web is an experimental, browser-based companion for [Keycard Shell](https://github.com/keycard-tech/keycard-shell).

It helps users create OpenPGP identities, exchange QR requests and responses with Keycard Shell, manage public certificates, and cryptographically verify signing-key possession.

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

GapPGP Web focuses on identity setup, certificate management, and signing-key possession verification. General-purpose message signing and encryption are not yet implemented.

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
| Hardware key-possession verification | Experimental — hardware-tested |
| Message and document signing | Planned |
| Native Thunderbird integration | Separate project |
| Encryption | Not implemented |

Identity creation, certificate validation, and signing-key possession verification have been tested using a physical Keycard Shell. Additional security and interoperability testing remains necessary.

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

### 5. Verify control of your signing key

GapPGP Web supports experimental cryptographic proof-of-possession verification using Keycard Shell.

1. Open **Certificate Tools**.
2. Upload and validate your OpenPGP public certificate.
3. Select **Generate Signing Challenge**.
4. Scan the signing request QR with Keycard Shell.
5. Review and approve the signing operation on the device.
6. Scan the signature response QR with GapPGP Web, or paste its UR:BYTES response.
7. Wait for cryptographic verification.

GapPGP Web generates a random challenge and constructs a `SIGN_MESSAGE` request using CBOR and UR:BYTES.

Keycard Shell signs the challenge with its private signing key and returns a detached OpenPGP signature.

The browser verifies:

- The exact challenge generated for the current session
- The selected OpenPGP public certificate
- The expected signing timestamp
- The supported signature algorithm and packet format

Successful verification displays **Signing key possession verified** and the certificate fingerprint.

This demonstrates control of the corresponding private signing key at signing time. It does not independently establish hardware origin, real-world identity, or email ownership.

The workflow has passed a physical Keycard Shell integration test. Additional replay-protection and negative testing remains pending.

### 6. Use your certificate

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

The signing-key verification workflow uses a separate request and response exchange:

```text
GapPGP Web
    |
    | Random signing challenge
    | SIGN_MESSAGE request
    | CBOR -> UR:BYTES -> QR
    v
Keycard Shell
    |
    | Device review and approval
    | Private-key signing
    v
Detached OpenPGP Signature
    |
    | UR:BYTES response QR
    v
GapPGP Web
    |
    | Decode signature
    | Verify challenge and timestamp
    | Verify against public certificate
    v
Signing Key Possession Verified
```

The browser prepares requests, processes public certificates, and verifies returned OpenPGP signatures.

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
| `src/sign-challenge.ts` | Signing challenge generation and QR encoding |
| `src/sign-response.ts` | Detached signature decoding and cryptographic verification |
| `src/style.css` | Interface styling |
| `vite.config.ts` | Build and browser compatibility configuration |
| `.github/workflows/deploy.yml` | GitHub Pages deployment |

## Security Model

GapPGP Web follows a browser-local architecture.

- No accounts or authentication service.
- No server-side private-key operations.
- No private-key upload required.
- Hardware-backed signing keys remain on Keycard Shell.
- Certificate parsing and signature verification run in the browser.
- Signing challenges use cryptographically random values.
- Detached signatures are verified against the active challenge and selected public certificate.
- Private signing keys are not transferred to the browser.
- Public certificates may be freely exported and shared.

### Important limitations

GapPGP Web is experimental software and has not undergone an independent security audit.

Certificate validation alone does not prove real-world identity, email ownership, or current control of a private key. The separate signing-challenge workflow can demonstrate key possession at signing time.

Signing challenges and cryptographic proof-of-possession verification are experimentally implemented and hardware-tested. Signature verification does not independently attest that a specific hardware device performed the operation.

QR scanning depends on browser camera support.

Identity creation has been tested using Keycard Shell, and a tampered certificate fixture has been rejected. Broader malformed-input, stale-signature, replay, and certificate-mismatch testing remains necessary.

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

1. Expand automated regression tests for identity creation and signing verification.
2. Test replay protection, stale signatures, mismatched certificates, and malformed responses.
3. Improve multi-frame UR response handling and camera scanning.
4. Support general-purpose message and document signing workflows.
5. Expand interoperability with additional OpenPGP applications.
6. Strengthen security testing and prepare for independent review.

## About GapPGP

GapPGP is an open integration initiative for hardware-backed OpenPGP using Keycard Shell.

The goal is to make OpenPGP easier to use while preserving hardware-backed private-key security and interoperability with existing applications.

GapPGP Web provides a browser-based interface for that ecosystem.
