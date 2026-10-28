import * as openpgp from 'openpgp'

export type CertificateInfo = {
  fingerprint: string
  userID: string
  created: string
  armored: string
}

export async function validateCertificate(
  source: Uint8Array | string,
  expectedUID?: string
): Promise<CertificateInfo> {
  if (typeof source === 'string') {
    if (source.length > 131072 ||
        !source.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
      throw new Error('Expected an armored OpenPGP public certificate.')
    }
  } else if (source.length === 0 || source.length > 65536) {
    throw new Error('Invalid certificate size.')
  }

  const key = typeof source === 'string'
    ? await openpgp.readKey({ armoredKey: source })
    : await openpgp.readKey({ binaryKey: source })

  const userIDs = key.getUserIDs()
  if (userIDs.length !== 1) {
    throw new Error('Expected exactly one certified User ID.')
  }

  const userID = userIDs[0]
  if (expectedUID && userID !== expectedUID) {
    throw new Error('Certificate identity does not match the request.')
  }

  const config = {
    ...openpgp.config,
    rejectCurves: new Set(
      [...openpgp.config.rejectCurves].filter(
        curve => curve !== openpgp.enums.curve.secp256k1
      )
    ),
  }

  await key.verifyPrimaryKey(undefined, undefined, config)

  return {
    fingerprint: key.getFingerprint().toUpperCase(),
    userID,
    created: key.getCreationTime().toISOString(),
    armored: key.armor(),
  }
}
