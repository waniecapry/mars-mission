import { resolve } from "node:path";
import dotenv from "dotenv";
import { Library } from "./Library";
import { Actor } from "./Actor";
import { Tier, Tier$Gold, Tier$Level, Tier$Platinum, Tier$Silver } from "./Tier";

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
            throw new Error( "DB_HOST, DB_USER, and DB_NAME must be configured" );

        const port = Number( process.env.DB_PORT ?? 3306 );
    
        if( !Number.isInteger( port ) || port < 1 || port > 65535 )
            throw new Error( "DB_PORT must be a valid port" );

        const client: Library.MySqlClient = new Library.MySqlClient( host, user, process.env.DB_PASSWORD ?? "", database, port );
    
        await client.connect();

        _mysqlClient = client;

        await Tier.initialise();
        await Actor.initialise();
    }
    export function getMySqlClient(): Library.MySqlClient
    {
        if( !_mysqlClient )
            throw new Error( "MySQL client has not been initialised" );

        return _mysqlClient;
    }
}
