const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

/**
 * SettlementService — port of Java SettlementService.java.
 *
 * Performs the atomic debit+credit ledger update.
 *
 * Atomicity strategy:
 *   We use MongoDB sessions with multi-document transactions when available
 *   (requires replica set or mongod >= 4.0 with --replSet).
 *   For standalone development instances (no replica set), we fall back to
 *   sequential saves with the MongoDB unique index on packetHash providing
 *   defense-in-depth against duplicate settlements.
 *
 * The @Version optimistic locking from Java is replicated here by using
 * Mongoose's findOneAndUpdate with a version check (__v). If two concurrent
 * requests somehow get past the idempotency cache and attempt to debit the
 * same account, only one will succeed — the other will get a version mismatch
 * (in session mode) or a duplicate key error (on the Transaction insert).
 */
async function settle(instruction, packetHash, bridgeNodeId, hopCount) {
  // Check if MongoDB supports transactions (requires replica set)
  const supportsTransactions = mongoose.connection.readyState === 1 &&
    mongoose.connection.db.topology &&
    typeof mongoose.connection.db.topology.hasSessionSupport === 'function'
    ? mongoose.connection.db.topology.hasSessionSupport()
    : false;

  if (supportsTransactions) {
    return _settleWithSession(instruction, packetHash, bridgeNodeId, hopCount);
  } else {
    return _settleWithoutSession(instruction, packetHash, bridgeNodeId, hopCount);
  }
}

async function _settleWithSession(instruction, packetHash, bridgeNodeId, hopCount) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await _doSettle(instruction, packetHash, bridgeNodeId, hopCount, session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function _settleWithoutSession(instruction, packetHash, bridgeNodeId, hopCount) {
  return _doSettle(instruction, packetHash, bridgeNodeId, hopCount, null);
}

async function _doSettle(instruction, packetHash, bridgeNodeId, hopCount, session) {
  const opts = session ? { session } : {};

  // Validate sender
  const sender = await Account.findById(instruction.senderVpa).session(session);
  if (!sender) {
    throw new Error(`Unknown sender VPA: ${instruction.senderVpa}`);
  }

  // Validate receiver
  const receiver = await Account.findById(instruction.receiverVpa).session(session);
  if (!receiver) {
    throw new Error(`Unknown receiver VPA: ${instruction.receiverVpa}`);
  }

  const amount = parseFloat(instruction.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const senderBalance = parseFloat(sender.balance.toString());

  // Insufficient balance → record REJECTED (same as Java)
  if (senderBalance < amount) {
    console.warn(
      `[Settlement] Insufficient balance: ${sender._id} has ₹${senderBalance}, tried ₹${amount}`
    );
    return _recordRejected(instruction, packetHash, bridgeNodeId, hopCount, opts);
  }

  // Atomic debit + credit using findOneAndUpdate with version check
  const newSenderBalance = mongoose.Types.Decimal128.fromString(
    (senderBalance - amount).toFixed(2)
  );
  const newReceiverBalance = mongoose.Types.Decimal128.fromString(
    (parseFloat(receiver.balance.toString()) + amount).toFixed(2)
  );

  const updatedSender = await Account.findOneAndUpdate(
    { _id: instruction.senderVpa, __v: sender.__v },
    { $set: { balance: newSenderBalance }, $inc: { __v: 1 } },
    { new: true, ...opts }
  );

  if (!updatedSender) {
    throw new Error('Concurrent modification detected on sender account — retry');
  }

  await Account.findOneAndUpdate(
    { _id: instruction.receiverVpa },
    { $set: { balance: newReceiverBalance } },
    { new: true, ...opts }
  );

  // Record settled transaction
  const tx = new Transaction({
    packetHash,
    senderVpa: instruction.senderVpa,
    receiverVpa: instruction.receiverVpa,
    amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
    signedAt: new Date(instruction.signedAt),
    settledAt: new Date(),
    bridgeNodeId,
    hopCount,
    status: 'SETTLED',
  });

  if (session) tx.$session(session);
  await tx.save();

  console.log(
    `[Settlement] SETTLED ₹${amount} from ${instruction.senderVpa} to ${instruction.receiverVpa} ` +
    `(hash=${packetHash.substring(0, 12)}..., bridge=${bridgeNodeId}, hops=${hopCount})`
  );

  return tx;
}

async function _recordRejected(instruction, packetHash, bridgeNodeId, hopCount, opts) {
  const amount = parseFloat(instruction.amount);
  const tx = new Transaction({
    packetHash,
    senderVpa: instruction.senderVpa,
    receiverVpa: instruction.receiverVpa,
    amount: mongoose.Types.Decimal128.fromString(amount.toFixed(2)),
    signedAt: new Date(instruction.signedAt),
    settledAt: new Date(),
    bridgeNodeId,
    hopCount,
    status: 'REJECTED',
  });
  await tx.save(opts);
  return tx;
}

module.exports = { settle };
