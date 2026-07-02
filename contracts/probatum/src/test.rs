#![cfg(test)]
use super::*;
use soroban_sdk::Env;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, BytesN};

#[test]
fn test_version() {
    let env = Env::default();
    let id = env.register(ProbatumContract, ());
    let client = ProbatumContractClient::new(&env, &id);
    assert_eq!(client.version(), 1);
}

fn setup() -> (Env, ProbatumContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(ProbatumContract, ());
    let client = ProbatumContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.init(&admin);
    (env, client, admin)
}

#[test]
fn test_init_and_pause() {
    let (_env, client, _admin) = setup();
    assert_eq!(client.is_paused(), false);
    client.pause(&true);
    assert_eq!(client.is_paused(), true);
    client.pause(&false);
    assert_eq!(client.is_paused(), false);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // AlreadyInitialized
fn test_double_init_panics() {
    let (env, client, _admin) = setup();
    let admin2 = Address::generate(&env);
    client.init(&admin2);
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
