const { describe, test } = require( "node:test" );
const assert = require( "node:assert/strict" );
const { Library } = require( "../jsOut/Library" );
const { Actor, Actor$Crew, Actor$Passenger, Actor$Role } = require( "../jsOut/Actor" );
const { Resource, Resource$Status } = require( "../jsOut/Resource" );
const { Tier, Tier$Level } = require( "../jsOut/Tier" );
const { Center } = require( "../jsOut/Center" );

function resourceRow( id, minimumTier, status = Resource$Status.Active )
{
    return { id, type: 1, status, name: id, description: `${id} description`, minimumTier };
}
function clientReturning( rows, calls = [] )
{
    return {
        execute: async ( query, values ) =>
        {
            calls.push( { query, values } );
            return [rows, []];
        }
    };
}
function crew( id="crew-1" )
{
    const member = new Actor$Crew( id, "Ari", "ari@example.com", "salt", "hash" );
    Actor$Crew.members.set( id, member );
    return member;
}
function isStatus( status )
{
    return error=>error instanceof Library.Error && error.status === status;
}
function useClient( t, client )
{
    const original = Center.getMySqlClient;
    Center.getMySqlClient = ()=>client;
    t.after( ()=>{ Center.getMySqlClient = original; } );
}
async function loadTiers( t, rows, calls = [] )
{
    Tier.tiers.clear();
    Resource.resourcesByMinimumTier.clear();
    t.after( ()=>
    {
        Tier.tiers.clear();
        Resource.resourcesByMinimumTier.clear();
    });
    useClient( t, clientReturning( rows, calls ) );
    await Tier.initialise();
    await Resource.initialise();
}

describe( "Library utilities", () =>
{
    test( "Given two ID requests, when generated, then both are distinct UUIDs", ()=>
    {
        const first = Library.getStringId();
        const second = Library.getStringId();

        assert.match( first, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i );
        assert.notEqual( first, second, "New actors and resources need distinct IDs" );
    });
    test( "Given a password and salt, when checked, then only the matching password succeeds", ()=>
    {
        const hash = Library.makeHash( "correct password", "salt-a" );

        assert.equal( Library.makeHash( "correct password", "salt-a" ), hash );
        assert.equal( Library.isHashValueCorrect( "correct password", "salt-a", hash ), true );
        assert.equal( Library.isHashValueCorrect( "wrong password", "salt-a", hash ), false );
        assert.notEqual( Library.makeHash( "correct password", "salt-b" ), hash );
    });
    test( "Given a Library error, when converted to auxiliary data, then its status is preserved", ()=>
    {
        const error = new Library.Error( "Invalid resource", Library.Error.status.badRequest );

        assert.equal( error.status, 400 );
        assert.equal( error.toAux().message, "Invalid resource" );
        assert.equal( Library.Error.makeAux( error ).status, 400 );
        assert.equal( Library.Error.makeAux( new Error( "Native error" ) ).message, "Native error" );
    });
});

