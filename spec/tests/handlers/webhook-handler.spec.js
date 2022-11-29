'use strict';

const fdkBillingHelper = require("../../helpers/fdk_billing");
const { clearData } = require("../../helpers/setup_db");
const subscriptionFixture = require("../../fixtures/subscription");
const ObjectId = require("mongoose").Types.ObjectId;
const subscriptionPayloadFixture = require("../../fixtures/subscription-payload");
const { WebhookHandler } = require("../../../handlers/webhook-handler");

describe("Subscription webhook handlers", () => {

    beforeEach(async () => {
        this.fdk_billing_instance = await fdkBillingHelper();
    });

    afterEach(async () => {
        await clearData();
    });

    it("Update Subscription status by webhook handler", async () => {

        await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "pending",
            plan_id: new ObjectId(),
            platform_subscription_id: subscriptionPayloadFixture._id
        });

        await WebhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", subscriptionPayloadFixture, subscriptionFixture.company_id);
        
        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.findOne({});

        expect(dbSubscription.platform_subscription_id.toString()).toBe(subscriptionPayloadFixture._id);
        expect(dbSubscription.status).toBe("active");
        expect(dbSubscription.company_id).toBe(1);
    });

    it("Declined subscription status by webhook handler", async () => {

        await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "pending",
            plan_id: new ObjectId(),
            platform_subscription_id: subscriptionPayloadFixture._id
        });

        await WebhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", {...subscriptionPayloadFixture, status: "declined"}, subscriptionFixture.company_id);
        
        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.findOne({platform_subscription_id: subscriptionPayloadFixture._id});
        
        expect(dbSubscription).toBeFalsy();
    });

    it("Cancelled subscription status by webhook handler", async () => {

        await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "active",
            plan_id: new ObjectId(),
            platform_subscription_id: subscriptionPayloadFixture._id
        });

        await WebhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", {...subscriptionPayloadFixture, status: "cancelled"}, subscriptionFixture.company_id);
        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.findOne({});

        expect(dbSubscription.platform_subscription_id.toString()).toBe(subscriptionPayloadFixture._id);
        expect(dbSubscription.status).toBe("cancelled");
        expect(dbSubscription.company_id).toBe(1);
    });

    it("Already existing Subscription", async () => {

        let oldSubscription =  await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "active",
            plan_id: new ObjectId(),
        });

        let newSubscription = await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: "pending",
            plan_id: new ObjectId(),
            platform_subscription_id: subscriptionPayloadFixture._id
        });

        await WebhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", subscriptionPayloadFixture, subscriptionFixture.company_id);
        oldSubscription = await this.fdk_billing_instance.subscriptionModel.model.findById(oldSubscription._id);
        newSubscription = await this.fdk_billing_instance.subscriptionModel.model.findOne({"status": "active"});

        expect(oldSubscription.status).toBe("cancelled");
        expect(newSubscription.status).toBe("active");
        expect(newSubscription.platform_subscription_id.toString()).toBe(subscriptionPayloadFixture._id);
        expect(newSubscription.company_id).toBe(1);
    });

    it("Subscription not found with id", async () => {
        let exceptionOccur = false;
        try {
            await WebhookHandler.handleExtensionSubscriptionUpdate("extension/extension-subscription", subscriptionPayloadFixture, subscriptionFixture.company_id);
        }
        catch(err) {
            exceptionOccur = true;
        }
        expect(exceptionOccur).toBeTrue();
    });
});