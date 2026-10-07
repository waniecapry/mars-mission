"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Library = void 0;
const crypto = __importStar(require("crypto"));
const MySql = __importStar(require("mysql2/promise"));
var Library;
(function (Library) {
    Library.EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    function getStringId() {
        return crypto.randomUUID();
    }
    Library.getStringId = getStringId;
    function makeHash(text, salt) {
        return crypto.scryptSync(text, salt, 64).toString("hex");
    }
    Library.makeHash = makeHash;
    function isHashValueCorrect(text, salt, hashedValue) {
        return makeHash(text, salt) === hashedValue;
    }
    Library.isHashValueCorrect = isHashValueCorrect;
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    Library.sleep = sleep;
    class MySqlClient {
        _pool;
        constructor(host, user, password, database, port = 3306) {
            this._pool = MySql.createPool({
                host, user, password, database, port,
                waitForConnections: true,
                connectionLimit: 10,
                multipleStatements: false,
                decimalNumbers: true
            });
        }
        async connect() {
            const connection = await this._pool.getConnection();
            connection.release();
        }
        async disconnect() {
            await this._pool.end();
        }
        execute(query, values) {
            return this._pool.execute(query, values);
        }
        async withTransaction(work) {
            const connection = await this._pool.getConnection();
            try {
                await connection.beginTransaction();
                const result = await work(connection);
                await connection.commit();
                return result;
            }
            catch (error) {
                await connection.rollback();
                throw error;
            }
            finally {
                connection.release();
            }
        }
    }
    Library.MySqlClient = MySqlClient;
    class Error extends globalThis.Error {
        status;
        static status = {
            logicError: 400,
            badRequest: 400,
            unauthorized: 401,
            forbidden: 403,
            notFound: 404,
            methodNotAllowed: 405,
            requestTimeout: 408,
            conflict: 409,
            gone: 410,
            payloadTooLarge: 413,
            unsupportedMediaType: 415,
            unprocessableContent: 422,
            tooManyRequests: 429,
            internalError: 500,
            notImplemented: 501,
            badGateway: 502,
            serviceUnavailable: 503,
            gatewayTimeout: 504
        };
        static makeAux(e) {
            if (e instanceof Error)
                return e.toAux();
            else if (e instanceof globalThis.Error)
                return {
                    message: e.message,
                    stack: e.stack
                };
            return {
                message: e.toString()
            };
        }
        constructor(message, status) {
            super(message);
            this.status = status;
        }
        toAux() {
            return { message: this.message, status: this.status, stack: this.stack };
        }
    }
    Library.Error = Error;
})(Library || (exports.Library = Library = {}));