describe( "Actor database loading", () =>
{
    test( "No rows leave both member maps empty", async t=>
    {
        Actor$Crew.members.clear();
        Actor$Passenger.members.clear();
        useClient( t, clientReturning( [] ) );
        await Actor.initialise();
        assert.equal( Actor$Crew.members.size, 0 );
        assert.equal( Actor$Passenger.members.size, 0 );
    });
    test( "Crew rows are available by ID", async t=>
    {
        Actor$Crew.members.clear();
        useClient( t, clientReturning( [{ id: "c1", role: Actor$Role.crew, name: "Bo", email: "bo@example.com", salt: "s", password: "h" }] ) );
        await Actor.initialise();
        assert.equal( Actor$Crew.members.get( "c1" ).name, "Bo" );
        t.after( ()=>Actor$Crew.members.clear() );
    });
    test( "Loaded passengers have a usable tier", async t=>
    {
        Actor$Passenger.members.clear();
        t.after( ()=>Actor$Passenger.members.clear() );
        await Tier.initialise( {} );
        useClient( t, clientReturning( [{ id: "p1", role: Actor$Role.passenger, name: "Mira", email: "mira@example.com", salt: "s", password: "h", tier: Tier$Level.Gold }] ) );
        await Actor.initialise();
        const loaded = Actor$Passenger.members.get( "p1" );
        assert.equal( loaded.toAux().tier, Tier$Level.Gold );
        assert.equal( loaded.hasPermission( new Resource( "r1", 1, Resource$Status.Active, "Food", "", Tier.tiers.get( Tier$Level.Silver ) ) ), true );
    });
    test( "Unknown actor roles reject loading", async t=>
    {
        useClient( t, clientReturning( [{ id: "bad", role: 9 }] ) );
        await assert.rejects( Actor.initialise(), /invalid role/ );
    });
    test( "Loading cannot accept more than three crew members", async t=>
    {
        Actor$Crew.members.clear();
        t.after( ()=>Actor$Crew.members.clear() );
        const rows = [1, 2, 3, 4].map( id=>({ id: `c${id}`, role: Actor$Role.crew, name: "Crew", email: `c${id}@example.com`, salt: "s", password: "h" }) );
        useClient( t, clientReturning( rows ) );
        await assert.rejects( Actor.initialise(), isStatus( 500 ) );
        assert.equal( Actor$Crew.members.size, 0, "Invalid database rows must not partially load the crew map" );
    });
    test( "Loading rejects an unknown passenger tier", async t=>
    {
        Actor$Passenger.members.clear();
        t.after( ()=>Actor$Passenger.members.clear() );
        await Tier.initialise( {} );
        useClient( t, clientReturning( [{ id: "p1", role: Actor$Role.passenger, name: "Mira", email: "mira@example.com", salt: "s", password: "h", tier: 4 }] ) );
        await assert.rejects( Actor.initialise(), /tier/i );
    });
});

