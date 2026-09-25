const mongoose = require('mongoose');

/**
 * Account — simulated bank account / ledger entry.
 *
 * Mirrors Java Account.java:
 *   - vpa is the primary key (Virtual Payment Address, e.g. "alice@demo")
 *   - balance is stored as a Number (Mongoose Decimal128 would be pedantically correct,
 *     but for this demo Number with 2-decimal rounding is fine and simpler to serialise)
 *   - __v (Mongoose's default version key) plays the same role as JPA @Version —
 *     Mongoose uses it for optimistic concurrency on findOneAndUpdate
 *
 * The MongoDB unique constraint on _id (vpa) provides the same protection as JPA's @Id.
 */
const accountSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
      description: 'Virtual Payment Address, e.g. alice@demo',
    },
    holderName: {
      type: String,
      required: true,
      trim: true,
    },
    balance: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => v ? parseFloat(v.toString()) : 0,
    },
  },
  {
    _id: false,          // we set _id manually (vpa)
    versionKey: '__v',   // keep Mongoose optimistic lock
    toJSON: {
      getters: true,
      transform: (doc, ret) => {
        ret.vpa = ret._id;
        delete ret._id;
        return ret;
      },
    },
    toObject: { getters: true },
  }
);

// Virtual field so code can use account.vpa just like the Java model
accountSchema.virtual('vpa').get(function () {
  return this._id;
});

module.exports = mongoose.model('Account', accountSchema);
