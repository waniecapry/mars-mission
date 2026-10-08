"use strict";

const { randomBytes, randomUUID, scryptSync } = require( "node:crypto" );
const fs = require( "node:fs/promises" );
const { createRequire } = require( "node:module" );
const { join } = require( "node:path" );

const requireFromServer = createRequire( join( __dirname, "server", "package.json" ) );
const mysql = requireFromServer( "mysql2/promise" );
const databaseName = "marsMission";
const credentialsPath = join( __dirname, "credentials.json" );
const resources = 
[
    { name: "Food Stations", minimumTier: 1, description: "Food supply stations" },
    { name: "Sleeping Pods", minimumTier: 1, description: "Sleeping pods" },
    { name: "Basic Hygiene", minimumTier: 1, description: "Basic hygiene facilities" },
    { name: "Private Cabins", minimumTier: 2, description: "Private passenger cabins" },
    { name: "Adv. Medical Bay", minimumTier: 2, description: "Advanced medical bay" },
    { name: "Luxury O2 Pods", minimumTier: 3, description: "Luxury oxygen refill pods" },
    { name: "VIP Rec Deck", minimumTier: 3, description: "VIP recreation deck" }
];

function createCredentials()
{
    const account = ( name, email, tier )=>
    ({
        name,
        email,
        password: randomBytes( 18 ).toString( "base64url" ),
        ...(tier === undefined ? {} : { tier })
    });

    return {
        crew: Array.from( { length: 3 }, ( _, index )=> account( `Crew Lead ${index + 1}`, `crew${index + 1}@spaceship-x26.local` ) ),
        passengers: 
        [
            account( "Silver Passenger", "silver@spaceship-x26.local", 1 ),
            account( "Gold Passenger", "gold@spaceship-x26.local", 2 ),
            account( "Platinum Passenger", "platinum@spaceship-x26.local", 3 )
        ]
    };
}
async function setupDatabase( options )
{
    const credentials = createCredentials();
    const connection = await mysql.createConnection( { ...options, database: databaseName } );

    try
    {
        await connection.beginTransaction();

        try
        {
            for( const member of credentials.crew )
            {
                const salt = randomBytes( 16 ).toString( "hex" );

                await connection.execute
                (
                    "INSERT INTO Actor (id, role, name, email, password, salt) VALUES (?, ?, ?, ?, ?, ?)",
                    [randomUUID(), 0, member.name, member.email, scryptSync( member.password, salt, 64 ).toString( "hex" ), salt]
                );
            }

            for( const member of credentials.passengers )
            {
                const id = randomUUID();
                const salt = randomBytes( 16 ).toString( "hex" );

                await connection.execute
                (
                    "INSERT INTO Actor (id, role, name, email, password, salt) VALUES (?, ?, ?, ?, ?, ?)",
                    [id, 1, member.name, member.email, scryptSync( member.password, salt, 64 ).toString( "hex" ), salt]
                );
                await connection.execute
                (
                    "INSERT INTO Actor$Passenger (id, tier) VALUES (?, ?)",
                    [id, member.tier]
                );
            }

            for( const resource of resources )
                await connection.execute
                (
                    "INSERT INTO Resource (id, type, status, name, description, minimumTier) VALUES (?, ?, ?, ?, ?, ?)",
                    [randomUUID(), 0, 1, resource.name, resource.description, resource.minimumTier]
                );

            await connection.commit();
        }
        catch( error )
        {
            await connection.rollback();

            throw error;
        }

        await fs.writeFile( credentialsPath, `${JSON.stringify( credentials, null, 2 )}\n`, { flag: "wx", mode: 0o600 } );

        return credentials;
    }
    finally
    {
        await connection.end();
    }
}
async function readPassword()
{
    let password = "";

    for await( const chunk of process.stdin )
        password += chunk;

    return password.replace( /\r?\n$/, "" );
}
async function main()
{
    const host = process.argv[2];
    const port = Number( process.env.MYSQL_PORT ?? 3306 );

    if( !host || !Number.isInteger( port ) || port < 1 || port > 65535 )
        throw new Error( "Usage: node setup.js <mysql-host> (optional MYSQL_USER and MYSQL_PORT environment variables)" );

    const password = await readPassword();
    const user = process.env.MYSQL_USER || "root";
    const credentials = await setupDatabase( { host, user, password, port } );

    console.log( `Added ${credentials.crew.length} Crew Leads, ${credentials.passengers.length} passengers, and ${resources.length} resources to ${databaseName}.` );
    console.log( `Login credentials are in ${credentialsPath}. Keep this file private.` );
    console.log( `Configure server/data.env with DB_HOST=${host}, DB_NAME=${databaseName}, DB_USER=${user}, and the corresponding DB_PASSWORD.` );
}

if( require.main === module )
    main().catch( error=>
    {
        console.error( error.message );
        process.exitCode = 1;
    });

module.exports = { setupDatabase, resources };