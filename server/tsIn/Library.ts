import * as crypto from "crypto";
import * as MySql from "mysql2/promise";

export namespace Library
{
    export type Identifier = string;
    export type UnixTime = number;
    export type Error$Aux = { message?: string; stack?: string; status?: number; };

    export const EMAIL_REGEX: RegExp = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    export function getStringId(): Identifier
    {
        return crypto.randomUUID();
    }
    export function makeHash( text: string, salt: string ): string
    {
        return crypto.scryptSync( text, salt, 64 ).toString( "hex" );
    }
    export function isHashValueCorrect( text: string, salt: string, hashedValue: string ): boolean
    {
        return makeHash( text, salt ) === hashedValue;
    }
    export function sleep( ms: UnixTime ): Promise<void>
    {
        return new Promise( resolve=>setTimeout( resolve, ms ) );
    }

    export class MySqlClient
    {
        private readonly _pool: MySql.Pool;

        public constructor( host: string, user: string, password: string, database: string, port: number = 3306 )
        {
            this._pool = MySql.createPool
            ({
                host, user, password, database, port,
                waitForConnections: true,
                connectionLimit: 10,
                multipleStatements: false,
                decimalNumbers: true
            });
        }
        public async connect(): Promise<void>
        {
            const connection: MySql.PoolConnection = await this._pool.getConnection();
    
            connection.release();
        }
        public async disconnect(): Promise<void>
        {
            await this._pool.end();
        }
        public execute( query: string, values: MySql.ExecuteValues ): Promise<[any, MySql.FieldPacket[]]>
        {
            return this._pool.execute( query, values );
        }
        public async withTransaction<T>( work: (connection: MySql.PoolConnection) => Promise<T> ): Promise<T>
        {
            const connection: MySql.PoolConnection = await this._pool.getConnection();
    
            try
            {
                await connection.beginTransaction();
    
                const result = await work( connection );
        
                await connection.commit();
    
                return result;
            }
            catch( error )
            {
                await connection.rollback();

                throw error;
            }
            finally
            {
                connection.release();
            }
        }
    }
    export class Error extends globalThis.Error
    {
        public static makeAux( e: globalThis.Error | object ): Error$Aux
        {
            if( e instanceof Error )
                return e.toAux();

            else if( e instanceof globalThis.Error )
                return {
                    message: e.message,
                    stack: e.stack
                };

            return {
                message: e.toString()
            };
        }

        public constructor( message: string, public readonly status: number )
        {
            super( message );
        }
        public toAux(): Error$Aux
        {
            return { message: this.message, status: this.status, stack: this.stack };
        }
    }
}