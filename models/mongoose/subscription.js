'use strict';

const { Schema, Types } = require("mongoose");
const ObjectId = Types.ObjectId;
const deepExtend = require("deep-extend");
const { omit } = require("../../helpers/common");
const Subscription = require("../entities/subscription");
const BaseSubscriptionModel = require("../base-models/base_subscription_model");

const schema = new Schema({
    company_id: {
        type: Number,
        required: true,
        immutable: true
    },
    status: {
        type: String,
        required: true,
        enum: ["pending", "active", "cancelled"]
    },
    platform_subscription_id: {
        type: ObjectId,
        required: true
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
        const dbSubscription = await this.model.findOne({ company_id: companyId, status: "active" });
        if(!dbSubscription) {
            return dbSubscription;
        }
        return new Subscription(dbSubscription.toObject());
    }

    async getSubscriptionById(subscriptionId) {
        const dbSubscription = await this.model.findOne({ _id: ObjectId(subscriptionId) });
        if(!dbSubscription) {
            return dbSubscription;
        }
        return new Subscription(dbSubscription.toObject());
    }

    async getSubscriptionByPlatformId(platformSubscriptionId, companyId) {
        const dbSubscription = await this.model.findOne({ platform_subscription_id: ObjectId(platformSubscriptionId), company_id: companyId });
        if(!dbSubscription) {
            return dbSubscription;
        }
        return new Subscription(dbSubscription.toObject());
    }

    async createSubscription(companyId, planId, platformSubscriptionId) {
        return new Subscription (await this.model.create({
            company_id: companyId,
            plan_id: planId,
            status: 'pending',
            platform_subscription_id: ObjectId(platformSubscriptionId)
        }));
    }

    async updateSubscription(subscription) {
        const dbSubscription = await this.model.findOne({ company_id: subscription.company_id, platform_subscription_id: ObjectId(subscription.platform_subscription_id) });
        deepExtend(dbSubscription, omit(subscription, ["company_id", "platform_subscription_id"]));
        await dbSubscription.save();
        return new Subscription(dbSubscription.toObject())
    }

    async removeSubscription(subscriptionId) {
        const dbSubscription = await this.model.findOne({ _id: ObjectId(subscriptionId) });
        await dbSubscription.remove();
        return new Subscription(dbSubscription.toObject());
    }

    async activateSubscription(subscriptionId, platformSubscriptionId) {
        const dbSubscription = await this.model.findOne({ _id: ObjectId(subscriptionId) });
        dbSubscription.status = 'active';
        dbSubscription.platform_subscription_id = platformSubscriptionId;
        dbSubscription.activated_on = (new Date()).toISOString();
        await dbSubscription.save();
        return new Subscription(dbSubscription.toObject());
    }

    async cancelSubscription(subscriptionId) {
        const dbSubscription = await this.model.findOne({ _id: ObjectId(subscriptionId) })
        dbSubscription.status = 'cancelled';
        dbSubscription.cancelled_on = (new Date()).toISOString();
        await dbSubscription.save();
        return new Subscription(dbSubscription.toObject());
    }
}

module.exports = SubscriptionModel;