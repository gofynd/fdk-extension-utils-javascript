'use strict';

module.exports = (config, models) => {

    const {
        subscriptionModel,
        planModel
    } = models;

    async function getActiveSubscription(companyId) {
        companyId = Number(companyId);
        const sellerSubscription = await subscriptionModel.getActiveSubscription(companyId);

        if (!sellerSubscription) {
            return null;
        }
        return sellerSubscription;
    };

    async function subscribePlan(companyId, planId, platformClient, callbackUrl) {
        companyId = Number(companyId);
        const plan = await planModel.getPlanById(planId);
        if (!plan) {
            throw new Error(`plan not found for planID ${planId}`);
        }
        let platformResponse;
        if (plan.price?.amount >= 1) {
            // billing service expects amount to be at least 1
            platformResponse = await platformClient.billing.createSubscriptionCharge({
                extensionId: config.extension_id,
                body: {
                    name: plan.name,
                    line_items: [
                        {
                            name: plan.name,
                            term: plan.tagline,
                            price: {
                                amount: plan.price.amount,
                                currency_code: plan.price.currency
                            },
                            pricing_type: plan.pricing_type || 'recurring',
                            recurring: {
                                interval: plan.interval
                            }
                        }
                    ],
                    return_url: callbackUrl
                }
            });
        } else {
            // free plan will have 0 amount
            platformResponse = {
                subscription: {
                    _id: null
                },
                confirm_url: null
            }
        }

        await subscriptionModel.createSubscription(
            companyId,
            planId,
            platformResponse.subscription._id
        );
        return {
            platform_subscription_id: response.subscription._id,
            redirect_url: platformResponse.confirm_url
        }
    };

    async function updateSubscriptionStatus(companyId, platformSubscriptionId, platformClient) {
            let success = false;
            let message = "";
            companyId = Number(companyId);
            const sellerSubscription = await subscriptionModel.getSubscriptionByPlatformId(platformSubscriptionId, companyId);
            const existingSubscription = await subscriptionModel.getActiveSubscription(companyId);
            if (!sellerSubscription) {
                return {
                    success: success,
                    seller_subscription: sellerSubscription,
                    message: `Subscription not found with id ${platformSubscriptionId}`
                }
            }
            const platformSubscriptionData = await platformClient.billing.getSubscriptionCharge({
                "extensionId": config.extension_id,
                "subscriptionId": sellerSubscription.platform_subscription_id.toString()
            });
            if (!platformSubscriptionData) {
                return {
                    success: success,
                    seller_subscription: sellerSubscription,
                    message: `Subscription not found on Fynd Platform with id ${platformSubscriptionId}`
                }
            }
            sellerSubscription.status = platformSubscriptionData.status;
            if (sellerSubscription.status === 'active') {
                await subscriptionModel.activateSubscription(sellerSubscription.id, sellerSubscription.platform_subscription_id);
                if (existingSubscription) {
                    await subscriptionModel.cancelSubscription(existingSubscription.id);
                }
                success = true;
                message = "Subscription activated";
            }
            else {
                // for now remove subscription entry as it was not accepted
                await subscriptionModel.removeSubscription(sellerSubscription.id);
                message = "Subscription request is declined by user";
            }
            return {
                success: success,
                seller_subscription: sellerSubscription,
                message: message
            };
    };

    async function getActivePlans(companyId) {
        const plans = await planModel.getActivePlans(companyId);
        return { 
            plans: plans 
        };
    }

    return {
        getActivePlans,
        subscribePlan,
        getActiveSubscription,
        updateSubscriptionStatus
    };
};
