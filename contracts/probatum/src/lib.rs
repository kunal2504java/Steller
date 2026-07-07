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

fn load_batch_checked(env: &Env, issuer: &Address, batch_id: u64) -> Result<Batch, Error> {
    let batch: Batch = env
        .storage()
        .persistent()
        .get(&DataKey::Batch(batch_id))
        .ok_or(Error::BatchNotFound)?;
    if batch.issuer != *issuer {
        return Err(Error::NotBatchIssuer);
    }
    Ok(batch)
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

    pub fn register_issuer(env: Env, issuer: Address, profile_hash: BytesN<32>) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        let key = DataKey::Issuer(issuer.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyRegistered);
        }
        env.storage().persistent().set(&key, &profile_hash);
        env.events()
            .publish((soroban_sdk::symbol_short!("issuer"), issuer), profile_hash);
        Ok(())
    }

    pub fn update_issuer(env: Env, issuer: Address, profile_hash: BytesN<32>) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        let key = DataKey::Issuer(issuer.clone());
        if !env.storage().persistent().has(&key) {
            return Err(Error::NotRegistered);
        }
        env.storage().persistent().set(&key, &profile_hash);
        env.events()
            .publish((soroban_sdk::symbol_short!("issuer"), issuer), profile_hash);
        Ok(())
    }

    pub fn get_issuer(env: Env, issuer: Address) -> Option<BytesN<32>> {
        env.storage().persistent().get(&DataKey::Issuer(issuer))
    }

    pub fn anchor_batch(
        env: Env,
        issuer: Address,
        root: BytesN<32>,
        meta: BytesN<32>,
        count: u32,
    ) -> Result<u64, Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        if !env
            .storage()
            .persistent()
            .has(&DataKey::Issuer(issuer.clone()))
        {
            return Err(Error::NotRegistered);
        }
        let seq: u64 = env.storage().instance().get(&DataKey::BatchSeq).unwrap_or(0);
        let batch_id = seq + 1;
        let batch = Batch {
            issuer: issuer.clone(),
            root: root.clone(),
            meta,
            count,
            revoked: false,
            anchored_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&DataKey::Batch(batch_id), &batch);
        env.storage().instance().set(&DataKey::BatchSeq, &batch_id);
        env.events()
            .publish((soroban_sdk::symbol_short!("anchor"), issuer, batch_id), root);
        Ok(batch_id)
    }

    pub fn get_batch(env: Env, batch_id: u64) -> Option<Batch> {
        env.storage().persistent().get(&DataKey::Batch(batch_id))
    }

    pub fn batch_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::BatchSeq).unwrap_or(0)
    }

    pub fn revoke_batch(env: Env, issuer: Address, batch_id: u64) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        let mut batch = load_batch_checked(&env, &issuer, batch_id)?;
        batch.revoked = true;
        env.storage().persistent().set(&DataKey::Batch(batch_id), &batch);
        env.events()
            .publish((soroban_sdk::symbol_short!("revokeb"), batch_id), ());
        Ok(())
    }

    pub fn revoke_leaf(
        env: Env,
        issuer: Address,
        batch_id: u64,
        leaf_hash: BytesN<32>,
    ) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        load_batch_checked(&env, &issuer, batch_id)?;
        env.storage()
            .persistent()
            .set(&DataKey::RevokedLeaf(batch_id, leaf_hash.clone()), &true);
        env.events()
            .publish((soroban_sdk::symbol_short!("revokel"), batch_id), leaf_hash);
        Ok(())
    }

    pub fn is_batch_revoked(env: Env, batch_id: u64) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Batch(batch_id))
            .map(|b: Batch| b.revoked)
            .unwrap_or(false)
    }

    pub fn is_leaf_revoked(env: Env, batch_id: u64, leaf_hash: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::RevokedLeaf(batch_id, leaf_hash))
            .unwrap_or(false)
    }
}

mod test;
