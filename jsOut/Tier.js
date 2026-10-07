"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tier = exports.Tier$Level = void 0;
const Center_1 = require("./Center");
const Resource_1 = require("./Resource");
var Tier$Level;
(function (Tier$Level) {
    Tier$Level[Tier$Level["Silver"] = 1] = "Silver";
    Tier$Level[Tier$Level["Gold"] = 2] = "Gold";
    Tier$Level[Tier$Level["Platinum"] = 3] = "Platinum";
})(Tier$Level || (exports.Tier$Level = Tier$Level = {}));
class Tier {
    static tiers = new Map();
    _level;
    _resources = [];
    static async initialise(client = Center_1.Center.getMySqlClient()) {
        Tier.tiers.set(Tier$Level.Silver, new Tier(Tier$Level.Silver));
        Tier.tiers.set(Tier$Level.Gold, new Tier(Tier$Level.Gold));
        Tier.tiers.set(Tier$Level.Platinum, new Tier(Tier$Level.Platinum));
    }
    constructor(level) {
        this._level = level;
    }
    get level() {
        return this._level;
    }
    getResources() {
        if (this._resources.length > 0)
            return this._resources;
        for (let i = Tier$Level.Silver; i <= this.level; ++i) {
            const tierResources = Resource_1.Resource.resourcesByMinimumTier.get(i);
            if (tierResources)
                this._resources.push(...tierResources);
        }
        return this._resources;
    }
    canAccessResource(resource) {
        return resource.minimumTier.level <= this.level;
    }
    toAux() {
        return this._level;
    }
}
exports.Tier = Tier;
