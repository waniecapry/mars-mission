"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Center = void 0;
const node_path_1 = require("node:path");
const dotenv_1 = __importDefault(require("dotenv"));
const Library_1 = require("./Library");
const Actor_1 = require("./Actor");
const Tier_1 = require("./Tier");
const Resource_1 = require("./Resource");
var Center;
(function (Center) {
    let _mysqlClient = null;
    async function initialise() {
        dotenv_1.default.config({ path: (0, node_path_1.resolve)(__dirname, "../data.env") });
        const host = process.env.DB_HOST;
        const user = process.env.DB_USER;
        const database = process.env.DB_NAME;
        if (!host || !user || !database)
            throw new Library_1.Library.Error("DB_HOST, DB_USER, and DB_NAME must be configured", Library_1.Library.Error.status.internalError);
        const port = Number(process.env.DB_PORT ?? 3306);
        if (!Number.isInteger(port) || port < 1 || port > 65535)
            throw new Library_1.Library.Error("DB_PORT must be a valid port", Library_1.Library.Error.status.internalError);
        const client = new Library_1.Library.MySqlClient(host, user, process.env.DB_PASSWORD ?? "", database, port);
        await client.connect();
        _mysqlClient = client;
        await Tier_1.Tier.initialise();
        await Resource_1.Resource.initialise();
        await Actor_1.Actor.initialise();
    }
    Center.initialise = initialise;
    function getMySqlClient() {
        if (!_mysqlClient)
            throw new Library_1.Library.Error("MySQL client has not been initialised", Library_1.Library.Error.status.internalError);
        return _mysqlClient;
    }
    Center.getMySqlClient = getMySqlClient;
    function toAux(caller) {
        const resources = [];
        for (const resourceSet of Resource_1.Resource.resourcesByMinimumTier.values())
            for (const resource of resourceSet)
                try {
                    resources.push(resource.toAux(caller));
                }
                catch (ex) {
                    console.error(ex);
                    if (ex.status === Library_1.Library.Error.status.unauthorized) {
                        // Ignore resources the caller is not authorized to access
                    }
                    else {
                        throw ex;
                    }
                }
        return {
            actor: caller.toAux(),
            resources: resources
        };
    }
    Center.toAux = toAux;
})(Center || (exports.Center = Center = {}));
