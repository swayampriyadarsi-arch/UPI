const Account = require('../models/Account');

/**
 * GET /api/accounts
 * Returns all accounts (for the dashboard).
 * Mirrors Java ApiController.listAccounts().
 */
async function listAccounts(req, res, next) {
  try {
    const accounts = await Account.find().lean({ getters: true });
    // Remap _id → vpa for clean JSON output
    const result = accounts.map((a) => ({
      vpa: a._id,
      holderName: a.holderName,
      balance: parseFloat(a.balance ? a.balance.toString() : '0'),
    }));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { listAccounts };
