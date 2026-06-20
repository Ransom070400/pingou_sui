
/// Pingou — on-chain profile pointer + Seal access policy.
///
/// Each user owns one shared `Profile` object that holds:
///   - the Walrus blob id of their CURRENT encrypted profile (mutable on edit), and
///   - an allowlist of addresses permitted to decrypt that profile via Seal.
///
/// Seal key servers call `seal_approve` (read-only dry-run) when a client asks to
/// decrypt. The function aborts unless the requester is the owner or has been added
/// to the allowlist — that abort/no-abort is what gates decryption. Granting access
/// (`add`) is an on-chain write, normally run as an Enoki-sponsored transaction so
/// zkLogin users never need SUI for gas.
module pingou::profile;

use std::hash;
use std::string::String;
use sui::table::{Self, Table};

// === Errors ===
const EInvalidCap: u64 = 0;
const ENoAccess: u64 = 1;
const EBadShareCode: u64 = 2;

// === Objects ===

/// Shared so Seal key servers and grantees can read it during access checks.
public struct Profile has key {
    id: UID,
    owner: address,
    /// Walrus blob id of the current Seal-encrypted profile payload.
    blob_id: String,
    /// sha2_256 of the secret share-code carried in this profile's QR. Lets a
    /// scanner who presents the code grant THEMSELVES read access (`add_self`) —
    /// enabling a one-scan two-way exchange without the owner's cap.
    share_hash: vector<u8>,
    /// Addresses granted decrypt access. Doubles as the connection list: in a
    /// two-way scan each party ends up in the other's allow table.
    allow: Table<address, bool>,
}

/// Bearer capability proving ownership of a specific `Profile`. Required to mutate it.
public struct OwnerCap has key, store {
    id: UID,
    profile_id: ID,
}

// === Create / mutate ===

/// Create a profile pointing at an initial encrypted blob. `share_hash` is
/// sha2_256 of the secret code embedded in the owner's QR. Shares the `Profile`
/// and returns the `OwnerCap` to the caller.
public fun create(blob_id: String, share_hash: vector<u8>, ctx: &mut TxContext): OwnerCap {
    let profile = Profile {
        id: object::new(ctx),
        owner: ctx.sender(),
        blob_id,
        share_hash,
        allow: table::new(ctx),
    };
    let cap = OwnerCap { id: object::new(ctx), profile_id: object::id(&profile) };
    transfer::share_object(profile);
    cap
}

/// Entry convenience: create a profile and keep the cap.
entry fun create_and_keep(blob_id: String, share_hash: vector<u8>, ctx: &mut TxContext) {
    let cap = create(blob_id, share_hash, ctx);
    transfer::public_transfer(cap, ctx.sender());
}

fun assert_owner(profile: &Profile, cap: &OwnerCap) {
    assert!(cap.profile_id == object::id(profile), EInvalidCap);
}

/// Repoint at a new Walrus blob after re-encrypting an edited profile.
public fun set_blob(profile: &mut Profile, cap: &OwnerCap, blob_id: String) {
    assert_owner(profile, cap);
    profile.blob_id = blob_id;
}

/// Grant `account` permission to decrypt this profile (idempotent).
public fun add(profile: &mut Profile, cap: &OwnerCap, account: address) {
    assert_owner(profile, cap);
    if (!profile.allow.contains(account)) {
        profile.allow.add(account, true);
    };
}

/// Revoke `account`'s access (idempotent).
public fun remove(profile: &mut Profile, cap: &OwnerCap, account: address) {
    assert_owner(profile, cap);
    if (profile.allow.contains(account)) {
        profile.allow.remove(account);
    };
}

/// Grant the CALLER decrypt access by presenting the profile's secret share-code
/// (the value whose sha2_256 is `share_hash`). This is what a QR scanner calls to
/// read the scanned profile — no owner cap needed, but you must hold the code, which
/// only travels in the owner's QR. Idempotent.
public fun add_self(profile: &mut Profile, code: vector<u8>, ctx: &TxContext) {
    assert!(hash::sha2_256(code) == profile.share_hash, EBadShareCode);
    let account = ctx.sender();
    if (!profile.allow.contains(account)) {
        profile.allow.add(account, true);
    };
}

// === Reads ===

public fun blob_id(profile: &Profile): String {
    profile.blob_id
}

public fun owner(profile: &Profile): address {
    profile.owner
}

/// The id of the `Profile` this cap controls.
public fun cap_profile_id(cap: &OwnerCap): ID {
    cap.profile_id
}

public fun has_access(profile: &Profile, account: address): bool {
    profile.owner == account || profile.allow.contains(account)
}

// === Seal access policy ===

/// True iff `prefix` is a prefix of `word`.
fun is_prefix(prefix: vector<u8>, word: vector<u8>): bool {
    if (prefix.length() > word.length()) return false;
    let mut i = 0;
    while (i < prefix.length()) {
        if (prefix[i] != word[i]) return false;
        i = i + 1;
    };
    true
}

/// Seal identities for a profile are namespaced by the profile's object id, i.e.
/// `id == profile_object_id_bytes ++ <nonce>`. This prevents one profile's policy
/// from authorizing another profile's ciphertext.
fun approve_internal(caller: address, id: vector<u8>, profile: &Profile): bool {
    let namespace = object::id(profile).to_bytes();
    if (!is_prefix(namespace, id)) return false;
    has_access(profile, caller)
}

/// Called by Seal key servers via dry-run. Aborts => decryption denied.
entry fun seal_approve(id: vector<u8>, profile: &Profile, ctx: &TxContext) {
    assert!(approve_internal(ctx.sender(), id, profile), ENoAccess);
}

// === Test helpers ===

#[test_only]
public fun destroy_cap_for_testing(cap: OwnerCap) {
    let OwnerCap { id, profile_id: _ } = cap;
    id.delete();
}
