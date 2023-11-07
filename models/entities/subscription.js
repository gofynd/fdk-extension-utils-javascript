const Joi = require("joi");
const { EntityCastError } = require("../../helpers/errors");

const subscriptionSchema = Joi.object().keys({
    id: Joi.string().required(), 
    company_id: Joi.number(),
    status: Joi.string().required(), 
    plan_id: Joi.string().required(), 
    platform_subscription_id: Joi.string().required(), 
    activated_on: Joi.string(), 
    cancelled_on: Joi.string(), 
    created_at: Joi.string().required(),
    updated_at: Joi.string().required(),
    meta: Joi.object(),
});

class Subscription {
    constructor(obj) {
        this.id = (obj.id || obj._id).toString();
        this.company_id = obj.company_id;
        this.status = obj.status;
        this.plan_id = obj.plan_id.toString();
        this.platform_subscription_id = obj.platform_subscription_id?.toString();
        this.activated_on = obj.activated_on instanceof Date? obj.activated_on.toISOString(): obj.activated_on;
        this.cancelled_on = obj.cancelled_on instanceof Date? obj.cancelled_on.toISOString(): obj.cancelled_on;
        this.created_at = obj.created_at instanceof Date? obj.created_at.toISOString(): obj.created_at;
        this.updated_at = obj.updated_at instanceof Date? obj.updated_at.toISOString(): obj.updated_at;
        this.meta = obj.meta;
        this.validate();
    }
    validate() {
        const validateResult = subscriptionSchema.validate(this);
        if (validateResult.error) {
            throw new EntityCastError(validateResult.error)
        }
    }
}

module.exports = Subscription;
