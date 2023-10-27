'use strict';

const { Schema, Types } = require("mongoose");
const ObjectId = Types.ObjectId;
const deepExtend = require("deep-extend");
const { omit } = require("../../helpers/common");
const Subscription = require("../entities/subscription");
const BaseSubscriptionModel = require("../base-models/base_subscription_model");
const { SubscriptionStatus } = require("../../helpers/constants");

const schema = new Schema({
    company_id: {
        type: Number,
        required: true,
        immutable: true
    },
    status: {
        type: String,
        required: true,
        enum: Object.values(SubscriptionStatus)
    },
    /**
     * ObjectID returned from platform after subscription
     * will be empty for free subscription
     */
    platform_subscription_id: {
        type: ObjectId,
    },
    plan_id: {
        type: ObjectId,
        required: true
    },
    activated_on: {
        type: Date
    },
    cancelled_on: {
        type: Date
    },
    meta: {
        type: Object
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

class SubscriptionModel extends BaseSubscriptionModel{
    constructor(connection, collectionName) {
        super(connection, collectionName);

        this.model = connection.model(collectionName, schema, collectionName);
    }

    async getActiveSubscription(companyId) {
        const dbSubscription = await this.model.findOne({ company_id: companyId, status: SubscriptionStatus.active });
        if(!dbSubscription) {
            return dbSubscription;
        }
        return new Subscription(dbSubscription.toObject());
    }

    async getSubscriptionById(subscriptionId) {
        const dbSubscription = await this.model.findOne({ _id: subscriptionId });
        if(!dbSubscription) {
            return dbSubscription;
        }
        return new Subscription(dbSubscription.toObject());
    }

    async getSubscriptionByPlatformId(platformSubscriptionId, companyId) {
        const dbSubscription = await this.model.findOne({ platform_subscription_id: platformSubscriptionId, company_id: companyId });
        if(!dbSubscription) {
            return dbSubscription;
        }
        return new Subscription(dbSubscription.toObject());
    }

    async createSubscription(companyId, planId, platformSubscriptionId) {
        return new Subscription (await this.model.create({
            company_id: companyId,
            plan_id: planId,
            status: SubscriptionStatus.pending,
            platform_subscription_id: new ObjectId(platformSubscriptionId)
        }));
    }

    async createFreeSubscription(companyId, planId) {
        return new Subscription (await this.model.create({
            company_id: companyId,
            status: SubscriptionStatus.active,
            plan_id: planId,
        }));
    }

    async updateSubscription(subscription) {
        const dbSubscription = await this.model.findOne({
            company_id: subscription.company_id,
            platform_subscription_id: new ObjectId(subscription.platform_subscription_id) 
        });
        deepExtend(dbSubscription, omit(subscription, ["company_id", "platform_subscription_id"]));
        await dbSubscription.save();
        return new Subscription(dbSubscription.toObject())
    }

    async removeSubscription(subscriptionId) {
        const dbSubscription = await this.model.findByIdAndDelete(new ObjectId(subscriptionId));
        return new Subscription(dbSubscription.toObject());
    }

    async activateSubscription(subscriptionId, platformSubscriptionId) {
        const dbSubscription = await this.model.findOne({ _id: new ObjectId(subscriptionId) });
        dbSubscription.status = SubscriptionStatus.active;
        dbSubscription.platform_subscription_id = platformSubscriptionId;
        dbSubscription.activated_on = (new Date()).toISOString();
        await dbSubscription.save();
        return new Subscription(dbSubscription.toObject());
    }

    /**
     * Sets the existing subscription `status` to `cancelled` or `expired`
     * @param {string | number | Types.ObjectId} subscriptionId 
     * @param {undefined | 'expired' | 'cancelled'} status if `status` is undefined, the default value is `cancelled`
     * @returns {Subscription} Subscription Object
     */
    async cancelSubscription(subscriptionId, status = SubscriptionStatus.cancelled) {
        const dbSubscription = await this.model.findOne({ _id: new ObjectId(subscriptionId) })
        dbSubscription.status = status;
        dbSubscription.cancelled_on = (new Date()).toISOString();
        await dbSubscription.save();
        return new Subscription(dbSubscription.toObject());
    }
}

module.exports = SubscriptionModel;
