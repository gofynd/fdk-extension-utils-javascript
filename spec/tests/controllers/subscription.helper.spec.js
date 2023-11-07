'use strict';

const fdkBillingHelper = require("../../helpers/fdk_billing");
const { clearData } = require("../../helpers/setup_db");
const planFixture = require("../../fixtures/plan");
const subscriptionFixture = require("../../fixtures/subscription");
const ObjectId = require("mongoose").Types.ObjectId;
const { SubscriptionStatus } = require("../../../helpers/constants");

describe("Subscription helper", () => {
    
    const platformClientMock = {
        billing: {
            createSubscriptionCharge: async ()=>{},
            getSubscriptionCharge: async ()=>{}
        }
    }

    beforeEach(async () => {
        this.fdk_billing_instance = await fdkBillingHelper();
    });

    afterEach(async () => {
        await clearData();
    });

    it("Get active plans", async () => {
        await this.fdk_billing_instance.planModel.model.create({
            ...planFixture
        });
        const data = await this.fdk_billing_instance.getActivePlans();
        expect(data.plans.length).toBeGreaterThan(0);
    });

    it("Get active plans: Skip company specific plans", async () => {
        await this.fdk_billing_instance.planModel.model.create({
            ...planFixture,
            company_id: [1]
        });
        const data = await this.fdk_billing_instance.getActivePlans();
        expect(data.plans.length).toBe(0);
    });

    it("Subscribe to one of plans", async () => {
        const dbPlan = await this.fdk_billing_instance.planModel.model.create({
            ...planFixture
        });
        const platformId = new ObjectId()
        const createChargeSpy = spyOn(platformClientMock.billing, "createSubscriptionCharge").and.returnValue({
            "subscription": {
                "_id": platformId,
                "status": SubscriptionStatus.pending,
            },
            "confirm_url": "test_url"
        });
        const data = await this.fdk_billing_instance.subscribePlan(1, dbPlan._id.toString(), platformClientMock);
        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.findOne({});

        const argsObj = createChargeSpy.calls.mostRecent().args[0];
        expect(data.platform_subscription_id).toBe(platformId);
        expect(data.redirect_url).toBe("test_url");
        expect(dbSubscription._id).toBeTruthy();
        expect(dbSubscription.status).toBe(SubscriptionStatus.pending);
        expect(argsObj.extensionId).toBe("API_KEY");
        expect(argsObj.body.line_items.length).toBe(1);
        expect(argsObj.body.line_items[0].name).toBe(dbPlan.name);
    });

    it("Update Subscription status", async () => {
        const platformId = new ObjectId();
        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: SubscriptionStatus.pending,
            plan_id: new ObjectId(),
            platform_subscription_id: platformId
        });
        const getChargeSpy = spyOn(platformClientMock.billing, "getSubscriptionCharge").and.returnValue({
                "_id": platformId,
                "status": SubscriptionStatus.active
        });
        const data = await this.fdk_billing_instance.updateSubscriptionStatus(1, dbSubscription.platform_subscription_id.toString(), platformClientMock);

        const argsObj = getChargeSpy.calls.mostRecent().args[0];
        expect(data.success).toBeTrue()
        expect(data.seller_subscription.platform_subscription_id).toBe(platformId.toString());
        expect(data.seller_subscription.status).toBe(SubscriptionStatus.active);
        expect(data.message).toBeTruthy();
        expect(argsObj.extensionId).toBe("API_KEY");
    });

    it("Update Subscription status: Not found by subscription id", async () => {
        const platformId = new ObjectId();
        await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: SubscriptionStatus.pending,
            plan_id: new ObjectId(),
        });
        const data = await this.fdk_billing_instance.updateSubscriptionStatus(1, platformId.toString(), platformClientMock);
        const getChargeSpy = spyOn(platformClientMock.billing, "getSubscriptionCharge").and.returnValue(null);

        expect(data.success).toBeFalse()
        expect(data.seller_subscription).toBeNull();
        expect(data.message).toBeTruthy();
        expect(getChargeSpy).toHaveBeenCalledTimes(0);
    });

    it("Update Subscription status: Not found on platform subscription", async () => {
        const platformId = new ObjectId();
        await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: SubscriptionStatus.pending,
            plan_id: new ObjectId(),
            platform_subscription_id: platformId
        });
        const data = await this.fdk_billing_instance.updateSubscriptionStatus(1, platformId.toString(), platformClientMock);
        const getChargeSpy = spyOn(platformClientMock.billing, "getSubscriptionCharge");

        expect(data.success).toBeFalse()
        expect(data.seller_subscription).toBeTruthy();
        expect(data.message).toBeTruthy();
        expect(getChargeSpy).toHaveBeenCalledTimes(0);
    });

    it("Update new and Cancel existing subscription status", async () => {
        let oldSubscription = await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            plan_id: new ObjectId()
        });

        const platformId = new ObjectId();
        const subscription = await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: SubscriptionStatus.pending,
            plan_id: new ObjectId(),
            platform_subscription_id: platformId
        });
        const getChargeSpy = spyOn(platformClientMock.billing, "getSubscriptionCharge").and.returnValue({
            "_id": platformId,
            "status": SubscriptionStatus.active
        });

        const data = await this.fdk_billing_instance.updateSubscriptionStatus(1, platformId.toString(), platformClientMock);

        oldSubscription = await this.fdk_billing_instance.subscriptionModel.model.findById(oldSubscription._id);
        
        expect(data.success).toBeTrue()
        expect(data.seller_subscription.id).toBe(subscription._id.toString());
        expect(data.seller_subscription.status).toBe(SubscriptionStatus.active);
        expect(data.message).toBeTruthy();
        expect(oldSubscription.status).toBe(SubscriptionStatus.cancelled);
        expect(getChargeSpy).toHaveBeenCalled();
    });

    it("Update Subscription status: Declined by user", async () => {

        const platformId = new ObjectId();
        await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            status: SubscriptionStatus.pending,
            plan_id: new ObjectId(),
            platform_subscription_id: platformId
        });
        const getChargeSpy = spyOn(platformClientMock.billing, "getSubscriptionCharge").and.returnValue({
            "_id": platformId,
            "status": SubscriptionStatus.cancelled,
        });

        const data = await this.fdk_billing_instance.updateSubscriptionStatus(1, platformId.toString(), platformClientMock);
        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.findOne({_id: platformId});
        expect(data.success).toBeFalse()
        expect(data.seller_subscription).toBeTruthy();
        expect(getChargeSpy).toHaveBeenCalled();
        expect(dbSubscription).toBeNull();
    });

    it("Get active subscription", async () => {

        const platformId = new ObjectId();
        const dbSubscription = await this.fdk_billing_instance.subscriptionModel.model.create({
            ...subscriptionFixture,
            plan_id: new ObjectId(),
            platform_subscription_id: platformId
        });
        const data = await this.fdk_billing_instance.getActiveSubscription(1);
        expect(dbSubscription._id.toString()).toBe(data.id);
        expect(data.platform_subscription_id).toBe(platformId.toString());
        expect(data.status).toBe(SubscriptionStatus.active);
    });

    it("Get active subscription: No active subscription", async () => {
        const data = await this.fdk_billing_instance.getActiveSubscription(1);
        expect(data).toBeNull();
    });

});
