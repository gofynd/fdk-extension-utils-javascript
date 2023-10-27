'use strict';
const { SubscriptionStatus } = require("../helpers/constants");


module.exports = (config, models) => {

    const {
        subscriptionModel,
        planModel
    } = models;

    /**
     * @param {string | number} companyId 
     * @param {undefined | *} platformClient if provided, will check for the current status of the subscription
     * @returns {Promise<Subscription | null>} Subscription object if found, null otherwise
     */
    async function getActiveSubscription(companyId, platformClient) {
        companyId = Number(companyId);
        const sellerSubscription = await subscriptionModel.getActiveSubscription(companyId);

        if (!sellerSubscription) {
            return null;
        }
        if(platformClient) {
            /**
             * @type {{
             *  _id: string,
             *  status: "active" | "pending" | "expired"
             * }}
             * There are more properties available, but we need only two here.
             * For the whole list checkout [EntitySubscription]{@link https://github.com/gofynd/fdk-client-javascript/blob/43aeeeceef69edb64fcb92db28e77b2831878efa/documentation/platform/BILLING.md#EntitySubscription }
             */
            const platformSubscriptionData = platformClient.billing.getSubscriptionCharge({
                extensionId: config.extension_id,
                subscriptionId: sellerSubscription?.toString() ?? ''
            });
            if (!platformSubscriptionData) {
                /**
                 * subscriptionId does not exist
                 */
                console.error(`Possible hack to get subscription with id ${sellerSubscription.platform_subscription_id}`)
                return null;
            }
            if (platformSubscriptionData.status === sellerSubscription.status) {
                return sellerSubscription;
            }

            /**
             * `platformSubscriptionData.status` has probably `expired`
             * change the status to whatever was sent from billing service
             */
            return await subscriptionModel.cancelSubscription(
                sellerSubscription.id,
                platformSubscriptionData.status
            )
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
            await subscriptionModel.createSubscription(
                companyId,
                planId,
                platformResponse.subscription._id
            );
        } else {
            // free plan will have 0 amount
            platformResponse = {
                subscription: {},
                confirm_url: null
            }
            await subscriptionModel.createFreeSubscription(
                companyId,
                planId
            );
        }

        return {
            platform_subscription_id: platformResponse.subscription._id,
            redirect_url: platformResponse.confirm_url
        }
    };

    /**
     * @typedef {Promise<{
     *  success: boolean,
     *  seller_subscription: null | SubscriptionSchema
     *  message: string,
     * }>} SubscriptionUpdate
     * 
     * @param {string | number} companyId 
     * @param {null | string | number} platformSubscriptionId mongoDB ObjectIdLike
     * @param {*} platformClient 
     * @returns {SubscriptionUpdate} If the subscription was updated
     */
    async function updateSubscriptionStatus(companyId, platformSubscriptionId, platformClient) {
            let success = false;
            let message = "";
            if (!platformSubscriptionId || platformSubscriptionId === 'undefined') {
                message = 'Cannot update free subscription';
                return {
                    success,
                    seller_subscription: null,
                    message,
                }
            }
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
            if (sellerSubscription.status === SubscriptionStatus.active) {
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
