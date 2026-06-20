/**
 * zkLogin session: Google OAuth -> Enoki proof -> a Signer that produces zkLogin
 * signatures. Replicates `@mysten/enoki`'s EnokiKeypair (which we can't import on
 * Hermes) using only `@mysten/sui` primitives.
 *
 * Persistence: the ephemeral SECRET key goes in expo-secure-store (Keychain); the
 * proof/address/epoch (public, submitted on-chain anyway) go in AsyncStorage. A
 * session is valid until its epoch window expires, after which the user re-logs in.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Signer, type PublicKey, type SignatureScheme } from '@mysten/sui/cryptography';
import {
  ZkLoginPublicIdentifier,
  getZkLoginSignature,
} from '@mysten/sui/zklogin';
import {
  createZkLoginNonce,
  getZkLogin,
  createZkLoginProof,
  type ZkLoginProof,
} from './enoki';
import { signInWithGoogle, signInWithApple } from './oauth';

const SECRET_KEY = 'pingou.zklogin.ephemeralSecret';
const PUBLIC_KEY = 'pingou.zklogin.session';

/** A Signer that wraps an ephemeral Ed25519 signature in a zkLogin signature. */
export class ZkLoginSigner extends Signer {
  #proof: ZkLoginProof;
  #maxEpoch: number;
  #ephemeral: Ed25519Keypair;
  #publicKey: PublicKey;

  constructor(args: {
    proof: ZkLoginProof;
    maxEpoch: number;
    ephemeral: Ed25519Keypair;
    address: string;
  }) {
    super();
    this.#proof = args.proof;
    this.#maxEpoch = args.maxEpoch;
    this.#ephemeral = args.ephemeral;
    this.#publicKey = ZkLoginPublicIdentifier.fromProof(args.address, args.proof as any);
  }

  getKeyScheme(): SignatureScheme {
    return this.#ephemeral.getKeyScheme();
  }
  getPublicKey(): PublicKey {
    return this.#publicKey;
  }
  sign(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    return this.#ephemeral.sign(data);
  }

  async signTransaction(bytes: Uint8Array) {
    const { bytes: b, signature: userSignature } = await this.#ephemeral.signTransaction(bytes);
    return {
      bytes: b,
      signature: getZkLoginSignature({
        inputs: this.#proof as any,
        maxEpoch: this.#maxEpoch,
        userSignature,
      }),
    };
  }

  async signPersonalMessage(bytes: Uint8Array) {
    const { bytes: b, signature: userSignature } =
      await this.#ephemeral.signPersonalMessage(bytes);
    return {
      bytes: b,
      signature: getZkLoginSignature({
        inputs: this.#proof as any,
        maxEpoch: this.#maxEpoch,
        userSignature,
      }),
    };
  }
}

export interface ZkLoginSession {
  address: string;
  signer: ZkLoginSigner;
}

interface StoredPublic {
  address: string;
  proof: ZkLoginProof;
  maxEpoch: number;
  /** Epoch-window end (ms since epoch); session is dead past this. */
  expiresAtMs: number;
}

/** Run the full zkLogin flow with a provider's sign-in (returns the OIDC JWT). */
async function loginWith(signIn: (nonce: string) => Promise<string>): Promise<ZkLoginSession> {
  const ephemeral = Ed25519Keypair.generate();

  const nonce = await createZkLoginNonce(ephemeral.getPublicKey());
  const jwt = await signIn(nonce.nonce);
  const { address } = await getZkLogin(jwt);
  const proof = await createZkLoginProof({
    jwt,
    ephemeralPublicKey: ephemeral.getPublicKey(),
    maxEpoch: nonce.maxEpoch,
    randomness: nonce.randomness,
  });

  await persist(ephemeral, {
    address,
    proof,
    maxEpoch: nonce.maxEpoch,
    expiresAtMs: nonce.estimatedExpiration,
  });

  return { address, signer: new ZkLoginSigner({ proof, maxEpoch: nonce.maxEpoch, ephemeral, address }) };
}

/** Full interactive login: returns the user's Sui address + a ready-to-use signer. */
export const loginWithGoogle = () => loginWith(signInWithGoogle);
export const loginWithApple = () => loginWith(signInWithApple);

/** Rebuild a session from storage if one exists and hasn't expired. */
export async function restoreSession(): Promise<ZkLoginSession | null> {
  try {
    const [secret, pubJson] = await Promise.all([
      SecureStore.getItemAsync(SECRET_KEY),
      AsyncStorage.getItem(PUBLIC_KEY),
    ]);
    if (!secret || !pubJson) return null;

    const pub = JSON.parse(pubJson) as StoredPublic;
    if (Date.now() >= pub.expiresAtMs) {
      await logout();
      return null;
    }

    const ephemeral = Ed25519Keypair.fromSecretKey(secret);
    return {
      address: pub.address,
      signer: new ZkLoginSigner({
        proof: pub.proof,
        maxEpoch: pub.maxEpoch,
        ephemeral,
        address: pub.address,
      }),
    };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECRET_KEY),
    AsyncStorage.removeItem(PUBLIC_KEY),
  ]);
}

async function persist(ephemeral: Ed25519Keypair, pub: StoredPublic): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SECRET_KEY, ephemeral.getSecretKey()),
    AsyncStorage.setItem(PUBLIC_KEY, JSON.stringify(pub)),
  ]);
}
