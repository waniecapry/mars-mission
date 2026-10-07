const { test } = require( "node:test" );
const assert = require( "node:assert/strict" );
const { Center } = require( "../jsOut/Center" );

test( "Active sessions refresh their database expiration", async ()=>
{
    const calls = [];
    const store = new Center.HttpServer$SessionStore
    ({
        execute: async ( query, values )=>
        {
            calls.push( { query, values } );
        }
    });
    const expires = new Date( Date.now() + 60_000 );

    await new Promise( (resolve, reject)=>
    {
        store.touch( "session-1", { cookie: { expires } }, error=>error ? reject( error ) : resolve() );
    });

    assert.equal( calls.length, 1 );
    assert.match( calls[0].query, /UPDATE `Session` SET expiresAt/ );
    assert.deepEqual( calls[0].values, [expires.getTime(), "session-1"] );
});
test( "Session refresh reports database errors", async ()=>
{
    const failure = new Error( "database unavailable" );
    const store = new Center.HttpServer$SessionStore
    ({
        execute: async ()=>{ throw failure; }
    });

    await assert.rejects
    (
        new Promise( (resolve, reject)=>
        {
            store.touch( "session-1", { cookie: { expires: new Date() } }, error=>error ? reject( error ) : resolve() );
        }),
        error=>error === failure
    );
});