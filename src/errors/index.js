module.exports = {
    CHANGE_TRUST: {
        MALFORMED: `The input to this operation is invalid.`,
        NO_ISSUER: `The issuer of the asset cannot be found.`,
        INVALID_LIMIT: `The limit is not sufficient to hold the current balance of the trustline and still satisfy its buying 
                        liabilities.`,
        LOW_RESERVE: `This account does not have enough XLM to satisfy the minimum XLM reserve increase caused by adding a 
                        subentry and still satisfy its XLM selling liabilities. For every new trustline added to an account, 
                        the minimum reserve of XLM that account must hold increases.`,
        SELF_NOT_ALLOWED: `The source account attempted to create a trustline for itself, which is not allowed.`
    }
}