"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Resource = exports.Resource$Status = void 0;
const Library_1 = require("./Library");
const Center_1 = require("./Center");
const Tier_1 = require("./Tier");
var Resource$Status;
(function (Resource$Status) {
    Resource$Status[Resource$Status["Inactive"] = 0] = "Inactive";
    Resource$Status[Resource$Status["Active"] = 1] = "Active";
})(Resource$Status || (exports.Resource$Status = Resource$Status = {}));
class Resource {
    static resourcesByMinimumTier = new Map();
    static async initialise() {
        const [rows] = await Center_1.Center.getMySqlClient().execute("SELECT id, type, status, name, description, minimumTier FROM Resource ORDER BY minimumTier, name, id", []);
        if (!Array.isArray(rows))
            throw new Library_1.Library.Error("Expected resource rows from the database", Library_1.Library.Error.status.internalError);
        const resourcesByMinimumTier = new Map();
        rows.map(row => {
            const minimumTier = Tier_1.Tier.tiers.get(row.minimumTier);
            if (!minimumTier)
                throw new Library_1.Library.Error(`Unexpected resource tier: ${row.minimumTier}`, Library_1.Library.Error.status.internalError);
            if (row.status !== Resource$Status.Inactive && row.status !== Resource$Status.Active)
                throw new Library_1.Library.Error(`Invalid resource status: ${row.status}`, Library_1.Library.Error.status.internalError);
            if (!resourcesByMinimumTier.has(minimumTier.level))
                resourcesByMinimumTier.set(minimumTier.level, new Set());
            resourcesByMinimumTier.get(minimumTier.level).add(new Resource(row.id, row.type, row.status, row.name, row.description, minimumTier));
        });
        Resource.resourcesByMinimumTier.clear();
        for (const [level, resources] of resourcesByMinimumTier)
            Resource.resourcesByMinimumTier.set(level, resources);
    }
    _id;
    _type;
    _status;
    _name;
    _description;
    _minimumTier;
    constructor(id, type, status, name, description, minimumTier) {
        this._id = id;
        this._type = type;
        this._status = status;
        this._name = name;
        this._description = description;
        this._minimumTier = minimumTier;
    }
    get id() {
        return this._id;
    }
    get type() {
        return this._type;
    }
    get status() {
        return this._status;
    }
    get name() {
        return this._name;
    }
    get description() {
        return this._description;
    }
    get minimumTier() {
        return this._minimumTier;
    }
    toAux(caller) {
        if (!caller.hasPermission(this))
            throw new Library_1.Library.Error("Caller does not have permission to access this resource", Library_1.Library.Error.status.unauthorized);
        return {
            id: this._id,
            type: this._type,
            status: this._status,
            name: this._name,
            description: this._description,
            minimumTier: this._minimumTier.level
        };
    }
}
exports.Resource = Resource;
