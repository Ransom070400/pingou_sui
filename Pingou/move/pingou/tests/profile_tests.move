#[test_only]
module pingou::profile_tests;

use pingou::profile::{Self, Profile, OwnerCap};
use std::hash;
use std::string;
use sui::test_scenario as ts;

const OWNER: address = @0xA;
const FRIEND: address = @0xB;
const STRANGER: address = @0xC;

// Secret share-code carried in OWNER's QR, and its on-chain hash.
fun code(): vector<u8> { b"super-secret-code" }
fun share_hash(): vector<u8> { hash::sha2_256(code()) }

#[test]
fun owner_and_granted_have_access_stranger_does_not() {
    let mut scenario = ts::begin(OWNER);

    {
        let cap = profile::create(string::utf8(b"blob-v1"), share_hash(), scenario.ctx());
        transfer::public_transfer(cap, OWNER);
    };

    // Owner grants FRIEND access.
    scenario.next_tx(OWNER);
    {
        let mut p = scenario.take_shared<Profile>();
        let cap = scenario.take_from_sender<OwnerCap>();
        profile::add(&mut p, &cap, FRIEND);
        scenario.return_to_sender(cap);
        ts::return_shared(p);
    };

    scenario.next_tx(OWNER);
    {
        let p = scenario.take_shared<Profile>();
        assert!(profile::has_access(&p, OWNER), 0);
        assert!(profile::has_access(&p, FRIEND), 1);
        assert!(!profile::has_access(&p, STRANGER), 2);
        assert!(profile::blob_id(&p) == string::utf8(b"blob-v1"), 3);
        ts::return_shared(p);
    };

    scenario.end();
}

#[test]
fun set_blob_updates_pointer_and_remove_revokes() {
    let mut scenario = ts::begin(OWNER);
    {
        let cap = profile::create(string::utf8(b"blob-v1"), share_hash(), scenario.ctx());
        transfer::public_transfer(cap, OWNER);
    };

    scenario.next_tx(OWNER);
    {
        let mut p = scenario.take_shared<Profile>();
        let cap = scenario.take_from_sender<OwnerCap>();

        profile::set_blob(&mut p, &cap, string::utf8(b"blob-v2"));
        assert!(profile::blob_id(&p) == string::utf8(b"blob-v2"), 0);

        profile::add(&mut p, &cap, FRIEND);
        assert!(profile::has_access(&p, FRIEND), 1);
        profile::remove(&mut p, &cap, FRIEND);
        assert!(!profile::has_access(&p, FRIEND), 2);

        scenario.return_to_sender(cap);
        ts::return_shared(p);
    };

    scenario.end();
}

#[test]
fun add_self_with_correct_code_grants_access() {
    let mut scenario = ts::begin(OWNER);
    {
        let cap = profile::create(string::utf8(b"blob"), share_hash(), scenario.ctx());
        transfer::public_transfer(cap, OWNER);
    };

    // STRANGER presents the QR code -> grants themselves access (no owner cap).
    scenario.next_tx(STRANGER);
    {
        let mut p = scenario.take_shared<Profile>();
        assert!(!profile::has_access(&p, STRANGER), 0);
        profile::add_self(&mut p, code(), scenario.ctx());
        assert!(profile::has_access(&p, STRANGER), 1);
        ts::return_shared(p);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = pingou::profile::EBadShareCode)]
fun add_self_with_wrong_code_aborts() {
    let mut scenario = ts::begin(OWNER);
    {
        let cap = profile::create(string::utf8(b"blob"), share_hash(), scenario.ctx());
        transfer::public_transfer(cap, OWNER);
    };

    scenario.next_tx(STRANGER);
    {
        let mut p = scenario.take_shared<Profile>();
        profile::add_self(&mut p, b"wrong-code", scenario.ctx());
        ts::return_shared(p);
    };

    scenario.end();
}

#[test]
#[expected_failure(abort_code = pingou::profile::EInvalidCap)]
fun wrong_cap_cannot_mutate() {
    let mut scenario = ts::begin(OWNER);

    {
        let cap = profile::create(string::utf8(b"a"), share_hash(), scenario.ctx());
        transfer::public_transfer(cap, OWNER);
    };

    scenario.next_tx(OWNER);
    let owner_profile_id = {
        let cap = scenario.take_from_sender<OwnerCap>();
        let id = profile::cap_profile_id(&cap);
        scenario.return_to_sender(cap);
        id
    };

    scenario.next_tx(FRIEND);
    {
        let cap = profile::create(string::utf8(b"b"), share_hash(), scenario.ctx());
        transfer::public_transfer(cap, FRIEND);
    };

    scenario.next_tx(FRIEND);
    {
        let mut owners_profile = scenario.take_shared_by_id<Profile>(owner_profile_id);
        let friends_cap = scenario.take_from_sender<OwnerCap>();
        profile::add(&mut owners_profile, &friends_cap, STRANGER);
        scenario.return_to_sender(friends_cap);
        ts::return_shared(owners_profile);
    };

    scenario.end();
}
