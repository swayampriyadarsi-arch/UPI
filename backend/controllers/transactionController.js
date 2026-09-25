const Transaction = require('../models/Transaction');

/**
 * GET /api/transactions
 * Returns the 20 most recent transactions.
 * Mirrors Java ApiController.listTransactions() → txRepo.findTop20ByOrderByIdDesc()
 */
async function listTransactions(req, res, next) {
  try {
    const txs = await Transaction.find()
      .sort({ _id: -1 })
      .limit(20)
      .lean({ getters: true });

    const result = txs.map((t) => ({
      id: t._id.toString(),
      packetHash: t.packetHash,
      senderVpa: t.senderVpa,
      receiverVpa: t.receiverVpa,
      amount: parseFloat(t.amount ? t.amount.toString() : '0'),
      signedAt: t.signedAt,
      settledAt: t.settledAt,
      bridgeNodeId: t.bridgeNodeId,
      hopCount: t.hopCount,
      status: t.status,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { listTransactions };