describe( "Actor creation", () =>
{
    test( "Crew creation saves a normalized account and a password hash", async t=>
    {
        Actor$Crew.members.clear();
        const calls = [];
        useClient( t, clientReturning( [], calls ) );
        const created = await Actor.create( crew(), Actor$Role.crew, "  Bo  ", "  BO@EXAMPLE.COM  ", " launch " );
        assert.equal( created.name, "Bo" );
        assert.equal( created.email, "bo@example.com" );
        assert.equal( Actor$Crew.members.get( created.id ), created );
        assert.equal( calls.length, 1 );
        assert.match( calls[0].query, /INSERT INTO Actor \(/ );
        assert.equal( calls[0].values[1], Actor$Role.crew );
        assert.equal( calls[0].values[3], "bo@example.com" );
        assert.equal( created.isValidPassword( "launch" ), true );
        assert.notEqual( calls[0].values[5], "launch" );
        t.after( ()=>Actor$Crew.members.clear() );
    });
    test( "Passenger creation writes actor and tier in one transaction", async t=>
    {
        Actor$Crew.members.clear();
        Actor$Passenger.members.clear();
        const calls = [];
        let transactions = 0;
        useClient( t, { withTransaction: async work=>
        {
            ++transactions;
            await work( { execute: async ( query, values )=>{ calls.push( { query, values } ); } } );
        } } );
        const gold = new Tier( Tier$Level.Gold );
        const created = await Actor.create( crew(), Actor$Role.passenger, " Mira ", " MIRA@EXAMPLE.COM ", "pass", gold );
        assert.equal( transactions, 1 );
        assert.equal( calls.length, 2 );
        assert.match( calls[0].query, /INSERT INTO Actor \(/ );
        assert.match( calls[1].query, /INSERT INTO Actor\$Passenger \(/ );
        assert.deepEqual( calls[1].values, [created.id, Tier$Level.Gold] );
        assert.equal( created.tier, gold );
        assert.equal( Actor$Passenger.members.get( created.id ), created );
        t.after( ()=>( Actor$Crew.members.clear(), Actor$Passenger.members.clear() ) );
    });
    test( "Passenger caller cannot create another actor", async t=>
    {
        const calls = [];
        useClient( t, clientReturning( [], calls ) );
        const caller = new Actor$Passenger( "p1", "Mira", "mira@example.com", "s", "h", new Tier( Tier$Level.Silver ) );
        await assert.rejects( Actor.create( caller, Actor$Role.crew, "Bo", "bo@example.com", "pass" ), isStatus( 401 ) );
        assert.equal( calls.length, 0 );
    });
    test( "A fourth crew member is rejected", async t=>
    {
        Actor$Crew.members.clear();
        const calls = [];
        useClient( t, clientReturning( [], calls ) );
        const caller = crew();
        crew( "crew-2" );
        crew( "crew-3" );
        await assert.rejects( Actor.create( caller, Actor$Role.crew, "Bo", "bo@example.com", "pass" ), isStatus( 500 ) );
        assert.equal( calls.length, 0 );
        t.after( ()=>Actor$Crew.members.clear() );
    });
    test( "Concurrent crew creation cannot exceed three members", async t=>
    {
        Actor$Crew.members.clear();
        t.after( ()=>Actor$Crew.members.clear() );
        useClient( t, clientReturning( [] ) );
        const caller = crew();
        crew( "crew-2" );
        await Promise.allSettled
        ([
            Actor.create( caller, Actor$Role.crew, "Bo", "bo@example.com", "pass" ),
            Actor.create( caller, Actor$Role.crew, "Cy", "cy@example.com", "pass" )
        ]);
        assert.ok( Actor$Crew.members.size <= 3, "Crew count must remain at or below three" );
    });
    test( "Invalid email, missing passenger tier, and invalid role write nothing", async t=>
    {
        Actor$Crew.members.clear();
        const calls = [];
        useClient( t, clientReturning( [], calls ) );
        const caller = crew();
        await assert.rejects( Actor.create( caller, Actor$Role.crew, "Bo", "bad-email", "pass" ), isStatus( 500 ) );
        await assert.rejects( Actor.create( caller, Actor$Role.passenger, "Bo", "bo@example.com", "pass" ), isStatus( 500 ) );
        await assert.rejects( Actor.create( caller, 9, "Bo", "bo@example.com", "pass" ), isStatus( 500 ) );
        assert.equal( calls.length, 0 );
        t.after( ()=>Actor$Crew.members.clear() );
    });
    test( "Failed crew insert does not update the member map", async t=>
    {
        Actor$Crew.members.clear();
        t.after( ()=>Actor$Crew.members.clear() );
        const failure = new Error( "duplicate email" );
        useClient( t, { execute: async ()=>{ throw failure; } } );
        const caller = crew();
        crew( "crew-2" );
        await assert.rejects( Actor.create( caller, Actor$Role.crew, "Bo", "bo@example.com", "pass" ), error=>error === failure );
        assert.equal( Actor$Crew.members.size, 2 );
        Center.getMySqlClient = ()=>clientReturning( [] );
        await Actor.create( caller, Actor$Role.crew, "Cy", "cy@example.com", "pass" );
        assert.equal( Actor$Crew.members.size, 3, "A failed insert must free the third crew slot" );
    });
    test( "Failed passenger transaction does not update the member map", async t=>
    {
        Actor$Crew.members.clear();
        Actor$Passenger.members.clear();
        const failure = new Error( "passenger insert failed" );
        let inserts = 0;
        useClient( t, { withTransaction: async work=>work( { execute: async ()=>
        {
            if( ++inserts === 2 ) throw failure;
        } } ) } );
        await assert.rejects( Actor.create( crew(), Actor$Role.passenger, "Bo", "bo@example.com", "pass", new Tier( Tier$Level.Silver ) ), error=>error === failure );
        assert.equal( inserts, 2 );
        assert.equal( Actor$Passenger.members.size, 0 );
        t.after( ()=>( Actor$Crew.members.clear(), Actor$Passenger.members.clear() ) );
    });
});

describe( "Actors", () =>
{
    test( "Given a crew member, when read, then its role and public fields are correct", ()=>
    {
        const crew = new Actor$Crew( "crew-1", "Ari", "ari@example.com", "salt", "hash" );

        assert.equal( crew.id, "crew-1" );
        assert.equal( crew.name, "Ari" );
        assert.equal( crew.email, "ari@example.com" );
        assert.equal( crew.role, Actor$Role.crew );
        assert.deepEqual( crew.toAux(), 
        {
            id: "crew-1", role: Actor$Role.crew, name: "Ari", email: "ari@example.com"
        });
        assert.equal( "password" in crew.toAux(), false, "Public actor data must omit the password hash" );
    });
    test( "Given a passenger, when read, then its tier appears as a level", ()=>
    {
        const passenger = new Actor$Passenger(
            "passenger-1", "Mira", "mira@example.com", "salt", "hash", new Tier( Tier$Level.Gold )
        );

        assert.equal( passenger.role, Actor$Role.passenger );
        assert.equal( passenger.tier.level, Tier$Level.Gold );
        assert.deepEqual( passenger.toAux(), {
            id: "passenger-1", role: Actor$Role.passenger, name: "Mira",
            email: "mira@example.com", tier: Tier$Level.Gold
        });
        assert.equal( "password" in passenger.toAux(), false, "Public passenger data must omit the password hash" );
    });
    test( "Given a stored hash, when a crew member checks passwords, then a wrong one fails", ()=>
    {
        const salt = "crew-salt";
        const crew = new Actor$Crew(
            "crew-2", "Bo", "bo@example.com", salt, Library.makeHash( "launch", salt )
        );

        assert.equal( crew.isValidPassword( "launch" ), true );
        assert.equal( crew.isValidPassword( "land" ), false );
    });
    test( "Given Silver, Gold and Platinum passengers, when accessing resources, then minimum tiers apply", ()=>
    {
        const silverTier = new Tier( Tier$Level.Silver );
        const goldTier = new Tier( Tier$Level.Gold );
        const platinumTier = new Tier( Tier$Level.Platinum );
        const resources = [silverTier, goldTier, platinumTier].map( (tier, index)=>new Resource( `resource-${index}`, 1, Resource$Status.Active, "Resource", "Description", tier ) );
        const passengers = [silverTier, goldTier, platinumTier].map( (tier, index)=>new Actor$Passenger( `passenger-${index}`, "Name", "email@example.com", "salt", "hash", tier ) );

        assert.deepEqual( passengers.map( passenger=>resources.map( resource=>passenger.hasPermission( resource ) ) ), 
        [
            [true, false, false],
            [true, true, false],
            [true, true, true]
        ], "Each passenger may access resources at or below their tier" );
    });
    test( "Crew tier changes are written before the passenger object changes", async t=>
    {
        const member = new Actor$Passenger( "p1", "Mira", "mira@example.com", "s", "h", new Tier( Tier$Level.Silver ) );
        const gold = new Tier( Tier$Level.Gold );
        const calls = [];
        useClient( t, clientReturning( [], calls ) );
        await member.setTier( new Actor$Crew( "c1", "Ari", "ari@example.com", "s", "h" ), gold );
        assert.equal( calls.length, 1 );
        assert.match( calls[0].query, /UPDATE Actor\$Passenger SET tier/ );
        assert.deepEqual( calls[0].values, [Tier$Level.Gold, "p1"] );
        assert.equal( member.tier, gold );
        assert.equal( member.toAux().tier, Tier$Level.Gold );
    });
    test( "Failed tier updates leave the passenger at the previous tier", async t=>
    {
        const member = new Actor$Passenger( "p1", "Mira", "mira@example.com", "s", "h", new Tier( Tier$Level.Silver ) );
        const failure = new Error( "database unavailable" );
        useClient( t, { execute: async ()=>{ throw failure; } } );
        await assert.rejects( member.setTier( new Actor$Crew( "c1", "Ari", "ari@example.com", "s", "h" ), new Tier( Tier$Level.Gold ) ), error=>error === failure );
        assert.equal( member.tier.level, Tier$Level.Silver );
    });
    test( "Passengers cannot change another passenger tier", async ()=>
    {
        const member = new Actor$Passenger( "p1", "Mira", "mira@example.com", "s", "h", new Tier( Tier$Level.Silver ) );
        const caller = new Actor$Passenger( "p2", "Bo", "bo@example.com", "s", "h", new Tier( Tier$Level.Gold ) );
        await assert.rejects( member.setTier( caller, new Tier( Tier$Level.Gold ) ), isStatus( 401 ) );
        assert.equal( member.tier.level, Tier$Level.Silver );
    });
});

describe( "Resources", () =>
{
    test( "Given an active resource, when read, then its fields and auxiliary data match", ()=>
    {
        const tier = new Tier( Tier$Level.Gold );
        const resource = new Resource( "resource-1", 2, Resource$Status.Active, "Lab", "Research lab", tier );

        assert.equal( resource.id, "resource-1" );
        assert.equal( resource.type, 2 );
        assert.equal( resource.status, Resource$Status.Active );
        assert.equal( resource.name, "Lab" );
        assert.equal( resource.description, "Research lab" );
        assert.equal( resource.minimumTier, tier );
        assert.deepEqual( resource.toAux( new Actor$Crew( "crew-1", "Ari", "ari@example.com", "salt", "hash" ) ),
        {
            id: "resource-1", type: 2, status: Resource$Status.Active,
            name: "Lab", description: "Research lab", minimumTier: Tier$Level.Gold
        });
    });
    test( "Given an inactive resource, when serialized, then its inactive status is retained", ()=>
    {
        const resource = new Resource
        (
            "resource-2", 1, Resource$Status.Inactive, "Storage", "Inactive storage",
            new Tier( Tier$Level.Silver )
        );

        assert.equal( resource.status, Resource$Status.Inactive );
        assert.equal( resource.toAux( new Actor$Crew( "crew-1", "Ari", "ari@example.com", "salt", "hash" ) ).status, Resource$Status.Inactive );
    });
});

describe( "Resource loading and tier lists", () =>
{
    test( "Given zero database rows, when loaded, then all three tiers have no resources", async t=>
    {
        const calls = [];
        await loadTiers( t, [], calls );

        assert.equal( calls.length, 1, "Loading tiers should issue one resource query" );
        assert.match( calls[0].query, /FROM Resource/ );
        assert.deepEqual( calls[0].values, [] );
        assert.deepEqual( [...Tier.tiers.keys()], [Tier$Level.Silver, Tier$Level.Gold, Tier$Level.Platinum] );

        for( const tier of Tier.tiers.values() )
            assert.deepEqual( tier.getResources(), [], `Tier ${tier.level} should be empty` );
    });
    test( "Given one Silver resource, when loaded, then all tiers can list it", async t=>
    {
        await loadTiers( t, [resourceRow( "silver-1", Tier$Level.Silver )] );

        for( const tier of Tier.tiers.values() )
            assert.deepEqual( tier.getResources().map( resource=>resource.id ), ["silver-1"] );
    });
    test( "Given resources at all three levels, when loaded, then each tier lists its allowed resources", async t=>
    {
        await loadTiers
        ( 
            t, 
            [
                resourceRow( "silver-1", Tier$Level.Silver ),
                resourceRow( "gold-1", Tier$Level.Gold ),
                resourceRow( "platinum-1", Tier$Level.Platinum )
            ] 
        );

        assert.deepEqual( Tier.tiers.get( Tier$Level.Silver ).getResources().map( resource=>resource.id ), ["silver-1"] );
        assert.deepEqual( Tier.tiers.get( Tier$Level.Gold ).getResources().map( resource=>resource.id ), ["silver-1", "gold-1"] );
        assert.deepEqual( Tier.tiers.get( Tier$Level.Platinum ).getResources().map( resource=>resource.id ), ["silver-1", "gold-1", "platinum-1"] );
        assert.equal( Tier.tiers.get( 0 ), undefined, "Unknown tiers have no entry" );
    });
    test( "Given a loaded resource, when read, then it references its minimum tier object", async t=>
    {
        await loadTiers( t, [resourceRow( "gold-1", Tier$Level.Gold )] );

        const goldTier = Tier.tiers.get( Tier$Level.Gold );
        const resource = [...Resource.resourcesByMinimumTier.get( Tier$Level.Gold )][0];

        assert.equal( resource instanceof Resource, true );
        assert.equal( resource.minimumTier, goldTier );
        assert.equal( resource.toAux( new Actor$Crew( "crew-1", "Ari", "ari@example.com", "salt", "hash" ) ).minimumTier, Tier$Level.Gold );
    });
    for( const level of [0, 4] )
    {
        test( `Given invalid minimumTier ${level}, when loaded, then a server data error is raised`, async t=>
        {
            useClient( t, clientReturning( [resourceRow( "invalid-tier", level )] ) );
            await Tier.initialise();
            await assert.rejects
            (
                Resource.initialise(),
                error=>error instanceof Library.Error && error.status === 500
            );
        });
    }
    test( "Given an invalid resource status, when loaded, then a server data error is raised", async t=>
    {
        useClient( t, clientReturning( [resourceRow( "invalid-status", Tier$Level.Silver, 9 )] ) );
        await Tier.initialise();
        await assert.rejects
        (
            Resource.initialise(),
            error=>error instanceof Library.Error && error.status === 500
        );
    });
    test( "Given a non-row query result, when loaded, then a server data error is raised", async t=>
    {
        useClient( t, clientReturning( { unexpected: "result" } ) );
        await Tier.initialise();
        await assert.rejects
        (
            Resource.initialise(),
            error=>error instanceof Library.Error && error.status === 500
        );
    });
    test( "Given a database query failure, when loaded, then the failure is propagated", async t=>
    {
        const databaseError = new Error( "database unavailable" );
        useClient( t, { execute: async ()=>{ throw databaseError; } } );
        await Tier.initialise();
    
        await assert.rejects
        (
            Resource.initialise(),
            error=>error === databaseError
        );
    });
    test( "Given new database rows, when reloaded, then the tier lists are refreshed", async t=>
    {
        const rows = [resourceRow( "old", Tier$Level.Silver )];
        await loadTiers( t, rows );
        rows.splice( 0, rows.length, resourceRow( "new", Tier$Level.Platinum ) );
        await Resource.initialise();

        assert.equal( Resource.resourcesByMinimumTier.has( Tier$Level.Silver ), false );
        assert.deepEqual( [...Resource.resourcesByMinimumTier.get( Tier$Level.Platinum )].map( resource=>resource.id ), ["new"] );
    });
    test( "Given a valid load, when a later load has invalid data, then the valid tiers remain available", async t=>
    {
        const rows = [resourceRow( "working", Tier$Level.Gold )];
        await loadTiers( t, rows );
        rows.splice( 0, rows.length, resourceRow( "invalid", Tier$Level.Silver, 9 ) );

        await assert.rejects
        (
            Resource.initialise(),
            error=>error instanceof Library.Error && error.status === 500
        );
        assert.deepEqual
        (
            [...Resource.resourcesByMinimumTier.get( Tier$Level.Gold )].map( resource=>resource.id ), ["working"],
            "A failed reload should leave the previously loaded resource available"
        );
    });
});

describe( "Resource permissions and passenger discovery", () =>
{
    test( "A passenger cannot serialize a resource above their tier", () =>
    {
        const resource = new Resource( "g1", 1, Resource$Status.Active, "Cabin", "", new Tier( Tier$Level.Gold ) );
        const caller = new Actor$Passenger( "p1", "Mira", "mira@example.com", "s", "h", new Tier( Tier$Level.Silver ) );
        assert.throws( ()=>resource.toAux( caller ), isStatus( 401 ) );
    });
    test( "Center filters resources for Silver, Gold, Platinum and crew", async t=>
    {
        await loadTiers( t, [resourceRow( "s1", 1 ), resourceRow( "g1", 2 ), resourceRow( "p1", 3 )] );
        const originalLog = console.error;
        console.error = ()=>{};
        t.after( ()=>{ console.error = originalLog; } );

        for( const [level, expected] of [[1, ["s1"]], [2, ["s1", "g1"]], [3, ["s1", "g1", "p1"]]] )
        {
            const caller = new Actor$Passenger( `p${level}`, "Mira", "mira@example.com", "s", "h", new Tier( level ) );
            assert.deepEqual( Center.toAux( caller ).resources.map( item=>item.id ), expected );
        }
        assert.deepEqual( Center.toAux( new Actor$Crew( "c1", "Ari", "ari@example.com", "s", "h" ) ).resources.map( item=>item.id ), ["s1", "g1", "p1"] );
    });
});