#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Bytes, BytesN, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    Paused = 2,
    AlreadyRegistered = 3,
    NotRegistered = 4,
    BatchNotFound = 5,
    NotBatchIssuer = 6,
    BatchRevoked = 7,
    LeafRevoked = 8,
    AlreadyClaimed = 9,
    InvalidProof = 10,
}

#[contracttype]
#[derive(Clone)]
pub struct Batch {
    pub issuer: Address,
    pub root: BytesN<32>,
    pub meta: BytesN<32>,
    pub count: u32,
    pub revoked: bool,
    pub anchored_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Paused,
    BatchSeq,
    Issuer(Address),
    Batch(u64),
    RevokedLeaf(u64, BytesN<32>),
    Claim(u64, BytesN<32>),
}

fn require_not_paused(env: &Env) -> Result<(), Error> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false);
    if paused {
        return Err(Error::Paused);
    }
    Ok(())
}

#[contract]
pub struct ProbatumContract;

#[contractimpl]
impl ProbatumContract {
    pub fn version(_env: Env) -> u32 {
        1
    }

    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::BatchSeq, &0u64);
        Ok(())
    }

    pub fn pause(env: Env, paused: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }
}

mod test;
