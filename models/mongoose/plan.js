'use strict';

const deepExtend = require("deep-extend");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const BasePlanModel = require("../base-models/base_plan_model");
const Plan = require("../entities/plan");
const { PlanInterval, PricingType } = require("../../helpers/constants");

const schema = new mongoose.Schema({
    name: {
        type: String
    },
    tagline: {
        type: String
    },
    company_id: {
        type: [Number],
        required: false
    },
    is_active: {
        type: Boolean,
        default: true
    },
    price: {
        amount: Number,
        currency: {
            type: String,
            default: "INR"
        }
    },
    features: [String],
    pricing_type: {
        type: String,
        default: 'recurring',
        enums: Object.values(PricingType)
    },
    interval: {
        type: String,
        enums: Object.values(PlanInterval)
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

class PlanModel extends BasePlanModel {
    constructor(connection, collectionName) {
        super(connection, collectionName);

        this.model = connection.model(collectionName, schema, collectionName);
    }

    async getActivePlans(companyId) {
        const query = { is_active: true };
        if (companyId) {
            query.company_id = companyId;
        }
        else {
            query.$or = [{"company_id": {"$exists": false}}, {"company_id": []}];
        }
        const dbPlans = await this.model.find(query).lean();
        return dbPlans.map(plan=>new Plan(plan));
    }

    async getPlanById(planId) {
        const dbPlan = await this.model.findOne({ _id: new ObjectId(planId)});
        if(!dbPlan) {
            return dbPlan;
        }
        return new Plan(dbPlan.toObject());
    }

    async createPlan(planData) {
        return new Plan(await this.model.create(planData));
    }

    async updatePlan(planId, planData) {
        const dbPlan = await this.model.findOne({ _id: new ObjectId(planId) });
        deepExtend(dbPlan, planData);
        await dbPlan.save();
        return new Plan(dbPlan.toObject());
    }
}

module.exports = PlanModel;
