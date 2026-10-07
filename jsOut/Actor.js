"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Actor$Crew = exports.Actor$Passenger = exports.Actor = exports.Actor$Role = void 0;
const crypto_1 = require("crypto");
const Library_1 = require("./Library");
const Center_1 = require("./Center");
const Tier_1 = require("./Tier");
var Actor$Role;
(function (Actor$Role) {
    Actor$Role[Actor$Role["crew"] = 0] = "crew";
    Actor$Role[Actor$Role["passenger"] = 1] = "passenger";
})(Actor$Role || (exports.Actor$Role = Actor$Role = {}));
class Actor {
    static _pendingCrewCreations = 0;
    _id;
    _name;
    _role;
    _email;
    _password;
    _salt;
    static async initialise() {
        const [rows] = await Center_1.Center.getMySqlClient().execute("SELECT Actor.*, Actor$Passenger.tier FROM Actor LEFT JOIN Actor$Passenger ON Actor$Passenger.id = Actor.id", []);
        rows.map((row) => {
            if (row.role === Actor$Role.crew) {
                if (Actor$Crew.members.size === 3) {
                    Actor$Crew.members.clear();
                    throw new Library_1.Library.Error("Cannot have more than 3 crew members", Library_1.Library.Error.status.internalError);
                }
                Actor$Crew.members.set(row.id, new Actor$Crew(row.id, row.name, row.email, row.salt, row.password));
            }
            else if (row.role === Actor$Role.passenger) {
                const tier = Tier_1.Tier.tiers.get(row.tier);
                if (!tier)
                    throw new Library_1.Library.Error("Passenger has invalid tier", Library_1.Library.Error.status.internalError);
                Actor$Passenger.members.set(row.id, new Actor$Passenger(row.id, row.name, row.email, row.salt, row.password, tier));
            }
            else
                throw new Library_1.Library.Error("Actor has invalid role", Library_1.Library.Error.status.internalError);
        });
    }
    static async create(caller, role, name, email, password, tier) {
        if (!(caller instanceof Actor$Crew))
            throw new Library_1.Library.Error("Only crew members can create other actors", Library_1.Library.Error.status.unauthorized);
        const normalizedEmail = email.toLowerCase().trim();
        if (!Library_1.Library.EMAIL_REGEX.test(normalizedEmail))
            throw new Library_1.Library.Error("Invalid email address", Library_1.Library.Error.status.internalError);
        if (role === Actor$Role.passenger) {
            if (!tier)
                throw new Library_1.Library.Error("Passenger must have a tier", Library_1.Library.Error.status.internalError);
            const salt = (0, crypto_1.randomBytes)(16).toString("hex");
            const pass = Library_1.Library.makeHash(password.trim(), salt);
            const passengerAux = { id: Library_1.Library.getStringId(), role, name: name.trim(), email: normalizedEmail, tier: tier.level };
            await Center_1.Center.getMySqlClient().withTransaction(async (connection) => {
                await connection.execute("INSERT INTO Actor (id, role, name, email, salt, password) VALUES (?, ?, ?, ?, ?, ?)", [passengerAux.id, passengerAux.role, passengerAux.name, normalizedEmail, salt, pass]);
                await connection.execute("INSERT INTO Actor$Passenger (id, tier) VALUES (?, ?)", [passengerAux.id, passengerAux.tier]);
            });
            Actor$Passenger.members.set(passengerAux.id, new Actor$Passenger(passengerAux.id, passengerAux.name, normalizedEmail, salt, pass, tier));
            return Actor$Passenger.members.get(passengerAux.id);
        }
        else if (role === Actor$Role.crew) {
            if (Actor$Crew.members.size + Actor._pendingCrewCreations >= 3)
                throw new Library_1.Library.Error("Cannot create more than 3 crew members", Library_1.Library.Error.status.internalError);
            ++Actor._pendingCrewCreations; // Increment pending crew creations to prevent race conditions
            try {
                const salt = (0, crypto_1.randomBytes)(16).toString("hex");
                const pass = Library_1.Library.makeHash(password.trim(), salt);
                const crewAux = { id: Library_1.Library.getStringId(), role, name: name.trim(), email: normalizedEmail };
                await Center_1.Center.getMySqlClient().execute("INSERT INTO Actor (id, role, name, email, salt, password) VALUES (?, ?, ?, ?, ?, ?)", [crewAux.id, crewAux.role, crewAux.name, normalizedEmail, salt, pass]);
                Actor$Crew.members.set(crewAux.id, new Actor$Crew(crewAux.id, crewAux.name, normalizedEmail, salt, pass));
                return Actor$Crew.members.get(crewAux.id);
            }
            finally {
                --Actor._pendingCrewCreations;
            }
        }
        throw new Library_1.Library.Error("Invalid role", Library_1.Library.Error.status.internalError);
    }
    constructor(id, name, role, email, salt, password) {
        this._id = id;
        this._name = name;
        this._role = role;
        this._email = email;
        this._salt = salt;
        this._password = password;
    }
    get id() {
        return this._id;
    }
    get name() {
        return this._name;
    }
    get role() {
        return this._role;
    }
    get email() {
        return this._email;
    }
    isValidPassword(password) {
        return Library_1.Library.isHashValueCorrect(password, this._salt, this._password);
    }
    toAux() {
        return {
            id: this._id,
            role: this._role,
            name: this._name,
            email: this._email
        };
    }
}
exports.Actor = Actor;
class Actor$Passenger extends Actor {
    static members = new Map();
    _tier;
    constructor(id, name, email, salt, password, tier) {
        super(id, name, Actor$Role.passenger, email, salt, password);
        this._tier = tier;
    }
    get tier() {
        return this._tier;
    }
    toAux() {
        return {
            ...super.toAux(),
            tier: this._tier.level
        };
    }
    hasPermission(resource) {
        return this._tier.canAccessResource(resource);
    }
    async setTier(caller, tier) {
        if (!(caller instanceof Actor$Crew))
            throw new Library_1.Library.Error("Only crew members can set passenger tiers", Library_1.Library.Error.status.unauthorized);
        await Center_1.Center.getMySqlClient().execute("UPDATE Actor$Passenger SET tier = ? WHERE id = ?;", [tier.level, this.id]);
        this._tier = tier;
    }
}
exports.Actor$Passenger = Actor$Passenger;
class Actor$Crew extends Actor {
    static members = new Map();
    constructor(id, name, email, salt, password) {
        super(id, name, Actor$Role.crew, email, salt, password);
    }
    hasPermission(resource) {
        return true;
    }
}
exports.Actor$Crew = Actor$Crew;
