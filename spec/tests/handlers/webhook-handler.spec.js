'use strict';

const fdkBillingHelper = require("../../helpers/fdk_billing");
const { clearData } = require("../../helpers/setup_db");
const subscriptionFixture = require("../../fixtures/subscription");
const ObjectId = require("mongoose").Types.ObjectId;
const payloadFixture = require("../../fixtures/payload");
const { webhookHandler } = require("../../../handlers/webhook-handler"); 

describe("Webhook handlers", () => {

    beforeEach(async () => {
        this.fdk_billing_instance = await fdkBillingHelper();
    });

    afterEach(async () => {
        await clearData();
    });

    it("Update Subscription status by webook handler", async () => {

        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "pending",
            plan_id: new ObjectId(),
            platform_subscription_id: payloadFixture._id
        });

        const data = await this.fdk_billing_instance.webhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", payloadFixture, subscriptionFixture.company_id);

        expect(data.success).toBeTrue()
        expect(data.seller_subscription.platform_subscription_id).toBe(payloadFixture._id);
        expect(data.seller_subscription.status).toBe("active");
        expect(data.message).toBeTruthy();
    });

    it("Declined subscription status by webook handler", async () => {

        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "pending",
            plan_id: new ObjectId(),
            platform_subscription_id: payloadFixture._id
        });

        payloadFixture.status = "declined";

        const data = await this.fdk_billing_instance.webhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", payloadFixture, subscriptionFixture.company_id);

        expect(data.success).toBeTrue()
        expect(data.seller_subscription.platform_subscription_id).toBe(payloadFixture._id);
        expect(data.seller_subscription.status).toBe("declined");
        expect(data.message).toBeTruthy();
    });

    it("Cancelled subscription status by webook handler", async () => {

        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "active",
            plan_id: new ObjectId(),
            platform_subscription_id: payloadFixture._id
        });

        payloadFixture.status = "cancelled";

        const data = await this.fdk_billing_instance.webhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", payloadFixture, subscriptionFixture.company_id);

        expect(data.success).toBeTrue()
        expect(data.seller_subscription.platform_subscription_id).toBe(payloadFixture._id);
        expect(data.seller_subscription.status).toBe("cancelled");
        expect(data.message).toBeTruthy();
    });

    it("Update Subscription status: Not found by subscription id", async () => {

        const platformId = new ObjectId();
        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "pending",
            plan_id: new ObjectId(),
            platform_subscription_id: platformId
        });

        const data = await this.fdk_billing_instance.webhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", payloadFixture, subscriptionFixture.company_id);
    
        expect(data.success).toBeFalse()
        expect(data.seller_subscription).toBeNull();
        expect(data.message).toBeTruthy();
    });

    it("already existing Subscription", async () => {

        await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "pending",
            plan_id: new ObjectId(),
            platform_subscription_id: payloadFixture._id
        });

        await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "active",
            plan_id: new ObjectId(),
            platform_subscription_id: payloadFixture._id
        });

        payloadFixture.status = "active";
        const data = await this.fdk_billing_instance.webhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", payloadFixture, subscriptionFixture.company_id);
        
        expect(data.success).toBeTrue()
        expect(data.message).toBeTruthy();
        expect(data.seller_subscription.platform_subscription_id).toBe(payloadFixture._id);
    });
});