#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Bytes, BytesN,
    Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1, // reserved (v1 init) — discriminants are append-only
    Paused = 2,
    AlreadyRegistered = 3,
    NotRegistered = 4,
    BatchNotFound = 5,
    NotBatchIssuer = 6,
    BatchRevoked = 7,
    LeafRevoked = 8,
    AlreadyClaimed = 9,
    InvalidProof = 10,
    NotInitialized = 11,
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

// --- Events ---
// Typed replacements for the deprecated `env.events().publish(...)` calls.
// Each struct carries the same semantic content as the old (topic-tuple, data)
// pair it replaces; `data_format = "single-value"` keeps the data payload as a
// single raw value (or Void when there are no data fields), matching how the
// legacy code published a bare value rather than a Map/Vec.
//
// Default static topic is the struct name in snake_case, e.g. `IssuerRegistered`
// publishes under topic `issuer_registered`.

/// Emitted when an issuer profile hash is registered or updated.
/// Topics: (`issuer_registered`, issuer). Data: profile_hash.
#[contractevent(data_format = "single-value")]
pub struct IssuerRegistered {
    #[topic]
    pub issuer: Address,
    pub profile_hash: BytesN<32>,
}

/// Emitted when a new batch is anchored.
/// Topics: (`batch_anchored`, issuer, batch_id). Data: root.
#[contractevent(data_format = "single-value")]
pub struct BatchAnchored {
    #[topic]
    pub issuer: Address,
    #[topic]
    pub batch_id: u64,
    pub root: BytesN<32>,
}

/// Emitted when a whole batch is revoked.
/// Topics: (`batch_revoked`, batch_id). Data: none (Void).
#[contractevent(data_format = "single-value")]
pub struct BatchRevoked {
    #[topic]
    pub batch_id: u64,
}

/// Emitted when a single leaf within a batch is revoked.
/// Topics: (`leaf_revoked`, batch_id). Data: leaf_hash.
#[contractevent(data_format = "single-value")]
pub struct LeafRevoked {
    #[topic]
    pub batch_id: u64,
    pub leaf_hash: BytesN<32>,
}

/// Emitted when a recipient successfully claims a certificate leaf.
/// Topics: (`cert_claimed`, batch_id, recipient). Data: leaf_hash.
#[contractevent(data_format = "single-value")]
pub struct CertClaimed {
    #[topic]
    pub batch_id: u64,
    #[topic]
    pub recipient: Address,
    pub leaf_hash: BytesN<32>,
}

/// Emitted when pause state is toggled.
/// Topics: (`pause_toggled`). Data: paused.
#[contractevent(data_format = "single-value")]
pub struct PauseToggled {
    pub paused: bool,
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

fn hash_pair(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> BytesN<32> {
    let (lo, hi) = if a < b { (a, b) } else { (b, a) };
    let mut buf = Bytes::new(env);
    buf.append(&Bytes::from_slice(env, &lo.to_array()));
    buf.append(&Bytes::from_slice(env, &hi.to_array()));
    env.crypto().sha256(&buf).into()
}

fn verify_proof(env: &Env, leaf: &BytesN<32>, proof: &Vec<BytesN<32>>, root: &BytesN<32>) -> bool {
    let mut node = leaf.clone();
    for sib in proof.iter() {
        node = hash_pair(env, &node, &sib);
    }
    node == *root
}

#[contract]
pub struct ProbatumContract;

#[contractimpl]
impl ProbatumContract {
    pub fn version(_env: Env) -> u32 {
        2
    }

    /// Runs atomically at deploy time — no init front-running window.
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::BatchSeq, &0u64);
    }

    pub fn pause(env: Env, paused: bool) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &paused);
        PauseToggled { paused }.publish(&env);
        Ok(())
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn register_issuer(
        env: Env,
        issuer: Address,
        profile_hash: BytesN<32>,
    ) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        let key = DataKey::Issuer(issuer.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyRegistered);
        }
        env.storage().persistent().set(&key, &profile_hash);
        IssuerRegistered {
            issuer,
            profile_hash,
        }
        .publish(&env);
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
        IssuerRegistered {
            issuer,
            profile_hash,
        }
        .publish(&env);
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
        let seq: u64 = env
            .storage()
            .instance()
            .get(&DataKey::BatchSeq)
            .unwrap_or(0);
        let batch_id = seq + 1;
        let batch = Batch {
            issuer: issuer.clone(),
            root: root.clone(),
            meta,
            count,
            revoked: false,
            anchored_at: env.ledger().timestamp(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Batch(batch_id), &batch);
        env.storage().instance().set(&DataKey::BatchSeq, &batch_id);
        BatchAnchored {
            issuer,
            batch_id,
            root,
        }
        .publish(&env);
        Ok(batch_id)
    }

    pub fn get_batch(env: Env, batch_id: u64) -> Option<Batch> {
        env.storage().persistent().get(&DataKey::Batch(batch_id))
    }

    pub fn batch_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::BatchSeq)
            .unwrap_or(0)
    }

    pub fn revoke_batch(env: Env, issuer: Address, batch_id: u64) -> Result<(), Error> {
        require_not_paused(&env)?;
        issuer.require_auth();
        let mut batch = load_batch_checked(&env, &issuer, batch_id)?;
        batch.revoked = true;
        env.storage()
            .persistent()
            .set(&DataKey::Batch(batch_id), &batch);
        BatchRevoked { batch_id }.publish(&env);
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
        LeafRevoked {
            batch_id,
            leaf_hash,
        }
        .publish(&env);
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

    pub fn claim(
        env: Env,
        recipient: Address,
        batch_id: u64,
        leaf_hash: BytesN<32>,
        proof: Vec<BytesN<32>>,
    ) -> Result<(), Error> {
        require_not_paused(&env)?;
        recipient.require_auth();
        let batch: Batch = env
            .storage()
            .persistent()
            .get(&DataKey::Batch(batch_id))
            .ok_or(Error::BatchNotFound)?;
        if batch.revoked {
            return Err(Error::BatchRevoked);
        }
        if Self::is_leaf_revoked(env.clone(), batch_id, leaf_hash.clone()) {
            return Err(Error::LeafRevoked);
        }
        let claim_key = DataKey::Claim(batch_id, leaf_hash.clone());
        if env.storage().persistent().has(&claim_key) {
            return Err(Error::AlreadyClaimed);
        }
        if !verify_proof(&env, &leaf_hash, &proof, &batch.root) {
            return Err(Error::InvalidProof);
        }
        env.storage().persistent().set(&claim_key, &recipient);
        let claims: u64 = env
            .storage()
            .instance()
            .get(&soroban_sdk::symbol_short!("claims"))
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&soroban_sdk::symbol_short!("claims"), &(claims + 1));
        CertClaimed {
            batch_id,
            recipient,
            leaf_hash,
        }
        .publish(&env);
        Ok(())
    }

    pub fn claim_of(env: Env, batch_id: u64, leaf_hash: BytesN<32>) -> Option<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Claim(batch_id, leaf_hash))
    }

    pub fn claim_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&soroban_sdk::symbol_short!("claims"))
            .unwrap_or(0)
    }
}

mod test;
