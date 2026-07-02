#![cfg(test)]
use super::*;
use soroban_sdk::Env;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Address;

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
