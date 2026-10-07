import { resolve } from "node:path";
import dotenv from "dotenv";
import { Library } from "./Library";
import { Actor } from "./Actor";
import { Tier } from "./Tier";

export namespace Center
{
    let _mysqlClient: Library.MySqlClient | null = null;

    export async function initialise(): Promise<void>
    {
        dotenv.config( { path: resolve( __dirname, "../data.env" ) } );

        const host: string | undefined = process.env.DB_HOST;
        const user: string | undefined = process.env.DB_USER;
        const database: string | undefined = process.env.DB_NAME;
    
        if( !host || !user || !database )
            throw new Library.Error( "DB_HOST, DB_USER, and DB_NAME must be configured" , Library.Error.status.internalError );

        const port = Number( process.env.DB_PORT ?? 3306 );
    
        if( !Number.isInteger( port ) || port < 1 || port > 65535 )
            throw new Library.Error( "DB_PORT must be a valid port" , Library.Error.status.internalError );

        const client: Library.MySqlClient = new Library.MySqlClient( host, user, process.env.DB_PASSWORD ?? "", database, port );
    
        await client.connect();

        _mysqlClient = client;

        await Tier.initialise();
        await Actor.initialise();
    }
    export function getMySqlClient(): Library.MySqlClient
    {
        if( !_mysqlClient )
            throw new Library.Error( "MySQL client has not been initialised" , Library.Error.status.internalError );

        return _mysqlClient;
    }
}