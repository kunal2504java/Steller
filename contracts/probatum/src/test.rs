#![cfg(test)]
use super::*;
use soroban_sdk::Env;

#[test]
fn test_version() {
    let env = Env::default();
    let id = env.register(ProbatumContract, ());
    let client = ProbatumContractClient::new(&env, &id);
    assert_eq!(client.version(), 1);
}
