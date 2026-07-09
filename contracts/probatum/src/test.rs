#![cfg(test)]
use super::*;
use soroban_sdk::testutils::{Address as _, Events, Ledger};
use soroban_sdk::Env;
use soroban_sdk::{Address, Bytes, BytesN};

fn setup() -> (Env, ProbatumContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(ProbatumContract, (admin.clone(),));
    let client = ProbatumContractClient::new(&env, &id);
    (env, client, admin)
}

#[test]
fn test_version() {
    let (_env, client, _admin) = setup();
    assert_eq!(client.version(), 2);
}

#[test]
fn test_constructor_initializes_state() {
    let (_env, client, _admin) = setup();
    assert_eq!(client.version(), 2);
    assert_eq!(client.is_paused(), false);
    assert_eq!(client.batch_count(), 0);
    assert_eq!(client.claim_count(), 0);
}

#[test]
fn test_pause_toggle() {
    let (_env, client, _admin) = setup();
    assert_eq!(client.is_paused(), false);
    client.pause(&true);
    assert_eq!(client.is_paused(), true);
    client.pause(&false);
    assert_eq!(client.is_paused(), false);
}

fn h(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

#[test]
fn test_register_and_update_issuer() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    assert_eq!(client.get_issuer(&issuer), None);
    client.register_issuer(&issuer, &h(&env, 1));
    assert_eq!(client.get_issuer(&issuer), Some(h(&env, 1)));
    client.update_issuer(&issuer, &h(&env, 2));
    assert_eq!(client.get_issuer(&issuer), Some(h(&env, 2)));
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")] // AlreadyRegistered
fn test_double_register_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    client.register_issuer(&issuer, &h(&env, 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // NotRegistered
fn test_update_unregistered_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    client.update_issuer(&issuer, &h(&env, 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // Paused
fn test_register_while_paused_panics() {
    let (env, client, _admin) = setup();
    client.pause(&true);
    let issuer = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
}

#[test]
fn test_anchor_batch() {
    let (env, client, _admin) = setup();
    env.ledger().set_timestamp(1_720_000_000);
    let issuer = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let id1 = client.anchor_batch(&issuer, &h(&env, 10), &h(&env, 11), &500u32);
    let id2 = client.anchor_batch(&issuer, &h(&env, 20), &h(&env, 21), &50u32);
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(client.batch_count(), 2);
    let b = client.get_batch(&id1).unwrap();
    assert_eq!(b.issuer, issuer);
    assert_eq!(b.root, h(&env, 10));
    assert_eq!(b.count, 500);
    assert_eq!(b.revoked, false);
    assert_eq!(b.anchored_at, 1_720_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // NotRegistered
fn test_anchor_unregistered_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    client.anchor_batch(&issuer, &h(&env, 10), &h(&env, 11), &1u32);
}

#[test]
fn test_revocation() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let bid = client.anchor_batch(&issuer, &h(&env, 10), &h(&env, 11), &10u32);
    assert_eq!(client.is_batch_revoked(&bid), false);
    assert_eq!(client.is_leaf_revoked(&bid, &h(&env, 42)), false);
    client.revoke_leaf(&issuer, &bid, &h(&env, 42));
    assert_eq!(client.is_leaf_revoked(&bid, &h(&env, 42)), true);
    client.revoke_batch(&issuer, &bid);
    assert_eq!(client.is_batch_revoked(&bid), true);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // NotBatchIssuer
fn test_revoke_by_stranger_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let stranger = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    client.register_issuer(&stranger, &h(&env, 2));
    let bid = client.anchor_batch(&issuer, &h(&env, 10), &h(&env, 11), &10u32);
    client.revoke_batch(&stranger, &bid);
}

fn pair(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> BytesN<32> {
    let (lo, hi) = if a < b { (a, b) } else { (b, a) };
    let mut buf = Bytes::new(env);
    buf.append(&Bytes::from_slice(env, &lo.to_array()));
    buf.append(&Bytes::from_slice(env, &hi.to_array()));
    env.crypto().sha256(&buf).into()
}

#[test]
fn test_claim_with_valid_proof() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let alice = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));

    // 4 leaves; alice owns leaf_a
    let (la, lb, lc, ld) = (h(&env, 101), h(&env, 102), h(&env, 103), h(&env, 104));
    let n_ab = pair(&env, &la, &lb);
    let n_cd = pair(&env, &lc, &ld);
    let root = pair(&env, &n_ab, &n_cd);
    let bid = client.anchor_batch(&issuer, &root, &h(&env, 0), &4u32);

    let proof = soroban_sdk::vec![&env, lb.clone(), n_cd.clone()];
    client.claim(&alice, &bid, &la, &proof);
    assert_eq!(client.claim_of(&bid, &la), Some(alice.clone()));
    assert_eq!(client.claim_count(), 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")] // InvalidProof
fn test_claim_bad_proof_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let alice = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let bid = client.anchor_batch(&issuer, &h(&env, 99), &h(&env, 0), &4u32);
    let proof = soroban_sdk::vec![&env, h(&env, 1)];
    client.claim(&alice, &bid, &h(&env, 101), &proof);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")] // AlreadyClaimed
fn test_double_claim_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let (la, lb) = (h(&env, 101), h(&env, 102));
    let root = pair(&env, &la, &lb);
    let bid = client.anchor_batch(&issuer, &root, &h(&env, 0), &2u32);
    let proof = soroban_sdk::vec![&env, lb.clone()];
    client.claim(&alice, &bid, &la, &proof);
    client.claim(&bob, &bid, &la, &proof);
}

// Known-answer vector, computed independently in Python, to pin the exact
// byte layout (sibling ordering + concatenation) that hash_pair/verify_proof
// rely on. A future TypeScript port of the merkle tree must reproduce these
// exact bytes for the same leaves.
//
// $ python -c "
// import hashlib
// H = lambda b: hashlib.sha256(b).digest()
// la, lb, lc, ld = b'\x65'*32, b'\x66'*32, b'\x67'*32, b'\x68'*32
// pair = lambda a,b: H(min(a,b)+max(a,b))
// n_ab, n_cd = pair(la,lb), pair(lc,ld)
// root = pair(n_ab, n_cd)
// print('n_ab', n_ab.hex()); print('n_cd', n_cd.hex()); print('root', root.hex())"
// n_ab 3a3e2eafeb54090a2205f411e6adad9fdef9ec1e06f8668a2de535c7b5b027dc
// n_cd 547c42726a3fde5b9ff24eff90363351905fa1a2fa51af076fdd4a7ccd296a42
// root 57c49ece895537b2bf5dfe5ba421bbf7666f12a00d28a81c29ba0faa52cd1902
#[test]
fn test_known_answer_vector() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let alice = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));

    // Same 4 leaves as the Python vector: 0x65, 0x66, 0x67, 0x68 repeated 32x.
    let (la, lb, lc, ld) = (h(&env, 0x65), h(&env, 0x66), h(&env, 0x67), h(&env, 0x68));

    let n_cd_hardcoded = BytesN::from_array(
        &env,
        &[
            0x54, 0x7c, 0x42, 0x72, 0x6a, 0x3f, 0xde, 0x5b, 0x9f, 0xf2, 0x4e, 0xff, 0x90, 0x36,
            0x33, 0x51, 0x90, 0x5f, 0xa1, 0xa2, 0xfa, 0x51, 0xaf, 0x07, 0x6f, 0xdd, 0x4a, 0x7c,
            0xcd, 0x29, 0x6a, 0x42,
        ],
    );
    let root_hardcoded = BytesN::from_array(
        &env,
        &[
            0x57, 0xc4, 0x9e, 0xce, 0x89, 0x55, 0x37, 0xb2, 0xbf, 0x5d, 0xfe, 0x5b, 0xa4, 0x21,
            0xbb, 0xf7, 0x66, 0x6f, 0x12, 0xa0, 0x0d, 0x28, 0xa8, 0x1c, 0x29, 0xba, 0x0f, 0xaa,
            0x52, 0xcd, 0x19, 0x02,
        ],
    );

    // The in-test pair() helper must reproduce the externally-computed
    // (Python/hashlib) intermediate node and root exactly.
    let n_ab = pair(&env, &la, &lb);
    let n_cd = pair(&env, &lc, &ld);
    assert_eq!(n_cd, n_cd_hardcoded);
    let root = pair(&env, &n_ab, &n_cd);
    assert_eq!(root, root_hardcoded);

    let bid = client.anchor_batch(&issuer, &root_hardcoded, &h(&env, 0), &4u32);

    let proof = soroban_sdk::vec![&env, lb.clone(), n_cd_hardcoded.clone()];
    client.claim(&alice, &bid, &la, &proof);
    assert_eq!(client.claim_of(&bid, &la), Some(alice.clone()));
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // LeafRevoked
fn test_claim_revoked_leaf_panics() {
    let (env, client, _admin) = setup();
    let issuer = Address::generate(&env);
    let alice = Address::generate(&env);
    client.register_issuer(&issuer, &h(&env, 1));
    let (la, lb) = (h(&env, 101), h(&env, 102));
    let root = pair(&env, &la, &lb);
    let bid = client.anchor_batch(&issuer, &root, &h(&env, 0), &2u32);
    client.revoke_leaf(&issuer, &bid, &la);
    let proof = soroban_sdk::vec![&env, lb.clone()];
    client.claim(&alice, &bid, &la, &proof);
}

#[test]
fn test_pause_emits_event() {
    let (env, client, _admin) = setup();
    client.pause(&true);
    let events = env.events().all();
    assert!(!events.is_empty(), "pause must emit an event");
    assert_eq!(client.is_paused(), true);
}
