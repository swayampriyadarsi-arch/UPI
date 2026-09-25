const mongoose = require('mongoose');

/**
 * Transaction — permanent, immutable record of every settled (or rejected) payment.
 *
 * Mirrors Java Transaction.java exactly:
 *   - packetHash is the idempotency key, enforced unique at DB level (defense-in-depth
 *     if the in-memory idempotency cache is cleared or the process restarts)
 *   - signedAt / settledAt are stored as Date (equivalent to Java's Instant)
 *   - status is either SETTLED or REJECTED
 *
 * Once a Transaction document is written it is NEVER modified.
 */
const transactionSchema = new mongoose.Schema(
  {
    packetHash: {
      type: String,
      required: true,
      unique: true,       // DB-level uniqueness — same as @Index(unique=true) in Java
      length: 64,         // SHA-256 hex is always 64 chars
      index: true,
    },
    senderVpa: {
      type: String,
      required: true,
    },
    receiverVpa: {
      type: String,
      required: true,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => v ? parseFloat(v.toString()) : 0,
    },
    signedAt: {
      type: Date,
      required: true,
    },
    settledAt: {
      type: Date,
      required: true,
    },
    bridgeNodeId: {
      type: String,
      required: true,
    },
    hopCount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['SETTLED', 'REJECTED'],
      required: true,
    },
  },
  {
    timestamps: false,    // we manage signedAt/settledAt manually
    toJSON: {
      getters: true,
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);
