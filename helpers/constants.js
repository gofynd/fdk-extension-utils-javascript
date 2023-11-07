const OrmType = {
    MONGOOSE: "mongoose"
}

const PlanInterval = {
    MONTH: 'month',
    YEAR: 'year',
}

const PricingType = {
    RECURRING: 'recurring',
    ONE_TIME: 'one_time',
}

/**
 * @todo discuss
 * On the billing service, `status` is defined as `string` and `nullable`
 * Will this cause mongoose type issues?
 * However, we have seen only 3 status `pending`, `active`, `expired` coming from billing service 
 */
const SubscriptionStatus = {
    pending: 'pending',
    active: 'active',
    cancelled: 'cancelled',
    expired: 'expired',
}

module.exports = {
    OrmType,
    PlanInterval,
    PricingType,
    SubscriptionStatus,
}
