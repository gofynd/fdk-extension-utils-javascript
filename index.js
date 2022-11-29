const { getConnectionInstance } = require("./helpers/common");
const { OrmType } = require("./helpers/constants");
const Plan = require("./models/entities/plan");
const Subscription = require("./models/entities/subscription");
const { WebhookHandler } = require("./handlers/webhook-handler");

function setupBilling(config) {
    if(!config) {
        throw Error("Missing config for setup");
    }
    if (!config.extension_id) {
        throw Error("`extension_id` is required");
    }
    if (!config.db_connection) {
        throw Error("`db_connection` is required");
    }
    if (!config.collection_name) {
        throw Error("`collection_name` is required");
    }
    if (!config.collection_name.plan) {
        throw Error("`collection_name.plan` is required");
    }
    if (!config.collection_name.subscription) {
        throw Error("`collection_name.subscription` is required");
    }
    if (!Object.values(OrmType).includes(config.orm_type)) {
        throw Error(`\`orm_type\` value is invalid. Allowed values are: ${Object.values(OrmType).join(", ")}`);
    }
    if(!(config.db_connection instanceof getConnectionInstance(config.orm_type))) { 
        throw Error("`db_connection` object type is invalid for orm");
    }

    const models = require("./models")(config.db_connection, config.collection_name, config.orm_type);
    const { getActivePlans, subscribePlan, getActiveSubscription, updateSubscriptionStatus } = require("./controllers/subscription.helper")(config, models);
    const webhookHandler = WebhookHandler.getInstance(models);
    return {
        planModel: models.planModel,
        subscriptionModel: models.subscriptionModel,
        getActivePlans, 
        subscribePlan, 
        getActiveSubscription, 
        updateSubscriptionStatus,
        webhookHandler: webhookHandler
    }
}

module.exports = {
    setupBilling,
    OrmType,
    Plan,
    Subscription,
    WebhookHandler
}