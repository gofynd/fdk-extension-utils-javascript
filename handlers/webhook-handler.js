'use strict';
class WebhookHandler {
    constructor(models) {
        this.models = models;
    }

    static instance = null;

    static getInstance(models) {
        if (!WebhookHandler.instance) {
            WebhookHandler.instance = new WebhookHandler(models);
        }
        return WebhookHandler.instance
    }

    static async handleExtensionSubscriptionUpdate(eventName, body, companyId) {
        companyId = Number(companyId);
        const { payload } = body;
        const sellerSubscription = await WebhookHandler.instance.models.subscriptionModel.getSubscriptionByPlatformId(payload._id, companyId);
        const existingSubscription = await WebhookHandler.instance.models.subscriptionModel.getActiveSubscription(companyId);
        if (!sellerSubscription) {
            throw new Error(`Subscription not found with id ${payload._id}`);
        }
    
        let currentStatus = sellerSubscription.status;
        sellerSubscription.status = payload.status;
        
        if (currentStatus === 'pending' && sellerSubscription.status === 'active' ) {
            await WebhookHandler.instance.models.subscriptionModel.activateSubscription(sellerSubscription.id, sellerSubscription.platform_subscription_id);
            if (existingSubscription && existingSubscription.id.toString() !== sellerSubscription.id.toString()) {
                await WebhookHandler.instance.models.subscriptionModel.cancelSubscription(existingSubscription.id);
            }
        } else if (currentStatus === 'pending' && sellerSubscription.status === 'declined') {
            await WebhookHandler.instance.models.subscriptionModel.removeSubscription(sellerSubscription.id);
        } else if (currentStatus === 'active' && sellerSubscription.status === 'cancelled') {
            await WebhookHandler.instance.models.subscriptionModel.updateSubscription(sellerSubscription);
        }
    };
}

module.exports = {
    WebhookHandler
}