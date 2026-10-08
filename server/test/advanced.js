const { test } = require( "node:test" );
const assert = require( "node:assert/strict" );
const { once } = require( "node:events" );
const express = require( "express" );
const session = require( "express-session" );
const { handleRequests } = require( "../jsOut/requests" );
const { Library } = require( "../jsOut/Library" );
const { Center } = require( "../jsOut/Center" );
const { Actor$Crew, Actor$Passenger } = require( "../jsOut/Actor" );
const { Resource, Resource$Status } = require( "../jsOut/Resource" );
const { Tier, Tier$Level } = require( "../jsOut/Tier" );
const { Usage, Usage$Outcome } = require( "../jsOut/Usage" );

test( "Resource use, history, reporting and crew resource management", async t=>
{
    Actor$Crew.members.clear();
    Actor$Passenger.members.clear();
    Resource.resourcesByMinimumTier.clear();
    Tier.tiers.clear();

    const silver = new Tier( Tier$Level.Silver );
    const gold = new Tier( Tier$Level.Gold );
    const platinum = new Tier( Tier$Level.Platinum );

    Tier.tiers.set( silver.level, silver );
    Tier.tiers.set( gold.level, gold );
    Tier.tiers.set( platinum.level, platinum );

    const crew = new Actor$Crew( "crew-1", "Ari", "ari@example.com", "salt", Library.makeHash( "crew-pass", "salt" ) );
    const passenger = new Actor$Passenger( "passenger-1", "Mira", "mira@example.com", "salt", Library.makeHash( "passenger-pass", "salt" ), silver );
    const otherPassenger = new Actor$Passenger( "passenger-2", "Bo", "bo@example.com", "salt", Library.makeHash( "other-pass", "salt" ), silver );

    Actor$Crew.members.set( crew.id, crew );
    Actor$Passenger.members.set( passenger.id, passenger );
    Actor$Passenger.members.set( otherPassenger.id, otherPassenger );

    const food = new Resource( "food", 0, Resource$Status.Active, "Food", "Food stations", silver );
    const cabin = new Resource( "cabin", 0, Resource$Status.Active, "Cabin", "Private cabin", gold );
    const hygiene = new Resource( "hygiene", 0, Resource$Status.Inactive, "Hygiene", "Closed", silver );

    Resource.resourcesByMinimumTier.set( silver.level, new Set([food, hygiene]) );
    Resource.resourcesByMinimumTier.set( gold.level, new Set([cabin]) );

    const records = [];
    const originalClient = Center.getMySqlClient;

    Center.getMySqlClient = ()=>(
    {
        execute: async ( query, values )=>
        {
            if( query.startsWith( "INSERT INTO Resource$Usage" ) )
            {
                const [id, passengerId, resourceId, tierAtUse, outcome, occurredAt] = values;

                records.push( { id, passengerId, resourceId, tierAtUse, outcome, occurredAt } );

                return [{ affectedRows: 1 }];
            }

            if( query.includes( "FROM Resource$Usage JOIN Resource" ) && query.includes( "WHERE passengerId" ) )
                return [records.filter( row=>row.passengerId === values[0] ).map( row=>
                ({ ...row, resourceName: Resource.getById( row.resourceId ).name }) ).reverse()];

            if( query.includes( "FROM Resource$Usage JOIN Resource" ) && query.includes( "JOIN Actor ON" ) )
                return [records.map( row=>
                ({ ...row, resourceName: Resource.getById( row.resourceId ).name, passengerName: Actor$Passenger.members.get( row.passengerId ).name }) ).reverse()];

            if( query.includes( "GROUP BY tierAtUse ORDER BY" ) )
            {
                const counts = new Map();

                for( const row of records.filter( row=>row.outcome === values[0] ) )
                    counts.set( row.tierAtUse, (counts.get( row.tierAtUse ) ?? 0) + 1 );

                return [[...counts].map( ([tier, usageCount])=>({ tier, usageCount: String( usageCount ) }) )];
            }

            if( query.includes( "GROUP BY Resource.id" ) )
            {
                const counts = new Map();

                for( const row of records.filter( row=>row.outcome === values[0] ) )
                    counts.set( row.resourceId, (counts.get( row.resourceId ) ?? 0) + 1 );

                return [[...counts].sort( (a, b)=>b[1] - a[1] ).map( ([resourceId, usageCount])=>
                ({ resourceId, resourceName: Resource.getById( resourceId ).name, usageCount: String( usageCount ) }) )];
            }

            if( query.includes( "GROUP BY tierAtUse, Resource.id" ) )
            {
                const counts = new Map();

                for( const row of records.filter( row=>row.outcome === values[0] ) )
                {
                    const key = `${row.tierAtUse}:${row.resourceId}`;

                    counts.set( key, (counts.get( key ) ?? 0) + 1 );
                }

                return [[...counts].map( ([key, usageCount])=>
                {
                    const [tier, resourceId] = key.split( ":" );

                    return { tier: Number( tier ), resourceId, resourceName: Resource.getById( resourceId ).name, usageCount: String( usageCount ) };
                })];
            }

            if( query.startsWith( "UPDATE Resource SET status" ) || query.startsWith( "INSERT INTO Resource (" ) || query.startsWith( "UPDATE Actor$Passenger SET tier" ) )
                return [{ affectedRows: 1 }];

            throw new Error( `Unexpected query: ${query}` );
        }
    });
    t.after( ()=>
    {
        Center.getMySqlClient = originalClient;
        Actor$Crew.members.clear();
        Actor$Passenger.members.clear();
        Resource.resourcesByMinimumTier.clear();
        Tier.tiers.clear();
    });

    const httpServer = new Center.HttpServer( { port: 0, sessionSecret: "test" }, "127.0.0.1", 3306, "unused", "unused", "unused" );
    const app = httpServer.app;

    app.use( express.json() );
    app.use( session( { secret: "test-session-secret-test-session-secret", resave: false, saveUninitialized: false } ) );
    handleRequests( app );
    httpServer.initEnd();

    const server = app.listen( 0, "127.0.0.1" );

    await once( server, "listening" );
    t.after( ()=>new Promise( resolve=>server.close( resolve ) ) );

    const base = `http://127.0.0.1:${server.address().port}`;

    async function request( method, path, body, cookie )
    {
        const headers = {};

        if( body !== undefined )
            headers["content-type"] = "application/json";

        if( cookie )
            headers.cookie = cookie;

        const response = await fetch( `${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify( body ) } );

        return {
            status: response.status,
            data: response.status === 204 ? null : await response.json(),
            cookie: response.headers.get( "set-cookie" )?.split( ";" )[0]
        };
    }

    assert.equal( (await request( "POST", "/i/resources/food/usage" )).status, 401 );

    const passengerLogin = await request( "POST", "/login", { email: passenger.email, password: "passenger-pass" } );
    const otherLogin = await request( "POST", "/login", { email: otherPassenger.email, password: "other-pass" } );
    const crewLogin = await request( "POST", "/login", { email: crew.email, password: "crew-pass" } );

    assert.equal( (await request( "POST", "/i/resources/food/usage", undefined, crewLogin.cookie )).status, 403 );
    assert.equal( (await request( "POST", "/i/resources/missing/usage", undefined, passengerLogin.cookie )).status, 404 );
    assert.equal( (await request( "POST", "/i/resources/cabin/usage", undefined, passengerLogin.cookie )).status, 403 );
    assert.equal( records[0].outcome, Usage$Outcome.Denied );
    assert.equal( (await request( "POST", "/i/resources/hygiene/usage", undefined, passengerLogin.cookie )).status, 409 );
    assert.equal( records[1].outcome, Usage$Outcome.Unavailable );

    const firstUse = await request( "POST", "/i/resources/food/usage", undefined, passengerLogin.cookie );

    assert.equal( firstUse.status, 201 );
    assert.equal( firstUse.data.tierAtUse, Tier$Level.Silver );
    assert.equal( firstUse.data.outcome, Usage$Outcome.Granted );
    assert.equal( records.length, 3 );

    assert.equal( (await request( "GET", "/i/usage", undefined, otherLogin.cookie )).data.length, 0 );
    assert.equal( (await request( "GET", "/i/usage", undefined, crewLogin.cookie )).status, 403 );
    assert.equal( (await request( "GET", `/i/passengers/${passenger.id}/usage`, undefined, passengerLogin.cookie )).status, 403 );
    assert.equal( (await request( "GET", "/i/passengers/missing/usage", undefined, crewLogin.cookie )).status, 404 );
    assert.equal( (await request( "GET", "/i/usage", undefined, passengerLogin.cookie )).data.length, 3 );
    assert.equal( (await request( "GET", `/i/passengers/${passenger.id}/usage`, undefined, crewLogin.cookie )).data.length, 3 );
    assert.equal( (await request( "GET", "/i/activity", undefined, passengerLogin.cookie )).status, 403 );
    assert.equal( (await request( "GET", "/i/activity", undefined, crewLogin.cookie )).data[0].passengerName, passenger.name );
    assert.equal( (await request( "GET", "/i/reports/usage", undefined, passengerLogin.cookie )).status, 403 );

    assert.equal( (await request( "POST", "/i/resources", { name: "New", description: "", minimumTier: 1 }, passengerLogin.cookie )).status, 403 );
    assert.equal( (await request( "POST", "/i/resources", { name: "", description: "", minimumTier: 1 }, crewLogin.cookie )).status, 400 );
    assert.equal( (await request( "POST", "/i/resources", { name: "New", description: "", minimumTier: 4 }, crewLogin.cookie )).status, 400 );
    assert.equal( (await request( "PATCH", "/i/resources/food/status", { status: 9 }, crewLogin.cookie )).status, 400 );
    assert.equal( (await request( "PATCH", "/i/resources/food/status", { status: 0 }, passengerLogin.cookie )).status, 403 );
    assert.equal( (await request( "PATCH", "/i/resources/missing/status", { status: 0 }, crewLogin.cookie )).status, 404 );

    const created = await request( "POST", "/i/resources", { name: "  O2 Pods  ", description: " Oxygen refills ", minimumTier: 3 }, crewLogin.cookie );

    assert.equal( created.status, 201 );
    assert.equal( created.data.name, "O2 Pods" );
    assert.equal( created.data.minimumTier, Tier$Level.Platinum );
    assert.ok( Resource.getById( created.data.id ) );
    assert.equal( (await request( "GET", "/i/resources", undefined, passengerLogin.cookie )).data.some( resource=>resource.id === created.data.id ), false );

    assert.equal( (await request( "PATCH", "/i/resources/food/status", { status: 0 }, crewLogin.cookie )).status, 200 );
    assert.equal( (await request( "GET", "/i/resources", undefined, passengerLogin.cookie )).data.some( resource=>resource.id === food.id ), false );
    assert.equal( (await request( "POST", "/i/resources/food/usage", undefined, passengerLogin.cookie )).status, 409 );
    assert.equal( (await request( "PATCH", "/i/resources/food/status", { status: 1 }, crewLogin.cookie )).status, 200 );
    assert.equal( (await request( "GET", "/i/resources", undefined, passengerLogin.cookie )).data.some( resource=>resource.id === food.id ), true );

    assert.equal( (await request( "PATCH", `/i/passengers/${passenger.id}/tier`, { tier: 2 }, crewLogin.cookie )).status, 200 );
    const secondUse = await request( "POST", "/i/resources/cabin/usage", undefined, passengerLogin.cookie );

    assert.equal( secondUse.status, 201 );
    assert.equal( secondUse.data.tierAtUse, Tier$Level.Gold );
    assert.equal( (await request( "POST", "/i/resources/food/usage", undefined, passengerLogin.cookie )).status, 201 );

    const report = await request( "GET", "/i/reports/usage", undefined, crewLogin.cookie );

    assert.equal( report.status, 200 );
    assert.deepEqual( report.data.byTier,
    [
        { tier: 1, usageCount: 1, resources: [{ resourceId: "food", resourceName: "Food", usageCount: 1 }] },
        { tier: 2, usageCount: 2, resources: [{ resourceId: "cabin", resourceName: "Cabin", usageCount: 1 }, { resourceId: "food", resourceName: "Food", usageCount: 1 }] },
        { tier: 3, usageCount: 0, resources: [] }
    ] );
    assert.deepEqual( report.data.popularResources.map( resource=>[resource.resourceName, resource.usageCount] ), [["Food", 2], ["Cabin", 1]] );
    assert.equal( (await request( "GET", "/i/usage", undefined, passengerLogin.cookie )).data.length, 6 );
});

test( "Failed database writes do not complete usage or resource changes", async t=>
{
    Resource.resourcesByMinimumTier.clear();

    const originalClient = Center.getMySqlClient;
    const failure = new Error( "database unavailable" );

    Center.getMySqlClient = ()=>({ execute: async ()=>{ throw failure; } });
    t.after( ()=>
    {
        Center.getMySqlClient = originalClient;
        Resource.resourcesByMinimumTier.clear();
    });

    const silver = new Tier( Tier$Level.Silver );
    const crew = new Actor$Crew( "crew-1", "Ari", "ari@example.com", "salt", "hash" );
    const passenger = new Actor$Passenger( "passenger-1", "Mira", "mira@example.com", "salt", "hash", silver );
    const resource = new Resource( "food", 0, Resource$Status.Active, "Food", "", silver );

    Resource.resourcesByMinimumTier.set( silver.level, new Set([resource]) );

    await assert.rejects( Usage.record( passenger, resource ), error=>error === failure );
    await assert.rejects( resource.setStatus( crew, Resource$Status.Inactive ), error=>error === failure );
    await assert.rejects( Resource.create( crew, "New", "", silver ), error=>error === failure );

    assert.equal( resource.status, Resource$Status.Active );
    assert.equal( Resource.resourcesByMinimumTier.get( silver.level ).size, 1 );
});